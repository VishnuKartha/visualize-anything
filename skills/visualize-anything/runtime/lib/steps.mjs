import {existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {bakeDiagram} from './bake-diagram.mjs';
import {analyzeRouting, formatRouting} from './router.mjs';
import {buildTimeline, captionPhrases, loadStoryboard, loadTimeline, resolveCode} from './storyboard.mjs';
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

const pick = (scenes, kind, only) => {
  const wanted = scenes.filter((scene) => scene.kind === kind);
  if (!only.length) return wanted;
  const unknown = only.filter((id) => !wanted.some((scene) => scene.id === id));
  if (unknown.length) fail(`No ${kind} scene with id: ${unknown.join(', ')}.`);
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
      scene.beats.map((beat, index) => ({scene: scene.id, index, text: beat.say, file: `${scene.id}-${index}.mp3`})),
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
    if (!Array.isArray(beat.focus)) return;
    for (const token of beat.focus) {
      if (!baked.nodes[token] && !baked.edges[token]) problems.push(`beat ${index + 1}: "${token}"`);
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
      for (const beat of scene.beats) {
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
  const scale = draft ? 0.5 : 1;
  const width = Math.round(storyboard.width * scale);
  const height = Math.round(storyboard.height * scale);

  for (const scene of pick(storyboard.scenes, 'manim', only)) {
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
    const key = sha({source, cls: scene.class, windows, width, height, fps: timeline.fps, typst: TYPST_SPEC, helper});
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
        }),
      },
    );
    if (result.code !== 0) {
      fail(`Scene "${scene.id}": manim failed.\n${(result.stderr || result.stdout).trim().split('\n').slice(-40).join('\n')}`);
    }
    const overruns = (result.stderr + result.stdout).split('\n').filter((line) => line.startsWith('VA_OVERRUN'));
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
    if (drift > 0.25) log(`  warning: animation is ${fmtSeconds(drift)} longer than its narration; the end was trimmed.`);
    if (drift < -0.25) log(`  warning: animation is ${fmtSeconds(-drift)} shorter than its narration; the last frame is held. Wrap each beat in \`with self.beat(i):\`.`);
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

  for (const [index, scene] of storyboard.scenes.entries()) {
    const timed = timeline.scenes[index];
    const beats = timed.beats.map((beat, beatIndex) => {
      const authored = scene.beats[beatIndex];
      if (!existsSync(path.join(paths.public, beat.audio))) missing.push(`${beat.audio} (run \`va tts\`)`);
      return {
        audio: beat.audio,
        from: beat.from,
        cue: beat.cue,
        cueFrames: beat.cueFrames,
        audioFrames: beat.audioFrames,
        phrases: captionPhrases(authored.caption, beat.words, beat.duration),
        lines: authored.lines ?? null,
        note: authored.note ?? null,
        focus: authored.focus ?? null,
        show: authored.show ?? null,
      };
    });
    const base = {id: scene.id, kind: scene.kind, heading: scene.heading || null, from: timed.from, frames: timed.frames, beats};

    if (scene.kind === 'title') {
      scenes.push({...base, title: scene.title, kicker: scene.kicker || null, subtitle: scene.subtitle || null});
    } else if (scene.kind === 'bullets') {
      scenes.push({...base, title: scene.title || null, items: scene.items});
    } else if (scene.kind === 'code') {
      const resolved = resolveCode(scene, paths, storyboard);
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
      });
    } else if (scene.kind === 'diagram') {
      const asset = diagramAsset(paths, scene);
      if (!existsSync(asset)) {
        missing.push(`diagram for "${scene.id}" (run \`va diagram\`)`);
        continue;
      }
      const baked = readJson(asset);
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
    }
  }
  if (missing.length) fail(`Not ready to render. Missing:\n  - ${missing.join('\n  - ')}`);

  const props = {
    title: storyboard.title,
    fps: storyboard.fps,
    width: storyboard.width,
    height: storyboard.height,
    captions: storyboard.captions,
    totalFrames: timeline.totalFrames,
    scenes,
  };
  const file = path.join(paths.cache, 'props.json');
  writeJson(file, props);
  return {props, file, storyboard, timeline};
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

export const render = async (paths, {draft = false, out} = {}) => {
  ensureRuntime();
  const {file, props} = await buildProps(paths);
  const output = path.resolve(out || path.join(paths.out, draft ? 'draft.mp4' : 'video.mp4'));
  mkdirSync(path.dirname(output), {recursive: true});
  const args = [
    'render', 'src/index.ts', 'Explainer', output,
    `--props=${file}`, `--public-dir=${paths.public}`, '--log=error',
  ];
  if (draft) args.push('--scale=0.5', '--crf=30');
  log(`render: ${props.scenes.length} scenes, ${fmtSeconds(props.totalFrames / props.fps)}${draft ? ' (draft, half resolution)' : ''}. Expect roughly one to two times the video's length...`);
  await remotion(args);
  const seconds = await ffprobeDuration(output);
  log(`render: ok → ${output} (${fmtSeconds(seconds)})`);
  return output;
};

/** One PNG per beat, taken mid-beat, so the picture can be reviewed without watching the video. */
export const stills = async (paths, only = []) => {
  ensureRuntime();
  const {file, props} = await buildProps(paths);
  const shots = [];
  props.scenes.forEach((scene, sceneIndex) => {
    if (only.length && !only.includes(scene.id)) return;
    scene.beats.forEach((beat, beatIndex) => {
      // Late in the beat: transitions have settled and the picture is what the viewer dwells on.
      const frame = scene.from + beat.cue + Math.max(0, Math.round(beat.cueFrames * 0.8) - 1);
      shots.push({frame, name: `${String(sceneIndex + 1).padStart(2, '0')}-${scene.id}-beat${beatIndex}.png`});
    });
  });
  if (!shots.length) fail('No matching scenes to capture.');
  const dir = path.join(paths.out, 'stills');
  rmSync(dir, {recursive: true, force: true});
  mkdirSync(dir, {recursive: true});
  log(`stills: capturing ${shots.length} frame(s)...`);
  for (const shot of shots) {
    await remotion(
      [
        'still', 'src/index.ts', 'Explainer', path.join(dir, shot.name),
        `--props=${file}`, `--public-dir=${paths.public}`, `--frame=${shot.frame}`, '--scale=0.5', '--log=error',
      ],
      {capture: true},
    );
  }
  log(`stills: ok → ${dir}`);
  shots.forEach((shot) => log(`  ${shot.name}  (frame ${shot.frame})`));
  return dir;
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
    scenes: [
      {
        id: 'intro',
        need: 'question',
        why: 'Opens the video; names the subject and the question it answers.',
        kicker: 'Code explainer',
        title: 'Replace me',
        subtitle: 'One line on what the viewer will understand by the end.',
        beats: [{say: 'Replace this with the opening line of narration.'}],
      },
    ],
  });
  log(target);
  return target;
};

