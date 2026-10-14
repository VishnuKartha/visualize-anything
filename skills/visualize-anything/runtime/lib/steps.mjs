import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {bakeDiagram} from './bake-diagram.mjs';
import {withRenderer} from './remotion-api.mjs';
import {compareFacts, parseOracle, unbackedNumbers} from './facts.mjs';
import {analyzeRouting, formatRouting, scriptProse} from './router.mjs';
import {HYPERFRAMES_VERSION, planCodeChange, renderComposition, writeAuthored, writeCodeChange} from './hyperframes.mjs';
import {BED, brightIn, concatVideos, firstBright, frameChanges, frameSimilarity, frozenStretches, loudness, mixBed, mixNarration, mux, pictureFill, probeStreams, silences, sparseStretch, subtitleFiles} from './media.mjs';
import {findSeams} from './seams.mjs';
import {loadPaper, paperFindings} from './paper.mjs';
import {formatProse, lintProse} from './prose.mjs';
import {SOURCE_KINDS, inventory, isDocument} from './sources.mjs';
import {VIEWERS, planBrief, viewerContracts} from './viewers.mjs';
import {EVIDENCE, HAS_PICTURE, SETTLED, buildSteps, buildTimeline, captionPhrases, loadStoryboard, loadTimeline, resolveCode, resolveVersions, speakable, withAutoCues} from './storyboard.mjs';
import {
  ARCHIFY_BIN, MANIM_UV_ARGS, RUNTIME_DIR, TYPST_SPEC, fail, ffprobeDuration, fmtSeconds, has, manimEnv, readJson, run, sha, writeJson,
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
const shotOf = (timeline, storyboard, id, beatNumber) => {
  const target = timeline.scenes.find((entry) => entry.id === id);
  if (!target) return null;
  const beat = target.beats[beatNumber ? beatNumber - 1 : target.beats.length - 1];
  // When its animation has settled, and before the scene fades.
  return {scene: id, frame: Math.max(0, Math.min(beat.cue + beat.cueFrames - 3, target.frames - lastLook(storyboard.scenes.find((entry) => entry.id === id))))};
};

/** How many frames before its end a scene is last seen whole: an evidence scene lets its picture go early. */
const lastLook = (scene) => (EVIDENCE.includes(scene?.kind) ? SETTLED : 10);

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

/**
 * The narration as prose: script.md run through Vale's proselint and ai-tells packages. The findings
 * are advice, like a routing review. That the check runs is not: without Vale this fails.
 */
export const prose = async (paths) => {
  const file = path.join(paths.dir, 'script.md');
  if (!existsSync(file)) {
    log('Prose: no script.md in this project, so there is no narration to check. Write the script whole before the storyboard.');
    return [];
  }
  const {storyboard} = load(paths, {gate: false});
  const findings = await lintProse(file);
  log(formatProse(findings, {lines: readFileSync(file, 'utf8').split('\n'), storyboard}));
  return findings;
};

/** The router's verdict on every scene, and on the sequence as a whole; then the prose check on the script. */
export const route = async (paths) => {
  const {storyboard} = load(paths, {gate: false});
  const report = routingOf(paths, storyboard);
  log(formatRouting(report));
  if (report.errors) process.exitCode = 1;
  await prose(paths);
  return report;
};

export const check = async (paths) => {
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
  await route(paths);
  return storyboard;
};

// ---------------------------------------------------------------------------------------------
// paper

/** Read a paper into the project: its abstract and what it claims, its sections, figures, and tables. */
export const paper = async (paths, source) => {
  if (!source) fail('Usage: va paper <project> <source>, where the source is an arXiv id (2610.12374), an arXiv address, or the path of a PDF.');
  const out = path.join(paths.dir, 'paper');
  const result = await run('uv', ['run', '--quiet', path.join(RUNTIME_DIR, 'python', 'paper.py'), '--source', source, '--out', out], {capture: true, allowFail: true});
  if (result.code !== 0) fail(`Could not read the paper.\n${(result.stderr || result.stdout).trim().split('\n').slice(-8).join('\n')}`);
  const read = loadPaper(paths.dir);
  if (!read) fail(`paper.py finished but wrote no usable ${path.join(out, 'paper.json')}.`);
  const body = read.sections.filter((section) => section.kind === 'body');
  log(`paper: ${read.title}`);
  log(`  read from ${read.read_from}: ${body.length} sections, ${read.figures.filter((figure) => figure.file).length} of ${read.figures.length} figures saved, ${read.tables.length} tables${read.tables_from_source ? ` (${read.tables_from_source} of them from the LaTeX source, where the HTML edition lost or misnumbered them)` : ''}.`);
  for (const conflict of read.table_conflicts || []) {
    log(`  Table ${conflict.n}: the HTML edition and the LaTeX source give this number to different tables. The source's is kept, since its numbers are the PDF's.`);
    log(`    HTML:   ${conflict.html}`);
    log(`    source: ${conflict.source}`);
  }
  log('');
  log('  The abstract, claim by claim. Plan the video from these before anything in the body:');
  for (const claim of read.claims) log(`    ${String(claim.n).padStart(2)}. ${claim.text}${claim.numbers.length ? `   [states ${claim.numbers.join(', ')}]` : ''}`);
  log('');
  if (read.read_from === 'PDF' && !read.tables.length) log('  No tables could be read from the PDF (only ruled tables are found). Copy the rows you need from the paper by hand, and give each number a "given" that names its table.');
  if (read.licence?.open === false) log(`  Licence: ${read.licence.url}. That lets arXiv distribute the paper; it does not let you reproduce its figures. Read them, and draw your own.`);
  else if (read.licence?.open) log(`  Licence: ${read.licence.url}. Its figures may be shown with credit; say where each is from in its caption.`);
  else log('  Licence: unknown. Check what the authors allow before showing any of its figures.');
  log(`  Read ${path.relative(process.cwd(), path.join(out, 'paper.md'))} next. Then account for every claim above in the storyboard's "claims"; \`va route\` holds you to it.`);
  return read;
};

// ---------------------------------------------------------------------------------------------
// facts

// The oracle is a script in the project that computes every fact again by running the real code.
const ORACLES = [
  // Run as a script, so inline metadata (`# /// script` with `dependencies = ["numpy"]`) is honoured.
  ['facts.py', (file) => ['uv', ['run', '--quiet', '--no-project', file]]],
  ['facts.mjs', (file) => [process.execPath, [file]]],
];
const shown = (value) => (typeof value === 'string' ? `"${value}"` : String(value));

/** Run the project's oracle and hold every fact in the storyboard to what it computes. */
export const facts = async (paths) => {
  const {storyboard} = load(paths, {gate: false});
  const declared = storyboard.facts;
  const loose = unbackedNumbers(storyboard);
  let computed = null;
  let oracleName = null;
  if (declared.some((fact) => !fact.given)) {
    const oracle = ORACLES.map(([name, command]) => ({name, file: path.join(paths.dir, name), command})).find((entry) => existsSync(entry.file));
    if (!oracle) {
      fail(
        `${declared.filter((fact) => !fact.given).length} fact(s) have nothing computing them. Write ${path.join(paths.dir, 'facts.py')} (or facts.mjs): ` +
          'it runs the code the video is about on the video\'s own example and prints one JSON object, fact id to value. ' +
          `Ids to print: ${declared.filter((fact) => !fact.given).map((fact) => fact.id).join(', ')}.`,
      );
    }
    const [command, args] = oracle.command(oracle.file);
    const result = await run(command, args, {cwd: paths.dir, capture: true, allowFail: true});
    if (result.code !== 0) fail(`${oracle.name} failed (exit ${result.code}).\n${(result.stderr || result.stdout).trim().split('\n').slice(-25).join('\n')}`);
    computed = parseOracle(result.stdout);
    if (!computed) fail(`${oracle.name} has to print one JSON object, fact id to value, as its last line. It printed:\n${result.stdout.trim().split('\n').slice(-5).join('\n') || '(nothing)'}`);
    oracleName = oracle.name;
  }

  const rows = compareFacts(declared, computed);
  const bad = rows.filter((entry) => entry.status === 'differs' || entry.status === 'missing');
  if (!declared.length) log('facts: none declared.');
  else {
    log(`facts: ${declared.length} in the storyboard${oracleName ? `, checked against ${oracleName}` : ''}.`);
    const width = Math.max(...rows.map((entry) => entry.id.length));
    const mark = {ok: ' ok    ', given: ' given ', differs: 'DIFFERS', missing: 'MISSING'};
    for (const entry of rows) {
      const detail = entry.status === 'differs' ? `the oracle computed ${shown(entry.computed)}`
        : entry.status === 'missing' ? `${oracleName} does not print "${entry.id}"`
          : entry.status === 'given' ? entry.given : entry.what;
      log(`  ${mark[entry.status]}  ${entry.id.padEnd(width)}  ${shown(entry.value).padStart(9)}  ${detail}`);
    }
  }
  if (loose.length) {
    log(`  ${loose.length} number(s) said or shown with no fact behind them: ${loose.map((number) => `"${number.text}" (${number.where})`).join(', ')}.`);
  }
  // A number said to come from the paper has to be in the paper as it was read.
  const read = loadPaper(paths.dir);
  const strays = read ? paperFindings(storyboard, read).notInPaper : [];
  if (strays.length) log(`  ${strays.length} "given" number(s) are nowhere in the paper as read: ${strays.map((fact) => `${fact.id} = ${fact.value}`).join(', ')}. Write the number the way the paper does, or say in "given" where else it comes from.`);
  if (bad.length) log(`  ${bad.length} fact(s) do not hold. Fix the narration and the picture to match the code, or fix the oracle if it is the one that is wrong; never the other way round.`);
  else if (declared.length && !loose.length) log('  every number in the video is computed, and the computation agrees.');
  const ok = bad.length === 0;
  writeJson(path.join(paths.cache, 'facts.json'), {ok, oracle: oracleName, rows, loose});
  if (!ok) process.exitCode = 1;
  return {ok, rows, loose, oracle: oracleName};
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
// How much of its frame a drawing should fill, and for how long it may fall short before it is reported.
const SPARSE = {panel: 0.35, frame: 0.12, seconds: 4};
const OFF_PALETTE = /\b(?:PURE_)?(?:BLUE|RED|GREEN|YELLOW|PURPLE|PINK|TEAL|GOLD|MAROON|WHITE|BLACK|GR[AE]Y)(?:_[A-E])?\b/g;

// Manim classes that typeset with LaTeX unless told otherwise, and what the kit has in their place.
const NEEDS_LATEX = [
  [/\b(?:MathTex|Tex|SingleStringMathTex)\s*\(/, 'MathTex/Tex', 'Math(...) for a formula, Text(...) for words'],
  [/\b(?:DecimalNumber|Integer|Variable)\s*\((?![^)]*mob_class)/, 'DecimalNumber/Integer', 'Tally(...) or Count(...)'],
  [/\bBarChart\s*\((?![^)]*label_constructor)/, 'BarChart', 'bar_chart(...)'],
  [/\bGraph\s*\([^)]*labels\s*=\s*True/, 'Graph(labels=True)', 'Net(...)'],
  [/\b(?:Matrix|MobjectMatrix|BraceLabel)\s*\(/, 'Matrix/BraceLabel', 'MobjectTable(...), span(...)'],
  [/include_numbers["']?\s*[:=]\s*True(?![\s\S]{0,160}label_constructor)/, 'numbered axes', 'axes(...), or label_constructor=label'],
];
// The ready-made pictures. A script that uses none of them has drawn everything by hand.
const KIT = /\b(?:Cells|Tally|Count|Flow|Node|Link|Track|Net|span|tag|claim|verdict|bar_chart|axes|curve|fit|halves|lanes)\s*\(/;

/** Things a script does that will look out of place next to the other scenes, or fail outright. */
export const manimTaste = (source, beside, className) => {
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
  for (const [pattern, what, instead] of NEEDS_LATEX) {
    if (pattern.test(code)) notes.push(`uses ${what}, which typesets with LaTeX and fails where none is installed. Use ${instead}.`);
  }
  for (const clash of countAndRestyle(code)) notes.push(`changes the value of ${clash} and animates it in the same play(). Manim then leaves the number on its old value. Count in one play(), then recolour or move it in the next.`);
  if (!KIT.test(code)) notes.push('draws everything by hand. Start from the kit in va_manim (Cells, Tally, Flow, Track, Net, span, tag, fit, and the rest; see references/scene-manim.md) and keep raw Manim shapes for the one object the kit does not have.');
  return notes;
};

/**
 * Each play() that counts a number to a new value (ChangeDecimalToValue, or a Tally's .to()) while it also
 * animates that same number, or the group holding it, with .animate. The two animations fight over one
 * mobject and the count is lost: the number stays where it started. Returns the clashing names.
 */
export const countAndRestyle = (code) => {
  const clashes = [];
  for (const start of [...code.matchAll(/self\.play\(/g)].map((match) => match.index + match[0].length)) {
    let depth = 1;
    let end = start;
    while (end < code.length && depth > 0) {
      if (code[end] === '(') depth += 1;
      else if (code[end] === ')') depth -= 1;
      end += 1;
    }
    const call = code.slice(start, end - 1);
    const counted = [
      ...[...call.matchAll(/ChangeDecimalToValue\(\s*([\w.\[\]]+)/g)].map((match) => match[1]),
      ...[...call.matchAll(/([\w.\[\]]+)\.to\(/g)].map((match) => match[1]),
    ];
    const animated = [...call.matchAll(/([\w.\[\]]+)\.animate\b/g)].map((match) => match[1]);
    const root = (name) => name.split(/[.\[]/)[0];
    for (const name of counted) {
      if (animated.some((other) => other === name || other.startsWith(`${name}[`) || other.startsWith(`${name}.`) || name.startsWith(`${other}[`) || name.startsWith(`${other}.`) || root(other) === root(name)) && !clashes.includes(name)) clashes.push(name);
    }
  }
  return clashes;
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

  const factsFile = path.join(paths.cache, 'fact-values.json');
  writeJson(factsFile, Object.fromEntries(storyboard.facts.map((fact) => [fact.id, fact.value])));

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
    // A script reads numbers with fact("<id>"), so a changed fact redraws the scenes that use one.
    const ledger = /\bfact\(/.test(source) ? Object.fromEntries(storyboard.facts.map((fact) => [fact.id, fact.value])) : null;
    const key = sha({source, cls: scene.class, windows, spoken, width, height, fps: timeline.fps, typst: TYPST_SPEC, helper, continues: scene.continues === true, ...(ledger ? {ledger} : {})});
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
          VA_FACTS: factsFile,
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
    // A drawing that keeps to one corner of its frame looks unfinished. A trace panel has nothing laid over it,
    // so it should be filled; a full frame gives up its top and bottom to the heading and the captions.
    const least = beside ? SPARSE.panel : SPARSE.frame;
    const sparse = sparseStretch(await pictureFill(asset), least);
    if (sparse && sparse.end - sparse.start >= SPARSE.seconds) {
      log(`  warning: from ${sparse.start.toFixed(1)}s to ${sparse.end.toFixed(1)}s the drawing fills at most ${Math.round(sparse.share * 100)}% of ${beside ? 'its panel' : 'the frame'} (a full one fills ${Math.round(least * 100)}% or more). Build the whole layout first and centre it, make its parts larger, and put what arrives later where it leaves no hole.`);
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
      const shots = scene.items.map((item) => shotOf(timeline, storyboard, item.from || fallback, item.from ? item.beat : null));
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
    } else if (scene.kind === 'stat') {
      scenes.push({...base, title: scene.title, metrics: scene.metrics});
    } else if (scene.kind === 'compare') {
      scenes.push({...base, title: scene.title, versus: scene.versus, panels: scene.panels});
    } else if (scene.kind === 'chart') {
      scenes.push({...base, chart: scene.chart, title: scene.title, unit: scene.unit, axis: scene.axis, across: scene.across ?? null, labels: scene.labels, series: scene.series});
    } else if (scene.kind === 'table') {
      scenes.push({...base, title: scene.title, columns: scene.columns, rows: scene.rows, best: scene.best, highlight: scene.highlight, caption: scene.caption});
    } else if (scene.kind === 'matrix') {
      scenes.push({...base, title: scene.title, rows: scene.rows, columns: scene.columns, values: scene.values, scale: scene.scale, center: scene.center ?? null, numbers: scene.numbers, axis: scene.axis});
    } else if (scene.kind === 'quote') {
      scenes.push({...base, quote: scene.quote, highlights: scene.highlights, attribution: scene.attribution});
    } else if (scene.kind === 'figure') {
      // The image is served under a name that carries its content, so a redrawn figure is a changed scene.
      const source = path.resolve(paths.dir, scene.image);
      const name = `${scene.id}-${sha(readFileSync(source).toString('base64')).slice(0, 12)}${path.extname(source).toLowerCase()}`;
      mkdirSync(paths.assets, {recursive: true});
      if (!existsSync(path.join(paths.assets, name))) copyFileSync(source, path.join(paths.assets, name));
      const {width, height} = await probeStreams(source);
      if (!width || !height) fail(`Scene "${scene.id}": could not read the size of ${source}. Is it an image?`);
      // A crop shows one region of the figure, at that region's own shape.
      const crop = scene.crop || {x: 0, y: 0, width: 100, height: 100};
      scenes.push({...base, image: `assets/${name}`, aspect: (width * crop.width) / (height * crop.height), crop, caption: scene.caption, callouts: scene.callouts});
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
  const cover = {text: thumbnail?.text || hook || storyboard.title, shot: thumbnail?.from ? shotOf(timeline, storyboard, thumbnail.from, thumbnail.beat) : null};

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
  const {props, storyboard} = await buildProps(paths);
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
  const total = props.totalFrames / props.fps;
  await mixNarration(clips, total, narration);
  let sound = narration;
  let bed = null;
  if (storyboard.music) {
    // The bed is ducked from the narration's own timeline, then measured where it ended up.
    sound = path.join(workDir, 'sound.m4a');
    const spoken = props.scenes.flatMap((scene) => scene.beats.map((beat) => ({start: (scene.from + beat.from) / props.fps, duration: beat.audioFrames / props.fps})));
    bed = await mixBed({narration, bed: path.resolve(paths.dir, storyboard.music.file), clips: spoken, total, under: storyboard.music.under, gap: storyboard.music.gap, output: sound, workDir});
    writeJson(path.join(workDir, 'bed.json'), bed);
  } else rmSync(path.join(workDir, 'bed.json'), {force: true});
  await mux(silent, sound, output);

  const stem = output.replace(/\.[^.]+$/, '');
  const subtitles = subtitleFiles(props);
  writeFileSync(`${stem}.srt`, subtitles.srt);
  writeFileSync(`${stem}.vtt`, subtitles.vtt);
  log(`render: ok → ${output}  (${rendered} of ${props.scenes.length} scenes rendered, ${props.scenes.length - rendered} reused)`);
  log(`  subtitles → ${path.basename(stem)}.srt, ${path.basename(stem)}.vtt (${subtitles.count} cues)`);

  if (needsCover) log(`  thumbnail → ${path.basename(thumbnail)}, and thumbnail-small.png: look at the small one, it is the size viewers see`);
  if (bed) {
    const tooClose = bed.distance < BED.floor;
    const tooHot = bed.peak > BED.peak;
    log(`  music: the bed sits ${bed.distance.toFixed(1)} LU under the voice while it speaks (asked for ${storyboard.music.under}, refused under ${BED.floor}); the mix peaks at ${bed.peak.toFixed(1)} dBTP.`);
    if (tooClose) log(`  ERROR: the bed is only ${bed.distance.toFixed(1)} LU under the voice. It will mask speech: raise "under", or use a bed with less going on.`);
    if (tooHot) log(`  ERROR: the mix peaks at ${bed.peak.toFixed(1)} dBTP, over ${BED.peak}. Raise "under" and "gap" so the music adds less to the voice's peaks.`);
    if (tooClose || tooHot) process.exitCode = 1;
  }
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
  stat: 'bring each number in on the words that say it ("cues": [{"at": "<phrase>", "show": n}]), or add a "note" where the sentence qualifies it',
  compare: 'bring each point in on the words that make it ("cues": [{"at": "<phrase>", "show": n}])',
  chart: 'grow the next bar on the words that say its value ("show"), or light the one the sentence is about ("focus": ["<label>"])',
  table: 'bring each row in on the words that name it ("cues": [{"at": "<phrase>", "show": n}]), or light the row or column the sentence is about ("focus": ["<row or column>"])',
  matrix: 'fill the next row on the words that name it ("cues": [{"at": "<phrase>", "show": n}]), or light the row or column the sentence is about ("focus": [...])',
  quote: 'mark a phrase when the voice reaches it ("highlight", then "cues": [{"at": "<phrase>", "show": n}]), or quote less',
  figure: 'point at the next part of the figure when the voice names it ("callouts", then "cues": [{"at": "<phrase>", "show": n}])',
};

// The part of the frame a scene's picture lives in, clear of the heading above and the captions below.
const CONTENT = {x: 60, y: 104, width: 1800, height: 800};

/** Measure the rendered file for seams: cuts, joins that do not match, the voice stopping, and its level stepping. */
const measureSeams = async (paths, file, props, streams, voice = file) => {
  const scale = streams.width / 1920;
  const rect = (region) => [region.width, region.height, region.x, region.y].map((value) => Math.round(value * scale)).join(':');
  const joins = [];
  for (let index = 1; index < props.scenes.length; index += 1) {
    const [before, after] = [props.scenes[index - 1], props.scenes[index]];
    if (after.fadeIn !== false) continue;
    // Two trace scenes share the animation panel; the code beside it is expected to change.
    const region = before.kind === 'trace' && after.kind === 'trace' ? after.clip : CONTENT;
    joins.push({index, similarity: await frameSimilarity(file, after.from - 1, after.from, props.fps, rect(region))});
  }
  const levels = await Promise.all(
    props.scenes.flatMap((scene) =>
      scene.beats.map(async (beat, beatIndex) => ({scene: scene.id, beat: beatIndex + 1, mean: (await loudness(path.join(paths.public, beat.audio))).mean})),
    ),
  );
  return {
    changes: await frameChanges(file),
    joins,
    silences: streams.hasAudio ? await silences(voice) : [],
    levels,
    firstPicture: await firstBright(file, rect(CONTENT)),
  };
};

/** Check the finished file: complete, audible, in sync, not sitting on one picture for too long, and without seams. */
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

  // Under a music bed the finished track is never silent, so the voice's pauses are read from the voice alone.
  const stem = path.join(paths.cache, 'render', streams.width < reference.width ? 'draft' : 'full', 'narration.m4a');
  const bedded = existsSync(path.join(path.dirname(stem), 'bed.json')) && existsSync(stem);
  const measured = streams.frames ? await measureSeams(paths, file, reference, streams, bedded ? stem : file) : null;
  const seams = measured ? findSeams(reference, measured) : [];

  log(`qc: ${path.basename(file)} — ${streams.frames} frames, ${fmtSeconds(streams.videoSeconds)}, ${streams.width}×${streams.height}${streams.hasAudio ? '' : ', NO AUDIO'}`);
  problems.forEach((text) => log(`  ERROR: ${text}`));
  reviews.forEach((text) => log(`  review: ${text}`));
  if (statics.length) {
    log(`  ${statics.length} stretch(es) where the picture holds still for more than ${STATIC_SECONDS}s while the voice continues:`);
    for (const item of statics) {
      log(`    ${item.scene.id} beat ${item.beat}: ${(item.end - item.start).toFixed(1)}s still (${clock(item.start)}–${clock(item.end)})`);
    }
    // Every kind that can hold still has its advice; a kind added later without any still gets the general rule.
    for (const kind of new Set(statics.map((item) => item.scene.kind))) log(`    ${kind}: ${STATIC_ADVICE[kind] || 'change the picture on the words that name what changes: a cue ("cues": [{"at": "<phrase>", ...}]) on the next part, or a "focus" on the one the sentence is about'}.`);
  }
  if (seams.length) {
    log(`  ${seams.length} seam(s), where the video stops being one continuous thing:`);
    seams.forEach((seam) => log(`    ${seam.text}`));
  }
  if (!problems.length && !reviews.length && !statics.length) log('  complete, audible, in sync, and the picture keeps moving.');
  if (measured && !seams.length) {
    log(`  no seams: no single-frame changes, ${measured.joins.length ? `${measured.joins.length} carried-on join(s) match frame for frame` : 'no carried-on joins'}, the voice never stops for long, and its level is steady.`);
  }
  if (problems.length) process.exitCode = 1;
  return {problems, reviews, statics, seams};
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

/** One frame for each visual state of the video, late in the state, when its transitions have settled and it is what the viewer dwells on. */
const settledShots = (props) =>
  props.scenes.flatMap((scene, sceneIndex) =>
    scene.steps.map((step, stepIndex) => {
      const local = Math.min(step.cue + Math.max(0, Math.round(step.cueFrames * 0.8) - 1), scene.frames - lastLook(scene));
      const frame = scene.from + Math.max(step.cue, local);
      const part = scene.steps.filter((entry, index) => entry.beat === step.beat && index <= stepIndex).length;
      const sub = part > 1 ? String.fromCharCode(96 + part) : '';
      return {frame, scene, sceneIndex, beat: step.beat, sub, label: `${String(sceneIndex + 1).padStart(2, '0')} ${scene.id} · beat ${step.beat + 1}${sub} · ${clock(frame / props.fps)}`};
    }),
  );

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
    shots.push(...settledShots(props).filter((shot) => !only.length || only.includes(shot.scene.id)));
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
  } else log('layout: nothing runs off the frame, collides, or is cut off in the measured scenes (every kind drawn by Remotion: title, code, bullets, stat, compare, chart, table, matrix, quote, figure).');
  return {dir, findings};
};

// ---------------------------------------------------------------------------------------------
// review

const RENDERER_NAME = {title: 'opening statement', credit: 'end card', code: 'code', trace: 'code + animation', hyperframes: 'HyperFrames clip', manim: 'animation', diagram: 'diagram', bullets: 'bullets', stat: 'number', compare: 'side-by-side panels', chart: 'chart', table: 'table', matrix: 'matrix', quote: 'quote', figure: "the source's figure"};

/**
 * Everything an independent reviewer needs, in one file: what the video is for, what is said and
 * when, where the frames are, and what the automated checks found. The reviewer must be a fresh
 * agent that did not build the video; this brief is all it is given.
 */
export const review = async (paths, {verify, plan, graphics, force} = {}) => {
  if (plan) return reviewPlan(paths);
  if (graphics) return reviewGraphics(paths, {force});
  const video = path.join(paths.out, 'video.mp4');
  if (!existsSync(video)) fail('Nothing to review yet. Run `va render <project>` first.');
  const {storyboard} = load(paths);
  const routing = routingOf(paths, storyboard);
  const ledger = await facts(paths);
  const failed = ledger.rows.filter((entry) => entry.status === 'differs' || entry.status === 'missing');
  const ledgerLine = [
    !ledger.rows.length ? 'no facts declared, so no number in the video is computed by anything'
      : failed.length ? `${failed.length} of ${ledger.rows.length} do not hold (${failed.map((entry) => entry.id).join(', ')})`
        : `${ledger.rows.length} declared; every computed one agrees with the oracle`,
    ledger.loose.length ? `${ledger.loose.length} number(s) said or shown with no fact behind them (${ledger.loose.map((number) => `"${number.text}"`).join(', ')})` : null,
  ].filter(Boolean).join('; ');
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
    'You are reviewing a narrated explainer video. You did not make it, and nobody will tell you what was intended beyond this page. Judge what is on screen and what was measured.',
    '',
  );
  out.push('## What the video is for', '');
  out.push(`- Subject: ${routing.subject}${storyboard.brief?.audience ? `; audience: ${storyboard.brief.audience}` : ''}${storyboard.brief?.focus ? `; focus: ${storyboard.brief.focus}` : ''}`);
  // What it is made from, whole: a paper's claims are judged against the paper, not only the lines on screen.
  const root = path.resolve(paths.dir, storyboard.sourceRoot);
  for (const source of storyboard.sources) {
    out.push(`- Made from: ${source.title || source.id} (${source.kind})${source.path ? `, at ${path.resolve(root, source.path)}` : ''}${source.url ? `, ${source.url}` : ''}. Read it before you judge what the video says about it.`);
  }
  out.push(`- Length: ${fmtSeconds(props.totalFrames / props.fps)}${storyboard.brief?.length ? ` (asked for about ${storyboard.brief.length}s)` : ''}`);
  if (storyboard.brief?.context) out.push(`- The context it means to give first: ${storyboard.brief.context}`);
  if (storyboard.brief?.hook) out.push(`- The hook it means to land after that: ${storyboard.brief.hook.replace(/\*/g, '')}`);
  out.push('');
  out.push('| # | Starts | Scene | Viewer needs to see | Shown as | Why |', '|---|---|---|---|---|---|');
  props.scenes.forEach((scene, index) => {
    const source = authored.get(scene.id);
    const drawn = routing.rows.find((entry) => entry.id === scene.id)?.sources || [];
    out.push(`| ${index + 1} | ${clock(scene.from / props.fps)} | ${scene.id} | ${source.need || '(not declared)'} | ${RENDERER_NAME[scene.kind]}${storyboard.sources.length > 1 && drawn.length ? ` (from ${drawn.join(' + ')})` : ''} | ${source.why || ''} |`);
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
  out.push('', '## Who it has to work for', '');
  out.push('The video makes a contract with three viewers. Watch it once as each.', '', ...viewerContracts(), '');
  out.push('## What the automated checks found', '');
  out.push('```', formatRouting(routing), '```', '');
  out.push(`- Facts: ${ledgerLine}`);
  out.push(`- Layout: ${findings.length ? findings.flatMap((entry) => entry.issues.map((issue) => `${entry.label}: ${issue}`)).join('; ') : 'no issues measured'}`);
  out.push(`- File: ${checks.problems.length ? checks.problems.join('; ') : 'complete, with audio'}${checks.reviews.length ? `; ${checks.reviews.join('; ')}` : ''}`);
  out.push(
    `- Still picture: ${checks.statics.length ? checks.statics.map((item) => `${item.scene.id} beat ${item.beat} holds for ${(item.end - item.start).toFixed(1)}s from ${clock(item.start)}`).join('; ') : 'no stretch longer than 6s'}`,
    `- Seams: ${checks.seams.length ? checks.seams.map((seam) => seam.text).join(' ') : 'none measured (no single-frame changes, carried-on joins match, no long silences, steady voice level)'}`,
    '',
  );

  if (verify) {
    out.push('## Your job: verify the previous round', '');
    out.push(`The previous review is at ${path.resolve(verify)}. For every defect and fix it lists, look at the new frames and say FIXED, PARTLY, or STILL PRESENT, with the time. Where the builder has written a disposition under a finding (fixed, answered, or deferred), judge the disposition too: an "answered" that does not answer the finding is STILL PRESENT. Then list anything new that is wrong: fixes often break something next to them.`, '');
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
      '9. **Say each scene back.** As the newcomer, write the one sentence you would give a friend about each scene: what happened, and why it mattered. A scene you cannot do that for is a blocker, whatever else is right about it.',
      '10. **Numbers and absolutes.** Is every number on screen the number the voice says, rounded the same way? Does any sentence say always, never, at most, or at least where the picture shows only one case?',
      '',
    );
    out.push('## Your report', '');
    out.push(`Write it to ${reportPath}, under 500 words, with no praise:`, '');
    out.push('- **Verdict:** SHIP or REVISE.', '- **Scene by scene:** your one sentence for each.', '- **Defects**, most serious first. Each one: scene · beat · time, blocker, major, or minor, what is wrong, and what in the frame shows it.', '- **Top fixes**, at most five, each concrete enough to act on (which scene, what to change).');
  }
  const briefPath = path.join(reviewDir, `brief-${round}.md`);
  writeFileSync(briefPath, out.join('\n') + '\n');
  log('');
  log(`review: brief for an independent reviewer → ${briefPath}`);
  log(`  Give that file, and nothing else, to a fresh agent. It writes ${reportPath}.`);
  return {briefPath, reportPath, round};
};

/**
 * The last look, and the only one of its kind: every visual state cut from the finished MP4 itself,
 * read scene by scene by fresh agents who ask of each one only whether the graphic could be better
 * for the person watching. A stated audience gets one reviewer who is that audience; with none
 * stated, the three viewers each get one, as in the other reviews. Each reads many full-size
 * frames, so it is expensive, and it runs once per video.
 */
const reviewGraphics = async (paths, {force} = {}) => {
  const video = path.join(paths.out, 'video.mp4');
  if (!existsSync(video)) fail('Nothing to review yet. Run `va render <project>` first.');
  const reviewDir = path.join(paths.out, 'review');
  mkdirSync(reviewDir, {recursive: true});
  const done = readdirSync(reviewDir).filter((name) => /^graphics-.+-report\.md$/.test(name));
  if (done.length && !force) {
    fail(`The graphics review has already run: ${done.map((name) => path.join(reviewDir, name)).join(', ')}. It reads every frame at full size, so it runs once per video. Act on those reports; pass --force only if the user asks for another.`);
  }
  const {storyboard} = load(paths);
  const {props} = await buildProps(paths);
  const frameDir = path.join(reviewDir, 'graphics');
  rmSync(frameDir, {recursive: true, force: true});
  mkdirSync(frameDir, {recursive: true});

  // Cut from the rendered file, not redrawn: this is exactly what a viewer sees, encoding and all.
  const shots = settledShots(props);
  log(`review: cutting ${shots.length} frame(s) from ${video}...`);
  for (const shot of shots) {
    shot.file = path.join(frameDir, `${String(shot.sceneIndex + 1).padStart(2, '0')}-${shot.scene.id}-beat${shot.beat + 1}${shot.sub}.png`);
    await run('ffmpeg', ['-y', '-v', 'error', '-ss', (shot.frame / props.fps).toFixed(3), '-i', video, '-frames:v', '1', shot.file], {capture: true});
  }

  const brief = storyboard.brief || {};
  // The person the video was made for. With nobody stated, the three viewers stand in, as they do in the other reviews.
  const viewers = brief.audience
    ? [{key: 'audience', name: 'the audience', who: `You are the person this video was made for: ${brief.audience}.${brief.focus ? ` You came for this: ${brief.focus}.` : ''}`, contract: 'Every picture gives you what you came for, at the depth this video has time for, and nothing on screen is in your way.'}]
    : Object.entries(VIEWERS).map(([key, viewer]) => ({key, name: viewer.name, who: viewer.who, contract: viewer.contract}));

  const authored = new Map(storyboard.scenes.map((scene) => [scene.id, scene]));
  const scenes = [];
  props.scenes.forEach((scene, index) => {
    const source = authored.get(scene.id);
    scenes.push(`### ${index + 1}. ${scene.id} · ${RENDERER_NAME[scene.kind]} · ${clock(scene.from / props.fps)} · on screen ${fmtSeconds(scene.frames / props.fps)}`, '');
    scenes.push(`- Viewer needs to see: ${source.need || '(not declared)'}`);
    if (source.why) scenes.push(`- Why this picture: ${source.why}`);
    if (source.ref) scenes.push(`- From the source: ${source.ref}`);
    scenes.push('- The voice:');
    source.beats.forEach((beat, beatIndex) => scenes.push(`  ${beatIndex + 1}. ${beat.say}`));
    scenes.push('- Frames (read every one):');
    shots.filter((shot) => shot.scene === scene).forEach((shot) => scenes.push(`  - beat ${shot.beat + 1}${shot.sub}: ${shot.file}`));
    scenes.push('');
  });

  log('');
  log(`review: ${shots.length} frame(s) cut from the video → ${frameDir}`);
  log(`  graphics brief${viewers.length > 1 ? 's, one per viewer (no audience in the brief)' : ` for ${brief.audience}`}. Give each to its own fresh agent, and nothing else:`);
  const briefs = viewers.map((viewer) => {
    const briefPath = path.join(reviewDir, `graphics-${viewer.key}.md`);
    const reportPath = path.join(reviewDir, `graphics-${viewer.key}-report.md`);
    const out = [];
    out.push(`# Graphics review, as ${viewer.name}: ${storyboard.title}`, '');
    out.push(
      'You are judging the graphics of a narrated explainer video, scene by scene. You did not make it. Each frame below was cut from the finished video file, late in each visual state, when it has settled. Judge only what is on screen, and whether a better picture was possible for you.',
      '',
    );
    out.push('## Who you are', '', viewer.who, '', `**The contract:** ${viewer.contract}`, '');
    out.push('## The video', '');
    out.push(`- Subject: ${storyboard.title}`);
    if (brief.focus) out.push(`- What it sets out to answer: ${brief.focus}`);
    out.push(`- Length: ${fmtSeconds(props.totalFrames / props.fps)}${brief.length ? ` (asked for about ${brief.length}s)` : ''}`);
    for (const source of storyboard.sources) out.push(`- Made from: ${source.title || source.id} (${source.kind})${source.url ? `, ${source.url}` : ''}`);
    out.push(`- Video, if you need to see motion: ${video}`, '');
    out.push('## The scenes', '', ...scenes);
    out.push(`The video runs ${fmtSeconds(props.totalFrames / props.fps)}, and each scene shows how long it is on screen. Suggest the best use of the time there is, not more time.`, '');
    out.push('## What to judge, for each scene, as yourself', '');
    out.push(
      '1. **Can this graphic be improved for you?** Answer yes or no first. "No" is a good answer when the frame is right; do not invent a defect.',
      '2. **If yes, how.** Name the change concretely: what to add, remove, enlarge, recolour, move, or show instead. Say whether it is a change to this scene, or a different kind of picture.',
      '3. **Does it carry what you came for, in the time it has?** Given the length and the focus above, does the picture show enough? A rich result (many rows, datasets, or conditions) collapsed into one number, when the scene has the time and you want more, is a finding. So is a frame too dense to read in the seconds it is on screen.',
      '4. **Craft.** Legibility at normal size, contrast, alignment, empty space, a colour that means two things, a label that names nothing.',
      '5. **What the skill could not do.** If the better picture needs something the scene kinds cannot draw (a kind of chart, an error bar, a layout), say so as its own item. These go back into the skill.',
      '',
    );
    out.push('## Your report', '');
    out.push(`Write it to ${reportPath}, with no praise:`, '');
    out.push(
      '- **Scene by scene:** one line each: `<n>. <id>: KEEP` or `<n>. <id>: IMPROVE: <the change>`.',
      '- **Top improvements**, at most five, the largest gain for you first. Each one: scene · beat, what to change, and what in the frame shows the need.',
      '- **Missing capabilities:** what the skill should be able to draw and cannot. Write "none" if none.',
    );
    writeFileSync(briefPath, out.join('\n') + '\n');
    log(`  ${viewer.name.padEnd(16)} ${briefPath}`);
    return {viewer: viewer.key, briefPath, reportPath};
  });
  log('  This review runs once.');
  return {briefs, frames: shots.length};
};

/**
 * The review that costs nothing to act on: the script and storyboard, read by three fresh agents
 * before anything is recorded or drawn. One brief per viewer; each reviewer is given one and
 * nothing else.
 */
const reviewPlan = async (paths) => {
  const {storyboard} = load(paths, {gate: false});
  const routing = routingOf(paths, storyboard);
  const ledger = await facts(paths);
  const reviewDir = path.join(paths.out, 'review');
  mkdirSync(reviewDir, {recursive: true});
  const round = Math.max(0, ...readdirSync(reviewDir).map((name) => Number(name.match(/^plan-(\d+)-/)?.[1] || 0))) + 1;
  const scriptFile = path.join(paths.dir, 'script.md');
  const script = existsSync(scriptFile) ? scriptProse(readFileSync(scriptFile, 'utf8')).replace(/\s+/g, ' ') : '';
  const root = path.resolve(paths.dir, storyboard.sourceRoot);
  const quoted = [...new Set(storyboard.scenes.flatMap((scene) => [scene.file, ...(scene.versions || []).map((version) => version.file)]).filter(Boolean))].map((file) => path.resolve(root, file));
  // A document the video is made from is read whole by the reviewers, not only the lines it quotes.
  const declared = storyboard.sources.map((source) => (source.path ? path.resolve(root, source.path) : source.url)).filter(Boolean);
  const sources = [...new Set([...declared, ...quoted])];

  log('');
  log(`review: plan round ${round}, one brief per viewer. Give each to its own fresh agent, and nothing else:`);
  const briefs = Object.keys(VIEWERS).map((viewer) => {
    const briefPath = path.join(reviewDir, `plan-${round}-${viewer}.md`);
    const reportPath = path.join(reviewDir, `plan-${round}-${viewer}-report.md`);
    writeFileSync(briefPath, planBrief({viewer, storyboard, script, routingText: formatRouting(routing), ledger, sources, drawn: Object.fromEntries(routing.rows.map((entry) => [entry.id, entry.sources])), reportPath, paper: loadPaper(paths.dir)}));
    log(`  ${VIEWERS[viewer].name.padEnd(16)} ${briefPath}`);
    return {viewer, briefPath, reportPath};
  });
  log('  Then give every finding a disposition (fixed, answered, or deferred) before `va tts`.');
  return {round, briefs};
};

export const studio = async (paths) => {
  ensureRuntime();
  const {file} = await buildProps(paths);
  await remotion(['studio', 'src/index.ts', `--props=${file}`, `--public-dir=${paths.public}`]);
};

export const build = async (paths, options = {}) => {
  // A number that does not hold is cheapest to find before anything is recorded or drawn.
  const ledger = await facts(paths);
  if (!ledger.ok) fail('The facts do not hold, so nothing was built. Fix what `va facts` lists and run the build again.');
  await prose(paths);
  await tts(paths);
  await diagram(paths, [], options);
  await manim(paths, [], options);
  await hyperframes(paths, [], options);
  return render(paths, options);
};

// ---------------------------------------------------------------------------------------------
// sources

// Tools that turn a figure's PDF or EPS into a PNG, best first. Each takes (input, output) and renders page one at about 300 dpi.
const RASTERIZERS = [
  ['pdftoppm', (input, output) => ['-png', '-r', '300', '-singlefile', input, output.replace(/\.png$/, '')]],
  ['mutool', (input, output) => ['draw', '-r', '300', '-o', output, input, '1']],
  ['magick', (input, output) => ['-density', '300', `${input}[0]`, output]],
  ['gs', (input, output) => ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dEPSCrop', '-sDEVICE=png16m', '-r300', '-dFirstPage=1', '-dLastPage=1', `-sOutputFile=${output}`, input]],
  ['sips', (input, output) => ['-s', 'format', 'png', input, '--out', output]],
];
const RASTER = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

/** Text of a PDF, for a paper that comes only as one. */
const pdfText = async (file) => {
  if (has('pdftotext')) return (await run('pdftotext', ['-layout', file, '-'], {capture: true, allowFail: true})).stdout;
  if (has('gs')) return (await run('gs', ['-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=txtwrite', '-sOutputFile=-', file], {capture: true, allowFail: true})).stdout;
  return null;
};

/**
 * What each source holds, read before a word is written: for a document, its sections, figures (and
 * the files behind them), tables, algorithms, and code listings, each with where it is; for a PDF
 * alone, its text. `--figures` exports every figure to a PNG in the project, ready for a figure scene.
 */
export const sources = async (paths, {figures: exportFigures = false} = {}) => {
  const {storyboard} = load(paths, {gate: false});
  if (!storyboard.sources.length) {
    fail(`No "sources" in the storyboard. Say what the video is made from first: [{"id": "...", "kind": "${Object.keys(SOURCE_KINDS).join('" | "')}", "path": "...", "url": "..."}].`);
  }
  const root = path.resolve(paths.dir, storyboard.sourceRoot);
  const report = {};
  for (const source of storyboard.sources) {
    log(`${source.id} (${source.kind}${isDocument(source) ? ', document rules apply' : ''})${source.title ? `: ${source.title}` : ''}`);
    log(`  ${SOURCE_KINDS[source.kind].says}`);
    if (!source.path) {
      log(`  no "path": nothing on disk to list${source.url ? ` (read it at ${source.url})` : ''}.`);
      if (source.kind === 'paper' && /arxiv\.org\/(abs|pdf)\//.test(source.url || '')) {
        log(`  An arXiv paper's LaTeX source has its figures, tables, and any code as files: download https://arxiv.org/e-print/${source.url.split(/\/(abs|pdf)\//)[2].replace(/\.pdf$/, '')}, unpack it into its own folder, and set "path".`);
      }
      log('');
      continue;
    }
    // A paper is read in by `va paper`: its abstract, sections, tables, figures, and licence, in paper/.
    if (source.kind === 'paper') {
      log(`  Read it in with \`va paper <project> ${source.url || source.path}\`; then read paper/paper.md. See references/paper.md.\n`);
      continue;
    }
    const found = inventory(source, root);
    report[source.id] = found;
    if (found.missing) {
      log(`  path not found: ${path.resolve(root, source.path)}\n`);
      continue;
    }
    if (found.pdf) {
      // A PDF alone: its text, with the characters that extraction gets wrong pointed out.
      const text = await pdfText(found.pdf);
      if (text === null) log('  A PDF, and no pdftotext or gs to read it with. Install poppler, or get the LaTeX source.');
      else {
        const out = path.join(paths.cache, 'sources', `${source.id}.txt`);
        mkdirSync(path.dirname(out), {recursive: true});
        writeFileSync(out, text);
        log(`  A PDF: its text is in ${out} (${text.split('\n').length} lines). Quote from there with "file" and "range".`);
        const soft = (text.match(/\u00ad/g) || []).length;
        if (soft) log(`  warning: ${soft} soft hyphen(s) (U+00AD). Some PDFs encode a minus sign that way: check every one in a line you quote.`);
        log('  Figures, tables, and listings cannot be told apart in a PDF. If it is on arXiv, get the LaTeX source instead.');
      }
      log('');
      continue;
    }
    if (!isDocument(source)) {
      log(`  ${found.files.length} file(s).\n`);
      continue;
    }
    const where = (item) => `${item.file}:${item.range ? `${item.range[0]}-${item.range[1]}` : item.line}`;
    if (found.sections.length) log(`  Sections: ${found.sections.filter((section) => section.depth === 1).map((section) => section.title).join(' · ')}`);
    log(`  Figures (${found.figures.length}): show the source's own with a "figure" scene; do not redraw one it already drew.`);
    for (const figure of found.figures) {
      log(`    ${figure.ref}${figure.label ? ` [${figure.label}]` : ''}  ${where(figure)}  ${figure.caption ? `"${figure.caption.slice(0, 90)}${figure.caption.length > 90 ? '...' : ''}"` : '(no caption)'}`);
      figure.exported = [];
      for (const [index, file] of (figure.paths || []).entries()) {
        if (!file) {
          log(`      ${figure.images[index]}: not found on disk`);
          continue;
        }
        const target = path.join(paths.dir, 'figures', `${source.id}-${path.basename(file).replace(/\.[^.]+$/, '')}.png`);
        if (exportFigures) {
          mkdirSync(path.dirname(target), {recursive: true});
          const ext = path.extname(file).toLowerCase();
          if (RASTER.includes(ext)) copyFileSync(path.resolve(root, file), target.replace(/\.png$/, ext));
          else {
            const tool = RASTERIZERS.find(([name]) => has(name));
            if (!tool) {
              log(`      ${file}: no pdftoppm, mutool, magick, gs, or sips to turn it into a PNG`);
              continue;
            }
            await run(tool[0], tool[1](path.resolve(root, file), target), {capture: true, allowFail: true});
          }
        }
        const made = [target, target.replace(/\.png$/, path.extname(file).toLowerCase())].find((candidate) => existsSync(candidate));
        if (made) figure.exported.push(path.relative(paths.dir, made));
        log(`      ${file}${made ? ` → ${path.relative(paths.dir, made)}` : exportFigures ? ' (export failed)' : ''}`);
      }
    }
    if (!exportFigures && found.figures.some((figure) => (figure.paths || []).some(Boolean))) log('    Run `va sources <project> --figures` to export them as PNGs into figures/.');
    log(`  Tables (${found.tables.length}): a "table" of the rows the sentence compares, or a "chart" of the values; say which with "ref".`);
    for (const table of found.tables) log(`    ${table.ref}${table.label ? ` [${table.label}]` : ''}  ${where(table)}  ${table.caption ? `"${table.caption.slice(0, 90)}"` : ''}`);
    log(`  Algorithms and listings (${found.listings.length}): the only parts of a document to show as code.`);
    for (const listing of found.listings) log(`    ${listing.env}  ${where(listing)}`);
    if (found.code.length) log(`  Code shipped with it (${found.code.length}): ${found.code.slice(0, 8).join(', ')}${found.code.length > 8 ? ', ...' : ''}. Real code reads better than an algorithm block: quote it.`);
    log('');
  }
  writeJson(path.join(paths.cache, 'sources.json'), report);
  return report;
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
  // paper/ is somebody else's paper, read in by `va paper`: fetched again when needed, never republished from here.
  writeFileSync(path.join(target, '.gitignore'), 'public/\n.cache/\nout/\ntimeline.json\npaper/\n');
  writeFileSync(
    path.join(target, 'script.md'),
    [
      '<!-- The whole narration, written as one piece before any scene exists. No scene labels, no stage directions.',
      '     Read it aloud from top to bottom. Then split it: a paragraph becomes a scene, a sentence or two becomes a beat.',
      '     `va route` checks that the storyboard says these words, in this order, and nothing else. -->',
      '',
      'Replace this with the opening: a sentence or two from where the viewer already is, then the hook, said over the picture that shows it.',
      '',
    ].join('\n'),
  );
  writeFileSync(
    path.join(target, 'facts.py'),
    [
      '"""The oracle: every number the video says or shows, computed by running the code it is about.',
      '',
      '`va facts` runs this and compares what it prints with the storyboard\'s "facts". Import the real code,',
      'run it on the video\'s own example, and count what it does. Restate nothing: a number typed here',
      'checks nothing.',
      '"""',
      '',
      'import json',
      'import sys',
      'from pathlib import Path',
      '',
      `sys.path.insert(0, str((Path(__file__).resolve().parent / ${JSON.stringify(path.relative(target, process.cwd()) || '.')}).resolve()))`,
      '',
      '# from the_module import the_function',
      '',
      'print(json.dumps({',
      '    # "fact-id": value computed above,',
      '}))',
      '',
    ].join('\n'),
  );
  writeJson(path.join(target, 'storyboard.json'), {
    title: 'Untitled explainer',
    voice: 'en-US-AndrewNeural',
    sourceRoot: path.relative(target, process.cwd()) || '.',
    brief: {
      audience: 'Who is watching, and what they already know.',
      length: 90,
      focus: 'The one question the video answers.',
      context: 'Where the viewer already is, and the one step from there to the subject: what the opening says first.',
      hook: 'The core of the problem, or the most *surprising* thing about the answer, in one sentence.',
    },
    facts: [],
    vocabulary: [],
    sources: [],
    scenes: [
      {
        id: 'open',
        need: 'motion',
        why: 'Opening: the picture the viewer already knows, then the hook said over what happens to it.',
        class: 'Open',
        beats: [{say: 'Replace this with the opening: a sentence or two from where the viewer already is, then the hook, said over the picture that shows it.'}],
      },
    ],
  });
  log(target);
  return target;
};

