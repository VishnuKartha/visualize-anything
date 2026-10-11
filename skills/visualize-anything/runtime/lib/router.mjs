// The router. The agent states, per scene, what the viewer needs to see (`need`, a closed
// vocabulary). The router turns that into a renderer, cross-checks it against what the narration
// actually says, and applies sequence rules across the whole video. Every verdict carries its
// reason, and a scene can disagree with the router by saying why in `override`.
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {absolutesIn, unbackedNumbers, vocabularyFindings} from './facts.mjs';
import {speakable} from './speech.mjs';

/** What the viewer needs to see → which renderer shows it. The single source of routing truth. */
export const NEEDS = {
  question: {kind: 'title', family: 'frame', says: 'the opening question, or a chapter turn'},
  source: {kind: 'code', family: 'code', says: 'what the code literally says, with nothing beside it (needs an override; prefer trace)'},
  motion: {kind: 'manim', family: 'algorithm', says: 'data or state changing step by step'},
  branching: {kind: 'manim', family: 'algorithm', says: 'decisions inside one procedure, acting on its data'},
  math: {kind: 'manim', family: 'algorithm', says: 'a formula, a growth rate, a plot'},
  trace: {kind: 'trace', family: 'algorithm', says: 'the code running line by line, beside the data it changes'},
  change: {kind: 'hyperframes', family: 'code', says: 'code turning from one version into the next'},
  data: {kind: 'hyperframes', family: 'frame', says: 'numbers that need a picture designed for them: a composition you write'},
  number: {kind: 'stat', family: 'frame', says: 'the one number the claim rests on, or a few side by side'},
  contrast: {kind: 'compare', family: 'frame', says: 'two or three alternatives, each with what it gets right and what it costs'},
  chart: {kind: 'chart', family: 'frame', says: 'measured values against each other: bars, or a line across rounds'},
  quote: {kind: 'quote', family: 'frame', says: "the source's own words, when the wording is the evidence"},
  figure: {kind: 'figure', family: 'frame', says: "the source's own figure, with the parts worth seeing pointed out"},
  structure: {kind: 'diagram', type: 'architecture', family: 'system', says: 'separate components and what connects them'},
  conversation: {kind: 'diagram', type: 'sequence', family: 'system', says: 'ordered messages between components'},
  pipeline: {kind: 'diagram', type: 'dataflow', family: 'system', says: 'data moving through stages and stores'},
  process: {kind: 'diagram', type: 'workflow', family: 'system', says: 'a process across several actors, with gates'},
  states: {kind: 'diagram', type: 'lifecycle', family: 'system', says: 'named states of an object and its transitions'},
  recap: {kind: 'bullets', family: 'frame', says: 'the claims to remember; nothing new'},
  credit: {kind: 'credit', family: 'frame', says: 'the name of what was explained and where to find it; the last scene'},
};

export const SUBJECTS = ['algorithm', 'system', 'mixed'];
const MIN_OVERRIDE = 12; // an override has to be an actual reason, not "ok"

// Words that suggest a need. They never decide a route; they catch a declared need that the
// narration does not support, and suggest one where none was declared.
const CUES = {
  source: [
    'line', 'lines', 'function', 'method', 'statement', 'if-statement', 'in code', 'as code', 'the code', 'this call',
    'here is', 'here are', 'notice', 'returns', 'argument', 'parameter', 'signature', 'declares', 'imports',
  ],
  motion: [
    'moves', 'move', 'jumps', 'jump', 'shifts', 'shift', 'swaps', 'swap', 'slides', 'grows', 'shrinks', 'halves',
    'doubles', 'evicted', 'evicts', 'evict', 'inserted', 'inserts', 'insert', 'removed', 'removes', 'pushes', 'pops',
    'pop', 'traverse', 'traverses', 'rotates', 'merges', 'splits', 'step by step', 'each step', 'one at a time',
    'over time', 'watch', 'picture', 'array', 'list', 'tree', 'heap', 'stack', 'slot', 'slots', 'bucket', 'buckets',
    'row', 'entry', 'entries', 'node', 'nodes', 'pointer', 'pointers', 'index',
  ],
  branching: [
    'decision', 'decisions', 'if it is', 'if so', 'if not', 'otherwise', 'either way', 'check fails', 'check passes',
    'first decision', 'second decision', 'branch', 'branches', 'in that case', 'whether',
  ],
  change: [
    'refactor', 'refactored', 'rewrite', 'rewritten', 'becomes', 'turns into', 'instead of', 'replace', 'replaces', 'replaced',
    'the fix', 'fixed by', 'before and after', 'the old version', 'the new version', 'first version', 'changed to', 'diff',
  ],
  data: [
    'percent', 'benchmark', 'benchmarks', 'milliseconds', 'requests per second', 'throughput', 'latency', 'times faster',
    'times slower', 'compared with', 'on average', 'chart', 'measured',
  ],
  trace: [
    'line by line', 'step through', 'stepping through', 'trace', 'as it runs', 'each iteration', 'iteration', 'the loop runs',
    'first pass', 'second pass', 'this time around', 'on the next pass',
  ],
  math: [
    'big o', 'o of', 'logarithmic', 'logarithm', 'quadratic', 'linear', 'exponential', 'exponentially', 'constant time',
    'curve', 'curves', 'plot', 'ratio', 'formula', 'equation', 'probability', 'average', 'squared', 'grows as',
    'proportional', 'times as',
  ],
  structure: [
    'service', 'services', 'server', 'servers', 'client', 'clients', 'browser', 'api', 'database', 'gateway',
    'load balancer', 'cdn', 'module', 'modules', 'package', 'packages', 'component', 'components', 'layer', 'layers',
    'microservice', 'microservices', 'frontend', 'backend', 'worker', 'workers', 'cluster', 'container', 'sits between',
    'made of', 'pieces', 'depends on', 'architecture',
  ],
  conversation: [
    'request', 'requests', 'response', 'responds', 'respond', 'replies', 'asks the', 'calls the', 'sends', 'round trip',
    'hands off', 'forwards', 'waits for', 'acknowledges', 'handshake',
  ],
  pipeline: [
    'pipeline', 'stage', 'stages', 'ingest', 'ingested', 'transform', 'transformed', 'enrich', 'enriched', 'stream',
    'batch', 'etl', 'written to', 'flows', 'lineage', 'warehouse', 'downstream', 'upstream', 'consumer', 'consumers',
  ],
  process: [
    'approval', 'approve', 'gate', 'deploy', 'deploys', 'deployment', 'release', 'rollout', 'sign-off', 'ci', 'review',
    'reviewer', 'merge request', 'pull request', 'runbook', 'on-call',
  ],
  states: [
    'state', 'states', 'status', 'pending', 'running', 'failed', 'succeeded', 'retry', 'retries', 'transition',
    'transitions', 'lifecycle', 'terminal', 'cancelled', 'expired',
  ],
  recap: ['remember', 'recap', 'in summary', 'to sum up', 'takeaway', 'takeaways', 'things to remember', 'that is all'],
};

const FAMILY_OF = Object.fromEntries(Object.entries(NEEDS).map(([need, spec]) => [need, spec.family]));
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CUE_PATTERNS = Object.fromEntries(
  Object.entries(CUES).map(([need, words]) => [need, words.map((word) => [word, new RegExp(`\\b${escape(word)}\\b`, 'i')])]),
);

const narrationOf = (scene) => scene.beats.map((beat) => `${beat.say} ${beat.caption || ''}`).join(' ');

/** Which cue words for each need appear in a scene's narration. */
export const cueHits = (text) => {
  const hits = {};
  for (const [need, patterns] of Object.entries(CUE_PATTERNS)) {
    const matched = patterns.filter(([, pattern]) => pattern.test(text)).map(([word]) => word);
    if (matched.length) hits[need] = matched;
  }
  return hits;
};

/** Best guess at a need from position and narration, for scenes that did not declare one. */
export const suggestNeed = (scene, index, count) => {
  if (index === 0) return {need: 'motion', because: 'first scene: the opening is always an animation of the hook'};
  const hits = cueHits(narrationOf(scene));
  if (index === count - 1 && (hits.recap || !Object.keys(hits).length)) return {need: 'recap', because: 'last scene'};
  if (scene.file || typeof scene.code === 'string') return {need: 'trace', because: 'the scene quotes source, and code is shown beside what it does'};
  const ranked = Object.entries(hits)
    .filter(([need]) => need !== 'recap')
    .sort((a, b) => b[1].length - a[1].length);
  if (!ranked.length) return null;
  const [need, words] = ranked[0];
  return {need, because: `narration says ${words.slice(0, 4).map((word) => `"${word}"`).join(', ')}`};
};

/** Settle a scene's kind (and diagram type) from what it declared. Explicit fields win; `need` fills gaps. */
export const resolveRoute = (scene) => {
  const spec = scene.need ? NEEDS[scene.need] : null;
  return {
    kind: scene.kind || spec?.kind || null,
    type: scene.type || (spec?.kind === 'diagram' ? spec.type : undefined),
  };
};

// Openings that tell the viewer a video is starting instead of giving them a reason to watch it.
const ANNOUNCEMENT = /^\s*(in this (video|tutorial|explainer)|today,? (we|i)|let'?s|welcome|hi\b|hello|hey\b|here (is|are) (some|a few|\w+ (tips|things|ways))|this (video|tutorial) |we(?:'re| are| will|'ll) (going to|look|explore|learn)|i(?:'m| am| will|'ll) (going to|show|explain))/i;

/** What is weak about a title, if anything. A title should promise a specific payoff in a few words. */
export const weakTitle = (raw) => {
  const title = raw.replace(/\*/g, '').trim();
  const words = title.split(/\s+/).filter(Boolean);
  const problems = [];
  if (!words.length) return problems;
  if (/^(an? )?(introduction|intro|overview|guide|tutorial|walkthrough|primer|deep dive)\b|^(understanding|explaining|exploring|learning|learn|all about)\b/i.test(title)) {
    problems.push(`The title "${title}" names a genre, not a payoff. Say what the viewer will find out ("Why binary search needs so few steps"), not that an explanation follows.`);
  } else if (/^how (does )?.{1,40} works?\??$/i.test(title)) {
    problems.push(`The title "${title}" could sit on any video about the subject. Put the surprising or specific part in it: what it avoids, how few steps, what it decides.`);
  } else if (words.length <= 2) {
    problems.push(`The title "${title}" is only the subject's name. Add the claim or question the video answers.`);
  }
  if (words.length > 9) problems.push(`The title is ${words.length} words. Past nine it stops reading as a title; say less.`);
  return problems;
};

// A scene that starts over instead of following on: the words that announce a new section.
const RESTART = /^\s*(now,?\s+(let'?s|we|that)|next,?\s|moving on|okay,?\s|alright,?\s|(so,?\s+)?(first,?\s+)?let'?s\s+(now\s+)?(look|take|see|move|turn|dive|explore|talk|walk|go|start|begin)|in this (section|part|scene)|we(?:'ll| will) now|with that (out of the way|in mind))/i;

// Words that pad a sentence or talk down to the viewer. Narration is better without every one of them.
const FILLER = [
  'simply', 'basically', 'obviously', 'clearly', 'of course', 'essentially', 'actually', 'really', 'very', 'just',
  'kind of', 'sort of', 'as you can see', 'as we can see', 'take a look', 'it is worth noting', "it's worth noting", 'in order to',
  'needless to say', 'at the end of the day', "here's the thing", "let's dive in", "here's the kicker", 'the wild part',
].map((phrase) => [phrase, new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')]);

const SMALL_NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS = {30: 'thirty', 40: 'forty', 50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety', 100: 'hundred', 1000: 'thousand', 1000000: 'million', 1000000000: 'billion'};

/** The words a starred hook word could be spoken as: itself, and for a number, its name. */
const spokenForms = (word) => {
  const plain = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!plain) return [];
  const value = /^\d+$/.test(plain) ? Number(plain) : null;
  if (value === null) return [plain];
  return [plain, SMALL_NUMBERS[value], TENS[value]].filter(Boolean);
};

const starred = (text) => [...String(text || '').matchAll(/\*([^*]+)\*/g)].flatMap((match) => match[1].split(/\s+/)).filter(Boolean);

const HAS_PICTURE = ['manim', 'trace', 'diagram', 'hyperframes', 'stat', 'compare', 'chart', 'figure'];
// What a video that does not open on an animation opens on instead, in words.
const OPENS_ON = {title: 'words', bullets: 'a list', code: 'bare code', trace: 'code', credit: 'the credit', stat: 'a number card', compare: 'panels', chart: 'a chart', quote: 'a quotation', figure: "the source's figure", diagram: 'a diagram', hyperframes: 'a rendered clip'};
// Scenes drawn from the storyboard alone, whose parts arrive by `show`.
const EVIDENCE = ['stat', 'compare', 'chart', 'quote', 'figure'];

const IDENTIFIER = /\b[a-z]+_[a-z0-9_]+\b|\b[a-z]+[A-Z][A-Za-z0-9]*\b|\b[A-Za-z_]\w*\(\)/;
const sameCue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const hasOverride = (scene) => typeof scene.override === 'string' && scene.override.trim().length >= MIN_OVERRIDE;

const estimateSeconds = (scene, timed) => {
  if (timed) return timed.frames / timed.fps;
  const words = scene.beats.reduce((sum, beat) => sum + beat.say.split(/\s+/).length, 0);
  const thinking = 1.5 * scene.beats.filter((beat) => beat.predict).length;
  return words / 2.6 + 1.2 + 0.3 * (scene.beats.length - 1) + thinking;
};

const diagramNodeCount = (scene, projectDir) => {
  if (!projectDir || !scene.candidate) return null;
  const file = path.resolve(projectDir, scene.candidate);
  if (!existsSync(file)) return null;
  try {
    const candidate = JSON.parse(readFileSync(file, 'utf8'));
    const list = candidate.nodes || candidate.participants || candidate.states || candidate.components;
    return Array.isArray(list) ? list.length : null;
  } catch {
    return null;
  }
};

// The narration is written once, whole, in script.md, and then split into scenes and beats. The two
// are compared by their words alone, in order, so line breaks and punctuation are free to differ.
const spokenWords = (text) => String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);

/** The prose of a script: its headings, comments, and quoted notes are for the writer, not the voice. */
export const scriptProse = (markdown) => {
  const prose = String(markdown).replace(/<!--[\s\S]*?-->/g, ' ');
  return prose.split('\n').filter((line) => !/^\s*(#|>)/.test(line)).join(' ');
};

/** Where a storyboard's narration first parts from the script, or null when they are the same words in the same order. */
export const scriptDrift = (markdown, scenes) => {
  const script = spokenWords(scriptProse(markdown));
  const spoken = scenes.flatMap((scene) => scene.beats.flatMap((beat, beatIndex) => spokenWords(beat.say).map((word) => ({word, scene: scene.id, beat: beatIndex + 1}))));
  const length = Math.max(script.length, spoken.length);
  for (let index = 0; index < length; index += 1) {
    if (script[index] === spoken[index]?.word) continue;
    const around = (words) => words.slice(Math.max(0, index - 3), index + 4).join(' ') || '(nothing more)';
    const place = spoken[Math.min(index, spoken.length - 1)];
    return {scene: place?.scene ?? null, beat: place?.beat ?? null, script: around(script), storyboard: around(spoken.map((entry) => entry.word))};
  }
  return null;
};

/**
 * Review every routing decision in a storyboard.
 * Returns one row per scene (status ok | review | error, with reasons) plus notes on the sequence.
 */
export const analyzeRouting = (storyboard, {timeline = null, projectDir = null} = {}) => {
  const scenes = storyboard.scenes;
  const count = scenes.length;
  const notes = [];

  // What the video is about decides whether system diagrams belong in it at all.
  const totals = {algorithm: 0, system: 0};
  for (const scene of scenes) {
    for (const [need, words] of Object.entries(cueHits(narrationOf(scene)))) {
      if (FAMILY_OF[need] === 'algorithm' || FAMILY_OF[need] === 'system') totals[FAMILY_OF[need]] += words.length;
    }
  }
  let subject = storyboard.subject;
  if (!subject) {
    const guess = totals.algorithm >= totals.system * 1.5 ? 'algorithm' : totals.system >= totals.algorithm * 1.5 ? 'system' : 'mixed';
    subject = guess;
    notes.push({
      level: 'review',
      text: `No "subject" declared. The narration reads as "${guess}" (${totals.algorithm} algorithm cues, ${totals.system} system cues). Set "subject" to algorithm, system, or mixed.`,
    });
  }

  const offVocabulary = vocabularyFindings(storyboard);

  // A credit comes after the close: the scene before it is the one that has to end the explanation.
  const closeIndex = count > 1 && scenes[count - 1].kind === 'credit' ? count - 2 : count - 1;

  const rows = scenes.map((scene, index) => {
    const reasons = [];
    let status = 'ok';
    const flag = (level, text) => {
      reasons.push({level, text});
      if (level === 'error' || (level === 'review' && status === 'ok')) status = level;
    };
    const overridden = hasOverride(scene);
    const spec = scene.need ? NEEDS[scene.need] : null;
    const hits = cueHits(narrationOf(scene));
    const timed = timeline?.scenes?.[index]?.id === scene.id ? {frames: timeline.scenes[index].frames, fps: timeline.fps} : null;
    const seconds = estimateSeconds(scene, timed);

    if (!spec) {
      const suggestion = suggestNeed(scene, index, count);
      flag(
        'review',
        suggestion
          ? `No "need" declared, so this route cannot be checked. Suggested: "${suggestion.need}" (${suggestion.because}).`
          : 'No "need" declared, so this route cannot be checked.',
      );
    } else {
      // Declared need and authored renderer must agree, unless the scene says why not.
      const wantType = spec.kind === 'diagram' ? spec.type : undefined;
      const mismatch = scene.kind !== spec.kind || (wantType && scene.type && scene.type !== wantType);
      if (mismatch) {
        const want = wantType ? `${spec.kind} · ${wantType}` : spec.kind;
        const got = scene.kind === 'diagram' ? `${scene.kind} · ${scene.type}` : scene.kind;
        if (overridden) flag('note', `Routed to ${got} instead of ${want}: ${scene.override.trim()}`);
        else flag('error', `need "${scene.need}" (${spec.says}) routes to ${want}, but the scene is ${got}. Fix one, or add "override": "<reason>".`);
      }

      // The narration should sound like the need. Only speak up when it clearly sounds like something else.
      const own = hits[scene.need]?.length || 0;
      const rival = Object.entries(hits)
        // `source` is never proposed: code on its own is not something to route a scene to.
        .filter(([need]) => need !== scene.need && need !== 'recap' && need !== 'source' && NEEDS[need].kind !== spec.kind)
        .sort((a, b) => b[1].length - a[1].length)[0];
      // A trace scene is code beside its animation, so narration about the data moving supports it.
      const supported = scene.need === 'trace' && rival && ['motion', 'branching', 'math'].includes(rival[0]);
      if (rival && rival[1].length >= 3 && own === 0 && spec.family !== 'frame' && !overridden && !supported) {
        flag(
          'review',
          `Declared "${scene.need}", but the narration reads like "${rival[0]}" (${rival[1].slice(0, 4).map((word) => `"${word}"`).join(', ')}) and has no cue for "${scene.need}". Re-read the scene: what must the viewer see?`,
        );
      }
    }

    // The hook is shown happening, not stated: the opening is always an animation, with the hook said over it.
    if (index === 0 && scene.kind !== 'manim') {
      const what = OPENS_ON[scene.kind] || `a ${scene.kind} scene`;
      if (overridden) flag('note', `Opens on ${what} rather than an animation: ${scene.override.trim()}`);
      else flag('error', `The video opens on ${what}. The opening is always an animation: make the first scene a "motion", "branching", or "math" scene, drawn in Manim, that shows the hook happening (the problem going wrong, or the number being counted), and say the hook over it. If nothing about this subject can be animated in its first seconds, say why in "override".`);
    }

    // Code on its own is text to be read, not an explanation. It always comes with a picture of what it does.
    if (scene.kind === 'code') {
      if (overridden) flag('note', `Code shown without a visual: ${scene.override.trim()}`);
      else flag('error', 'A code block is never shown on its own. Use a trace scene ("need": "trace"): the same lines on the left, and what they do to the data animated on the right. If this code truly has nothing to draw, add "override": "<reason>".');
    }

    // An algorithm is animated end to end; its branches are not a flowchart.
    if (subject === 'algorithm' && scene.kind === 'diagram') {
      if (overridden) flag('note', `Diagram in an algorithm video: ${scene.override.trim()}`);
      else flag('error', 'This is an algorithm video, so a diagram scene is out of place: show the behaviour in Manim, on the data the viewer is already watching. If this really is about separate components, add "override": "<reason>" or set "subject" to "mixed".');
    }

    if (scene.kind === 'diagram') {
      const nodes = diagramNodeCount(scene, projectDir);
      if (nodes !== null && nodes < 3) flag('review', `The diagram has ${nodes} node(s). Two boxes and an arrow is a sentence, not a scene.`);
      if (nodes !== null && nodes > 7) flag('review', `The diagram has ${nodes} nodes; past seven, labels fall below a readable size. Split it into an overview and a detail scene.`);
    }

    if (!scene.why) flag('review', 'No "why". Record the reason for this route in one sentence so it can be reviewed.');

    // The voice explains; it does not recite. And it does not pad.
    scene.beats.forEach((beat, beatIndex) => {
      const spoken = speakable(beat.say);
      const dots = (spoken.match(/\bdot\b/g) || []).length;
      if (dots >= 2 || /[()[\]{}=<>]/.test(spoken)) {
        flag('review', `Beat ${beatIndex + 1} reads code aloud ("${spoken.length > 70 ? `${spoken.slice(0, 67)}...` : spoken}"). Say what the line does; the line itself is on screen.`);
      }
      const padding = FILLER.filter(([, pattern]) => pattern.test(beat.say)).map(([phrase]) => `"${phrase}"`);
      if (padding.length) flag('review', `Beat ${beatIndex + 1} has filler: ${padding.join(', ')}. Cut it; the sentence is stronger without.`);
      // A sentence without exceptions is a promise about the edges, and is tested there before it is said.
      const absolute = absolutesIn(beat.say);
      if (absolute.length && !beat.holds) {
        flag('review', `Beat ${beatIndex + 1} says ${absolute.map((word) => `"${word}"`).join(', ')}. That is a claim about every case, so try the edges before voicing it (nothing in it, one thing in it, a tie, the limit): have the oracle print true or false, record it in "facts", and name it here with "holds": "<fact id>". If it only usually holds, say that instead.`);
      }
    });

    // One word per idea, and no word before the scene that explains it.
    for (const finding of offVocabulary.filter((entry) => entry.scene === scene.id)) {
      flag('review', finding.kind === 'synonym'
        ? `Beat ${finding.beat} says "${finding.said}" for what the video calls "${finding.word}". Two words for one thing are heard as two things.`
        : `Beat ${finding.beat} says "${finding.word}" before "${finding.defined}", the scene that explains it. Use plain words until then, or explain it here.`);
    }
    const asked = scene.beats.filter((beat) => beat.predict).length;
    if (asked > 2) flag('review', `${asked} prediction pauses in one scene. One or two; past that the stopping becomes the rhythm and none of them is a question the viewer wanted to answer.`);

    // Two scenes drawn by the same script usually share one picture, and should not blink between them.
    const before = scenes[index - 1];
    if (before && scene.script && scene.script === before.script && scene.continues === undefined && HAS_PICTURE.includes(scene.kind) && HAS_PICTURE.includes(before.kind)) {
      flag('review', `This scene and "${before.id}" are drawn by the same script. If it starts on the picture that scene ended on, set "continues": true so the picture is not faded out and back in between them; if it starts fresh, set "continues": false.`);
    }

    if (scene.kind === 'bullets' && index === closeIndex) {
      const pictured = scenes.slice(0, index).filter((entry) => HAS_PICTURE.includes(entry.kind));
      const items = scene.items || [];
      if (pictured.length >= 2 && items.length >= 2 && !items.some((item) => item && typeof item === 'object' && item.from)) {
        flag('review', `The recap lists ${items.length} takeaways beside one picture. Let each show the moment that proved it: {"text": "...", "from": "<scene id>", "beat": n}.`);
      }
    }

    if ((scene.kind === 'code' || scene.kind === 'trace') && scene.beats.length > 1) {
      const cued = (beat) => beat.lines || (beat.cues || []).some((cue) => cue.lines);
      if (scene.kind === 'code' && scene.auto === false && scene.beats.every((beat) => !cued(beat))) flag('review', 'No beat highlights any lines, so nothing changes on screen while the voice moves on. Give each beat "lines".');
      scene.beats.forEach((beat, beatIndex) => {
        if (beatIndex > 0 && beat.lines && sameCue(beat.lines, scene.beats[beatIndex - 1].lines) && !beat.note) {
          flag('review', `Beats ${beatIndex} and ${beatIndex + 1} highlight the same lines. Merge them, or move the highlight.`);
        }
      });
    }
    if (scene.kind === 'diagram') {
      scene.beats.forEach((beat, beatIndex) => {
        if (beatIndex > 0 && Array.isArray(beat.focus) && sameCue(beat.focus, scene.beats[beatIndex - 1].focus)) {
          flag('review', `Beats ${beatIndex} and ${beatIndex + 1} focus the same parts. Merge them, or move the focus.`);
        }
      });
    }

    if (EVIDENCE.includes(scene.kind)) {
      // What a beat leaves on screen is its last word on the matter: its own cue, or its final one.
      const state = (beat) => [beat, ...(beat.cues || [])].reduce((kept, cue) => ({show: cue.show ?? kept.show, focus: cue.focus ?? kept.focus, note: cue.note ?? kept.note}), {});
      scene.beats.forEach((beat, beatIndex) => {
        const before = beatIndex > 0 ? state(scene.beats[beatIndex - 1]) : null;
        if (before && beat.show !== undefined && !(beat.cues || []).length && sameCue(state(beat), before)) {
          flag('review', `Beats ${beatIndex} and ${beatIndex + 1} show the same thing. Bring in the next part with "show", light what the sentence is about with "focus", or merge them.`);
        }
      });
      if (scene.kind === 'quote' && scene.quote && scene.quote.split(/\s+/).length > 45) {
        flag('review', `The quote is ${scene.quote.split(/\s+/).length} words. Past about forty-five it is a paragraph to read, not a line to hear: quote the sentence that carries the claim and say the rest.`);
      }
      if (scene.kind === 'chart' && scene.labels && scene.series && scene.labels.length * scene.series.length > 16) {
        flag('review', `The chart has ${scene.labels.length * scene.series.length} marks. Past sixteen none of them is read; chart the ones the sentence compares and say the rest.`);
      }
    }

    if (scene.kind === 'title') {
      const hooks = scene.beats.flatMap((beat) => [beat.text, ...(beat.cues || []).map((cue) => cue.text)]).filter(Boolean);
      // A question scene shows its statement and nothing else: no title card stands in for one.
      if (!hooks.length) {
        flag('error', `This scene puts nothing on screen for about ${seconds.toFixed(0)}s while the voice talks. Give the first beat a "text": the hook as a short statement, with the *key number or word* starred. The name of what is explained goes in a closing "credit" scene.`);
      }
      for (const hook of hooks) {
        const longest = Math.max(...hook.split('\n').map((line) => line.replace(/\*/g, '').split(/\s+/).filter(Boolean).length));
        if (longest > 8) flag('review', `Hook text "${hook.replace(/\n/g, ' / ')}" has a ${longest}-word line. A hook is read at a glance: eight words a line at most, the rest belongs to the voice.`);
      }
      if (hooks.length && !hooks.some((hook) => hook.includes('*'))) flag('review', 'No word in the hook text is starred. Star the one number or word the viewer should remember (*20* comparisons).');
    }
    if (scene.kind === 'credit') {
      if (index !== count - 1) flag('review', 'A credit names what was explained and where to find it. It goes last, after the recap.');
      if (seconds > 8) flag('review', `The credit runs about ${seconds.toFixed(0)}s. The explanation is over: one short line that says the name is enough.`);
    }
    // However the video opens, on a statement or cold on a picture, its first words are the hook.
    const firstWords = scene.beats[0]?.say || '';
    if (index > 0 && scene.kind !== 'credit' && RESTART.test(firstWords)) {
      flag('review', `This scene starts over ("${firstWords.split(/\s+/).slice(0, 4).join(' ')}..."). It should pick up where "${scenes[index - 1].id}" stopped: answer the question that scene left open, or turn on "but" or "so".`);
    }
    if (index === 0 && ANNOUNCEMENT.test(firstWords)) {
      flag('review', `The narration opens by announcing the video ("${firstWords.split(/\s+/).slice(0, 5).join(' ')}..."). Open on the hook itself: the surprising number, the failure, or the question.`);
    }
    if (scene.kind !== 'title' && scene.kind !== 'credit' && seconds < 6) flag('review', `About ${seconds.toFixed(0)}s is a short scene; the cut will feel abrupt. Merge it into a neighbour or give it another beat.`);
    if (seconds > 40) flag('review', `About ${seconds.toFixed(0)}s is a long time on one picture. Split it at a turn in the narration.`);

    return {id: scene.id, index, need: scene.need || null, kind: scene.kind, type: scene.type, seconds, status, reasons, hits};
  });

  // Rules about the sequence as a whole.
  const kinds = scenes.map((scene) => scene.kind);
  const seq = (level, text) => notes.push({level, text});
  if (count > 2 && !['bullets', 'code', 'trace', 'hyperframes'].includes(kinds[closeIndex])) seq('review', `The video ends on a ${kinds[closeIndex]} scene. Close on a recap or a final look at the code, not a new idea.`);
  for (let i = 2; i < count; i += 1) {
    if (kinds[i] === kinds[i - 1] && kinds[i] === kinds[i - 2] && kinds[i] !== 'manim' && kinds[i] !== 'trace') {
      seq('review', `Three ${kinds[i]} scenes in a row (${scenes[i - 2].id}, ${scenes[i - 1].id}, ${scenes[i].id}) read as a slideshow. Put a different kind of picture between them.`);
      break;
    }
  }
  scenes.forEach((scene, index) => {
    if (['code', 'trace', 'hyperframes', 'title', 'bullets', 'credit'].includes(scene.kind)) return;
    const named = scene.beats.map((beat) => beat.caption || beat.say).join(' ').match(IDENTIFIER);
    const near = [kinds[index - 1], kinds[index + 1]].some((kind) => kind === 'code' || kind === 'trace' || kind === 'hyperframes');
    if (named && !near) seq('review', `"${scene.id}" names ${named[0]} but no code scene is next to it. Viewers trust a claim about an identifier once they have seen its line.`);
  });
  if (subject === 'algorithm' && !kinds.includes('manim') && !kinds.includes('trace')) seq('review', 'An algorithm video with no Manim or trace scene only shows text. Animate the behaviour at least once.');
  if (subject === 'system' && !kinds.includes('diagram')) seq('review', 'A system video with no diagram never shows how the parts connect. Add an architecture or sequence scene.');
  if (!kinds.includes('code') && !kinds.includes('trace') && !scenes.some((scene) => scene.need === 'change')) seq('review', 'No code scene. An explainer about code should show the real lines at least once.');

  // The narration is one piece of writing, split up; not a set of lines written a scene at a time.
  const scriptFile = projectDir ? path.join(projectDir, 'script.md') : null;
  if (scriptFile && !existsSync(scriptFile)) {
    if (count > 2) seq('review', 'No script.md. Write the whole narration there first, as one continuous piece with no scene labels, and read it through. Then split it into scenes and beats. Lines written a scene at a time do not follow on from each other.');
  } else if (scriptFile) {
    const drift = scriptDrift(readFileSync(scriptFile, 'utf8'), scenes);
    if (drift) {
      seq('review', `The storyboard's narration is not the script. They part at "${drift.scene}" beat ${drift.beat}: script.md has "${drift.script}", the storyboard has "${drift.storyboard}". Change the script first, reread the lines either side of the change, then bring the storyboard into line.`);
    }
  }

  // The hook is settled before the storyboard: the core of the problem, or the most interesting thing about the answer.
  const agreedHook = typeof storyboard.brief?.hook === 'string' ? storyboard.brief.hook.trim() : '';
  const spokenIn = (scene) => new Set(scene.beats.flatMap((beat) => beat.say.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')));
  const saysAny = (scene, words) => words.some((word) => spokenForms(word).some((form) => spokenIn(scene).has(form)));
  const quoted = (words) => [...new Set(words)].map((word) => `"${word}"`).join(', ');
  if (count > 2 && !agreedHook) {
    seq('review', 'No hook in the brief. Before writing scenes, settle the one sentence that makes someone want the answer: the core of the problem this solves, or the most surprising thing about how it solves it. Record it as "brief": {"hook": "...", with the *key word or number* starred}.');
  } else if (agreedHook) {
    if (!starred(agreedHook).length) seq('review', 'No word in the brief\'s hook is starred. Star the number or word it turns on: the opening has to say it and the ending has to come back to it.');
    else if (!saysAny(scenes[0], starred(agreedHook))) {
      seq('review', `The opening scene never says the hook: none of ${quoted(starred(agreedHook))} is spoken in "${scenes[0].id}". The first sentences are for the hook; the setup comes after it.`);
    }
  }

  // The ending should cash in what the opening promised.
  const opening = scenes.find((scene) => scene.kind === 'title');
  const promised = [...(opening ? opening.beats.flatMap((beat) => [beat.text, ...(beat.cues || []).map((cue) => cue.text)]).flatMap(starred) : []), ...starred(agreedHook)];
  if (promised.length && count > 2 && !saysAny(scenes[closeIndex], promised)) {
    seq('review', `The hook stars ${quoted(promised)}, but the closing scene never comes back to it. End by returning to the hook: the same number, the same word.`);
  }
  if (count > 2 && !scenes.some((scene) => scene.beats.some((beat) => beat.land))) {
    seq('review', 'No beat is marked to land. Find the moment the main point resolves and give that beat "land": true; the voice waits a moment longer there so it can sink in.');
  }

  // Every number said or shown is a row of the ledger, where the oracle can compute it again.
  const loose = unbackedNumbers(storyboard);
  if (loose.length) {
    const listed = loose.slice(0, 6).map((number) => `"${number.text}" (${number.where})`).join(', ');
    seq('review', `${loose.length} number(s) are said or shown but are not in "facts": ${listed}${loose.length > 6 ? ', and more' : ''}. A number typed in by hand can be wrong without anything noticing. Give each a row, {"id": "...", "value": n, "what": "..."}, have facts.py compute it by running the real code, and run \`va facts\`. A number nothing computes (the count of takeaways) gets "given": "<where it comes from>" instead.`);
  }
  // The viewer who has guessed is waiting for the answer; the one who was only told is not.
  const total = rows.reduce((sum, row) => sum + row.seconds, 0);
  if (count > 2 && total > 45 && !scenes.some((scene) => scene.beats.some((beat) => beat.predict))) {
    seq('review', 'No prediction pause. Find one place where the viewer could work out what comes next, end that beat on the question, and give it "predict": true: the picture holds for a moment longer before the next beat answers. One or two a video.');
  }
  if (count > 2 && !(storyboard.vocabulary || []).length) {
    seq('review', 'No "vocabulary". List the handful of words the video uses for its ideas, each with the words it must not also be called and the scene that explains it: [{"word": "entry", "not": ["item", "element"], "defined": "state"}]. The router then holds the narration to one word per idea.');
  }

  // The video's title is read where it is posted, beside the thumbnail; it is not shown in the video.
  if (storyboard.title && storyboard.title !== 'Untitled') for (const problem of weakTitle(storyboard.title)) seq('review', problem);

  // The thumbnail is met about 120 pixels wide. It holds a few words and one picture.
  const plainWords = (text) => String(text || '').replace(/\*/g, '').split(/\s+/).filter(Boolean);
  const thumbnail = storyboard.thumbnail || null;
  const hookText = opening?.beats.flatMap((beat) => [beat.text, ...(beat.cues || []).map((cue) => cue.text)]).filter(Boolean).at(-1);
  const coverText = thumbnail?.text || hookText;
  if (!coverText && count > 2) {
    seq('review', 'No thumbnail. Give the storyboard a "thumbnail": {"text": "five words at most, *one* starred", "from": "<the scene with the most striking picture>"}; without one the thumbnail only repeats the title.');
  }
  if (coverText && plainWords(coverText).length > 5) {
    seq('review', thumbnail?.text
      ? `The thumbnail text is ${plainWords(coverText).length} words. At the size a thumbnail is seen, five is the most that can be read: keep the number or the word that makes the claim, and drop the rest.`
      : `The thumbnail will carry the hook as it stands (${plainWords(coverText).length} words), which cannot be read at the size a thumbnail is seen. Give the storyboard a "thumbnail": {"text": "five words at most, *one* starred", "from": "<the scene with the most striking picture>"}.`);
  }
  if (thumbnail?.text && !thumbnail.text.includes('*')) seq('review', 'No word in the thumbnail text is starred. Star the number or word that carries the claim.');
  if (thumbnail && !thumbnail.from && scenes.some((scene) => HAS_PICTURE.includes(scene.kind))) seq('review', 'The thumbnail is words alone. Put the video\'s most striking moment under them: "from": "<scene id>", and "beat" for which moment.');
  if (thumbnail?.text && storyboard.title && plainWords(thumbnail.text).join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, '') === plainWords(storyboard.title).join(' ').toLowerCase().replace(/[^a-z0-9 ]/g, '')) {
    seq('review', 'The thumbnail repeats the title, which already sits beside it wherever the video is listed. Use the hook instead: the number, the failure, the question.');
  }

  const target = Number(storyboard.brief?.length);
  if (Number.isFinite(target) && target > 0 && Math.abs(total - target) / target > 0.2) {
    seq('review', `The brief asks for about ${target}s; this runs ${timeline ? '' : 'about '}${total.toFixed(0)}s. ${total > target ? 'Cut a scene or tighten the narration' : 'There is room for another idea, or say so and shorten the brief'}.`);
  }
  const share = {};
  rows.forEach((row) => (share[row.kind] = (share[row.kind] || 0) + row.seconds));
  const errors = rows.filter((row) => row.status === 'error').length;
  const reviews = rows.filter((row) => row.status === 'review').length + notes.filter((note) => note.level === 'review').length;
  return {subject, declaredSubject: Boolean(storyboard.subject), brief: storyboard.brief || null, rows, notes, total, share, errors, reviews, timed: Boolean(timeline)};
};

/** The routing report as text: one line per scene, then whatever needs attention. */
export const formatRouting = (report) => {
  const lines = [];
  const mark = {ok: ' ok   ', review: 'REVIEW', error: 'ERROR '};
  lines.push(`Routing: ${report.rows.length} scenes, subject "${report.subject}"${report.declaredSubject ? '' : ' (guessed)'}, ${report.timed ? '' : 'about '}${report.total.toFixed(0)}s.`);
  if (report.brief) {
    const {audience, length, focus, hook} = report.brief;
    lines.push(`  Brief: ${[audience && `for ${audience}`, length && `about ${length}s`, focus && `focus on ${focus}`].filter(Boolean).join(', ') || '(empty)'}.`);
    if (hook) lines.push(`  Hook: ${hook}`);
  }
  const width = Math.max(...report.rows.map((row) => row.id.length));
  for (const row of report.rows) {
    const route = row.kind === 'diagram' ? `diagram · ${row.type}` : row.kind;
    lines.push(`  ${mark[row.status]}  ${row.id.padEnd(width)}  ${(row.need || '?').padEnd(12)} → ${route.padEnd(22)} ${row.seconds.toFixed(0).padStart(3)}s`);
    for (const reason of row.reasons) lines.push(`            ${reason.level === 'note' ? 'note' : reason.level}: ${reason.text}`);
  }
  if (report.notes.length) {
    lines.push('  Sequence:');
    for (const note of report.notes) lines.push(`    ${note.level}: ${note.text}`);
  }
  const mix = Object.entries(report.share)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, seconds]) => `${kind} ${Math.round((100 * seconds) / report.total)}%`)
    .join(', ');
  lines.push(`  Screen time: ${mix}.`);
  lines.push(
    report.errors
      ? `  ${report.errors} routing error(s) must be fixed before rendering.`
      : report.reviews
        ? `  No errors. ${report.reviews} item(s) to review: act on each, or leave it if the reason does not apply here.`
        : '  Every route checks out.',
  );
  return lines.join('\n');
};
