import {existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {bakeDiagram} from './bake-diagram.mjs';
import {withRenderer} from './remotion-api.mjs';
import {analyzeRouting, formatRouting} from './router.mjs';
import {HYPERFRAMES_VERSION, planCodeChange, renderComposition, writeAuthored, writeCodeChange} from './hyperframes.mjs';
import {brightIn, concatVideos, frozenStretches, loudness, mixNarration, mux, probeStreams, subtitleFiles} from './media.mjs';
import {HAS_PICTURE, buildSteps, buildTimeline, captionPhrases, loadStoryboard, loadTimeline, resolveCode, resolveVersions, speakable, withAutoCues} from './storyboard.mjs';
import {
  ARCHIFY_BIN, MANIM_UV_ARGS, RUNTIME_DIR, TYPST_SPEC, fail, ffprobeDuration, fmtSeconds, manimEnv, readJson, run, sha, writeJson,
} from './util.mjs';

const THEME = readJson(path.join(RUNTIME_DIR, 'theme.json'));
const log = (message) => console.log(message);
const warn = (warnings) => warnings.forEach((warning) => console.log(`  warning: ${warning}`));

const routingOf = (paths, storyboard) => {
  let timeline = null;
  try {
    timeline = existsSync(paths.timeline) ? readJson(paths.timeline) : null;
  } catch {
    timeline = null;
  }
  return analyzeRouting(storyboard, {timeline, projectDir: paths.dir});
};

/** Load the storyboard. Routing errors stop every build step: a misrouted scene is not worth rendering. */
const load = (paths, {gate = true} = {}) => {
  const {storyboard, warnings} = loadStoryboard(paths);
  if (gate) {
    const report = routingOf(paths, storyboard);
    if (report.errors) {
      const lines = report.rows
        .filter((row) => row.status === 'error')
        .flatMap((row) => row.reasons.filter((reason) => reason.level === 'error').map((reason) => `${row.id}: ${reason.text}`));
      fail(`Routing has ${report.errors} error(s). Run \`va route <project>\` for the full report.\n  - ${lines.join('\n  - ')}`);
    }
  }
  return {storyboard, warnings};
};

/** The settled end of a beat of a scene: the frame a recap, or the thumbnail, freezes it on. */
const shotOf = (timeline, id, beatNumber) => {
  const target = timeline.scenes.find((entry) => entry.id === id);
  if (!target) return null;
  const beat = target.beats[beatNumber ? beatNumber - 1 : target.beats.length - 1];
  // When its animation has settled, and before the scene fades.
  return {scene: id, frame: Math.max(0, Math.min(beat.cue + beat.cueFrames - 3, target.frames - 10))};
};

// A trace scene puts its animation beside the code, in a 4:3 panel on the right of the stage.
// The code gets nearly half the width: it has to be read, and a narrow panel shrinks its text.
// Even dimensions at full and half size: the video encoder refuses odd ones.
export const TRACE_CLIP = {x: 962, y: 152, width: 896, height: 672};

const pick = (scenes, kind, only) => {
  const kinds = [kind].flat();
  const wanted = scenes.filter((scene) => kinds.includes(scene.kind));
  if (!only.length) return wanted;
  const unknown = only.filter((id) => !wanted.some((scene) => scene.id === id));
  if (unknown.length) fail(`No ${kinds.join(' or ')} scene with id: ${unknown.join(', ')}.`);
  return wanted.filter((scene) => only.includes(scene.id));
};

// ---------------------------------------------------------------------------------------------
// check

/** The router's verdict on every scene, and on the sequence as a whole. */
export const route = (paths) => {
  const {storyboard} = load(paths, {gate: false});
  const report = routingOf(paths, storyboard);
  log(formatRouting(report));
  if (report.errors) process.exitCode = 1;
  return report;
};

export const check = (paths) => {
  const {storyboard, warnings} = load(paths, {gate: false});
  const counts = {};
  for (const scene of storyboard.scenes) counts[scene.kind] = (counts[scene.kind] || 0) + 1;
  const beats = storyboard.scenes.reduce((sum, scene) => sum + scene.beats.length, 0);
  const words = storyboard.scenes.reduce(
    (sum, scene) => sum + scene.beats.reduce((n, beat) => n + beat.say.split(/\s+/).length, 0),
    0,
  );
  log(`storyboard ok: ${storyboard.scenes.length} scenes (${Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(', ')}), ${beats} beats, ${words} words ≈ ${Math.round(words / 2.6)}s of narration.`);
  warn(warnings);
  log('');
  route(paths);
  return storyboard;
};

// ---------------------------------------------------------------------------------------------
// tts

export const tts = async (paths) => {
  const {storyboard, warnings} = load(paths);
  warn(warnings);
  const job = {
    voice: storyboard.voice,
    rate: storyboard.rate,
    pitch: storyboard.pitch,
    cacheDir: path.join(paths.cache, 'tts'),
    outDir: paths.audio,
    beats: storyboard.scenes.flatMap((scene) =>
      // The voice gets the spoken form; the storyboard and captions keep what was written.
      scene.beats.map((beat, index) => ({scene: scene.id, index, text: speakable(beat.say), file: `${scene.id}-${index}.mp3`})),
    ),
  };
  const jobFile = path.join(paths.cache, 'tts-job.json');
  const manifestFile = path.join(paths.cache, 'tts-manifest.json');
  writeJson(jobFile, job);
  await run('uv', ['run', '--quiet', path.join(RUNTIME_DIR, 'python', 'tts.py'), '--job', jobFile, '--manifest', manifestFile]);
  const timeline = buildTimeline(storyboard, readJson(manifestFile));
  writeJson(paths.timeline, timeline);

  log('');
  log('Time budget (seconds each visual window lasts — build visuals to these):');
  for (const scene of timeline.scenes) {
    const kind = storyboard.scenes.find((s) => s.id === scene.id).kind;
    log(`  ${scene.id}  [${kind}]  ${fmtSeconds(scene.frames / timeline.fps)}`);
    scene.beats.forEach((beat, index) => {
      const text = beat.text.length > 64 ? `${beat.text.slice(0, 61)}...` : beat.text;
      log(`    ${String(index).padStart(2)}  ${fmtSeconds(beat.cueFrames / timeline.fps).padStart(6)}  ${text}`);
    });
  }
  log(`Total: ${fmtSeconds(timeline.totalFrames / timeline.fps)} (${timeline.totalFrames} frames @ ${timeline.fps}fps) → ${path.relative(process.cwd(), paths.timeline)}`);
  return timeline;
};

// ---------------------------------------------------------------------------------------------
// diagram

const diagramAsset = (paths, scene) => path.join(paths.assets, `${scene.id}.diagram.json`);

const checkFocus = (scene, baked) => {
  const problems = [];
  scene.beats.forEach((beat, index) => {
    for (const cue of [beat, ...(beat.cues || [])]) {
      if (!Array.isArray(cue.focus)) continue;
      for (const token of cue.focus) {
        if (!baked.nodes[token] && !baked.edges[token]) problems.push(`beat ${index + 1}: "${token}"`);
      }
    }
  });
  if (problems.length) {
    fail(
      `Scene "${scene.id}": focus ids not found in the diagram: ${problems.join(', ')}.\n` +
        `  nodes: ${Object.keys(baked.nodes).join(', ')}\n  edges: ${Object.keys(baked.edges).join(', ')}`,
    );
  }
};

export const diagram = async (paths, only = [], {force = false} = {}) => {
  const {storyboard} = load(paths);
  if (!existsSync(ARCHIFY_BIN)) fail(`Archify is not installed at ${ARCHIFY_BIN}. Run \`va setup\`.`);
  for (const scene of pick(storyboard.scenes, 'diagram', only)) {
    const candidate = path.resolve(paths.dir, scene.candidate);
    if (!existsSync(candidate)) fail(`Scene "${scene.id}": write the Archify candidate at ${candidate} first.`);
    const asset = diagramAsset(paths, scene);
    const key = sha({candidate: readFileSync(candidate, 'utf8'), type: scene.type, legend: scene.legend === true, bake: 3});
    if (!force && existsSync(asset) && readJson(asset).key === key) {
      checkFocus(scene, readJson(asset));
      log(`diagram ${scene.id}: unchanged`);
      continue;
    }
    // Archify's browser evidence belongs to exact artifact bytes, so every run starts clean.
    const workDir = path.join(paths.cache, 'diagram', scene.id);
    rmSync(workDir, {recursive: true, force: true});
    mkdirSync(workDir, {recursive: true});
    const html = path.join(workDir, `${scene.id}.html`);
    const result = await run(
      process.execPath,
      [ARCHIFY_BIN, 'finalize', scene.type, candidate, html, '--quality', 'showcase', '--json'],
      {capture: true, allowFail: true},
    );
    if (result.code !== 0) {
      fail(
        `Scene "${scene.id}": archify finalize failed. Repair ${path.relative(process.cwd(), candidate)} and rerun.\n` +
          (result.stdout.trim() || result.stderr.trim()).slice(0, 6000),
      );
    }
    const baked = await bakeDiagram({htmlPath: html, sceneId: scene.id, keepLegend: scene.legend === true});
    checkFocus(scene, baked);
    writeJson(asset, {key, type: scene.type, ...baked});
    log(`diagram ${scene.id}: ok (${scene.type}, ${Math.round(baked.viewBox[2])}×${Math.round(baked.viewBox[3])} units)`);
    if (scene.build) {
      const shown = new Set();
      let all = false;
      for (const beat of scene.beats.flatMap((entry) => [entry, ...(entry.cues || [])])) {
        if (beat.focus === 'all') all = true;
        else for (const token of beat.focus || []) {
          shown.add(token);
          if (baked.edges[token]) shown.add(baked.edges[token].from).add(baked.edges[token].to);
        }
      }
      const never = Object.keys(baked.nodes).filter((id) => !shown.has(id));
      if (!all && never.length) log(`  warning: "build" is on but no beat ever reveals: ${never.join(', ')}. Focus them, or end on "focus": "all".`);
    }
    log(`  nodes: ${Object.keys(baked.nodes).join(', ')}`);
    log(`  edges: ${Object.keys(baked.edges).join(', ')}`);
  }
};

// ---------------------------------------------------------------------------------------------
// manim

const manimAsset = (paths, scene) => path.join(paths.assets, `${scene.id}.mp4`);

// Colours Manim defines that are not in the video's palette. ORANGE is absent: va_manim redefines it.
const OFF_PALETTE = /\b(?:PURE_)?(?:BLUE|RED|GREEN|YELLOW|PURPLE|PINK|TEAL|GOLD|MAROON|WHITE|BLACK|GR[AE]Y)(?:_[A-E])?\b/g;

/** Things a script does that will look out of place next to the other scenes. */
const manimTaste = (source, beside, className) => {
  const notes = [];
  // Judge the scene being rendered and the helpers above the classes, not its neighbours in the file:
  // a full-frame scene and a trace scene can share a script and have different floors.
  const blocks = source.split(/^(?=class\s+\w+)/m);
  const own = blocks.filter((block) => !/^class\s/.test(block) || new RegExp(`^class\\s+${className}\\b`).test(block)).join('\n');
  const code = own.replace(/#.*$/gm, '').replace(/"""[\s\S]*?"""/g, '');
  const theme = new Set(Object.values(THEME).filter((value) => /^#/.test(String(value))).map((value) => value.toLowerCase()));
  const foreign = [...new Set([...(code.match(OFF_PALETTE) || []), ...(code.match(/#[0-9a-fA-F]{6}\b/g) || []).filter((hex) => !theme.has(hex.toLowerCase()))])];
  if (foreign.length) notes.push(`uses colours outside the video's palette (${foreign.join(', ')}). Use the names va_manim provides (TEXT, MUTED, ACCENT, CYAN, AMBER, ROSE, VIOLET, and the state colours).`);
  // A trace panel is shown at about 60% of full-frame scale, so its text has to be set larger to read the same.
  const floor = beside ? 36 : 28;
  const small = [...new Set([...code.matchAll(/font_size\s*=\s*(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1])).filter((size) => size < floor))].sort((a, b) => a - b);
  if (small.length) notes.push(`sets text at font_size ${small.join(', ')}; below ${floor} is hard to read ${beside ? 'in a trace panel' : 'at video size'}.`);
  return notes;
};

const findRendered = (dir, className) => {
  const hits = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, {withFileTypes: true})) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'partial_movie_files') walk(full);
      } else if (entry.name === `${className}.mp4`) hits.push(full);
    }
  };
  if (existsSync(dir)) walk(dir);
  return hits[0];
};

export const manim = async (paths, only = [], {force = false, draft = false} = {}) => {
  const {storyboard} = load(paths);
  const timeline = loadTimeline(paths, storyboard);
  const scale = (draft ? 0.5 : 1) * (storyboard.width / 1920);

  for (const scene of pick(storyboard.scenes, ['manim', 'trace'], only)) {
    const beside = scene.kind === 'trace';
    const even = (value) => 2 * Math.round(value / 2);
    const width = even((beside ? TRACE_CLIP.width : 1920) * scale);
    const height = even((beside ? TRACE_CLIP.height : 1080) * scale);
    const script = path.resolve(paths.dir, scene.script);
    if (!existsSync(script)) fail(`Scene "${scene.id}": write the Manim script at ${script} first.`);
    const source = readFileSync(script, 'utf8');
    if (!new RegExp(`^class\\s+${scene.class}\\b`, 'm').test(source)) {
      fail(`Scene "${scene.id}": class ${scene.class} is not defined in ${scene.script}.`);
    }
    const timed = timeline.scenes.find((entry) => entry.id === scene.id);
    const windows = timed.beats.map((beat) => beat.cueFrames);
    const asset = manimAsset(paths, scene);
    const keyFile = `${asset}.key`;
    const helper = sha(readFileSync(path.join(RUNTIME_DIR, 'python', 'va_manim.py'), 'utf8'));
    const spoken = timed.beats.map((beat) => [beat.from, beat.words]);
    const key = sha({source, cls: scene.class, windows, spoken, width, height, fps: timeline.fps, typst: TYPST_SPEC, helper, continues: scene.continues === true});
    if (!force && existsSync(asset) && existsSync(keyFile) && readFileSync(keyFile, 'utf8') === key) {
      log(`manim ${scene.id}: unchanged`);
      continue;
    }

    const mediaDir = path.join(paths.cache, 'manim', scene.id);
    rmSync(mediaDir, {recursive: true, force: true});
    log(`manim ${scene.id}: rendering ${scene.class} at ${width}×${height}@${timeline.fps} (${fmtSeconds(timed.frames / timeline.fps)})...`);
    const result = await run(
      'uv',
      [
        'run', '--quiet', ...MANIM_UV_ARGS,
        'manim', 'render', '--resolution', `${width},${height}`, '--fps', String(timeline.fps),
        '--media_dir', mediaDir, '--format', 'mp4', '--progress_bar', 'none', '-v', 'WARNING', script, scene.class,
      ],
      {
        cwd: path.dirname(script),
        capture: true,
        allowFail: true,
        env: manimEnv({
          VA_TIMELINE: paths.timeline,
          VA_SCENE_ID: scene.id,
          VA_TYPST_CACHE: path.join(paths.cache, 'typst'),
          VA_LAYOUT: beside ? 'trace' : 'full',
          VA_CONTINUES: scene.continues === true ? '1' : '',
        }),
      },
    );
    if (result.code !== 0) {
      fail(`Scene "${scene.id}": manim failed.\n${(result.stderr || result.stdout).trim().split('\n').slice(-40).join('\n')}`);
    }
    const reported = (result.stderr + result.stdout).split('\n');
    const overruns = reported.filter((line) => line.startsWith('VA_OVERRUN'));
    const late = reported.filter((line) => line.startsWith('VA_LATE'));
    const rendered = findRendered(mediaDir, scene.class);
    if (!rendered) fail(`Scene "${scene.id}": manim finished but ${scene.class}.mp4 was not produced.`);

    // Normalize to exactly the scene's frame count: hold the last frame if short, trim if long.
    const actual = await ffprobeDuration(rendered);
    const target = timed.frames / timeline.fps;
    mkdirSync(paths.assets, {recursive: true});
    await run(
      'ffmpeg',
      [
        '-y', '-v', 'error', '-i', rendered,
        '-vf', `fps=${timeline.fps},tpad=stop_mode=clone:stop_duration=${Math.max(0, target - actual + 1).toFixed(3)}`,
        '-frames:v', String(timed.frames), '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', asset,
      ],
      {capture: true},
    );
    writeFileSync(keyFile, key);
    const drift = actual - target;
    log(`manim ${scene.id}: ok (${fmtSeconds(actual)} rendered for a ${fmtSeconds(target)} scene)`);
    if (overruns.length) {
      log(`  ${overruns.length} beat(s) ran past their narration window — shorten run_time values so the picture keeps pace with the voice:`);
      overruns.forEach((line) => log(`    ${line.replace('VA_OVERRUN ', '')}`));
    }
    for (const note of manimTaste(source, beside, scene.class)) log(`  warning: ${note}`);
    if (late.length) {
      log(`  ${late.length} word anchor(s) were reached after the word was spoken — shorten the animations before them:`);
      late.forEach((line) => log(`    ${line.replace('VA_LATE ', '')}`));
    }
    // The clip plays under the caption strip and the scene heading; see whether it draws there.
    const ranges = (list) => list.map((range) => `${range.start.toFixed(1)}–${range.end.toFixed(1)}s`).join(', ');
    const underCaptions = beside ? [] : await brightIn(asset, 'iw*0.70:ih*0.075:iw*0.15:ih*0.89');
    if (underCaptions.length) log(`  warning: draws where captions sit, at ${ranges(underCaptions)}. Keep content above SAFE_BOTTOM.`);
    if (scene.heading && !beside) {
      const underHeading = await brightIn(asset, 'iw*0.33:ih*0.05:iw*0.03:ih*0.035');
      if (underHeading.length) log(`  warning: draws under the scene heading (top left), at ${ranges(underHeading)}. Keep content below SAFE_TOP there.`);
    }
    if (drift > 0.25) log(`  warning: animation is ${fmtSeconds(drift)} longer than its narration; the end was trimmed.`);
    if (drift < -0.25) log(`  warning: animation is ${fmtSeconds(-drift)} shorter than its narration; the last frame is held. Wrap each beat in \`with self.beat(i):\`.`);
  }
};

// ---------------------------------------------------------------------------------------------
// hyperframes

/**
 * Render HyperFrames scenes to clips of their exact narration length. A scene is either code that
 * changes between versions (the built-in block, timed to the beats) or a composition you wrote.
 */
export const hyperframes = async (paths, only = [], {force = false, draft = false} = {}) => {
  const {storyboard} = load(paths);
  const timeline = loadTimeline(paths, storyboard);
  const {fps} = timeline;
  const template = sha(readFileSync(path.join(RUNTIME_DIR, 'hyperframes', 'code-change.html'), 'utf8'));

  for (const scene of pick(storyboard.scenes, 'hyperframes', only)) {
    const timed = timeline.scenes.find((entry) => entry.id === scene.id);
    const duration = timed.frames / fps;
    const asset = manimAsset(paths, scene);
    const keyFile = `${asset}.key`;
    const workDir = path.join(paths.cache, 'hyperframes', scene.id);
    const steps = buildSteps(scene, timed, fps);
    let prepare;
    let signature;

    if (scene.versions) {
      const versions = resolveVersions(scene, paths, storyboard);
      // Each time the storyboard names a different version, the code changes into it at that moment.
      const changes = [];
      steps.forEach((step, index) => {
        if (index > 0 && step.version !== steps[index - 1].version) changes.push({at: step.cue / fps, to: step.version});
      });
      const plan = await planCodeChange({
        id: scene.id,
        title: scene.title || versions[steps[0].version].title || versions.find((version) => version.title)?.title || '',
        lang: versions[0].lang,
        effect: scene.effect || 'diff',
        versions,
        initial: steps[0].version,
        changes,
        duration,
      });
      signature = {plan, template};
      prepare = () => writeCodeChange(workDir, plan);
    } else {
      const source = path.resolve(paths.dir, scene.composition);
      if (!existsSync(source)) fail(`Scene "${scene.id}": write the composition at ${source} first.`);
      // What an authored composition is told about the narration, as window.__VA, in seconds from the scene's start.
      const context = {
        id: scene.id,
        duration,
        fps,
        theme: THEME,
        beats: timed.beats.map((beat) => ({
          text: beat.text,
          start: beat.cue / fps,
          end: (beat.cue + beat.cueFrames) / fps,
          speech: beat.from / fps,
          words: beat.words.map((word) => ({text: word.text, at: Math.round((beat.from / fps + word.start) * 1000) / 1000})),
        })),
      };
      signature = {source: readFileSync(source, 'utf8'), context};
      prepare = () => writeAuthored(workDir, source, context);
    }

    const key = sha({signature, renderer: HYPERFRAMES_VERSION, fps, frames: timed.frames, draft});
    if (!force && existsSync(asset) && existsSync(keyFile) && readFileSync(keyFile, 'utf8') === key) {
      log(`hyperframes ${scene.id}: unchanged`);
      continue;
    }
    prepare();
    log(`hyperframes ${scene.id}: rendering ${scene.versions ? `${scene.effect || 'diff'} across ${scene.versions.length} versions` : path.basename(scene.composition)} (${fmtSeconds(duration)})...`);
    const raw = path.join(workDir, 'render.mp4');
    const rendered = await renderComposition(workDir, raw, fps);
    if (!rendered.ok || !existsSync(raw)) {
      fail(`Scene "${scene.id}": HyperFrames could not render it.\n${rendered.log.split('\n').slice(-30).join('\n')}`);
    }
    const actual = await ffprobeDuration(raw);
    mkdirSync(paths.assets, {recursive: true});
    await run(
      'ffmpeg',
      [
        '-y', '-v', 'error', '-i', raw,
        '-vf', `fps=${fps},tpad=stop_mode=clone:stop_duration=${Math.max(0, duration - actual + 1).toFixed(3)}${draft ? ',scale=iw/2:ih/2' : ''}`,
        '-frames:v', String(timed.frames), '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', asset,
      ],
      {capture: true},
    );
    writeFileSync(keyFile, key);
    log(`hyperframes ${scene.id}: ok (${fmtSeconds(actual)} rendered for a ${fmtSeconds(duration)} scene)`);
    if (Math.abs(actual - duration) > 0.25) log(`  warning: the composition ran ${fmtSeconds(actual)}, not the scene's ${fmtSeconds(duration)}; it was ${actual > duration ? 'trimmed' : 'held on its last frame'}.`);
    if (!scene.versions) {
      const ranges = (list) => list.map((range) => `${range.start.toFixed(1)}–${range.end.toFixed(1)}s`).join(', ');
      const underCaptions = await brightIn(asset, 'iw*0.70:ih*0.075:iw*0.15:ih*0.89');
      if (underCaptions.length) log(`  warning: draws where captions sit, at ${ranges(underCaptions)}. Keep content above y = 900 of 1080.`);
    }
  }
};

// ---------------------------------------------------------------------------------------------
// props (what Remotion renders from)

export const buildProps = async (paths) => {
  const {storyboard, warnings} = load(paths);
  warn(warnings);
  const timeline = loadTimeline(paths, storyboard);
  const {codeToTokens} = await import('shiki');
  const missing = [];
  const scenes = [];
  const autoNotes = [];

  for (const [index, authoredScene] of storyboard.scenes.entries()) {
    const timed = timeline.scenes[index];
    // What the scene shows has to be known before cues can be derived from the narration naming it.
    const resolved = authoredScene.kind === 'code' || authoredScene.kind === 'trace' ? resolveCode(authoredScene, paths, storyboard) : null;
    const baked = authoredScene.kind === 'diagram' && existsSync(diagramAsset(paths, authoredScene)) ? readJson(diagramAsset(paths, authoredScene)) : null;
    const {scene, notes} = withAutoCues(authoredScene, {baked, code: resolved});
    autoNotes.push(...notes);
    const beats = timed.beats.map((beat, beatIndex) => {
      const authored = scene.beats[beatIndex];
      if (!existsSync(path.join(paths.public, beat.audio))) missing.push(`${beat.audio} (run \`va tts\`)`);
      return {
        audio: beat.audio,
        from: beat.from,
        audioFrames: beat.audioFrames,
        phrases: captionPhrases(authored.caption, beat.words, beat.duration),
      };
    });
    const steps = buildSteps(scene, timed, timeline.fps).map(({at, ...step}) => step);
    // A scene that continues the one before it shares its picture: no fade between the two.
    const base = {
      id: scene.id,
      kind: scene.kind,
      heading: scene.heading || null,
      from: timed.from,
      frames: timed.frames,
      beats,
      steps,
      fadeIn: scene.continues !== true,
      fadeOut: storyboard.scenes[index + 1]?.continues !== true,
    };

    if (scene.kind === 'title') {
      scenes.push({...base, ambient: null});
    } else if (scene.kind === 'credit') {
      scenes.push({...base, title: scene.title, kicker: scene.kicker || null, subtitle: scene.subtitle || null});
    } else if (scene.kind === 'bullets') {
      // Each takeaway is shown beside a moment from the video: the one it names, else the last picture before the recap.
      const fallback = scene.over || storyboard.scenes.slice(0, index).findLast((entry) => HAS_PICTURE.includes(entry.kind))?.id || null;
      const shots = scene.items.map((item) => shotOf(timeline, item.from || fallback, item.from ? item.beat : null));
      scenes.push({...base, title: scene.title || null, items: scene.items.map((item) => item.text), shots});
    } else if (scene.kind === 'code' || scene.kind === 'trace') {
      if (scene.kind === 'trace' && !existsSync(manimAsset(paths, scene))) {
        missing.push(`animation for "${scene.id}" (run \`va manim\`)`);
        continue;
      }
      let tokens;
      try {
        tokens = (await codeToTokens(resolved.code, {lang: resolved.lang, theme: THEME.codeTheme})).tokens;
      } catch {
        tokens = (await codeToTokens(resolved.code, {lang: 'text', theme: THEME.codeTheme})).tokens;
      }
      scenes.push({
        ...base,
        title: resolved.title,
        lang: resolved.lang,
        startLine: resolved.startLine,
        code: tokens.map((line) => line.map((token) => ({text: token.content, color: token.color || THEME.text}))),
        ...(scene.kind === 'trace' ? {video: `assets/${scene.id}.mp4`, clip: TRACE_CLIP} : {}),
      });
    } else if (scene.kind === 'diagram') {
      if (!baked) {
        missing.push(`diagram for "${scene.id}" (run \`va diagram\`)`);
        continue;
      }
      scenes.push({
        ...base,
        diagramType: baked.type,
        build: scene.build === true,
        camera: scene.camera === 'static' ? 'static' : 'follow',
        viewBox: baked.viewBox,
        svg: baked.svg,
        nodes: baked.nodes,
        edges: baked.edges,
      });
    } else if (scene.kind === 'manim') {
      if (!existsSync(manimAsset(paths, scene))) {
        missing.push(`animation for "${scene.id}" (run \`va manim\`)`);
        continue;
      }
      scenes.push({...base, video: `assets/${scene.id}.mp4`});
    } else if (scene.kind === 'hyperframes') {
      if (!existsSync(manimAsset(paths, scene))) {
        missing.push(`clip for "${scene.id}" (run \`va hyperframes\`)`);
        continue;
      }
      scenes.push({...base, video: `assets/${scene.id}.mp4`});
    }
  }
  if (missing.length) fail(`Not ready to render. Missing:\n  - ${missing.join('\n  - ')}`);

  // The opening shows the code the video is about, faintly, behind its statement.
  const firstCode = scenes.find((scene) => Array.isArray(scene.code))?.code;
  for (const scene of scenes) {
    if (scene.kind === 'title' && firstCode) scene.ambient = firstCode.slice(0, 40);
  }

  // The thumbnail carries the authored words, else the hook as it stands when the opening ends.
  const opening = storyboard.scenes.find((scene) => scene.kind === 'title');
  const hook = opening?.beats.flatMap((beat) => [beat.text, ...beat.cues.map((cue) => cue.text)]).filter(Boolean).at(-1);
  const thumbnail = storyboard.thumbnail;
  const cover = {text: thumbnail?.text || hook || storyboard.title, shot: thumbnail?.from ? shotOf(timeline, thumbnail.from, thumbnail.beat) : null};

  const props = {
    title: storyboard.title,
    fps: storyboard.fps,
    width: storyboard.width,
    height: storyboard.height,
    captions: storyboard.captions,
    totalFrames: timeline.totalFrames,
    scenes,
    cover,
  };
  const file = path.join(paths.cache, 'props.json');
  writeJson(file, props);
  return {props, file, storyboard, timeline, autoNotes};
};

// ---------------------------------------------------------------------------------------------
// render / stills / studio

const remotion = (args, options) =>
  run(process.execPath, [path.join(RUNTIME_DIR, 'node_modules', '@remotion', 'cli', 'remotion-cli.js'), ...args], {
    cwd: RUNTIME_DIR,
    ...options,
  });

const ensureRuntime = () => {
  if (!existsSync(path.join(RUNTIME_DIR, 'node_modules', 'remotion'))) fail('Runtime dependencies are not installed. Run `va setup`.');
};

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Everything a rendered frame depends on besides the scene itself. */
const runtimeSignature = () => {
  const parts = [readFileSync(path.join(RUNTIME_DIR, 'theme.json'), 'utf8'), readFileSync(path.join(RUNTIME_DIR, 'package.json'), 'utf8')];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else parts.push(entry.name, readFileSync(full, 'utf8'));
    }
  };
  walk(path.join(RUNTIME_DIR, 'src'));
  return sha(parts.join('\n'));
};

/**
 * Render scene by scene and join the results. A scene whose inputs have not changed is reused,
 * so fixing one scene costs one scene. Narration is laid under the joined picture as one track.
 */
export const render = async (paths, {draft = false, out, force = false} = {}) => {
  ensureRuntime();
  const {props} = await buildProps(paths);
  const output = path.resolve(out || path.join(paths.out, draft ? 'draft.mp4' : 'video.mp4'));
  mkdirSync(path.dirname(output), {recursive: true});
  const quality = draft ? 'draft' : 'full';
  const segmentDir = path.join(paths.cache, 'segments', quality);
  mkdirSync(segmentDir, {recursive: true});
  const shared = sha({fps: props.fps, width: props.width, height: props.height, captions: props.captions, totalFrames: props.totalFrames, runtime: runtimeSignature(), quality});

  log(`render: ${props.scenes.length} scenes, ${fmtSeconds(props.totalFrames / props.fps)}${draft ? ' (draft, half resolution)' : ''}`);
  const plan = props.scenes.map((scene) => {
    const asset = scene.video ? readFileSync(`${path.join(paths.public, scene.video)}.key`, 'utf8') : '';
    const key = sha({shared, scene, asset}).slice(0, 16);
    const target = path.join(segmentDir, `${scene.id}-${key}.mp4`);
    return {scene, target, stale: force || !existsSync(target)};
  });
  const segments = plan.map((entry) => entry.target);
  const rendered = plan.filter((entry) => entry.stale).length;
  const thumbnail = path.join(path.dirname(output), 'thumbnail.png');
  const needsCover = !draft;

  if (rendered || needsCover) {
    await withRenderer(paths.public, async (renderer) => {
      for (const {scene, target, stale} of plan) {
        if (!stale) {
          log(`  ${scene.id}: unchanged`);
          continue;
        }
        for (const old of readdirSync(segmentDir)) {
          if (old.startsWith(`${scene.id}-`) && /^[0-9a-f]{16}\.mp4$/.test(old.slice(scene.id.length + 1))) rmSync(path.join(segmentDir, old));
        }
        log(`  ${scene.id}: rendering ${fmtSeconds(scene.frames / props.fps)}...`);
        await renderer.video({id: 'Explainer', inputProps: props, output: target, frameRange: [scene.from, scene.from + scene.frames - 1], draft});
      }
      if (needsCover) {
        // The hook frame: a few large words above one picture from the video. And the same image
        // at the size it is met in a feed, because that is the size it has to work at.
        await renderer.still({id: 'Cover', inputProps: props, output: thumbnail});
        await run('ffmpeg', ['-y', '-v', 'error', '-i', thumbnail, '-vf', 'scale=240:-1:flags=lanczos', thumbnail.replace(/\.png$/, '-small.png')], {capture: true});
      }
    });
  } else plan.forEach(({scene}) => log(`  ${scene.id}: unchanged`));

  const workDir = path.join(paths.cache, 'render', quality);
  const silent = path.join(workDir, 'picture.mp4');
  const narration = path.join(workDir, 'narration.m4a');
  await concatVideos(segments, silent, workDir);
  const clips = props.scenes.flatMap((scene) =>
    scene.beats.map((beat) => ({file: path.join(paths.public, beat.audio), start: (scene.from + beat.from) / props.fps})),
  );
  await mixNarration(clips, props.totalFrames / props.fps, narration);
  await mux(silent, narration, output);

  const stem = output.replace(/\.[^.]+$/, '');
  const subtitles = subtitleFiles(props);
  writeFileSync(`${stem}.srt`, subtitles.srt);
  writeFileSync(`${stem}.vtt`, subtitles.vtt);
  log(`render: ok → ${output}  (${rendered} of ${props.scenes.length} scenes rendered, ${props.scenes.length - rendered} reused)`);
  log(`  subtitles → ${path.basename(stem)}.srt, ${path.basename(stem)}.vtt (${subtitles.count} cues)`);

  if (needsCover) log(`  thumbnail → ${path.basename(thumbnail)}, and thumbnail-small.png: look at the small one, it is the size viewers see`);
  await qc(paths, {video: output, props});
  return output;
};

// ---------------------------------------------------------------------------------------------
// qc

const STATIC_SECONDS = 6; // a picture unchanged for longer than this, under a moving voice, reads as a slide

const STATIC_ADVICE = {
  code: 'move the highlight mid-sentence with a word-anchored cue ("cues": [{"at": "<phrase>", "lines": ...}]), or split the beat',
  manim: 'spread the animation across the sentence: `b.until("<phrase>")` holds each move until its word is spoken',
  hyperframes: 'bring in the next version on the words that describe it ("cues": [{"at": "<phrase>", "version": n}]), or split a long change into two',
  trace: 'advance the code cursor and the animation together: a cue per line named, and `b.until("<phrase>")` in the script',
  diagram: 'shift the focus mid-sentence with a word-anchored cue ("cues": [{"at": "<phrase>", "focus": [...]}])',
  bullets: 'reveal items on the words that name them ("cues": [{"at": "<phrase>", "show": n}])',
};

/** Check the finished file: complete, audible, in sync, and not sitting on one picture for too long. */
export const qc = async (paths, {video, props} = {}) => {
  const file = path.resolve(video || path.join(paths.out, 'video.mp4'));
  if (!existsSync(file)) fail(`Nothing to check: ${file} does not exist. Run \`va render\` first.`);
  const reference = props || (await buildProps(paths)).props;
  const problems = [];
  const reviews = [];

  const streams = await probeStreams(file);
  if (streams.frames !== reference.totalFrames) problems.push(`The video has ${streams.frames} frames; the timeline has ${reference.totalFrames}. Rerender with --force.`);
  if (!streams.hasAudio) problems.push('The video has no audio track.');
  else if (Math.abs(streams.audioSeconds - streams.videoSeconds) > 0.15) {
    reviews.push(`Audio (${fmtSeconds(streams.audioSeconds)}) and picture (${fmtSeconds(streams.videoSeconds)}) differ in length.`);
  }
  if (streams.hasAudio) {
    const level = await loudness(file);
    if (level.mean < -30) reviews.push(`Narration is quiet (mean ${level.mean} dB).`);
    if (level.peak > -0.5) reviews.push(`Narration peaks at ${level.peak} dB and may clip.`);
  }

  const {stretches} = await frozenStretches(file, {minSeconds: STATIC_SECONDS});
  const statics = [];
  for (const stretch of stretches) {
    const frame = Math.round(((stretch.start + stretch.end) / 2) * reference.fps);
    const scene = reference.scenes.find((entry) => frame >= entry.from && frame < entry.from + entry.frames);
    if (!scene || scene.kind === 'title' || scene.kind === 'credit') continue; // a statement, or a name, is meant to hold
    const local = Math.round(stretch.start * reference.fps) - scene.from;
    const step = [...scene.steps].reverse().find((entry) => local >= entry.cue - 2) || scene.steps[0];
    statics.push({scene, beat: step ? step.beat + 1 : 1, ...stretch});
  }

  log(`qc: ${path.basename(file)} — ${streams.frames} frames, ${fmtSeconds(streams.videoSeconds)}, ${streams.width}×${streams.height}${streams.hasAudio ? '' : ', NO AUDIO'}`);
  problems.forEach((text) => log(`  ERROR: ${text}`));
  reviews.forEach((text) => log(`  review: ${text}`));
  if (statics.length) {
    log(`  ${statics.length} stretch(es) where the picture holds still for more than ${STATIC_SECONDS}s while the voice continues:`);
    for (const item of statics) {
      log(`    ${item.scene.id} beat ${item.beat}: ${(item.end - item.start).toFixed(1)}s still (${clock(item.start)}–${clock(item.end)})`);
    }
    for (const kind of new Set(statics.map((item) => item.scene.kind))) log(`    ${kind}: ${STATIC_ADVICE[kind]}.`);
  }
  if (!problems.length && !reviews.length && !statics.length) log('  complete, audible, in sync, and the picture keeps moving.');
  if (problems.length) process.exitCode = 1;
  return {problems, reviews, statics};
};

// ---------------------------------------------------------------------------------------------
// stills

const parseLayout = (output) =>
  output
    .split('\n')
    .map((line) => line.match(/VA_LAYOUT (\{.*\})/))
    .filter(Boolean)
    .map((match) => {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

/**
 * Contact sheets: every visual state of the video, labelled, a few per image, so the picture can
 * be reviewed in a handful of reads. Each frame's layout is measured in the browser on the way.
 */
export const stills = async (paths, only = [], {at} = {}) => {
  ensureRuntime();
  const {props, autoNotes} = await buildProps(paths);
  const shots = [];
  if (at !== undefined) {
    const seconds = Number(at);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds * props.fps >= props.totalFrames) {
      fail(`--at takes a time in seconds inside the video (0–${(props.totalFrames / props.fps).toFixed(1)}).`);
    }
    shots.push({frame: Math.round(seconds * props.fps), label: `at ${clock(seconds)} (${seconds}s)`});
  } else {
    props.scenes.forEach((scene, sceneIndex) => {
      if (only.length && !only.includes(scene.id)) return;
      scene.steps.forEach((step, stepIndex) => {
        // Late in the state: transitions have settled and this is what the viewer dwells on.
        const local = Math.min(step.cue + Math.max(0, Math.round(step.cueFrames * 0.8) - 1), scene.frames - 10);
        const frame = scene.from + Math.max(step.cue, local);
        const part = scene.steps.filter((entry, index) => entry.beat === step.beat && index <= stepIndex).length;
        const sub = part > 1 ? String.fromCharCode(96 + part) : '';
        shots.push({frame, label: `${String(sceneIndex + 1).padStart(2, '0')} ${scene.id} · beat ${step.beat + 1}${sub} · ${clock(frame / props.fps)}`});
      });
    });
  }
  if (!shots.length) fail('No matching scenes to capture.');

  // All scenes: nine to a sheet. Named scenes or one moment: larger cells, for a closer look.
  const cols = at !== undefined ? 1 : only.length ? 2 : 3;
  const perSheet = cols * cols;
  const dir = path.join(paths.out, 'stills');
  rmSync(dir, {recursive: true, force: true});
  mkdirSync(dir, {recursive: true});
  const sheets = [];
  for (let i = 0; i < shots.length; i += perSheet) sheets.push(shots.slice(i, i + perSheet));
  log(`stills: ${shots.length} frame(s) on ${sheets.length} sheet(s)...`);

  const findings = [];
  let unmeasured = 0;
  await withRenderer(paths.public, async (renderer) => {
    for (const [index, group] of sheets.entries()) {
      const name = at !== undefined ? 'moment.png' : `sheet-${String(index + 1).padStart(2, '0')}.png`;
      const lines = [];
      await renderer.still({
        id: 'Sheet',
        inputProps: {...props, sheet: {cols, cellWidth: Math.round(1920 / cols), audit: true, shots: group}},
        output: path.join(dir, name),
        onLog: (text) => lines.push(text),
      });
      const measured = parseLayout(lines.join('\n'));
      findings.push(...measured.filter((entry) => entry.issues.length));
      unmeasured += group.length - measured.length;
      log(`  ${name}`);
      group.forEach((shot) => log(`    ${shot.label}`));
    }
  });
  log(`stills: ok → ${dir}`);
  if (autoNotes.length) {
    log('cues taken from the narration (the picture follows what the voice names; author a cue to override):');
    autoNotes.forEach((note) => log(`  ${note}`));
  }
  if (unmeasured > 0) log(`layout: not measured for ${unmeasured} frame(s); check the sheets by eye.`);
  else if (findings.length) {
    log(`layout: ${findings.reduce((sum, entry) => sum + entry.issues.length, 0)} issue(s), outlined in red on the sheets:`);
    for (const entry of findings) entry.issues.forEach((issue) => log(`  ${entry.label}: ${issue}`));
  } else log('layout: nothing runs off the frame, collides, or is cut off in the measured scenes (title, code, bullets).');
  return {dir, findings};
};

// ---------------------------------------------------------------------------------------------
// review

const RENDERER_NAME = {title: 'opening statement', credit: 'end card', code: 'code', trace: 'code + animation', hyperframes: 'HyperFrames clip', manim: 'animation', diagram: 'diagram', bullets: 'bullets'};

/**
 * Everything an independent reviewer needs, in one file: what the video is for, what is said and
 * when, where the frames are, and what the automated checks found. The reviewer must be a fresh
 * agent that did not build the video; this brief is all it is given.
 */
export const review = async (paths, {verify} = {}) => {
  const video = path.join(paths.out, 'video.mp4');
  if (!existsSync(video)) fail('Nothing to review yet. Run `va render <project>` first.');
  const {storyboard} = load(paths);
  const routing = routingOf(paths, storyboard);
  const {dir: sheetDir, findings} = await stills(paths);
  const {props} = await buildProps(paths);
  const checks = await qc(paths, {video, props});

  const reviewDir = path.join(paths.out, 'review');
  mkdirSync(reviewDir, {recursive: true});
  const round = readdirSync(reviewDir).filter((name) => /^report-\d+\.md$/.test(name)).length + 1;
  if (verify && !existsSync(path.resolve(verify))) fail(`--verify: ${verify} does not exist.`);
  const reportPath = path.join(reviewDir, `report-${round}.md`);
  const sheets = readdirSync(sheetDir).filter((name) => name.startsWith('sheet-')).sort();
  const authored = new Map(storyboard.scenes.map((scene) => [scene.id, scene]));

  const out = [];
  out.push(`# Review brief, round ${round}: ${storyboard.title}`, '');
  out.push(
    'You are reviewing a narrated code explainer video. You did not make it, and nobody will tell you what was intended beyond this page. Judge what is on screen and what was measured.',
    '',
  );
  out.push('## What the video is for', '');
  out.push(`- Subject: ${routing.subject}${storyboard.brief?.audience ? `; audience: ${storyboard.brief.audience}` : ''}${storyboard.brief?.focus ? `; focus: ${storyboard.brief.focus}` : ''}`);
  out.push(`- Length: ${fmtSeconds(props.totalFrames / props.fps)}${storyboard.brief?.length ? ` (asked for about ${storyboard.brief.length}s)` : ''}`);
  if (storyboard.brief?.hook) out.push(`- The hook it means to open on: ${storyboard.brief.hook.replace(/\*/g, '')}`);
  out.push('');
  out.push('| # | Starts | Scene | Viewer needs to see | Shown as | Why |', '|---|---|---|---|---|---|');
  props.scenes.forEach((scene, index) => {
    const source = authored.get(scene.id);
    out.push(`| ${index + 1} | ${clock(scene.from / props.fps)} | ${scene.id} | ${source.need || '(not declared)'} | ${RENDERER_NAME[scene.kind]} | ${source.why || ''} |`);
  });
  out.push('', '## What the voice says, and when', '');
  for (const scene of props.scenes) {
    out.push(`**${scene.id}**`);
    scene.beats.forEach((beat, index) => {
      out.push(`- ${clock((scene.from + beat.from) / props.fps)} (beat ${index + 1}) ${authored.get(scene.id).beats[index].say}`);
    });
    out.push('');
  }
  out.push('## Evidence', '');
  out.push(`- Video: ${video}`);
  out.push(`- Contact sheets, every visual state labelled with scene, beat, and time (read all of them):`);
  sheets.forEach((name) => out.push(`  - ${path.join(sheetDir, name)}`));
  out.push(`- For a closer look at any moment: \`node ${path.join(RUNTIME_DIR, 'va.mjs')} stills ${paths.dir} --at <seconds>\` writes ${path.join(sheetDir, 'moment.png')} at full size (it replaces the sheets; rerun without --at to get them back).`);
  out.push('', '## What the automated checks found', '');
  out.push('```', formatRouting(routing), '```', '');
  out.push(`- Layout: ${findings.length ? findings.flatMap((entry) => entry.issues.map((issue) => `${entry.label}: ${issue}`)).join('; ') : 'no issues measured'}`);
  out.push(`- File: ${checks.problems.length ? checks.problems.join('; ') : 'complete, with audio'}${checks.reviews.length ? `; ${checks.reviews.join('; ')}` : ''}`);
  out.push(
    `- Still picture: ${checks.statics.length ? checks.statics.map((item) => `${item.scene.id} beat ${item.beat} holds for ${(item.end - item.start).toFixed(1)}s from ${clock(item.start)}`).join('; ') : 'no stretch longer than 6s'}`,
    '',
  );

  if (verify) {
    out.push('## Your job: verify the previous round', '');
    out.push(`The previous review is at ${path.resolve(verify)}. For every defect and fix it lists, look at the new frames and say FIXED, PARTLY, or STILL PRESENT, with the time. Then list anything new that is wrong: fixes often break something next to them.`, '');
    out.push(`Write your report to ${reportPath}, under 400 words, ending with one line: SHIP or ONE MORE PASS (with at most three fixes).`);
  } else {
    out.push('## What to judge', '');
    out.push(
      '1. **Truth.** At each beat, does the picture show what the voice is saying at that moment? Is the highlighted line the line being discussed? Does the animation state match the claim?',
      '2. **Legibility.** Can every label be read at normal size? Anything crowded, low-contrast, overlapping, or cut off?',
      '3. **Pacing.** Where does the picture sit unchanged while the voice moves on? Where does too much happen in one beat?',
      '4. **Continuity.** Does the same object look the same from scene to scene? Does a colour mean one thing throughout?',
      '5. **Choice of picture.** Is each scene the right kind of picture for what the viewer needs to see? Would another kind explain it better?',
      '6. **Narration.** Any sentence that is unclear, assumes a term the audience has not been given, or claims something the picture never shows?',
      '7. **Story.** Do the first ten seconds give a reason to keep watching, in the picture and not only in the words? Is the viewer shown why this exists before how it works: the obvious approach and what it costs? Where the voice claims a count or a cost, is that number on screen as it adds up? Does anything move that the narration gives no reason for?',
      '8. **Flow.** Read the narration as one piece. Where does it start over instead of following on: a scene that does not pick up from the one before, a term defined after it was needed, a jump the viewer has to make alone?',
      '',
    );
    out.push('## Your report', '');
    out.push(`Write it to ${reportPath}, under 500 words, with no praise:`, '');
    out.push('- **Verdict:** SHIP or REVISE.', '- **Defects**, most serious first. Each one: scene · beat · time, what is wrong, and what in the frame shows it.', '- **Top fixes**, at most five, each concrete enough to act on (which scene, what to change).');
  }
  const briefPath = path.join(reviewDir, `brief-${round}.md`);
  writeFileSync(briefPath, out.join('\n') + '\n');
  log('');
  log(`review: brief for an independent reviewer → ${briefPath}`);
  log(`  Give that file, and nothing else, to a fresh agent. It writes ${reportPath}.`);
  return {briefPath, reportPath, round};
};

export const studio = async (paths) => {
  ensureRuntime();
  const {file} = await buildProps(paths);
  await remotion(['studio', 'src/index.ts', `--props=${file}`, `--public-dir=${paths.public}`]);
};

export const build = async (paths, options = {}) => {
  await tts(paths);
  await diagram(paths, [], options);
  await manim(paths, [], options);
  await hyperframes(paths, [], options);
  return render(paths, options);
};

// ---------------------------------------------------------------------------------------------
// init

export const init = (slug, {dir} = {}) => {
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail('Usage: va init <slug>  (kebab-case topic name, e.g. "lru-cache")');
  const base = path.resolve(dir || '.visualize');
  let target = path.join(base, slug);
  for (let n = 2; existsSync(target); n += 1) target = path.join(base, `${slug}-${n}`);
  mkdirSync(path.join(target, 'diagrams'), {recursive: true});
  mkdirSync(path.join(target, 'manim'), {recursive: true});
  writeFileSync(path.join(target, '.gitignore'), 'public/\n.cache/\nout/\ntimeline.json\n');
  writeJson(path.join(target, 'storyboard.json'), {
    title: 'Untitled explainer',
    voice: 'en-US-AndrewNeural',
    sourceRoot: path.relative(target, process.cwd()) || '.',
    brief: {
      audience: 'Who is watching, and what they already know.',
      length: 90,
      focus: 'The one question the video answers.',
      hook: 'The core of the problem, or the most *surprising* thing about the answer, in one sentence.',
    },
    scenes: [
      {
        id: 'open',
        need: 'motion',
        why: 'Opening: the picture that shows the problem, with the hook said over it.',
        class: 'Open',
        beats: [{say: 'Replace this with the hook, said over the picture that shows it: the most surprising thing, or the problem with the obvious way.'}],
      },
    ],
  });
  log(target);
  return target;
};

