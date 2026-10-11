import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {NEEDS, SUBJECTS, resolveRoute} from './router.mjs';
import {findRun, speakable, spokenTokens} from './speech.mjs';
import {fail, readJson} from './util.mjs';

export const KINDS = ['title', 'code', 'trace', 'hyperframes', 'diagram', 'manim', 'bullets', 'credit'];

const showsCode = (scene) => scene.kind === 'code' || scene.kind === 'trace';
const needsClip = (scene) => scene.kind === 'manim' || scene.kind === 'trace';
export const DIAGRAM_TYPES = ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle'];

// Seconds. Narration drives the clock: each scene is its beats' audio plus these breaths.
const LEAD = 0.5; // silence before a scene's first word, while the visual settles in
const GAP = 0.3; // pause between beats
const TAIL = 0.7; // hold after the last word, before the cut
const ANTICIPATE = 0.15; // visuals change slightly ahead of the voice
const LAND = 0.7; // extra silence after a beat marked `land`, so its point can sink in

const gapAfter = (beat) => beat.pause ?? (beat.land ? GAP + LAND : GAP);
const HAS_PICTURE = ['manim', 'trace', 'diagram', 'hyperframes'];

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
      const checkCue = (cue, label) => {
        const checked = {...cue};
        if (showsCode(scene) && cue.lines !== undefined) checked.lines = normalizeLines(cue.lines, label, errors);
        if (scene.kind === 'diagram' && cue.focus !== undefined && cue.focus !== 'all' && !Array.isArray(cue.focus)) {
          errors.push(`${label}: "focus" must be a list of node/edge ids, or "all".`);
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
  const scenes = storyboard.scenes.map((scene) => {
    let t = LEAD;
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
    const end = t - gapAfter(last) + TAIL + (last.land ? LAND : 0) + (scene.hold || 0);
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
