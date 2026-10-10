import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {NEEDS, SUBJECTS, resolveRoute} from './router.mjs';
import {fail, readJson} from './util.mjs';

export const KINDS = ['title', 'code', 'diagram', 'manim', 'bullets'];
export const DIAGRAM_TYPES = ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle'];

// Seconds. Narration drives the clock: each scene is its beats' audio plus these breaths.
const LEAD = 0.5; // silence before a scene's first word, while the visual settles in
const GAP = 0.3; // pause between beats
const TAIL = 0.7; // hold after the last word, before the cut
const ANTICIPATE = 0.15; // visuals change slightly ahead of the voice

const LANG_BY_EXT = {
  '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java', '.kt': 'kotlin', '.swift': 'swift', '.rb': 'ruby',
  '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.cc': 'cpp', '.hpp': 'cpp', '.cs': 'csharp', '.php': 'php', '.sh': 'bash',
  '.zsh': 'bash', '.sql': 'sql', '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml', '.html': 'html',
  '.css': 'css', '.md': 'markdown', '.lua': 'lua', '.ex': 'elixir', '.exs': 'elixir', '.scala': 'scala', '.dart': 'dart',
  '.vue': 'vue', '.svelte': 'svelte', '.zig': 'zig', '.hs': 'haskell', '.ml': 'ocaml', '.proto': 'proto', '.tf': 'hcl',
};

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

    scene.beats.forEach((beat, beatIndex) => {
      const at = `${where} beat ${beatIndex + 1}`;
      if (typeof beat.say !== 'string' || !beat.say.trim()) {
        errors.push(`${at}: "say" must be a non-empty string.`);
        return;
      }
      const words = beat.say.trim().split(/\s+/).length;
      if (words > 40) warnings.push(`${at}: ${words} words is a long single beat; split it so the visual can change with the idea.`);
      const out = {...beat, say: beat.say.trim(), caption: (beat.caption || beat.say).trim()};
      if (scene.kind === 'code') out.lines = normalizeLines(beat.lines, at, errors);
      if (scene.kind === 'diagram' && beat.focus !== undefined && beat.focus !== 'all' && !Array.isArray(beat.focus)) {
        errors.push(`${at}: "focus" must be a list of node/edge ids, or "all".`);
      }
      normalized.beats.push(out);
    });

    if (scene.kind === 'title' && !scene.title) errors.push(`${where}: title scenes need "title".`);
    if (scene.kind === 'bullets') {
      if (!Array.isArray(scene.items) || scene.items.length === 0) errors.push(`${where}: bullets scenes need "items".`);
      else if (scene.items.length > 6) warnings.push(`${where}: ${scene.items.length} bullets will be small on screen; keep to 6 or fewer.`);
    }
    if (scene.kind === 'code') {
      if (typeof scene.code !== 'string' && !scene.file) errors.push(`${where}: code scenes need "file" (with optional "range") or inline "code".`);
      else if (strict) {
        try {
          const resolved = resolveCode(scene, paths, storyboard);
          const lines = resolved.code.split('\n');
          const last = resolved.startLine + lines.length - 1;
          if (lines.length > 30) warnings.push(`${where}: ${lines.length} lines on one screen will scroll; prefer a tighter "range" or split the scene.`);
          const widest = Math.max(...lines.map((line) => line.length));
          if (widest > 100) warnings.push(`${where}: longest line is ${widest} columns and will be clipped past ~100.`);
          for (const beat of normalized.beats) {
            for (const [a, b] of beat.lines || []) {
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
    if (scene.kind === 'diagram') {
      if (!DIAGRAM_TYPES.includes(scene.type)) errors.push(`${where}: diagram "type" must be one of ${DIAGRAM_TYPES.join(', ')}.`);
      normalized.candidate = scene.candidate || `diagrams/${scene.id}.json`;
    }
    if (scene.kind === 'manim') {
      normalized.script = scene.script || `manim/${scene.id}.py`;
      if (!scene.class || !/^[A-Za-z_]\w*$/.test(scene.class)) errors.push(`${where}: manim scenes need "class", the Scene subclass to render.`);
    }
    storyboard.scenes.push(normalized);
  });

  if (errors.length) fail(`storyboard.json has ${errors.length} problem(s):\n  - ${errors.join('\n  - ')}`);
  return {storyboard, warnings};
};

/** Turn measured clip durations into frame-exact scene and beat windows. */
export const buildTimeline = (storyboard, manifest) => {
  const {fps} = storyboard;
  const byFile = new Map(manifest.beats.map((beat) => [beat.file, beat]));
  let cursor = 0;
  const scenes = storyboard.scenes.map((scene) => {
    let t = LEAD;
    const beats = scene.beats.map((beat, index) => {
      const clip = byFile.get(`${scene.id}-${index}.mp3`);
      if (!clip) fail(`TTS produced no clip for scene "${scene.id}" beat ${index + 1}.`);
      const start = t;
      t += clip.duration + (beat.pause ?? GAP);
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
    const end = t - (last.pause ?? GAP) + TAIL + (scene.hold || 0);
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
  let timed;
  if (words.length === tokens.length) {
    timed = tokens.map((text, index) => ({text, start: words[index].start, end: words[index].end}));
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
