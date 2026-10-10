// The router. The agent states, per scene, what the viewer needs to see (`need`, a closed
// vocabulary). The router turns that into a renderer, cross-checks it against what the narration
// actually says, and applies sequence rules across the whole video. Every verdict carries its
// reason, and a scene can disagree with the router by saying why in `override`.
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

/** What the viewer needs to see → which renderer shows it. The single source of routing truth. */
export const NEEDS = {
  question: {kind: 'title', family: 'frame', says: 'the opening question, or a chapter turn'},
  source: {kind: 'code', family: 'code', says: 'what the code literally says'},
  motion: {kind: 'manim', family: 'algorithm', says: 'data or state changing step by step'},
  branching: {kind: 'manim', family: 'algorithm', says: 'decisions inside one procedure, acting on its data'},
  math: {kind: 'manim', family: 'algorithm', says: 'a formula, a growth rate, a plot'},
  structure: {kind: 'diagram', type: 'architecture', family: 'system', says: 'separate components and what connects them'},
  conversation: {kind: 'diagram', type: 'sequence', family: 'system', says: 'ordered messages between components'},
  pipeline: {kind: 'diagram', type: 'dataflow', family: 'system', says: 'data moving through stages and stores'},
  process: {kind: 'diagram', type: 'workflow', family: 'system', says: 'a process across several actors, with gates'},
  states: {kind: 'diagram', type: 'lifecycle', family: 'system', says: 'named states of an object and its transitions'},
  recap: {kind: 'bullets', family: 'frame', says: 'the claims to remember; nothing new'},
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
  if (index === 0) return {need: 'question', because: 'first scene'};
  const hits = cueHits(narrationOf(scene));
  if (index === count - 1 && (hits.recap || !Object.keys(hits).length)) return {need: 'recap', because: 'last scene'};
  if (scene.file || typeof scene.code === 'string') return {need: 'source', because: 'the scene quotes source'};
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

const IDENTIFIER = /\b[a-z]+_[a-z0-9_]+\b|\b[a-z]+[A-Z][A-Za-z0-9]*\b|\b[A-Za-z_]\w*\(\)/;
const sameCue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const hasOverride = (scene) => typeof scene.override === 'string' && scene.override.trim().length >= MIN_OVERRIDE;

const estimateSeconds = (scene, timed) => {
  if (timed) return timed.frames / timed.fps;
  const words = scene.beats.reduce((sum, beat) => sum + beat.say.split(/\s+/).length, 0);
  return words / 2.6 + 1.2 + 0.3 * (scene.beats.length - 1);
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
        .filter(([need]) => need !== scene.need && need !== 'recap' && NEEDS[need].kind !== spec.kind)
        .sort((a, b) => b[1].length - a[1].length)[0];
      if (rival && rival[1].length >= 3 && own === 0 && spec.family !== 'frame' && !overridden) {
        flag(
          'review',
          `Declared "${scene.need}", but the narration reads like "${rival[0]}" (${rival[1].slice(0, 4).map((word) => `"${word}"`).join(', ')}) and has no cue for "${scene.need}". Re-read the scene: what must the viewer see?`,
        );
      }
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

    if (scene.kind === 'code' && scene.beats.length > 1) {
      if (scene.beats.every((beat) => !beat.lines)) flag('review', 'No beat highlights any lines, so nothing changes on screen while the voice moves on. Give each beat "lines".');
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

    if (scene.kind !== 'title' && seconds < 6) flag('review', `About ${seconds.toFixed(0)}s is a short scene; the cut will feel abrupt. Merge it into a neighbour or give it another beat.`);
    if (seconds > 40) flag('review', `About ${seconds.toFixed(0)}s is a long time on one picture. Split it at a turn in the narration.`);

    return {id: scene.id, index, need: scene.need || null, kind: scene.kind, type: scene.type, seconds, status, reasons, hits};
  });

  // Rules about the sequence as a whole.
  const kinds = scenes.map((scene) => scene.kind);
  const seq = (level, text) => notes.push({level, text});
  if (kinds[0] !== 'title') seq('review', `The video opens on a ${kinds[0]} scene. Open with a title that states the question it answers.`);
  if (count > 2 && !['bullets', 'code'].includes(kinds.at(-1))) seq('review', `The video ends on a ${kinds.at(-1)} scene. Close on a recap or a final look at the code, not a new idea.`);
  for (let i = 2; i < count; i += 1) {
    if (kinds[i] === kinds[i - 1] && kinds[i] === kinds[i - 2] && kinds[i] !== 'manim') {
      seq('review', `Three ${kinds[i]} scenes in a row (${scenes[i - 2].id}, ${scenes[i - 1].id}, ${scenes[i].id}) read as a slideshow. Put a different kind of picture between them.`);
      break;
    }
  }
  scenes.forEach((scene, index) => {
    if (scene.kind === 'code' || scene.kind === 'title' || scene.kind === 'bullets') return;
    const named = scene.beats.map((beat) => beat.caption || beat.say).join(' ').match(IDENTIFIER);
    const near = [kinds[index - 1], kinds[index + 1]].includes('code');
    if (named && !near) seq('review', `"${scene.id}" names ${named[0]} but no code scene is next to it. Viewers trust a claim about an identifier once they have seen its line.`);
  });
  if (subject === 'algorithm' && !kinds.includes('manim')) seq('review', 'An algorithm video with no Manim scene only shows text. Animate the behaviour at least once.');
  if (subject === 'system' && !kinds.includes('diagram')) seq('review', 'A system video with no diagram never shows how the parts connect. Add an architecture or sequence scene.');
  if (!kinds.includes('code')) seq('review', 'No code scene. An explainer about code should show the real lines at least once.');

  const total = rows.reduce((sum, row) => sum + row.seconds, 0);
  const share = {};
  rows.forEach((row) => (share[row.kind] = (share[row.kind] || 0) + row.seconds));
  const errors = rows.filter((row) => row.status === 'error').length;
  const reviews = rows.filter((row) => row.status === 'review').length + notes.filter((note) => note.level === 'review').length;
  return {subject, declaredSubject: Boolean(storyboard.subject), rows, notes, total, share, errors, reviews, timed: Boolean(timeline)};
};

/** The routing report as text: one line per scene, then whatever needs attention. */
export const formatRouting = (report) => {
  const lines = [];
  const mark = {ok: ' ok   ', review: 'REVIEW', error: 'ERROR '};
  lines.push(`Routing: ${report.rows.length} scenes, subject "${report.subject}"${report.declaredSubject ? '' : ' (guessed)'}, ${report.timed ? '' : 'about '}${report.total.toFixed(0)}s.`);
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
