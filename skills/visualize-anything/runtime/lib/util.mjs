import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const RUNTIME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SKILL_DIR = path.resolve(RUNTIME_DIR, '..');
export const VA_HOME = process.env.VISUALIZE_ANYTHING_HOME || path.join(homedir(), '.visualize-anything');

// Pinned so a diagram authored today renders the same next month.
export const ARCHIFY_REPO = 'https://github.com/tt-a1i/archify.git';
export const ARCHIFY_REF = '58ab0b98d2d0def8e49dced705c7b566936723ec';
export const ARCHIFY_DIR = process.env.VA_ARCHIFY_DIR || path.join(VA_HOME, 'vendor', 'archify');
export const ARCHIFY_BIN = path.join(ARCHIFY_DIR, 'archify', 'bin', 'archify.mjs');

// Manim's dependency stack lags the newest CPython; uv fetches this one on demand.
export const MANIM_PYTHON = process.env.VA_MANIM_PYTHON || '3.12';

// Everything a Manim scene runs with. Typst typesets formulas, so no TeX installation is needed.
export const TYPST_SPEC = process.env.VA_TYPST_SPEC || 'typst==0.15.*';
// Pinned to the release the helper's primitives were built and checked against.
export const MANIM_SPEC = process.env.VA_MANIM_SPEC || 'manim==0.22.*';
export const MANIM_UV_ARGS = ['--python', MANIM_PYTHON, '--with', MANIM_SPEC, '--with', TYPST_SPEC];
export const manimEnv = (extra = {}) => ({
  VA_THEME: path.join(RUNTIME_DIR, 'theme.json'),
  PYTHONPATH: [path.join(RUNTIME_DIR, 'python'), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
  ...extra,
});

export class VaError extends Error {}

export const fail = (message) => {
  throw new VaError(message);
};

export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

export const writeJson = (file, value) => {
  mkdirSync(path.dirname(file), {recursive: true});
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};

export const sha = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');

export const has = (command) =>
  spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], {stdio: 'ignore'}).status === 0;

/** Run a command, streaming its output unless `capture` is set. Rejects on a non-zero exit. */
export const run = (command, args, {cwd, env, capture = false, allowFail = false} = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {...process.env, ...env},
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    let stdout = '';
    let stderr = '';
    if (capture) {
      child.stdout.on('data', (chunk) => (stdout += chunk));
      child.stderr.on('data', (chunk) => (stderr += chunk));
    }
    child.on('error', (error) => reject(new VaError(`Could not start ${command}: ${error.message}`)));
    child.on('close', (code) => {
      if (code === 0 || allowFail) {
        resolve({code, stdout, stderr});
      } else {
        const tail = capture ? `\n${(stderr || stdout).trim().split('\n').slice(-25).join('\n')}` : '';
        reject(new VaError(`${command} ${args.slice(0, 3).join(' ')} exited with code ${code}${tail}`));
      }
    });
  });

export const ffprobeDuration = async (file) => {
  const {stdout} = await run(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file],
    {capture: true},
  );
  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds)) fail(`ffprobe could not read a duration from ${file}`);
  return seconds;
};

export const findChrome = () => {
  const candidates = [
    process.env.VA_CHROME,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  for (const command of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const found = spawnSync('which', [command], {encoding: 'utf8'});
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }
  return null;
};

export const fmtSeconds = (seconds) => `${seconds.toFixed(2)}s`;
