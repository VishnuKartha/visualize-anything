import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {NEEDS, analyzeRouting, cueHits, resolveRoute, suggestNeed} from '../lib/router.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Scenes as loadStoryboard hands them to the router: kind and type already settled.
const scene = (id, need, says, extra = {}) => {
  const base = {id, need, why: 'because', beats: says.map((say) => ({say, caption: say})), ...extra};
  return {...base, ...resolveRoute(base)};
};
const board = (subject, scenes) => ({subject, scenes});
const row = (report, id) => report.rows.find((entry) => entry.id === id);
const texts = (entries) => entries.map((entry) => entry.text).join('\n');

const LRU = [
  scene('intro', 'question', ['A cache has limited room, so when it fills up, something has to go.']),
  scene('state', 'source', ['The whole cache is one small class with two pieces of state.', 'And an ordered dictionary, which remembers when each key was last touched.'], {
    file: 'lru.py',
    beats: [
      {say: 'The whole cache is one small class with two pieces of state.', caption: '', lines: [[4, 5]]},
      {say: 'And an ordered dictionary, which remembers when each key was last touched.', caption: '', lines: [[9, 9]]},
    ],
  }),
  scene('order', 'motion', ['Reading a key counts as a use, so A jumps to the newest end and the others shift down.', 'The oldest entry is evicted.']),
  scene('get', 'source', ['Here is that read in code, and a missing key just returns nothing at all.', 'A hit calls move to end, the line behind the jump.'], {
    file: 'lru.py',
    beats: [
      {say: 'Here is that read in code, and a missing key just returns nothing at all.', caption: '', lines: [[12, 13]]},
      {say: 'A hit calls move to end, the line behind the jump.', caption: '', lines: [[14, 14]]},
    ],
  }),
  scene('recap', 'recap', ['So, three things to remember about how this cache decides what to forget.', 'Every read moves a key to the newest end.']),
];

test('every need routes to a known renderer', () => {
  for (const [need, spec] of Object.entries(NEEDS)) {
    assert.ok(['title', 'code', 'manim', 'diagram', 'bullets'].includes(spec.kind), need);
    assert.equal(spec.kind === 'diagram', Boolean(spec.type), `${need}: only diagrams carry a type`);
  }
});

test('need supplies kind and diagram type; explicit fields win', () => {
  assert.deepEqual(resolveRoute({need: 'branching'}), {kind: 'manim', type: undefined});
  assert.deepEqual(resolveRoute({need: 'conversation'}), {kind: 'diagram', type: 'sequence'});
  assert.deepEqual(resolveRoute({need: 'structure', type: 'dataflow'}), {kind: 'diagram', type: 'dataflow'});
  assert.equal(resolveRoute({need: 'motion', kind: 'code'}).kind, 'code');
  assert.equal(resolveRoute({}).kind, null);
});

test('a well-routed algorithm video has no errors and nothing to review', () => {
  const report = analyzeRouting(board('algorithm', LRU));
  assert.equal(report.errors, 0, texts(report.rows.flatMap((entry) => entry.reasons)));
  assert.equal(report.reviews, 0, texts([...report.rows.flatMap((entry) => entry.reasons), ...report.notes]));
});

test("an algorithm's branches drawn as a workflow diagram is an error", () => {
  const flow = scene('put-flow', 'process', ['Writing has two decisions in it. First, is this key already cached?', 'If so, pop the oldest end.']);
  const report = analyzeRouting(board('algorithm', [...LRU.slice(0, 4), flow, LRU[4]]));
  assert.equal(row(report, 'put-flow').status, 'error');
  assert.match(texts(row(report, 'put-flow').reasons), /algorithm video/);
});

test('an override with a real reason downgrades the error to a note', () => {
  const flow = scene('deps', 'structure', ['The cache sits between the API server and the database service, so every request passes through it first.'], {
    override: 'This scene steps outside the algorithm to show where the cache lives in the service.',
  });
  const report = analyzeRouting(board('algorithm', [...LRU.slice(0, 4), flow, LRU[4]]));
  assert.equal(row(report, 'deps').status, 'ok');
  assert.match(texts(row(report, 'deps').reasons), /steps outside the algorithm/);
  const lazy = analyzeRouting(board('algorithm', [...LRU.slice(0, 4), {...flow, override: 'ok'}, LRU[4]]));
  assert.equal(row(lazy, 'deps').status, 'error', 'a two-letter override is not a reason');
});

test('need and renderer must agree unless overridden', () => {
  const wrong = {...scene('order', 'motion', ['A jumps to the newest end.']), kind: 'code'};
  const report = analyzeRouting(board('algorithm', [LRU[0], wrong, LRU[3], LRU[4]]));
  assert.equal(row(report, 'order').status, 'error');
  assert.match(texts(row(report, 'order').reasons), /routes to manim, but the scene is code/);
});

test('narration that contradicts the declared need is flagged for review', () => {
  const odd = scene('order', 'source', ['Watch the array: each step the entries shift, one is evicted, and the pointer moves.'], {file: 'x.py'});
  const report = analyzeRouting(board('algorithm', [LRU[0], odd, LRU[2], LRU[3], LRU[4]]));
  assert.equal(row(report, 'order').status, 'review');
  assert.match(texts(row(report, 'order').reasons), /reads like "motion"/);
});

test('a system video routes conversations and structure to diagrams', () => {
  const report = analyzeRouting(
    board('system', [
      scene('intro', 'question', ['What happens between a click and a rendered dashboard?']),
      scene('parts', 'structure', ['Four pieces: the browser, the API server, the cache, and the database.']),
      scene('path', 'conversation', ['The API asks the cache, then sends a request to the database, which responds.']),
      scene('handler', 'source', ['The read-through is these six lines.'], {file: 'api.ts'}),
      scene('recap', 'recap', ['What to remember.']),
    ]),
  );
  assert.equal(report.errors, 0);
  assert.equal(row(report, 'path').type, 'sequence');
  assert.equal(row(report, 'parts').type, 'architecture');
});

test('sequence rules: opener, closer, slideshow runs, missing renderer', () => {
  const code = (id) => scene(id, 'source', ['Here is the function.'], {file: 'x.py'});
  const report = analyzeRouting(board('algorithm', [code('a'), code('b'), code('c'), scene('m', 'motion', ['The entries shift over time.'])]));
  const notes = texts(report.notes);
  assert.match(notes, /opens on a code scene/);
  assert.match(notes, /ends on a manim scene/);
  assert.match(notes, /Three code scenes in a row/);
  const flat = analyzeRouting(board('algorithm', [LRU[0], LRU[1], LRU[4]]));
  assert.match(texts(flat.notes), /no Manim scene/);
});

test('an identifier named away from any code scene is flagged', () => {
  const named = scene('order', 'motion', ['A hit calls move to end and the entries shift.'], {
    beats: [{say: 'A hit calls move to end and the entries shift.', caption: 'A hit calls move_to_end and the entries shift.'}],
  });
  const report = analyzeRouting(board('algorithm', [LRU[0], named, LRU[2], LRU[4]]));
  assert.match(texts(report.notes), /names move_to_end but no code scene is next to it/);
});

test('beats that change nothing on screen are flagged', () => {
  const flat = scene('state', 'source', ['One.', 'Two.'], {
    file: 'x.py',
    beats: [
      {say: 'One.', caption: '', lines: [[3, 4]]},
      {say: 'Two.', caption: '', lines: [[3, 4]]},
    ],
  });
  const report = analyzeRouting(board('algorithm', [LRU[0], flat, LRU[2], LRU[4]]));
  assert.match(texts(row(report, 'state').reasons), /highlight the same lines/);
});

test('undeclared needs and subject are suggested from position and narration', () => {
  assert.equal(suggestNeed({beats: [{say: 'Anything.'}]}, 0, 4).need, 'question');
  assert.equal(suggestNeed({beats: [{say: 'So, three things to remember.'}]}, 3, 4).need, 'recap');
  assert.equal(suggestNeed({file: 'x.py', beats: [{say: 'This check matters.'}]}, 1, 4).need, 'source');
  assert.equal(suggestNeed({beats: [{say: 'The entries shift and the oldest is evicted from the list.'}]}, 1, 4).need, 'motion');
  assert.equal(suggestNeed({beats: [{say: 'The client sends a request and the server responds.'}]}, 1, 4).need, 'conversation');
  const bare = analyzeRouting({scenes: LRU.map(({need, ...rest}) => rest)});
  assert.equal(bare.subject, 'algorithm');
  assert.ok(bare.rows.every((entry) => entry.status === 'review'));
});

test('cue matching is whole-word and case-insensitive', () => {
  assert.deepEqual(cueHits('The API Server replies.').structure, ['server', 'api']);
  assert.equal(cueHits('A listing of rowdy stacks.').motion, undefined);
});

test('the routing reference documents every need', () => {
  const doc = readFileSync(path.join(here, '..', '..', 'references', 'routing.md'), 'utf8');
  for (const need of Object.keys(NEEDS)) assert.ok(doc.includes(`\`${need}\``), `routing.md does not mention need "${need}"`);
});
