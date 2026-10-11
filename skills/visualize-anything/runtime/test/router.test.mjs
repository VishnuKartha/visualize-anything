import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {NEEDS, analyzeRouting, cueHits, resolveRoute, suggestNeed, weakTitle} from '../lib/router.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

// Scenes as loadStoryboard hands them to the router: kind and type already settled.
const scene = (id, need, says, extra = {}) => {
  const base = {id, need, why: 'because', beats: says.map((say) => ({say, caption: say})), ...extra};
  return {...base, ...resolveRoute(base)};
};
const board = (subject, scenes, extra = {}) => ({subject, scenes, ...extra});
const row = (report, id) => report.rows.find((entry) => entry.id === id);
const texts = (entries) => entries.map((entry) => entry.text).join('\n');

const LRU = [
  scene('intro', 'question', ['A cache has limited room, so when it fills up, something has to go.'], {
    beats: [{say: 'A cache has limited room, so when it fills up, something has to go.', caption: '', text: 'A full cache has to *forget* something.'}],
  }),
  scene('state', 'trace', ['The whole cache is one small class with two pieces of state.', 'And an ordered dictionary, which remembers when each key was last touched.'], {
    file: 'lru.py',
    class: 'State',
    beats: [
      {say: 'The whole cache is one small class with two pieces of state.', caption: '', lines: [[4, 5]]},
      {say: 'And an ordered dictionary, which remembers when each key was last touched.', caption: '', lines: [[9, 9]]},
    ],
  }),
  scene('order', 'motion', ['Reading a key counts as a use, so A jumps to the newest end and the others shift down.', 'The oldest entry is evicted.']),
  scene('get', 'trace', ['Here is that read in code, and a missing key returns nothing at all.', 'A hit calls move to end, the line behind the jump.'], {
    file: 'lru.py',
    class: 'Read',
    beats: [
      {say: 'Here is that read in code, and a missing key returns nothing at all.', caption: '', lines: [[12, 13]]},
      {say: 'A hit calls move to end, the line behind the jump.', caption: '', lines: [[14, 14]], land: true},
    ],
  }),
  scene('recap', 'recap', ['So, three things to remember about how this cache decides what to forget.', 'Every read moves a key to the newest end.']),
];

test('every need routes to a known renderer', () => {
  for (const [need, spec] of Object.entries(NEEDS)) {
    assert.ok(['title', 'code', 'trace', 'hyperframes', 'manim', 'diagram', 'bullets', 'credit'].includes(spec.kind), need);
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

const THUMBNAIL = {text: 'A full cache *forgets*.', from: 'order'};
const CREDIT = scene('credit', 'credit', ['That is LRUCache, in lru.py.'], {title: 'LRUCache', subtitle: 'lru.py'});

test('a well-routed algorithm video has no errors and nothing to review', () => {
  const report = analyzeRouting(board('algorithm', [...LRU, CREDIT], {title: 'How an LRU cache decides what to forget', thumbnail: THUMBNAIL}));
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
  assert.match(texts(row(report, 'order').reasons), /reads like "motion"/);
});

test('a system video routes conversations and structure to diagrams', () => {
  const report = analyzeRouting(
    board('system', [
      scene('intro', 'question', ['What happens between a click and a rendered dashboard?'], {beats: [{say: 'What happens between a click and a rendered dashboard?', caption: '', text: 'One *click*. Then what?'}]}),
      scene('parts', 'structure', ['Four pieces: the browser, the API server, the cache, and the database.']),
      scene('path', 'conversation', ['The API asks the cache, then sends a request to the database, which responds.']),
      scene('handler', 'trace', ['The read-through is these six lines, stepping through the handler line by line.'], {file: 'api.ts', class: 'Handler'}),
      scene('recap', 'recap', ['What to remember.']),
    ]),
  );
  assert.equal(report.errors, 0);
  assert.equal(row(report, 'path').type, 'sequence');
  assert.equal(row(report, 'parts').type, 'architecture');
});

test('sequence rules: opener, closer, slideshow runs, missing renderer', () => {
  const code = (id) => scene(id, 'source', ['Here is the function.'], {file: 'x.py', override: 'These lines are configuration with nothing to animate.'});
  const report = analyzeRouting(board('algorithm', [code('a'), code('b'), code('c'), scene('m', 'motion', ['The entries shift over time.'])]));
  const notes = texts(report.notes);
  assert.match(notes, /opens on a code scene/);
  assert.match(notes, /ends on a manim scene/);
  assert.match(notes, /Three code scenes in a row/);
  const flat = analyzeRouting(board('algorithm', [LRU[0], code('only'), LRU[4]]));
  assert.match(texts(flat.notes), /no Manim or trace scene/);
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
  assert.equal(suggestNeed({file: 'x.py', beats: [{say: 'This check matters.'}]}, 1, 4).need, 'trace');
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

test('a trace scene counts as both the code and the animation', () => {
  const trace = scene('walk', 'trace', ['Step through the loop line by line: on each iteration the middle item is compared.', 'The lower marker jumps past the middle.'], {
    file: 'search.py',
    class: 'Search',
  });
  assert.equal(trace.kind, 'trace');
  const report = analyzeRouting(board('algorithm', [LRU[0], trace, LRU[4]]));
  assert.equal(report.errors, 0);
  assert.doesNotMatch(texts(report.notes), /No code scene|no Manim or trace scene/);
});

test('a video far from the length its brief asked for is flagged', () => {
  const off = analyzeRouting({...board('algorithm', LRU), brief: {length: 300, audience: 'beginners'}});
  assert.match(texts(off.notes), /brief asks for about 300s/);
  const on = analyzeRouting({...board('algorithm', LRU), brief: {length: Math.round(off.total)}});
  assert.doesNotMatch(texts(on.notes), /brief asks/);
});

test('code that changes is routed to HyperFrames and counts as showing code', () => {
  const change = scene('refactor', 'change', ['The loop is replaced: instead of scanning every item, the new version halves the range each time.']);
  assert.equal(change.kind, 'hyperframes');
  const report = analyzeRouting(board('algorithm', [LRU[0], change, LRU[2], LRU[4]]));
  assert.equal(report.errors, 0);
  assert.doesNotMatch(texts(report.notes), /No code scene/);
  assert.equal(resolveRoute({need: 'data'}).kind, 'hyperframes');
});

test('a question scene with no statement puts nothing on screen, and is an error', () => {
  const still = scene('intro', 'question', ['A cache has limited room, so when it fills up, something has to go, and choosing what is the whole problem.']);
  const report = analyzeRouting(board('algorithm', [still, ...LRU.slice(1)]));
  assert.equal(row(report, 'intro').status, 'error');
  assert.match(texts(row(report, 'intro').reasons), /puts nothing on screen/);
  assert.doesNotMatch(texts(row(analyzeRouting(board('algorithm', LRU)), 'intro').reasons), /puts nothing on screen/);
  // A title does not stand in for one: no title card is shown by an opening.
  const titled = scene('intro', 'question', ['Something has to go.'], {title: 'How an LRU cache decides what to forget'});
  assert.equal(row(analyzeRouting(board('algorithm', [titled, ...LRU.slice(1)])), 'intro').status, 'error');
});

test('a code block is never shown without a visual', () => {
  const bare = scene('state', 'source', ['The whole cache is one small class with two pieces of state, a capacity and a dictionary.'], {file: 'lru.py'});
  const report = analyzeRouting(board('algorithm', [LRU[0], bare, LRU[2], LRU[4]]));
  assert.equal(row(report, 'state').status, 'error');
  assert.match(texts(row(report, 'state').reasons), /never shown on its own/);
  const excused = analyzeRouting(board('algorithm', [LRU[0], {...bare, override: 'A constants table: there is no behaviour to animate.'}, LRU[2], LRU[4]]));
  assert.equal(row(excused, 'state').status, 'ok');
  assert.equal(report.rows.filter((entry) => entry.kind === 'trace').every((entry) => entry.status !== 'error'), true);
});

test('weak titles and announcing openings are flagged; strong ones pass', () => {
  assert.match(weakTitle('Introduction to binary search')[0], /names a genre/);
  assert.match(weakTitle('Understanding LRU caches')[0], /names a genre/);
  assert.match(weakTitle('How binary search works')[0], /any video about the subject/);
  assert.match(weakTitle('Binary search')[0], /only the subject/);
  assert.match(weakTitle('Why binary search on a sorted list of a million items needs so very few steps').at(-1), /words/);
  assert.deepEqual(weakTitle('Why binary search needs so *few* steps'), []);
  assert.deepEqual(weakTitle('How an LRU cache decides what to forget'), []);

  // The title that is checked is the video's own, which is read where the video is posted.
  assert.match(texts(analyzeRouting(board('algorithm', LRU, {title: 'Binary search'})).notes), /only the subject/);
  assert.doesNotMatch(texts(analyzeRouting(board('algorithm', LRU, {title: 'Why binary search needs so few steps'})).notes), /subject|genre|any video/);

  const announce = scene('intro', 'question', ['In this video we are going to look at how binary search works.'], {
    beats: [{say: 'In this video we are going to look at how binary search works.', caption: '', text: 'At most *20* comparisons.'}],
  });
  assert.match(texts(row(analyzeRouting(board('algorithm', [announce, ...LRU.slice(1)])), 'intro').reasons), /opens by announcing/);
  const wordy = {...announce, beats: [{say: 'A million items take twenty looks.', caption: '', text: 'Finding one value among a million sorted items takes only twenty comparisons'}]};
  const reasons = texts(row(analyzeRouting(board('algorithm', [wordy, ...LRU.slice(1)])), 'intro').reasons);
  assert.match(reasons, /-word line/);
  assert.match(reasons, /No word in the hook text is starred/);
});

test('a video may open cold on a picture with no title scene at all, but not on bullets or an announcement', () => {
  const cold = analyzeRouting(board('algorithm', [LRU[2], LRU[1], LRU[3], LRU[4]]));
  assert.doesNotMatch(texts(cold.notes), /title|opens on/i);
  const slide = analyzeRouting(board('algorithm', [LRU[4], LRU[1], LRU[2], LRU[4]]));
  assert.match(texts(slide.notes), /opens on a bullets scene/);
  const announced = {...LRU[2], beats: [{...LRU[2].beats[0], say: 'In this video we will look at how reading a key counts as a use.'}, ...LRU[2].beats.slice(1)]};
  assert.match(texts(row(analyzeRouting(board('algorithm', [announced, LRU[1], LRU[3], LRU[4]])), announced.id).reasons), /announcing the video/);
});

test('narration that recites code or pads is flagged', () => {
  const recite = scene('get', 'trace', ['Then self.items.move_to_end(key) runs and returns self.items[key] to the caller.'], {file: 'lru.py', class: 'Get'});
  const reasons = texts(row(analyzeRouting(board('algorithm', [LRU[0], recite, LRU[4]])), 'get').reasons);
  assert.match(reasons, /reads code aloud/);
  const padded = scene('get', 'trace', ['Basically, a hit just sends the key to the newest end, as you can see.'], {file: 'lru.py', class: 'Get'});
  const filler = texts(row(analyzeRouting(board('algorithm', [LRU[0], padded, LRU[4]])), 'get').reasons);
  assert.match(filler, /filler: "basically", "just", "as you can see"/);
  const clean = scene('get', 'trace', ['A hit calls move_to_end, which sends the key to the newest end of the row.'], {file: 'lru.py', class: 'Get'});
  assert.doesNotMatch(texts(row(analyzeRouting(board('algorithm', [LRU[0], clean, LRU[4]])), 'get').reasons), /reads code aloud|filler/);
});

test('the ending has to return to what the opening starred', () => {
  const opening = scene('intro', 'question', ['A million sorted items need at most twenty comparisons, and here is why that holds.'], {
    beats: [{say: 'A million sorted items need at most twenty comparisons, and here is why that holds.', caption: '', text: '*1,000,000* items. At most *20* comparisons.'}],
  });
  const ending = (line) => scene('recap', 'recap', ['So, three things to remember about this search.', line]);
  const missed = analyzeRouting(board('algorithm', [opening, LRU[2], LRU[3], ending('Each pass halves the range, and that is the whole idea.')]));
  assert.match(texts(missed.notes), /closing scene never comes back/);
  const paid = analyzeRouting(board('algorithm', [opening, LRU[2], LRU[3], ending('And that is why a million items take only about twenty passes.')]));
  assert.doesNotMatch(texts(paid.notes), /closing scene never comes back/);
  // A credit after the recap does not take over as the close.
  const credited = analyzeRouting(board('algorithm', [opening, LRU[2], LRU[3], ending('And that is why a million items take only about twenty passes.'), CREDIT]));
  assert.doesNotMatch(texts(credited.notes), /closing scene never comes back|ends on a credit/);
});

test('a credit goes last and stays short', () => {
  const early = analyzeRouting(board('algorithm', [LRU[0], CREDIT, ...LRU.slice(1)]));
  assert.match(texts(row(early, 'credit').reasons), /It goes last/);
  const long = scene('credit', 'credit', ['That was the whole of the cache, and if you would like to read every line of it for yourself, it lives in a file called lru dot py in the examples folder of the repository.'], {title: 'LRUCache'});
  assert.match(texts(row(analyzeRouting(board('algorithm', [...LRU, long])), 'credit').reasons), /one short line/);
  assert.equal(row(analyzeRouting(board('algorithm', [...LRU, CREDIT])), 'credit').status, 'ok');
});

test('the thumbnail is a few words and one picture, and does not repeat the title', () => {
  const notes = (extra) => texts(analyzeRouting(board('algorithm', LRU, extra)).notes);
  assert.match(notes({}), /will carry the hook as it stands \(7 words\)/);
  assert.match(notes({thumbnail: {text: 'A full cache has to *forget* something today.', from: 'order'}}), /thumbnail text is 8 words/);
  assert.match(notes({thumbnail: {text: 'A full cache forgets.', from: 'order'}}), /No word in the thumbnail text is starred/);
  assert.match(notes({thumbnail: {text: 'A full cache *forgets*.'}}), /words alone/);
  assert.match(notes({title: 'A full cache forgets', thumbnail: {text: 'A full cache *forgets*.', from: 'order'}}), /repeats the title/);
  assert.doesNotMatch(notes({thumbnail: THUMBNAIL}), /thumbnail/i);
});

test('a video with no beat marked to land is told so', () => {
  const flat = LRU.map((entry) => ({...entry, beats: entry.beats.map(({land, ...beat}) => beat)}));
  assert.match(texts(analyzeRouting(board('algorithm', flat)).notes), /No beat is marked to land/);
  assert.doesNotMatch(texts(analyzeRouting(board('algorithm', LRU)).notes), /No beat is marked to land/);
});

test('two scenes drawn by one script are asked whether they share a picture', () => {
  const a = scene('read', 'trace', ['Reading A sends it to the newest end of the row, and the others shift.'], {file: 'lru.py', class: 'Get', script: 'manim/lru.py'});
  const b = scene('write', 'trace', ['Writing D pushes the row over capacity, so the oldest entry is evicted.'], {file: 'lru.py', class: 'Put', script: 'manim/lru.py'});
  const asked = analyzeRouting(board('algorithm', [LRU[0], a, b, LRU[4]]));
  assert.match(texts(row(asked, 'write').reasons), /drawn by the same script/);
  for (const answer of [true, false]) {
    const answered = analyzeRouting(board('algorithm', [LRU[0], a, {...b, continues: answer}, LRU[4]]));
    assert.doesNotMatch(texts(row(answered, 'write').reasons), /drawn by the same script/);
  }
});

test('a recap is asked to show the moment behind each takeaway', () => {
  const recap = (items) => ({...scene('recap', 'recap', ['So, two things to remember about how this cache forgets.', 'Every read moves a key to the newest end.']), items});
  const plain = analyzeRouting(board('algorithm', [LRU[0], LRU[1], LRU[2], LRU[3], recap(['Order lives in one dictionary', 'Reads move a key to the end'])]));
  assert.match(texts(row(plain, 'recap').reasons), /show the moment that proved it/);
  const shown = analyzeRouting(board('algorithm', [LRU[0], LRU[1], LRU[2], LRU[3], recap([{text: 'Order lives in one dictionary', from: 'state'}, 'Reads move a key to the end'])]));
  assert.doesNotMatch(texts(row(shown, 'recap').reasons), /show the moment that proved it/);
});
