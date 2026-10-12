// ffmpeg work that does not need Remotion: joining rendered scenes, laying the narration under
// them, and measuring what the finished picture actually does.
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fail, run} from './util.mjs';

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

// Music under a voice. The narration's timeline is known before any music is laid, so the bed is
// ducked ahead of each sentence instead of in reaction to it, and its level is set once from two
// measurements rather than by ear. The numbers are the ones to change, here and nowhere else.
export const BED = {
  under: 18, // LU the bed sits below the voice while it speaks
  gap: 10, // LU below the voice in a silence long enough to hear the music answer
  minGap: 2.0, // seconds of silence before the bed is let up at all; shorter pauses stay ducked
  early: 0.08, // the bed is already down this long before the first word
  attack: 0.3, // seconds it takes to get down
  hold: 0.25, // seconds it stays down after the last word
  release: 1.2, // seconds it takes to come back up
  floor: 16, // LU: the measured distance below which the mix is refused
  peak: -1.0, // dBTP: the loudest the finished mix may reach
};

/** Where the voice is speaking, with pauses shorter than `minGap` counted as speech. */
export const speechRegions = (clips, {minGap = BED.minGap} = {}) => {
  const regions = [];
  for (const clip of [...clips].sort((a, b) => a.start - b.start)) {
    const last = regions.at(-1);
    if (last && clip.start - last.end < minGap) last.end = Math.max(last.end, clip.start + clip.duration);
    else regions.push({start: clip.start, end: clip.start + clip.duration});
  }
  return regions;
};

/**
 * How far up the bed is at each moment, as points to draw straight lines between: 0 is ducked
 * under the voice, 1 is up in a gap. The head and tail count as gaps only when they are long enough.
 */
export const duckPoints = (regions, total, {minGap = BED.minGap, early = BED.early, attack = BED.attack, hold = BED.hold, release = BED.release} = {}) => {
  if (!regions.length) return [{t: 0, up: 1}, {t: total, up: 1}];
  const points = [];
  const head = regions[0].start >= minGap;
  points.push({t: 0, up: head ? 1 : 0});
  if (head) points.push({t: regions[0].start - early - attack, up: 1}, {t: regions[0].start - early, up: 0});
  for (let i = 0; i + 1 < regions.length; i += 1) {
    const [from, to] = [regions[i].end, regions[i + 1].start];
    points.push({t: from + hold, up: 0}, {t: from + hold + release, up: 1}, {t: to - early - attack, up: 1}, {t: to - early, up: 0});
  }
  const end = regions.at(-1).end;
  if (total - end >= minGap) points.push({t: end + hold, up: 0}, {t: end + hold + release, up: 1});
  points.push({t: total, up: points.at(-1).up});
  return points;
};

/** An ffmpeg expression in `t` that follows the points, clamped to 0–1 at either end. */
export const envelopeExpression = (points) => {
  let expression = String(points.at(-1).up);
  for (let i = points.length - 2; i >= 0; i -= 1) {
    const [a, b] = [points[i], points[i + 1]];
    const span = b.t - a.t;
    const line = span <= 0 || a.up === b.up ? String(a.up) : `${a.up}+(${(b.up - a.up).toFixed(4)})*(t-${a.t.toFixed(3)})/${span.toFixed(3)}`;
    expression = `if(lt(t,${b.t.toFixed(3)}),${line},${expression})`;
  }
  return expression;
};

/** Integrated loudness (LUFS) and true peak (dBTP) of a file, optionally over only some stretches of it. */
export const programLoudness = async (file, regions = null) => {
  const pick = regions ? `aselect='${regions.map((region) => `between(t,${region.start.toFixed(3)},${region.end.toFixed(3)})`).join('+')}',asetpts=N/SR/TB,` : '';
  const {stderr} = await run('ffmpeg', ['-v', 'info', '-nostats', '-i', file, '-vn', '-af', `${pick}ebur128=peak=true`, '-f', 'null', '-'], {capture: true});
  const summary = stderr.slice(stderr.lastIndexOf('Summary:'));
  return {
    lufs: Number.parseFloat(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1] ?? 'NaN'),
    peak: Number.parseFloat(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1] ?? 'NaN'),
  };
};

/**
 * Lay a music bed under the narration. Two copies of the bed are mixed: one shaped to stay out of
 * the voice's way (its low-mids and the 1–4 kHz band cut, its top rolled off) at the under-speech
 * level, and one untouched at the gap level; the envelope crossfades between them.
 * Returns what was measured afterwards, so the result is judged on the file and not on the settings.
 */
export const mixBed = async ({narration, bed, clips, total, under = BED.under, gap = BED.gap, output, workDir}) => {
  const regions = speechRegions(clips);
  const up = envelopeExpression(duckPoints(regions, total));
  const stem = path.join(workDir, 'bed.flac');
  const shaped = 'highpass=f=40,equalizer=f=155:t=h:w=155:g=-9,equalizer=f=2000:t=o:w=2:g=-5,lowpass=f=5000';
  const source = ['-stream_loop', '-1', '-i', bed];
  const lengthen = `aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${total.toFixed(3)}`;

  // Two measurements set the level: the voice where it speaks, and the shaped bed as it will sit under it.
  const voice = await programLoudness(narration, regions);
  const probe = path.join(workDir, 'bed-probe.flac');
  await run('ffmpeg', ['-y', '-v', 'error', ...source, '-af', `${lengthen},${shaped}`, probe], {capture: true});
  const raw = await programLoudness(probe, regions);
  const dry = await programLoudness(bed);
  if (![voice.lufs, raw.lufs, dry.lufs].every(Number.isFinite)) fail(`Could not measure loudness (voice ${voice.lufs}, bed ${dry.lufs}). Is ${bed} an audio file with sound in it?`);
  const underGain = 10 ** ((voice.lufs - under - raw.lufs) / 20);
  const gapGain = 10 ** ((voice.lufs - gap - dry.lufs) / 20);

  const fade = `afade=t=in:d=0.5,afade=t=out:st=${Math.max(0, total - 1).toFixed(3)}:d=1`;
  await run(
    'ffmpeg',
    [
      '-y', '-v', 'error', ...source, '-filter_complex',
      `[0:a]${lengthen},asplit[lo][hi];` +
        `[lo]${shaped},volume='${underGain.toFixed(5)}*(1-(${up}))':eval=frame[under];` +
        `[hi]volume='${gapGain.toFixed(5)}*(${up})':eval=frame[over];` +
        `[under][over]amix=inputs=2:normalize=0:dropout_transition=0,${fade}[out]`,
      '-map', '[out]', stem,
    ],
    {capture: true},
  );
  await run(
    'ffmpeg',
    [
      '-y', '-v', 'error', '-i', narration, '-i', stem, '-filter_complex',
      `[0:a]aresample=48000,aformat=channel_layouts=stereo[v];[v][1:a]amix=inputs=2:normalize=0:dropout_transition=0,atrim=duration=${total.toFixed(3)}[out]`,
      '-map', '[out]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', output,
    ],
    {capture: true},
  );

  const placed = await programLoudness(stem, regions);
  const mixed = await programLoudness(output);
  return {regions, voice: voice.lufs, bed: placed.lufs, distance: voice.lufs - placed.lufs, peak: mixed.peak, stem};
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

/** Where the voice stops, and for how long. */
export const silences = async (file, {minSeconds = 0.6, noise = -38} = {}) => {
  const {stderr} = await run('ffmpeg', ['-v', 'info', '-i', file, '-vn', '-af', `silencedetect=noise=${noise}dB:d=${minSeconds}`, '-f', 'null', '-'], {capture: true});
  const found = [];
  let start = null;
  for (const line of stderr.split('\n')) {
    const begin = line.match(/silence_start: (-?[\d.]+)/);
    const end = line.match(/silence_end: ([\d.]+)/);
    if (begin) start = Math.max(0, Number(begin[1]));
    if (end && start !== null) {
      found.push({start, end: Number(end[1])});
      start = null;
    }
  }
  return found;
};

/**
 * How much of the frame the drawing occupies over time: the bounding box of everything brighter than
 * the backdrop, as a share of the frame, sampled `fps` times a second. A picture that sits in one
 * corner of its panel reads as unfinished however correct it is.
 */
export const pictureFill = async (file, {fps = 2, threshold = 70} = {}) => {
  const stream = await probeStreams(file);
  const {stderr} = await run('ffmpeg', ['-hide_banner', '-i', file, '-an', '-vf', `fps=${fps},format=gray,bbox=min_val=${threshold}`, '-f', 'null', '-'], {capture: true});
  const frame = (stream?.width || 1) * (stream?.height || 1);
  return [...stderr.matchAll(/ w:(\d+) h:(\d+)/g)].map((match, index) => ({time: index / fps, share: (Number(match[1]) * Number(match[2])) / frame}));
};

/** The longest stretch, after the picture has had `settle` seconds to arrive, in which it fills less than `least` of the frame. */
export const sparseStretch = (samples, least, {settle = 1} = {}) => {
  let best = null;
  let run = null;
  for (const sample of samples) {
    if (sample.time >= settle && sample.share < least) {
      run = run ? {...run, end: sample.time, share: Math.max(run.share, sample.share)} : {start: sample.time, end: sample.time, share: sample.share};
      if (!best || run.end - run.start > best.end - best.start) best = run;
    } else run = null;
  }
  return best;
};

/**
 * How much the picture changes at each frame, compared with the frame before: the mean difference
 * in brightness over every pixel, 0 for an identical frame, 1 for black to white. `crop` keeps the
 * captions and progress bar, which always move, out of the measure.
 */
export const frameChanges = async (file, {crop = 'iw:ih*0.80:0:0'} = {}) => {
  // Each frame is laid beside the one before it (the first beside itself) and the two are
  // subtracted. ffmpeg's own `scene` score is not this: it is the smaller of the difference and
  // how much the difference itself changed, which is zero for every frame of an even fade but its
  // first, so a fade measures as one frame changing alone.
  const {stdout} = await run(
    'ffmpeg',
    [
      '-v', 'error', '-i', file, '-an', '-filter_complex',
      `[0:v]crop=${crop},split[now][held];[held]tpad=start=1:start_mode=clone[before];` +
        '[now][before]msad=shortest=1,metadata=mode=print:key=lavfi.msad.msad.Y:file=-',
      '-f', 'null', '-',
    ],
    {capture: true},
  );
  const found = [];
  let time = null;
  for (const line of stdout.split('\n')) {
    const at = line.match(/pts_time:([\d.]+)/);
    const score = line.match(/msad\.Y=([\d.]+)/);
    if (at) time = Number(at[1]);
    if (score && time !== null) found.push({time, score: Number(score[1])});
  }
  return found;
};

/** How alike two frames are inside a region: structural similarity, 1 for identical. Frames are numbered from 0. */
export const frameSimilarity = async (file, frameA, frameB, fps, crop) => {
  // Seeking lands on the first frame at or after the time asked for, so ask for half a frame early.
  const at = (frame) => String(Math.max(0, (frame - 0.5) / fps));
  const {stderr} = await run(
    'ffmpeg',
    ['-v', 'info', '-ss', at(frameA), '-i', file, '-ss', at(frameB), '-i', file, '-frames:v', '1', '-lavfi', `[0:v]crop=${crop}[a];[1:v]crop=${crop}[b];[a][b]ssim`, '-f', 'null', '-'],
    {capture: true},
  );
  return Number.parseFloat(stderr.match(/All:([\d.]+)/)?.[1] ?? 'NaN');
};

/** Seconds until anything is drawn in a region, or null if nothing is within `seconds`. */
export const firstBright = async (file, crop, {seconds = 5, fps = 10, threshold = 70} = {}) => {
  const {stdout} = await run(
    'ffmpeg',
    ['-v', 'error', '-t', String(seconds), '-i', file, '-an', '-vf', `fps=${fps},crop=${crop},format=gray,signalstats,metadata=mode=print:key=lavfi.signalstats.YMAX:file=-`, '-f', 'null', '-'],
    {capture: true},
  );
  let time = null;
  for (const line of stdout.split('\n')) {
    const at = line.match(/pts_time:([\d.]+)/);
    const value = line.match(/YMAX=([\d.]+)/);
    if (at) time = Number(at[1]);
    if (value && time !== null && Number(value[1]) > threshold) return time;
  }
  return null;
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
