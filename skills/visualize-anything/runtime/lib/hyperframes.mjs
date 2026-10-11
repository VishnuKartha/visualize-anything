// HyperFrames as a second scene renderer. A HyperFrames scene is an HTML composition rendered to a
// clip of the scene's exact length, which Remotion then places on the timeline like a Manim clip.
// It is used where its strengths lie: code that changes shape, and one-off designed compositions.
import {copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {RUNTIME_DIR, fail, readJson, run} from './util.mjs';

// Pinned: a composition written against one version of the renderer should not change under us.
export const HYPERFRAMES_VERSION = process.env.VA_HYPERFRAMES_VERSION || '0.8.145';

// Only `render` is ever invoked. `init` and `add` are avoided on purpose: `init` installs
// HyperFrames' own agent skills into the user's global skill directories.
const QUIET = {HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1'};
export const hyperframes = (args, options = {}) =>
  run('npx', ['--yes', `hyperframes@${HYPERFRAMES_VERSION}`, ...args], {...options, env: {...QUIET, ...options.env}});

const THEME = readJson(path.join(RUNTIME_DIR, 'theme.json'));
const TEMPLATE = path.join(RUNTIME_DIR, 'hyperframes', 'code-change.html');

// Same region and sizing rules as the Remotion code panel, so a change scene lines up with a code scene.
const REGION = {x: 150, y: 112, w: 1620, h: 790};
const HEADER = 58;
const PAD_X = 34;
const PAD_Y = 26;
const CHAR = 0.6;

const fit = (versions) => {
  const lines = versions.map((version) => version.code.split('\n'));
  const widest = Math.max(1, ...lines.flat().map((line) => line.length));
  const tallest = Math.max(...lines.map((list) => list.length));
  const viewHeight = REGION.h - HEADER - PAD_Y * 2;
  const fontSize = Math.min(40, Math.max(22, Math.min((REGION.w - PAD_X * 2) / (widest * CHAR), viewHeight / (tallest * 1.6))));
  const lineHeight = Math.round(fontSize * 1.6);
  const w = Math.min(REGION.w, Math.max(1100, widest * CHAR * fontSize + PAD_X * 2 + 40));
  const h = Math.min(REGION.h, tallest * lineHeight + HEADER + PAD_Y * 2);
  return {fontSize: Math.round(fontSize * 10) / 10, lineHeight, panel: {x: REGION.x + (REGION.w - w) / 2, y: REGION.y + (REGION.h - h) / 2, w, h}, widest, tallest};
};

const strip = (keyed) => keyed.tokens.map(({content, color, fontStyle, key}) => ({content, color, fontStyle: fontStyle || 0, key}));

/**
 * The data a code-change composition runs on: each version highlighted, and for each change the
 * two versions with matching tokens given matching keys, so they can travel instead of blinking.
 * `changes` is [{at: seconds into the scene, to: version index}], in order.
 */
export const planCodeChange = async ({id, title, lang, effect, versions, initial = 0, changes, duration}) => {
  const {createHighlighter} = await import('shiki');
  const {codeToKeyedTokens, syncTokenKeys} = await import('shiki-magic-move/core');
  let highlighter;
  let language = lang;
  try {
    highlighter = await createHighlighter({themes: [THEME.codeTheme], langs: [lang]});
  } catch {
    language = 'text';
    highlighter = await createHighlighter({themes: [THEME.codeTheme], langs: []});
  }
  const keyed = versions.map((version) => codeToKeyedTokens(highlighter, version.code, {lang: language, theme: THEME.codeTheme}));
  let shown = initial;
  const planned = changes.map((change) => {
    // Whole tokens travel. Splitting them into characters matches more, but reads as letter soup mid-flight.
    const {from, to} = syncTokenKeys(keyed[shown], keyed[change.to], {splitTokens: false, enhanceMatching: true});
    shown = change.to;
    return {at: Math.round(change.at * 1000) / 1000, from: strip(from), to: strip(to)};
  });
  highlighter.dispose?.();
  return {
    id: `va-${id}`,
    duration,
    effect,
    title,
    lang,
    theme: THEME,
    ...fit(versions),
    initial: strip(keyed[initial]),
    changes: planned,
  };
};

/** Everything a composition may load, placed beside it so a render never touches the network. */
const provision = (dir) => {
  mkdirSync(path.join(dir, 'fonts'), {recursive: true});
  copyFileSync(path.join(RUNTIME_DIR, 'node_modules', 'gsap', 'dist', 'gsap.min.js'), path.join(dir, 'gsap.min.js'));
  for (const family of ['jetbrains-mono', 'inter']) {
    const files = path.join(RUNTIME_DIR, 'node_modules', '@fontsource', family, 'files');
    for (const name of readdirSync(files)) {
      if (/-latin-(400|500|600|700|800)-normal\.woff2$/.test(name)) copyFileSync(path.join(files, name), path.join(dir, 'fonts', name));
    }
  }
  writeFileSync(path.join(dir, 'va.css'), STYLESHEET);
  writeFileSync(path.join(dir, 'va.js'), HELPERS);
};

// What an authored composition can lean on so it matches the rest of the video: the palette as CSS
// variables, the two bundled typefaces, the shared backdrop, and two helpers for timing.
const FACES = [['Inter', 'inter'], ['JetBrains Mono', 'jetbrains-mono']]
  .flatMap(([family, slug]) => [400, 500, 600, 700, 800].map((weight) => `@font-face { font-family: "${family}"; font-weight: ${weight}; src: url("fonts/${slug}-latin-${weight}-normal.woff2") format("woff2"); }`))
  .join('\n');

const STYLESHEET = `/* Provided by visualize-anything. Link it from a composition: <link rel="stylesheet" href="va.css"> */
${FACES}
:root {
${Object.entries(THEME).filter(([, value]) => /^#/.test(value)).map(([name, value]) => `  --va-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}: ${value};`).join('\n')}
  --va-sans: "Inter", sans-serif;
  --va-mono: "JetBrains Mono", monospace;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1920px; height: 1080px; overflow: hidden; background: var(--va-bg); }
/* The backdrop every other scene sits on. Put <div class="va-backdrop"></div> first inside the root. */
.va-backdrop {
  position: absolute; inset: 0; background-color: var(--va-bg);
  background-image:
    radial-gradient(1200px 700px at 12% -10%, ${THEME.accent}14, transparent 70%),
    radial-gradient(1000px 700px at 100% 110%, ${THEME.violet}12, transparent 70%),
    linear-gradient(${THEME.grid} 1px, transparent 1px),
    linear-gradient(90deg, ${THEME.grid} 1px, transparent 1px);
  background-size: 100% 100%, 100% 100%, 64px 64px, 64px 64px;
}
`;

const HELPERS = `// Provided by visualize-anything. Load it after gsap: <script src="va.js"></script>
// window.VA = {id, duration, fps, theme, beats: [{text, start, end, speech, words: [{text, at}]}], at(), register()}
(function () {
  var VA = (window.VA = window.__VA || {beats: [], duration: 0});
  var tokens = function (text) { return String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean); };
  // Seconds into the scene at which a phrase is spoken. Throws if nobody says it.
  VA.at = function (phrase) {
    var heard = [];
    VA.beats.forEach(function (beat) { beat.words.forEach(function (word) { tokens(word.text).forEach(function (token) { heard.push({token: token, at: word.at}); }); }); });
    var needle = tokens(phrase);
    for (var i = 0; i + needle.length <= heard.length; i++) {
      var hit = needle.every(function (token, offset) { return heard[i + offset].token === token; });
      if (hit && needle.length) return heard[i].at;
    }
    throw new Error('VA.at("' + phrase + '"): that phrase is not in this scene\\'s narration');
  };
  // Hand a finished, paused GSAP timeline to the renderer: padded to the scene's length, registered
  // under the root's composition id once fonts are ready.
  VA.register = function (timeline) {
    var root = document.querySelector('[data-composition-id]');
    timeline.to({}, {duration: VA.duration}, 0);
    window.__timelines = window.__timelines || {};
    document.fonts.ready.then(function () {
      window.__timelines[root.getAttribute('data-composition-id')] = timeline;
      if (typeof window.__hfForceTimelineRebind === 'function') window.__hfForceTimelineRebind();
    });
  };
})();
`;

const inline = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

/** Write the built-in code-change composition for one scene into `dir`. */
export const writeCodeChange = (dir, plan) => {
  rmSync(dir, {recursive: true, force: true});
  provision(dir);
  // The renderer reads the composition's id and length from the markup before any script runs.
  const html = readFileSync(TEMPLATE, 'utf8')
    .replace('/*__VA__*/ null', inline(plan))
    .replace('__VA_ID__', plan.id)
    .replace('__VA_DURATION__', String(plan.duration));
  writeFileSync(path.join(dir, 'index.html'), html);
};

/**
 * Prepare an authored composition: copy it in, tell it the scene's length, and hand it the
 * narration timing as window.__VA so its timeline can land on the beats.
 */
export const writeAuthored = (dir, sourceFile, context) => {
  rmSync(dir, {recursive: true, force: true});
  provision(dir);
  let html = readFileSync(sourceFile, 'utf8');
  if (!/data-composition-id=/.test(html)) fail(`${sourceFile}: no element carries data-composition-id. A HyperFrames composition needs a root with that attribute.`);
  if (!/__timelines|VA\.register/.test(html)) fail(`${sourceFile}: the timeline is never registered. Call VA.register(timeline), or the clip will be a still frame.`);
  const root = html.match(/<[^>]*data-composition-id=[^>]*>/)[0];
  const sized = /data-duration=/.test(root)
    ? root.replace(/data-duration="[^"]*"/, `data-duration="${context.duration}"`)
    : root.replace(/>$/, ` data-duration="${context.duration}">`);
  html = html.replace(root, sized);
  const seed = `<script>window.__VA = ${inline(context)};</script>`;
  html = /<head[^>]*>/.test(html) ? html.replace(/<head[^>]*>/, (head) => `${head}\n    ${seed}`) : `${seed}\n${html}`;
  writeFileSync(path.join(dir, 'index.html'), html);
};

/** Render the composition in `dir` to `output`. Returns the renderer's log on failure. */
export const renderComposition = async (dir, output, fps) => {
  const result = await hyperframes(['render', dir, '-o', output, '--fps', String(fps), '--quiet'], {capture: true, allowFail: true});
  return {ok: result.code === 0, log: `${result.stdout}\n${result.stderr}`.trim()};
};
