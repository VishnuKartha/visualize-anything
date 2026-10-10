#!/usr/bin/env node
// visualize-anything CLI. One storyboard in, one narrated video out; each step is rerunnable
// and cached, so fixing a single scene never redoes the rest.
import {existsSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import * as steps from './lib/steps.mjs';
import {resolveProject} from './lib/storyboard.mjs';
import {
  ARCHIFY_BIN, ARCHIFY_DIR, ARCHIFY_REF, ARCHIFY_REPO, MANIM_UV_ARGS, RUNTIME_DIR, TYPST_SPEC, VaError, findChrome, has,
  manimEnv, run,
} from './lib/util.mjs';

// Typesets one formula each way, which also downloads Manim, Typst, and the LaTeX-syntax package.
const WARM_MATH = "from va_manim import Math; Math('x^2'); Math(r'\\frac{a}{b}', latex=True)";
const mathReady = async ({offline}) => {
  const result = await run('uv', ['run', '--quiet', ...(offline ? ['--offline'] : []), ...MANIM_UV_ARGS, 'python', '-c', WARM_MATH], {
    env: manimEnv(),
    capture: true,
    allowFail: true,
  });
  return {ok: result.code === 0, detail: result.stderr.trim().split('\n').slice(-3).join('\n')};
};

const USAGE = `Usage: va <command> [args]

  setup                       Install runtime dependencies and the pinned Archify renderer
  doctor                      Report what is installed and what is missing
  init <slug> [--dir <path>]  Create .visualize/<slug>/ with a starter storyboard.json
  route <project>             Review every routing decision: need → renderer, with reasons
  check <project>             Validate storyboard.json and its routing (no network, no rendering)
  tts <project>               Synthesize narration; write timeline.json with every beat's time budget
  diagram <project> [ids...]  Finalize + bake Archify candidates for diagram scenes
  manim <project> [ids...]    Render Manim scenes to their exact narration length
  stills <project> [ids...]   One PNG per beat into out/stills/, for visual review
  render <project>            Compose everything with Remotion → out/video.mp4
  build <project>             tts → diagram → manim → render
  studio <project>            Open Remotion Studio on the project for interactive preview

Options: --draft (half resolution, faster)   --force (ignore caches)   --out <file> (render target)
<project> is a project directory or a slug under ./.visualize/.`;

const parse = (argv) => {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--draft' || arg === '--force') flags[arg.slice(2)] = true;
    else if (arg === '--out' || arg === '--dir') flags[arg.slice(2)] = argv[(i += 1)];
    else if (arg.startsWith('--')) throw new VaError(`Unknown option ${arg}`);
    else positional.push(arg);
  }
  return {flags, positional};
};

const setup = async () => {
  if (!existsSync(path.join(RUNTIME_DIR, 'node_modules', 'remotion'))) {
    console.log('Installing runtime dependencies (Remotion, Shiki, Puppeteer)...');
    await run('npm', ['install', '--no-audit', '--no-fund'], {cwd: RUNTIME_DIR});
  }
  if (!existsSync(ARCHIFY_BIN)) {
    console.log(`Fetching Archify @ ${ARCHIFY_REF.slice(0, 10)} → ${ARCHIFY_DIR}`);
    mkdirSync(ARCHIFY_DIR, {recursive: true});
    await run('git', ['init', '-q'], {cwd: ARCHIFY_DIR});
    await run('git', ['fetch', '-q', '--depth', '1', ARCHIFY_REPO, ARCHIFY_REF], {cwd: ARCHIFY_DIR});
    await run('git', ['checkout', '-q', 'FETCH_HEAD'], {cwd: ARCHIFY_DIR});
  }
  if (has('uv')) {
    console.log(`Preparing Manim and Typst (${TYPST_SPEC}) for animation scenes and formulas...`);
    const math = await mathReady({offline: false});
    if (!math.ok) console.log(`  warning: could not prepare them now; \`va manim\` will retry on first use.\n  ${math.detail}`);
  }
  await doctor();
};

const doctor = async () => {
  const rows = [];
  const add = (name, ok, detail, required = true) => rows.push({name, ok, detail, required});
  add('node >= 20', Number(process.versions.node.split('.')[0]) >= 20, process.versions.node);
  add('runtime deps', existsSync(path.join(RUNTIME_DIR, 'node_modules', 'remotion')), existsSync(path.join(RUNTIME_DIR, 'node_modules', 'remotion')) ? '' : 'run: va setup');
  add('ffmpeg + ffprobe', has('ffmpeg') && has('ffprobe'), has('ffmpeg') && has('ffprobe') ? '' : 'install ffmpeg');
  add('uv (runs edge-tts and Manim)', has('uv'), has('uv') ? '' : 'install from https://docs.astral.sh/uv/');
  add('Chrome (diagram scenes)', Boolean(findChrome()), findChrome() || 'install Google Chrome or set VA_CHROME');
  add('Archify (diagram scenes)', existsSync(ARCHIFY_BIN), existsSync(ARCHIFY_BIN) ? ARCHIFY_DIR : 'run: va setup');
  const math = has('uv') ? await mathReady({offline: true}) : {ok: false};
  add('Manim + Typst (animation scenes, formulas)', math.ok, math.ok ? 'Math() typesets formulas; no LaTeX needed' : 'run: va setup');
  add('LaTeX (optional)', has('latex'), has('latex') ? 'MathTex()/Tex() also work' : 'not installed, not needed: use Math() instead of MathTex()', false);
  for (const row of rows) {
    console.log(`${row.ok ? ' ok ' : row.required ? 'MISS' : ' -- '}  ${row.name}${row.detail ? `  (${row.detail})` : ''}`);
  }
  console.log(`\nArchify skill docs: ${path.join(ARCHIFY_DIR, 'archify', 'SKILL.md')}`);
  console.log(`Manim runs as: uv run ${MANIM_UV_ARGS.join(' ')} manim ...`);
  if (rows.some((row) => row.required && !row.ok)) process.exitCode = 1;
};

const main = async () => {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === 'help' || command === '--help' || command === '-h') return console.log(USAGE);
  const {flags, positional} = parse(rest);
  if (command === 'setup') return setup();
  if (command === 'doctor') return doctor();
  if (command === 'init') return steps.init(positional[0], flags);
  const paths = resolveProject(positional[0]);
  const ids = positional.slice(1);
  switch (command) {
    case 'route': return steps.route(paths);
    case 'check': return steps.check(paths);
    case 'tts': return steps.tts(paths);
    case 'diagram': return steps.diagram(paths, ids, flags);
    case 'manim': return steps.manim(paths, ids, flags);
    case 'stills': return steps.stills(paths, ids);
    case 'render': return steps.render(paths, flags);
    case 'build': return steps.build(paths, flags);
    case 'studio': return steps.studio(paths);
    default: throw new VaError(`Unknown command "${command}".\n\n${USAGE}`);
  }
};

main().catch((error) => {
  if (error instanceof VaError) console.error(`Error: ${error.message}`);
  else console.error(error);
  process.exit(1);
});
