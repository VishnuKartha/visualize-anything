import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {normalizeFacts, normalizeVocabulary} from './facts.mjs';
import {normalizeClaims} from './paper.mjs';
import {NEEDS, SUBJECTS, resolveRoute} from './router.mjs';
import {normalizeSources} from './sources.mjs';
import {findRun, speakable, spokenTokens} from './speech.mjs';
import {fail, readJson} from './util.mjs';

export const KINDS = ['title', 'code', 'trace', 'hyperframes', 'diagram', 'manim', 'bullets', 'credit', 'stat', 'compare', 'chart', 'table', 'matrix', 'quote', 'figure'];
// Scenes drawn from the storyboard alone: what the source reports, with its parts arriving by `show`.
export const EVIDENCE = ['stat', 'compare', 'chart', 'table', 'matrix', 'quote', 'figure'];
const TONES = ['positive', 'negative', 'caution', 'neutral'];
const IMAGES = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const SIDES = ['left', 'right', 'above', 'below'];

const showsCode = (scene) => scene.kind === 'code' || scene.kind === 'trace';
const needsClip = (scene) => scene.kind === 'manim' || scene.kind === 'trace';
export const DIAGRAM_TYPES = ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle'];

// Seconds. Narration drives the clock: each scene is its beats' audio plus these breaths.
const LEAD = 0.5; // silence before a scene's first word, while the visual settles in
const GAP = 0.3; // pause between beats
const TAIL = 0.7; // hold after the last word, before the cut
const CARRY = 0.15; // either side of a join where the picture carries on: together, one pause between beats
const ANTICIPATE = 0.15; // visuals change slightly ahead of the voice
const LAND = 0.7; // extra silence after a beat marked `land`, so its point can sink in
const LEAVE = 0.3; // extra hold at the end of an evidence scene: its picture is let go slowly, and only once the voice has finished
export const SETTLED = 32; // frames before its end by which an evidence scene's picture has begun to leave
export const PREDICT = 1.5; // extra silence after a beat marked `predict`: the question is asked, and the viewer gets to answer it first

const gapAfter = (beat) => beat.pause ?? (beat.predict ? GAP + PREDICT : beat.land ? GAP + LAND : GAP);
const HAS_PICTURE = ['manim', 'trace', 'diagram', 'hyperframes', 'stat', 'compare', 'chart', 'table', 'matrix', 'figure'];

const LANG_BY_EXT = {
  '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java', '.kt': 'kotlin', '.swift': 'swift', '.rb': 'ruby',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.hpp': 'cpp', '.cs': 'csharp', '.php': 'php', '.sh': 'bash',
  '.zsh': 'bash', '.sql': 'sql', '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml', '.html': 'html',
  '.css': 'css', '.md': 'markdown', '.lua': 'lua', '.ex': 'elixir', '.exs': 'elixir', '.scala': 'scala', '.dart': 'dart',
  '.vue': 'vue', '.svelte': 'svelte', '.zig': 'zig', '.hs': 'haskell', '.ml': 'ocaml', '.proto': 'proto', '.tf': 'hcl',
};

export {HAS_PICTURE};

export const projectPaths = (dir) => ({
  dir,
  storyboard: path.join(dir, 'storyboard.json'),
  timeline: path.join(dir, 'timeline.json'),
  public: path.join(dir, 'public'),
  audio: path.join(dir, 'public', 'audio'),
  assets: path.join(dir, 'public', 'assets'),
  cache: path.join(dir, '.cache'),
  out: path.join(dir, 'out'),
});

/** Accept a project directory, or a slug under ./.visualize/. */
export const resolveProject = (arg) => {
  if (!arg) fail('Missing <project>. Pass a project directory or a slug under ./.visualize/.');
  const candidates = [path.resolve(arg), path.resolve('.visualize', arg)];
  const dir = candidates.find((candidate) => existsSync(path.join(candidate, 'storyboard.json')));
  if (!dir) fail(`No storyboard.json found for "${arg}" (looked in ${candidates.join(' and ')}).`);
  return projectPaths(dir);
};

const CUE_FIELDS = ['lines', 'note', 'focus', 'show', 'version', 'text'];
const ANCHOR_LEAD = 0.1; // seconds a word-anchored change lands ahead of its word

export {speakable, spokenTokens};

/**
 * When a phrase is spoken, in seconds from the start of its beat's audio.
 * Uses the TTS engine's own word timings; falls back to its position in the sentence.
 */
export const phraseTime = (phrase, {say, words, duration}) => {
  const needle = spokenTokens(phrase);
  if (!needle.length) return null;
  const timed = words.flatMap((word) => spokenTokens(word.text).map((token) => ({token, start: word.start})));
  const hit = findRun(timed.map((entry) => entry.token), needle);
  if (hit >= 0) return timed[hit].start;
  const tokens = spokenTokens(say);
  const position = findRun(tokens, needle);
  if (position < 0) return null;
  const begin = words[0]?.start ?? 0;
  const finish = words.at(-1)?.end ?? duration;
  return begin + ((finish - begin) * position) / tokens.length;
};

const normalizeLines = (lines, where, errors) => {
  if (lines === undefined || lines === null) return null;
  if (typeof lines === 'number') return [[lines, lines]];
  if (Array.isArray(lines) && lines.length === 2 && lines.every((n) => typeof n === 'number')) return [lines];
  if (Array.isArray(lines) && lines.every((r) => Array.isArray(r) && r.length === 2 && r.every((n) => typeof n === 'number'))) {
    return lines;
  }
  errors.push(`${where}: "lines" must be a line number, a [start, end] range, or a list of [start, end] ranges.`);
  return null;
};

const dedent = (lines) => {
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^[ \t]*/)[0].length);
  const cut = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(cut));
};

/** Resolve a code scene to the exact text shown on screen and the line number of its first row. */
export const resolveCode = (scene, paths, storyboard) => {
  if (typeof scene.code === 'string') {
    const startLine = scene.startLine ?? 1;
    return {code: scene.code.replace(/\n+$/, ''), startLine, lang: scene.lang || 'text', title: scene.title || ''};
  }
  const file = path.resolve(paths.dir, storyboard.sourceRoot || '.', scene.file);
  if (!existsSync(file)) fail(`Scene "${scene.id}": file not found: ${file} (sourceRoot is relative to the project directory).`);
  const all = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  const [start, end] = scene.range || [1, all.length];
  if (start < 1 || end > all.length || start > end) {
    fail(`Scene "${scene.id}": range [${start}, ${end}] is outside ${scene.file} (1–${all.length}).`);
  }
  return {
    code: dedent(all.slice(start - 1, end)).join('\n'),
    startLine: start,
    lang: scene.lang || LANG_BY_EXT[path.extname(file).toLowerCase()] || 'text',
    title: scene.title || path.basename(file),
  };
};

/** The versions of a code-change scene, each resolved like a code scene's excerpt. */
export const resolveVersions = (scene, paths, storyboard) =>
  scene.versions.map((version, index) => resolveCode({id: `${scene.id} version ${index}`, lang: scene.lang, ...version}, paths, storyboard));

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const toneOf = (value, fallback, where, errors) => {
  if (value === undefined) return fallback;
  if (!TONES.includes(value)) errors.push(`${where}: "tone" must be one of ${TONES.join(', ')}.`);
  return TONES.includes(value) ? value : fallback;
};

/** Where a phrase sits in a quote, as [first, last] word indexes, or null. Compared by spoken words, so punctuation is free. */
export const phraseSpan = (quote, phrase) => {
  const words = quote.split(/\s+/).filter(Boolean);
  const owners = words.flatMap((word, index) => spokenTokens(word).map(() => index));
  const needle = spokenTokens(phrase);
  const at = needle.length ? findRun(words.flatMap((word) => spokenTokens(word)), needle) : -1;
  return at < 0 ? null : [owners[at], owners[at + needle.length - 1]];
};

/** How many parts an evidence scene reveals by `show`, and the counts a beat-by-beat reveal stops at. */
export const revealStops = (scene) => {
  const upTo = (count) => Array.from({length: count}, (_, index) => index + 1);
  if (scene.kind === 'stat') return {stops: upTo(scene.metrics.length), bare: false};
  if (scene.kind === 'chart') return {stops: upTo(scene.chart === 'scatter' ? scene.series.reduce((sum, entry) => sum + entry.points.length, 0) : scene.labels.length), bare: false};
  if (scene.kind === 'table') return {stops: upTo(scene.rows.length), bare: true};
  if (scene.kind === 'matrix') return {stops: upTo(scene.rows.length), bare: false};
  if (scene.kind === 'quote') return {stops: upTo(scene.highlights.length), bare: true};
  if (scene.kind === 'figure') return {stops: upTo(scene.callouts.length), bare: true};
  // A contrast is made a panel at a time: each stop is one more panel's points.
  let total = 0;
  return {stops: scene.panels.map((panel) => (total += panel.points.length)), bare: true};
};

/** Check an evidence scene's own fields, and return them in the one shape the rest of the code reads. */
const normalizeEvidence = (scene, beats, where, {errors, warnings, paths, strict}) => {
  const out = {title: text(scene.title)};
  const list = (value) => (Array.isArray(value) ? value : []);
  if (scene.kind === 'stat') {
    if (!Array.isArray(scene.metrics) || scene.metrics.length < 1 || scene.metrics.length > 4) errors.push(`${where}: a stat scene needs "metrics": one number to set large, or two to four to set side by side.`);
    out.metrics = list(scene.metrics).map((metric, index) => {
      const at = `${where} metric ${index + 1}`;
      const value = typeof metric?.value === 'number' ? String(metric.value) : text(metric?.value);
      if (!value) errors.push(`${at}: needs "value", the number as it should read ("36", "25,000,000", "94.3").`);
      if (!text(metric?.label)) errors.push(`${at}: needs "label", what the number counts.`);
      return {value: value || '', unit: text(metric?.unit), label: text(metric?.label) || '', detail: text(metric?.detail), delta: text(metric?.delta), tone: toneOf(metric?.tone, 'positive', at, errors)};
    });
  }
  if (scene.kind === 'compare') {
    const authored = Array.isArray(scene.panels) ? scene.panels : [scene.left, scene.right].filter(Boolean);
    if (authored.length < 2 || authored.length > 3) errors.push(`${where}: a compare scene needs "left" and "right", or "panels" (two or three), each {"label", "tone", "points"}.`);
    out.panels = authored.map((panel, index) => {
      const at = `${where} panel ${index + 1}`;
      if (!text(panel?.label)) errors.push(`${at}: needs "label", the name of what is being weighed.`);
      const tone = toneOf(panel?.tone, 'neutral', at, errors);
      if (!Array.isArray(panel?.points) || panel.points.length < 1 || panel.points.length > 4) errors.push(`${at}: needs "points", one to four short lines.`);
      const points = list(panel?.points).map((point, pointIndex) => {
        const line = text(typeof point === 'string' ? point : point?.text);
        if (!line) errors.push(`${at} point ${pointIndex + 1}: must be a line of text, or {"text": "...", "tone": "..."}.`);
        else if (line.length > 60) warnings.push(`${at} point ${pointIndex + 1}: ${line.length} characters will wrap past two lines; say it in under 60.`);
        return {text: line || '', tone: typeof point === 'string' ? tone : toneOf(point?.tone, tone, `${at} point ${pointIndex + 1}`, errors)};
      });
      return {label: text(panel?.label) || '', tone, points};
    });
    out.versus = scene.versus === true;
  }
  const checkFocus = (known, what) => {
    beats.flatMap((beat) => [beat, ...beat.cues]).forEach((cue) => {
      if (cue.focus === undefined || cue.focus === null) return;
      if (!Array.isArray(cue.focus)) errors.push(`${where}: "focus" is a list of the ${what} the sentence is about.`);
      else for (const name of cue.focus) if (!known.has(name)) errors.push(`${where}: "focus" names "${name}", which is not one of the ${what} (${[...known].join(', ')}).`);
    });
  };
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  if (scene.kind === 'chart') {
    out.chart = scene.chart ?? 'bar';
    if (!['bar', 'line', 'scatter'].includes(out.chart)) errors.push(`${where}: "chart" must be "bar", "line", or "scatter".`);
    out.unit = text(scene.unit);
    out.axis = text(scene.axis);
    if (out.chart === 'scatter') {
      // A trade-off: each point is one system, placed by two measurements.
      out.across = text(scene.across);
      if (!out.across || !out.axis) errors.push(`${where}: a scatter chart needs "axis" (what is measured up the side) and "across" (what is measured along the bottom), each with which way is better.`);
      out.labels = [];
      const authored = Array.isArray(scene.series) ? scene.series : Array.isArray(scene.points) ? [{points: scene.points}] : [];
      if (authored.length < 1 || authored.length > 4) errors.push(`${where}: a scatter chart needs "points" (each {"x", "y", "label"}), or "series" (one to four of {"label", "points"}).`);
      out.series = authored.map((entry, index) => {
        const at = `${where} series ${index + 1}`;
        if (authored.length > 1 && !text(entry?.label)) errors.push(`${at}: with more than one series, each needs a "label" for the legend.`);
        return {
          label: text(entry?.label),
          values: [],
          points: list(entry?.points).map((point, pointIndex) => {
            if (!finite(point?.x) || !finite(point?.y) || point.x < 0 || point.y < 0) errors.push(`${at} point ${pointIndex + 1}: needs "x" and "y", numbers zero or more.`);
            return {x: point?.x ?? 0, y: point?.y ?? 0, label: text(point?.label)};
          }),
        };
      });
      const total = out.series.reduce((sum, entry) => sum + entry.points.length, 0);
      if (total < 2 || total > 16) errors.push(`${where}: a scatter chart shows two to sixteen points; it has ${total}.`);
      checkFocus(new Set(out.series.flatMap((entry) => [entry.label, ...entry.points.map((point) => point.label)]).filter(Boolean)), "chart's point labels or series");
    } else {
      out.labels = list(scene.labels).map((label) => String(label));
      // Past sixteen the router advises against it (one value per mark can no longer be read), but a whole
      // distribution, every game of a benchmark sorted by its result, is read by its shape and is allowed.
      if (out.labels.length < 2 || out.labels.length > 32) errors.push(`${where}: a chart needs "labels", two to thirty-two of them, one per position along the axis.`);
      if (new Set(out.labels).size !== out.labels.length) errors.push(`${where}: chart "labels" must be different from each other.`);
      const authored = Array.isArray(scene.series) ? scene.series : scene.values !== undefined ? [{values: scene.values}] : [];
      if (authored.length < 1 || authored.length > 4) errors.push(`${where}: a chart needs "values" (one number per label), or "series" (one to four of {"label", "values"}).`);
      out.series = authored.map((entry, index) => {
        const at = `${where} series ${index + 1}`;
        const values = list(entry?.values);
        // A bar can go below zero: a change against a control (a gain on most datasets, a loss on one) is drawn from a zero line.
        if (values.length !== out.labels.length || values.some((value) => !finite(value))) {
          errors.push(`${at}: "values" must be one number for each of the ${out.labels.length} labels.`);
        }
        // The spread the source reports for each value (its ± standard deviation), drawn as a whisker.
        const spread = entry?.errors === undefined ? null : list(entry.errors);
        if (spread && (spread.length !== out.labels.length || spread.some((value) => !finite(value) || value < 0))) {
          errors.push(`${at}: "errors" must be one number, zero or more, for each of the ${out.labels.length} labels: the ± the source reports.`);
        }
        if (authored.length > 1 && !text(entry?.label)) errors.push(`${at}: with more than one series, each needs a "label" for the legend.`);
        // Series with the same "stack" are one bar made of parts: a total and what it is made of.
        const stack = text(entry?.stack);
        if (stack && out.chart !== 'bar') errors.push(`${at}: "stack" puts series on top of each other in one bar; it needs a bar chart.`);
        if (stack && values.some((value) => finite(value) && value < 0)) errors.push(`${at}: a stacked series adds to the bar below it, so its values must be zero or more.`);
        return {label: text(entry?.label), values, errors: spread, stack};
      });
      checkFocus(new Set([...out.labels, ...out.series.map((entry) => entry.label).filter(Boolean)]), "chart's labels or series");
    }
  }
  if (scene.kind === 'table') {
    // A results table, cut down to the rows the sentence compares. Its first column names each row.
    out.columns = list(scene.columns).map((column) => String(column));
    if (out.columns.length < 2 || out.columns.length > 5) errors.push(`${where}: a table needs "columns", two to five of them; the first names each row.`);
    if (!Array.isArray(scene.rows) || scene.rows.length < 1 || scene.rows.length > 6) errors.push(`${where}: a table needs "rows", one to six of them. A table of more is read, not watched: keep the rows the sentence compares.`);
    out.rows = list(scene.rows).map((cells, index) => {
      if (!Array.isArray(cells) || cells.length !== out.columns.length) errors.push(`${where} row ${index + 1}: must be a list of ${out.columns.length} cells, one per column.`);
      return list(cells).map((cell) => (cell === null || cell === undefined ? '' : String(cell)));
    });
    const names = out.rows.map((cells) => cells[0]);
    if (new Set(names).size !== names.length) errors.push(`${where}: each row's first cell names it, so they must differ.`);
    out.best = text(scene.best);
    if (out.best && !names.includes(out.best)) errors.push(`${where}: "best" is "${out.best}", which names no row (${names.join(', ')}).`);
    out.highlight = list(scene.highlight === undefined ? [] : [scene.highlight].flat()).map(String);
    for (const column of out.highlight) if (!out.columns.includes(column)) errors.push(`${where}: "highlight" names "${column}", which is not a column.`);
    out.caption = text(scene.caption);
    checkFocus(new Set([...names, ...out.columns]), "table's row names or columns");
  }
  if (scene.kind === 'matrix') {
    // A grid of values coloured by size: attention weights, a confusion matrix, a correlation table.
    out.rows = list(scene.rows).map(String);
    out.columns = list(scene.columns).map(String);
    if (out.rows.length < 2 || out.rows.length > 8 || out.columns.length < 2 || out.columns.length > 8) errors.push(`${where}: a matrix needs "rows" and "columns", two to eight labels each.`);
    if (!Array.isArray(scene.values) || scene.values.length !== out.rows.length || scene.values.some((cells) => !Array.isArray(cells) || cells.length !== out.columns.length || cells.some((value) => !finite(value)))) {
      errors.push(`${where}: "values" must be ${out.rows.length} rows of ${out.columns.length} numbers, one per cell.`);
    }
    out.values = list(scene.values).map((cells) => list(cells).map(Number));
    out.numbers = scene.numbers !== false;
    if (out.numbers && out.columns.length > 6) warnings.push(`${where}: ${out.columns.length} columns of numbers will be small; set "numbers": false to show the colours alone.`);
    const flat = out.values.flat().filter(Number.isFinite);
    out.scale = Array.isArray(scene.scale) && scene.scale.length === 2 && scene.scale.every(finite) && scene.scale[0] < scene.scale[1] ? scene.scale : flat.length ? [Math.min(0, ...flat), Math.max(...flat)] : [0, 1];
    if (scene.scale !== undefined && out.scale !== scene.scale) errors.push(`${where}: "scale" is [low, high], the values the lightest and the strongest colour stand for.`);
    // A grid of changes (a gain or a loss, a ratio above or below 1) is coloured both ways from a centre:
    // above it toward the accent, below it toward rose. With a scale that crosses zero, the centre is zero.
    if (scene.center !== undefined && (!finite(scene.center) || scene.center <= out.scale[0] || scene.center >= out.scale[1])) {
      errors.push(`${where}: "center" is the value that means no change (0 for a difference, 1 for a ratio); it must lie inside the scale, between ${out.scale[0]} and ${out.scale[1]}.`);
    }
    out.center = finite(scene.center) ? scene.center : out.scale[0] < 0 && out.scale[1] > 0 ? 0 : null;
    out.axis = text(scene.axis);
    checkFocus(new Set([...out.rows, ...out.columns]), "matrix's row or column labels");
  }
  if (scene.kind === 'quote') {
    out.quote = text(scene.quote) || '';
    if (!out.quote) errors.push(`${where}: a quote scene needs "quote": the source's words, exactly as it wrote them.`);
    out.attribution = text(scene.attribution);
    out.highlights = [];
    for (const phrase of scene.highlight === undefined ? [] : [scene.highlight].flat()) {
      const span = typeof phrase === 'string' ? phraseSpan(out.quote, phrase) : null;
      if (!span) errors.push(`${where}: "highlight" "${phrase}" is not in the quote. Mark words that are there.`);
      else out.highlights.push(span);
    }
  }
  if (scene.kind === 'figure') {
    out.image = text(scene.image) || '';
    if (!out.image) errors.push(`${where}: a figure scene needs "image", the path of the figure in the project.`);
    else if (!IMAGES.includes(path.extname(out.image).toLowerCase())) errors.push(`${where}: "image" must be one of ${IMAGES.join(', ')}. Export a PDF figure to PNG first.`);
    else if (strict && !existsSync(path.resolve(paths.dir, out.image))) errors.push(`${where}: image not found: ${path.resolve(paths.dir, out.image)}.`);
    out.caption = text(scene.caption);
    // A dense figure is cut down to the panel the sentence is about, in percentages of the whole image.
    out.crop = null;
    if (scene.crop !== undefined) {
      const crop = scene.crop;
      const fields = ['x', 'y', 'width', 'height'];
      if (!crop || fields.some((field) => !finite(crop[field])) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 100 || crop.y + crop.height > 100) {
        errors.push(`${where}: "crop" is {"x", "y", "width", "height"}: the region to show, as percentages of the image, inside 0 to 100.`);
      } else out.crop = Object.fromEntries(fields.map((field) => [field, crop[field]]));
    }
    if (scene.callouts !== undefined && (!Array.isArray(scene.callouts) || scene.callouts.length > 5)) errors.push(`${where}: "callouts" is a list of up to five {"label", "x", "y"}.`);
    out.callouts = list(scene.callouts).slice(0, 5).map((callout, index) => {
      const at = `${where} callout ${index + 1}`;
      if (!text(callout?.label)) errors.push(`${at}: needs "label", a few words naming what is pointed at.`);
      for (const axis of ['x', 'y']) {
        if (typeof callout?.[axis] !== 'number' || callout[axis] < 0 || callout[axis] > 100) errors.push(`${at}: "${axis}" is where it points, as a percentage of the image (0 to 100).`);
      }
      const side = callout?.side ?? ((callout?.x ?? 50) < 62 ? 'right' : 'left');
      if (!SIDES.includes(side)) errors.push(`${at}: "side" is where the label stands from its point: one of ${SIDES.join(', ')}.`);
      return {label: text(callout?.label) || '', x: callout?.x ?? 50, y: callout?.y ?? 50, side};
    });
  }
  // `show` cannot ask for more parts than there are.
  const most = errors.length ? null : revealStops({kind: scene.kind, ...out}).stops.at(-1) ?? 0;
  if (most !== null) {
    for (const cue of beats.flatMap((beat) => [beat, ...beat.cues])) {
      if (Number.isInteger(cue.show) && cue.show > most) errors.push(`${where}: "show": ${cue.show} asks for more than the ${most} this scene has.`);
    }
  }
  return out;
};

/** Load storyboard.json, apply defaults, and report everything wrong with it at once. */
export const loadStoryboard = (paths, {strict = true} = {}) => {
  let raw;
  try {
    raw = readJson(paths.storyboard);
  } catch (error) {
    fail(`storyboard.json is not valid JSON: ${error.message}`);
  }
  const errors = [];
  const warnings = [];
  const storyboard = {
    title: raw.title || 'Untitled',
    subject: raw.subject || null,
    brief: raw.brief && typeof raw.brief === 'object' ? raw.brief : null,
    voice: raw.voice || 'en-US-AndrewNeural',
    rate: raw.rate || '+0%',
    pitch: raw.pitch || '+0Hz',
    fps: raw.fps || 30,
    width: raw.width || 1920,
    height: raw.height || 1080,
    captions: raw.captions !== false,
    sourceRoot: raw.sourceRoot || '.',
    scenes: [],
  };
  // What the video is made from: recognised at the brief, and carried to every scene drawn from it.
  storyboard.sources = normalizeSources(raw.sources, errors);
  storyboard.facts = normalizeFacts(raw.facts, errors);
  storyboard.vocabulary = normalizeVocabulary(raw.vocabulary, errors);
  const factById = new Map(storyboard.facts.map((fact) => [fact.id, fact]));
  if (!Array.isArray(raw.scenes) || raw.scenes.length === 0) fail('storyboard.json needs a non-empty "scenes" array.');

  if (raw.subject && !SUBJECTS.includes(raw.subject)) errors.push(`"subject" must be one of ${SUBJECTS.join(', ')}.`);

  const seen = new Set();
  raw.scenes.forEach((authored, index) => {
    const where = `scene ${index + 1}${authored.id ? ` ("${authored.id}")` : ''}`;
    if (authored.need !== undefined && !NEEDS[authored.need]) {
      errors.push(`${where}: "need" must be one of ${Object.keys(NEEDS).join(', ')}.`);
      return;
    }
    // `need` says what the viewer must see; it supplies the renderer when `kind` is left out.
    const scene = {...authored, ...resolveRoute(authored)};
    if (!scene.kind) {
      errors.push(`${where}: declare "need" (what the viewer must see), or an explicit "kind".`);
      return;
    }
    if (!scene.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(scene.id)) errors.push(`${where}: "id" must be kebab-case (a-z, 0-9, hyphens).`);
    if (seen.has(scene.id)) errors.push(`${where}: duplicate id.`);
    seen.add(scene.id);
    if (!KINDS.includes(scene.kind)) {
      errors.push(`${where}: "kind" must be one of ${KINDS.join(', ')}.`);
      return;
    }
    if (!Array.isArray(scene.beats) || scene.beats.length === 0) {
      errors.push(`${where}: needs at least one beat ({"say": "..."}).`);
      return;
    }
    const normalized = {...scene, beats: []};
    // The sources a scene draws on: one id, a list of them (a design doc's decision beside the code), or null for the video's own picture.
    if (scene.source !== undefined && scene.source !== null) {
      const named = [scene.source].flat();
      if (!named.length || named.some((id) => typeof id !== 'string')) errors.push(`${where}: "source" is a source id, a list of them, or null for a picture of the video's own.`);
      else if (new Set(named).size !== named.length) errors.push(`${where}: "source" names a source twice.`);
      for (const id of named.filter((entry) => typeof entry === 'string' && !storyboard.sources.some((source) => source.id === entry))) {
        errors.push(`${where}: "source" "${id}" is not one of the storyboard's "sources" (${storyboard.sources.map((source) => source.id).join(', ') || 'none declared'}).`);
      }
    }
    if (scene.ref !== undefined && !text(scene.ref)) errors.push(`${where}: "ref" says where in the source this comes from ("Table 2", "Figure 4", "Section 3.1").`);
    // The scene that sets up what this one shows has to have been seen first.
    if (scene.after !== undefined) {
      if (typeof scene.after !== 'string' || !storyboard.scenes.some((entry) => entry.id === scene.after)) {
        errors.push(`${where}: "after" is "${scene.after}", which is not an earlier scene. It names the scene that sets up what this one shows, and that scene comes first.`);
      }
    }

    scene.beats.forEach((beat, beatIndex) => {
      const at = `${where} beat ${beatIndex + 1}`;
      if (typeof beat.say !== 'string' || !beat.say.trim()) {
        errors.push(`${at}: "say" must be a non-empty string.`);
        return;
      }
      const words = beat.say.trim().split(/\s+/).length;
      if (words > 40) warnings.push(`${at}: ${words} words is a long single beat; split it so the visual can change with the idea.`);
      const out = {...beat, say: beat.say.trim(), caption: (beat.caption || beat.say).trim()};
      // A prediction pause: the beat asks, the picture holds, and the next beat of the scene answers.
      if (beat.predict !== undefined) {
        if (beat.predict !== true && beat.predict !== false) errors.push(`${at}: "predict" must be true or false.`);
        else if (beat.predict && !/\?["')\]]?$/.test(out.say)) errors.push(`${at}: a "predict" beat ends on the question the viewer is left to answer. End its "say" with that question.`);
        else if (beat.predict && beatIndex === scene.beats.length - 1) errors.push(`${at}: a "predict" beat is answered by the next beat of the same scene, so the picture can hold while the viewer thinks. Put the answer after it.`);
      }
      // A sentence that says always or never names the fact that tested it.
      if (beat.holds !== undefined) {
        const tested = factById.get(beat.holds);
        if (!tested) errors.push(`${at}: "holds" names "${beat.holds}", which is not in "facts".`);
        else if (tested.value !== true) errors.push(`${at}: "holds" names "${beat.holds}", whose value is not true. A claim is voiced once the oracle has tried its edges and it held.`);
      }
      const checkCue = (cue, label) => {
        const checked = {...cue};
        if (showsCode(scene) && cue.lines !== undefined) checked.lines = normalizeLines(cue.lines, label, errors);
        if (scene.kind === 'diagram' && cue.focus !== undefined && cue.focus !== 'all' && !Array.isArray(cue.focus)) {
          errors.push(`${label}: "focus" must be a list of node/edge ids, or "all".`);
        }
        if (EVIDENCE.includes(scene.kind) && cue.show !== undefined && (!Number.isInteger(cue.show) || cue.show < 0)) {
          errors.push(`${label}: "show" is how many parts are on screen: a whole number, zero or more.`);
        }
        return checked;
      };
      Object.assign(out, checkCue(beat, at));
      if (showsCode(scene) && beat.lines === undefined) out.lines = null;

      // Changes inside the beat, each landing on a spoken phrase.
      out.cues = [];
      if (beat.cues !== undefined && !Array.isArray(beat.cues)) errors.push(`${at}: "cues" must be a list of {"at": "<spoken phrase>", ...}.`);
      const said = spokenTokens(out.say);
      let cursor = 0;
      for (const [cueIndex, cue] of (Array.isArray(beat.cues) ? beat.cues : []).entries()) {
        const label = `${at} cue ${cueIndex + 1}`;
        const phrase = typeof cue.at === 'string' ? spokenTokens(cue.at) : [];
        if (!phrase.length) {
          errors.push(`${label}: needs "at", the spoken phrase it lands on.`);
          continue;
        }
        const position = findRun(said, phrase, cursor);
        if (position < 0) {
          errors.push(
            findRun(said, phrase) >= 0
              ? `${label}: "${cue.at}" is spoken before the previous cue. List cues in the order they are said.`
              : `${label}: "${cue.at}" is not in this beat's "say". Anchor to words that are actually spoken.`,
          );
          continue;
        }
        cursor = position + 1;
        if (!CUE_FIELDS.some((field) => cue[field] !== undefined)) errors.push(`${label}: changes nothing. Give it "lines", "note", "focus", or "show".`);
        out.cues.push(checkCue(cue, label));
      }
      normalized.beats.push(out);
    });

    if (scene.kind === 'credit' && !scene.title) errors.push(`${where}: a credit scene needs "title": the name of what was explained.`);
    if (scene.kind === 'title' && (scene.title || scene.kicker || scene.subtitle)) {
      warnings.push(`${where}: "title", "kicker", and "subtitle" are not shown by an opening. Name the source in a closing "credit" scene; the video's own title is the top-level "title".`);
    }
    if (scene.kind === 'bullets') {
      if (!Array.isArray(scene.items) || scene.items.length === 0) errors.push(`${where}: bullets scenes need "items".`);
      else {
        if (scene.items.length > 5) warnings.push(`${where}: ${scene.items.length} takeaways will be small on screen; keep to 5 or fewer.`);
        // A takeaway is a line of text, or {"text", "from": <scene id>, "beat": n}: the moment that proved it.
        const earlier = new Map(storyboard.scenes.map((entry) => [entry.id, entry]));
        const pointsAt = (id, label) => {
          const target = earlier.get(id);
          if (!target) errors.push(`${where}: ${label} "${id}" is not an earlier scene.`);
          else if (!HAS_PICTURE.includes(target.kind)) errors.push(`${where}: ${label} "${id}" is a ${target.kind} scene; point at a scene with a picture (${HAS_PICTURE.join(', ')}).`);
          return target;
        };
        if (scene.over !== undefined) pointsAt(scene.over, '"over"');
        normalized.items = scene.items.map((item, itemIndex) => {
          if (typeof item === 'string') return {text: item, from: null, beat: null};
          if (!item || typeof item.text !== 'string' || !item.text.trim()) {
            errors.push(`${where}: item ${itemIndex + 1} must be a string or {"text": "...", "from": "<scene id>", "beat": n}.`);
            return {text: '', from: null, beat: null};
          }
          const target = item.from !== undefined ? pointsAt(item.from, `item ${itemIndex + 1} "from"`) : null;
          if (item.beat !== undefined && (!Number.isInteger(item.beat) || item.beat < 1 || (target && item.beat > target.beats.length))) {
            errors.push(`${where}: item ${itemIndex + 1} "beat" must be a beat number of scene "${item.from}" (1–${target ? target.beats.length : '?'}).`);
          }
          return {text: item.text.trim(), from: item.from ?? null, beat: item.beat ?? null};
        });
      }
    }
    if (EVIDENCE.includes(scene.kind)) Object.assign(normalized, normalizeEvidence(scene, normalized.beats, where, {errors, warnings, paths, strict}));
    if (scene.continues !== undefined) {
      const before = storyboard.scenes.at(-1);
      if (scene.continues !== true && scene.continues !== false) errors.push(`${where}: "continues" must be true or false.`);
      else if (scene.continues && !before) errors.push(`${where}: the first scene has nothing to continue.`);
      else if (scene.continues && !(HAS_PICTURE.includes(scene.kind) && HAS_PICTURE.includes(before.kind))) {
        errors.push(`${where}: "continues" joins two scenes that share a picture; this is a ${scene.kind} scene after a ${before.kind} scene.`);
      }
    }
    if (showsCode(scene)) {
      if (typeof scene.code !== 'string' && !scene.file) errors.push(`${where}: ${scene.kind} scenes need "file" (with optional "range") or inline "code".`);
      else if (strict) {
        try {
          const resolved = resolveCode(scene, paths, storyboard);
          const lines = resolved.code.split('\n');
          const last = resolved.startLine + lines.length - 1;
          // A trace scene gives the code half the frame, so it holds less of it.
          const [maxLines, maxCols] = scene.kind === 'trace' ? [16, 50] : [30, 100];
          if (lines.length > maxLines) warnings.push(`${where}: ${lines.length} lines on one screen will scroll; prefer a tighter "range" or split the scene.`);
          const widest = Math.max(...lines.map((line) => line.length));
          if (widest > maxCols) warnings.push(`${where}: longest line is ${widest} columns and will be clipped past ~${maxCols}.`);
          for (const cue of normalized.beats.flatMap((beat) => [beat, ...beat.cues])) {
            for (const [a, b] of cue.lines || []) {
              if (a < resolved.startLine || b > last || a > b) {
                errors.push(`${where}: beat lines [${a}, ${b}] fall outside the displayed lines ${resolved.startLine}–${last}.`);
              }
            }
          }
        } catch (error) {
          errors.push(error.message);
        }
      }
    }
    if (scene.kind === 'hyperframes') {
      const hasVersions = Array.isArray(scene.versions) && scene.versions.length > 0;
      if (hasVersions === Boolean(scene.composition)) {
        errors.push(`${where}: a hyperframes scene needs either "versions" (code that changes, shown with the built-in block) or "composition" (the path of an HTML composition you wrote), not both.`);
      } else if (hasVersions) {
        if (scene.effect !== undefined && !['morph', 'diff'].includes(scene.effect)) errors.push(`${where}: "effect" must be "morph" or "diff".`);
        if (strict) {
          try {
            const resolved = resolveVersions(scene, paths, storyboard);
            const widest = Math.max(...resolved.flatMap((version) => version.code.split('\n').map((line) => line.length)));
            const tallest = Math.max(...resolved.map((version) => version.code.split('\n').length));
            if (tallest > 20) warnings.push(`${where}: a version has ${tallest} lines; past 20 the text gets small. Show a tighter excerpt.`);
            if (widest > 90) warnings.push(`${where}: a version has a ${widest}-column line; past 90 it is shrunk to fit.`);
          } catch (error) {
            errors.push(error.message);
          }
        }
        const last = scene.versions.length - 1;
        for (const cue of normalized.beats.flatMap((beat) => [beat, ...beat.cues])) {
          if (cue.version !== undefined && (!Number.isInteger(cue.version) || cue.version < 0 || cue.version > last)) {
            errors.push(`${where}: "version" must be a whole number from 0 to ${last} (the index into "versions").`);
          }
        }
      } else if (strict && !existsSync(path.resolve(paths.dir, scene.composition))) {
        errors.push(`${where}: composition not found: ${path.resolve(paths.dir, scene.composition)}.`);
      }
    }
    if (scene.kind === 'diagram') {
      if (!DIAGRAM_TYPES.includes(scene.type)) errors.push(`${where}: diagram "type" must be one of ${DIAGRAM_TYPES.join(', ')}.`);
      normalized.candidate = scene.candidate || `diagrams/${scene.id}.json`;
    }
    if (needsClip(scene)) {
      normalized.script = scene.script || `manim/${scene.id}.py`;
      if (!scene.class || !/^[A-Za-z_]\w*$/.test(scene.class)) errors.push(`${where}: ${scene.kind} scenes need "class", the Scene subclass to render.`);
    }
    storyboard.scenes.push(normalized);
  });

  // What the video does with each claim of the paper's abstract: shown by a scene, or set aside with a reason.
  storyboard.claims = normalizeClaims(raw.claims, storyboard.scenes.map((scene) => scene.id), errors);

  for (const entry of storyboard.vocabulary) {
    if (entry.defined !== null && !storyboard.scenes.some((scene) => scene.id === entry.defined)) errors.push(`vocabulary "${entry.word}": "defined" "${entry.defined}" is not a scene.`);
  }

  // Music is optional and brought by the author; how far under the voice it sits is not left to the ear.
  storyboard.music = null;
  if (raw.music !== undefined && raw.music !== null) {
    const music = typeof raw.music === 'string' ? {file: raw.music} : raw.music;
    const levels = [music?.under, music?.gap].filter((value) => value !== undefined);
    if (!music || typeof music.file !== 'string' || !music.file.trim()) errors.push('"music" must be the path of an audio file, or {"file": "...", "under": 18, "gap": 10}.');
    else if (levels.some((value) => typeof value !== 'number' || !Number.isFinite(value))) errors.push('"music": "under" and "gap" are numbers: how many loudness units below the voice the bed sits while it speaks, and in a silence.');
    else if ((music.under ?? 18) < 16) errors.push('"music": "under" must be at least 16. Closer than that and the bed competes with the consonants; `va render` would refuse the mix.');
    else if ((music.gap ?? 10) > (music.under ?? 18) || (music.gap ?? 10) < 4) errors.push('"music": "gap" must be between 4 and "under": the bed comes up in a silence, but never to the level of the voice.');
    else if (strict && !existsSync(path.resolve(paths.dir, music.file))) errors.push(`"music": file not found: ${path.resolve(paths.dir, music.file)}.`);
    else storyboard.music = {file: music.file, under: music.under ?? 18, gap: music.gap ?? 10};
  }

  // The thumbnail: a few words, and optionally the moment of the video shown under them.
  storyboard.thumbnail = null;
  if (raw.thumbnail !== undefined) {
    const thumbnail = raw.thumbnail;
    if (!thumbnail || typeof thumbnail !== 'object' || (thumbnail.text !== undefined && (typeof thumbnail.text !== 'string' || !thumbnail.text.trim()))) {
      errors.push('"thumbnail" must be {"text": "a few words", "from": "<scene id>", "beat": n}.');
    } else {
      const target = thumbnail.from !== undefined ? storyboard.scenes.find((scene) => scene.id === thumbnail.from) : null;
      if (thumbnail.from !== undefined && !target) errors.push(`"thumbnail": "from" "${thumbnail.from}" is not a scene.`);
      else if (target && !HAS_PICTURE.includes(target.kind)) errors.push(`"thumbnail": "from" "${thumbnail.from}" is a ${target.kind} scene; point at a scene with a picture (${HAS_PICTURE.join(', ')}).`);
      if (thumbnail.beat !== undefined && (!Number.isInteger(thumbnail.beat) || thumbnail.beat < 1 || (target && thumbnail.beat > target.beats.length))) {
        errors.push(`"thumbnail": "beat" must be a beat number of scene "${thumbnail.from}" (1–${target ? target.beats.length : '?'}).`);
      }
      storyboard.thumbnail = {text: thumbnail.text?.trim() || null, from: thumbnail.from ?? null, beat: thumbnail.beat ?? null};
    }
  }

  if (errors.length) fail(`storyboard.json has ${errors.length} problem(s):\n  - ${errors.join('\n  - ')}`);
  return {storyboard, warnings};
};

/** Turn measured clip durations into frame-exact scene and beat windows. */
export const buildTimeline = (storyboard, manifest) => {
  const {fps} = storyboard;
  const byFile = new Map(manifest.beats.map((beat) => [beat.file, beat]));
  let cursor = 0;
  const scenes = storyboard.scenes.map((scene, sceneIndex) => {
    // Where one picture runs through a join, so does the voice: no breath out, no breath in.
    const carriesIn = scene.continues === true;
    const carriesOut = storyboard.scenes[sceneIndex + 1]?.continues === true;
    let t = carriesIn ? CARRY : LEAD;
    const beats = scene.beats.map((beat, index) => {
      const clip = byFile.get(`${scene.id}-${index}.mp3`);
      if (!clip) fail(`TTS produced no clip for scene "${scene.id}" beat ${index + 1}.`);
      const start = t;
      t += clip.duration + gapAfter(beat);
      return {
        text: beat.say,
        key: clip.key,
        audio: `audio/${clip.file}`,
        duration: clip.duration,
        words: clip.words,
        from: Math.round(start * fps),
        audioFrames: Math.ceil(clip.duration * fps),
      };
    });
    const last = scene.beats.at(-1);
    const end = t - gapAfter(last) + (carriesOut ? CARRY : TAIL + (EVIDENCE.includes(scene.kind) ? LEAVE : 0)) + (last.land ? LAND : 0) + (scene.hold || 0);
    const frames = Math.ceil(end * fps);
    beats.forEach((beat, index) => {
      beat.cue = index === 0 ? 0 : Math.max(0, beat.from - Math.round(ANTICIPATE * fps));
    });
    beats.forEach((beat, index) => {
      beat.cueFrames = (index + 1 < beats.length ? beats[index + 1].cue : frames) - beat.cue;
    });
    const out = {id: scene.id, from: cursor, frames, beats};
    cursor += frames;
    return out;
  });
  return {fps, voice: manifest.voice, rate: manifest.rate, pitch: manifest.pitch, totalFrames: cursor, scenes};
};

/** Load timeline.json and make sure it still matches the storyboard's narration. */
export const loadTimeline = (paths, storyboard) => {
  if (!existsSync(paths.timeline)) fail('No timeline.json yet. Run `va tts <project>` first: narration timing comes before visuals.');
  const timeline = readJson(paths.timeline);
  const stale = () => fail('timeline.json is out of date with storyboard.json narration. Run `va tts <project>` again.');
  if (timeline.fps !== storyboard.fps || timeline.voice !== storyboard.voice || timeline.scenes.length !== storyboard.scenes.length) stale();
  storyboard.scenes.forEach((scene, index) => {
    const timed = timeline.scenes[index];
    if (timed.id !== scene.id || timed.beats.length !== scene.beats.length) stale();
    scene.beats.forEach((beat, beatIndex) => {
      if (timed.beats[beatIndex].text !== beat.say) stale();
    });
  });
  return timeline;
};

/** Caption phrases with per-word timing. Falls back to proportional timing when TTS word counts differ. */
export const captionPhrases = (caption, words, duration) => {
  const tokens = caption.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  // A written token may be several spoken words (`move_to_end` is three); give it all of their time.
  const heard = words.flatMap((word) => spokenTokens(word.text).map(() => word));
  const spans = tokens.map((token) => spokenTokens(token).length);
  let timed;
  if (heard.length && spans.reduce((sum, n) => sum + n, 0) === heard.length) {
    let cursor = 0;
    timed = tokens.map((text, index) => {
      const first = heard[Math.min(cursor, heard.length - 1)];
      const last = spans[index] ? heard[cursor + spans[index] - 1] : first;
      cursor += spans[index];
      return {text, start: first.start, end: last.end};
    });
  } else {
    const begin = words[0]?.start ?? 0;
    const finish = words.at(-1)?.end ?? duration;
    const weights = tokens.map((token) => token.length + 1);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let acc = 0;
    timed = tokens.map((text, index) => {
      const start = begin + ((finish - begin) * acc) / total;
      acc += weights[index];
      return {text, start: Number(start.toFixed(3)), end: Number((begin + ((finish - begin) * acc) / total).toFixed(3))};
    });
  }
  const phrases = [];
  let current = [];
  let length = 0;
  const flush = () => {
    if (current.length) phrases.push({start: current[0].start, end: current.at(-1).end, words: current});
    current = [];
    length = 0;
  };
  for (const word of timed) {
    if (length + word.text.length > 46 && current.length) flush();
    current.push(word);
    length += word.text.length + 1;
    if ((/[.?!;:]$/.test(word.text) && length > 18) || (/,$/.test(word.text) && length > 30)) flush();
  }
  flush();
  // A one- or two-word phrase reads as a stutter; fold it back or borrow words from its neighbour.
  for (let i = phrases.length - 1; i > 0; i -= 1) {
    const orphan = phrases[i];
    const before = phrases[i - 1];
    if (orphan.words.length >= 3) continue;
    const chars = (list) => list.reduce((n, word) => n + word.text.length + 1, 0);
    if (chars(before.words) + chars(orphan.words) <= 58) {
      before.words.push(...orphan.words);
      phrases.splice(i, 1);
    } else {
      while (orphan.words.length < 3 && before.words.length > 3) orphan.words.unshift(before.words.pop());
      orphan.start = orphan.words[0].start;
    }
  }
  // Hold each phrase until the next one starts so captions never flicker off mid-sentence.
  phrases.forEach((phrase, index) => {
    phrase.end = index + 1 < phrases.length ? phrases[index + 1].start : Math.max(phrase.end, duration);
  });
  return phrases;
};

/**
 * A scene's visual states in order. Each beat opens one; each of its cues adds another at the
 * moment its phrase is spoken. A cue changes only the fields it names; the rest carry over.
 */
export const buildSteps = (scene, timed, fps) => {
  const steps = [];
  scene.beats.forEach((beat, index) => {
    const clock = timed.beats[index];
    let state = {lines: beat.lines ?? null, note: beat.note ?? null, focus: beat.focus ?? null, show: beat.show ?? null, version: beat.version ?? null, text: beat.text ?? null};
    steps.push({cue: clock.cue, beat: index, at: null, ...state});
    for (const cue of beat.cues || []) {
      const seconds = phraseTime(cue.at, {say: beat.say, words: clock.words, duration: clock.duration});
      if (seconds === null) fail(`Scene "${scene.id}" beat ${index + 1}: could not find "${cue.at}" in the narration audio. Run \`va tts\` again.`);
      state = {...state, ...Object.fromEntries(CUE_FIELDS.filter((field) => cue[field] !== undefined).map((field) => [field, cue[field]]))};
      const frame = clock.from + Math.round((seconds - ANCHOR_LEAD) * fps);
      steps.push({cue: Math.max(steps.at(-1).cue + 1, frame), beat: index, at: cue.at, ...state});
    }
  });
  if (scene.kind === 'bullets') {
    // Unless told otherwise, each beat reveals one more item and the last beat shows them all.
    let shown = 0;
    for (const step of steps) {
      if (step.show === null) {
        if (step.at === null) shown = step.beat === scene.beats.length - 1 ? scene.items.length : Math.min(scene.items.length, step.beat + 1);
      } else shown = step.show;
      step.show = shown;
    }
  }
  if (EVIDENCE.includes(scene.kind)) {
    // Unless told otherwise, each beat brings the next part and the last beat shows everything. A
    // contrast, a quote, and a figure start bare when there is a beat to spare, so the frame is
    // seen whole before anything is pointed out. With fewer beats than parts, the parts are shared out.
    const {stops, bare} = revealStops(scene);
    const count = scene.beats.length;
    const lead = bare && count > stops.length ? 1 : 0;
    const paced = count - lead;
    let shown = 0;
    for (const step of steps) {
      if (step.show !== null) shown = step.show;
      else if (step.at === null && stops.length) {
        const turn = step.beat - lead;
        shown = step.beat === count - 1 ? stops.at(-1) : turn < 0 ? 0 : stops[Math.min(stops.length - 1, paced < stops.length ? Math.ceil((stops.length * (turn + 1)) / paced) - 1 : turn)];
      }
      step.show = shown;
    }
  }
  if (scene.kind === 'hyperframes' && Array.isArray(scene.versions)) {
    // A version stays until another is named. With none named at all, each beat brings the next one.
    const named = steps.some((step) => step.version !== null);
    let shown = 0;
    for (const step of steps) {
      if (step.version !== null) shown = step.version;
      else if (!named && step.at === null) shown = Math.min(scene.versions.length - 1, step.beat);
      step.version = shown;
    }
  }
  steps.forEach((step, index) => {
    step.cueFrames = (index + 1 < steps.length ? steps[index + 1].cue : timed.frames) - step.cue;
  });
  return steps;
};

// Words too ordinary to count as naming a line of code when they turn up in narration.
const NOT_NAMES = new Set(
  ('self this that then else elif while return class import from const function async await None null true false True False ' +
    'value values item items data list dict string number index count result print range other first last next with into over each every')
    .split(' '),
);

/** Things a beat's narration can name: diagram nodes and edges by label, code lines by an identifier unique to them. */
const namedTargets = (scene, {baked, code}) => {
  if (scene.kind === 'diagram' && baked) {
    const nodes = Object.entries(baked.nodes).map(([id, node]) => ({key: id, phrases: [node.label, id.replace(/[-_]/g, ' ')]}));
    const edges = Object.entries(baked.edges)
      .filter(([, edge]) => spokenTokens(edge.label || '').length >= 2)
      .map(([id, edge]) => ({key: id, phrases: [edge.label]}));
    return [...nodes, ...edges].filter((target) => target.phrases.some((phrase) => spokenTokens(phrase).join('').length >= 2));
  }
  if ((scene.kind === 'code' || scene.kind === 'trace') && code) {
    const where = new Map();
    code.code.split('\n').forEach((line, index) => {
      for (const name of new Set(line.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [])) {
        where.set(name, [...(where.get(name) || []), code.startLine + index]);
      }
    });
    return [...where.entries()]
      .filter(([name, lines]) => lines.length === 1 && name.replace(/_/g, '').length >= 5 && !NOT_NAMES.has(name))
      .map(([name, lines]) => ({key: lines[0], phrases: [name]}));
  }
  return [];
};

/**
 * Derive cues from the narration itself. When a beat has no cue of its own and its sentence names
 * something on screen (a node by its label, a line by an identifier only it contains), the
 * picture follows the voice to it, at the word. Authored cues always win; `"auto": false` on a
 * scene turns this off.
 */
export const withAutoCues = (scene, context) => {
  const notes = [];
  if (scene.auto === false) return {scene, notes};
  const targets = namedTargets(scene, context);
  if (!targets.length) return {scene, notes};
  const field = scene.kind === 'diagram' ? 'focus' : 'lines';

  const beats = scene.beats.map((beat, index) => {
    const authored = beat.cues.length > 0 || (field === 'focus' ? beat.focus !== undefined : beat.lines !== null);
    if (authored) return beat;
    const said = spokenTokens(beat.say);
    const found = [];
    for (const target of targets) {
      for (const phrase of target.phrases) {
        const position = findRun(said, spokenTokens(phrase));
        if (position >= 0) {
          found.push({key: target.key, phrase, position});
          break;
        }
      }
    }
    found.sort((a, b) => a.position - b.position);
    const named = found.filter((entry, i) => i === 0 || entry.key !== found[i - 1].key);
    if (!named.length) return beat;
    // A diagram accumulates what has been named, so connections light up; code moves to the named line.
    const valueAt = (i) => (field === 'focus' ? [...new Set(named.slice(0, i + 1).map((entry) => entry.key))] : [[named[i].key, named[i].key]]);
    notes.push(`${scene.id} beat ${index + 1}: ${named.map((entry) => (field === 'focus' ? entry.key : `line ${entry.key}`)).join(' → ')}`);
    return {...beat, [field]: valueAt(0), cues: named.slice(1).map((entry, i) => ({at: entry.phrase, [field]: valueAt(i + 1)}))};
  });
  return {scene: {...scene, beats}, notes};
};
