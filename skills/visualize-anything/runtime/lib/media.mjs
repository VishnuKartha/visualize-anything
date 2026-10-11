// ffmpeg work that does not need Remotion: joining rendered scenes, laying the narration under
// them, and measuring what the finished picture actually does.
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {run} from './util.mjs';

/** Join per-scene video files without re-encoding. */
export const concatVideos = async (files, output, workDir) => {
  mkdirSync(workDir, {recursive: true});
  const list = path.join(workDir, 'concat.txt');
  writeFileSync(list, files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', output], {capture: true});
};

/** One narration track: every clip placed at its exact start, padded to the video's length. */
export const mixNarration = async (clips, totalSeconds, output) => {
  const inputs = clips.flatMap((clip) => ['-i', clip.file]);
  const delayed = clips.map((clip, index) => `[${index}:a]adelay=${Math.round(clip.start * 1000)}:all=1[a${index}]`);
  const mix = `${clips.map((_, index) => `[a${index}]`).join('')}amix=inputs=${clips.length}:normalize=0:dropout_transition=0,apad,atrim=duration=${totalSeconds.toFixed(3)}[out]`;
  await run(
    'ffmpeg',
    ['-y', '-v', 'error', ...inputs, '-filter_complex', [...delayed, mix].join(';'), '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', output],
    {capture: true},
  );
};

// Both streams are already cut to the video's exact length. No `-shortest`: when copying streams it
// stops at a packet boundary and can drop the last few video frames.
export const mux = (video, audio, output) =>
  run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-movflags', '+faststart', output], {capture: true});

export const probeStreams = async (file) => {
  const {stdout} = await run(
    'ffprobe',
    ['-v', 'error', '-count_packets', '-show_entries', 'stream=codec_type,nb_read_packets,duration,width,height', '-of', 'json', file],
    {capture: true},
  );
  const streams = JSON.parse(stdout).streams || [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  return {
    frames: video ? Number(video.nb_read_packets) : 0,
    width: video?.width,
    height: video?.height,
    videoSeconds: video ? Number(video.duration) : 0,
    audioSeconds: audio ? Number(audio.duration) : 0,
    hasAudio: Boolean(audio),
  };
};

export const loudness = async (file) => {
  const {stderr} = await run('ffmpeg', ['-v', 'info', '-i', file, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], {capture: true});
  const read = (name) => Number.parseFloat(stderr.match(new RegExp(`${name}: (-?[\\d.]+) dB`))?.[1] ?? 'NaN');
  return {mean: read('mean_volume'), peak: read('max_volume')};
};

/**
 * Stretches where the picture does not change. `crop` limits the look to part of the frame,
 * so captions and the progress bar, which always move, do not hide a frozen picture.
 */
export const frozenStretches = async (file, {minSeconds, crop = 'iw:ih*0.80:0:0', noise = 0.001}) => {
  // The threshold is low on purpose: a note swapping or a small label fading in changes only a
  // few percent of the frame, and a viewer still sees it as the picture moving.
  const {stderr} = await run(
    'ffmpeg',
    ['-v', 'info', '-i', file, '-an', '-vf', `crop=${crop},freezedetect=n=${noise}:d=${minSeconds}`, '-f', 'null', '-'],
    {capture: true},
  );
  const stretches = [];
  let start = null;
  for (const line of stderr.split('\n')) {
    const begin = line.match(/freeze_start: ([\d.]+)/);
    const end = line.match(/freeze_end: ([\d.]+)/);
    if (begin) start = Number(begin[1]);
    if (end && start !== null) {
      stretches.push({start, end: Number(end[1])});
      start = null;
    }
  }
  return {stretches, openStart: start};
};

/**
 * Times at which anything bright appears inside a region of a clip.
 * Used to see whether an animation draws where the captions or the scene heading will sit.
 */
export const brightIn = async (file, crop, {fps = 4, threshold = 70} = {}) => {
  const {stdout} = await run(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-an', '-vf', `fps=${fps},crop=${crop},format=gray,signalstats,metadata=mode=print:key=lavfi.signalstats.YMAX:file=-`, '-f', 'null', '-'],
    {capture: true},
  );
  const times = [];
  let time = null;
  for (const line of stdout.split('\n')) {
    const stamp = line.match(/pts_time:([\d.]+)/);
    const value = line.match(/YMAX=([\d.]+)/);
    if (stamp) time = Number(stamp[1]);
    if (value && time !== null && Number(value[1]) > threshold) times.push(time);
  }
  // Collapse sampled instants into ranges.
  const ranges = [];
  for (const instant of times) {
    const last = ranges.at(-1);
    if (last && instant - last.end <= 1.5 / fps) last.end = instant;
    else ranges.push({start: instant, end: instant});
  }
  return ranges;
};

const stamp = (seconds, separator) => {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${separator}${pad(ms % 1000, 3)}`;
};

/** Caption phrases with absolute times, as SubRip and WebVTT text. */
export const subtitleFiles = (props) => {
  const cues = [];
  for (const scene of props.scenes) {
    for (const beat of scene.beats) {
      const offset = (scene.from + beat.from) / props.fps;
      for (const phrase of beat.phrases) {
        cues.push({start: offset + phrase.start, end: offset + phrase.end, text: phrase.words.map((word) => word.text).join(' ')});
      }
    }
  }
  cues.forEach((cue, index) => {
    if (index + 1 < cues.length) cue.end = Math.min(cue.end, cues[index + 1].start);
  });
  return {
    srt: cues.map((cue, index) => `${index + 1}\n${stamp(cue.start, ',')} --> ${stamp(cue.end, ',')}\n${cue.text}\n`).join('\n'),
    vtt: `WEBVTT\n\n${cues.map((cue) => `${stamp(cue.start, '.')} --> ${stamp(cue.end, '.')}\n${cue.text}\n`).join('\n')}`,
    count: cues.length,
  };
};
