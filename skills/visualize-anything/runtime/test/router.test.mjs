import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {NEEDS, analyzeRouting, cueHits, listenerFindings, resolveRoute, scriptDrift, suggestNeed, weakTitle} from '../lib/router.mjs';

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
    assert.ok(['title', 'code', 'trace', 'hyperframes', 'manim', 'diagram', 'bullets', 'credit', 'stat', 'compare', 'chart', 'table', 'matrix', 'quote', 'figure'].includes(spec.kind), need);
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

// The default shape: the picture first with the hook said over it, the code after, the name last.
const OPEN = scene('open', 'motion', ['A full cache has to forget a key, and the entry that went in first is the wrong one to drop.', 'The entry used longest ago shifts out instead.']);
const HOOK = {context: 'Everyone has used a cache: it keeps what you asked for lately, and it has limited room.', hook: 'A full cache has to *forget* a key, and the obvious choice is *wrong*.'};
// The same opening with the question left open for a moment before the picture answers it.
const ASKED = {
  ...OPEN,
  beats: [OPEN.beats[0], {say: 'So which entry should go?', caption: '', predict: true}, OPEN.beats[1]],
};

test('a well-routed algorithm video has no errors and nothing to review', () => {
  const report = analyzeRouting(
    board('algorithm', [ASKED, LRU[1], LRU[3], LRU[4], CREDIT], {
      title: 'How an LRU cache decides what to forget',
      brief: HOOK,
      thumbnail: {...THUMBNAIL, from: 'open'},
      facts: [{id: 'state-fields', value: 2, what: 'fields the class keeps'}, {id: 'takeaways', value: 3, given: 'the recap has three items'}],
      vocabulary: [{word: 'entry', not: ['element', 'record'], defined: 'open'}],
      sources: [{id: 'lru', kind: 'code', path: 'lru.py'}],
    }),
  );
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
      scene('intro', 'motion', ['One click, and the same dashboard takes two seconds to appear, or twenty milliseconds.']),
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
  assert.match(texts(row(report, 'a').reasons), /Opens on bare code rather than an animation/);
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
  assert.equal(suggestNeed({beats: [{say: 'Anything.'}]}, 0, 4).need, 'motion');
  assert.equal(suggestNeed({beats: [{say: 'So, three things to remember.'}]}, 3, 4).need, 'recap');
  assert.equal(suggestNeed({file: 'x.py', beats: [{say: 'This check matters.'}]}, 1, 4).need, 'trace');
  assert.equal(suggestNeed({beats: [{say: 'The entries shift and the oldest is evicted from the list.'}]}, 1, 4).need, 'motion');
  assert.equal(suggestNeed({beats: [{say: 'The client sends a request and the server responds.'}]}, 1, 4).need, 'conversation');
  const bare = analyzeRouting({scenes: LRU.map(({need, ...rest}) => rest)});
  assert.equal(bare.subject, 'algorithm');
  assert.ok(bare.rows.slice(1).every((entry) => entry.status === 'review'));
  assert.match(texts(bare.rows[0].reasons), /Suggested: "motion"/);
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
  const report = analyzeRouting(board('algorithm', [OPEN, trace, LRU[4]]));
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
  const report = analyzeRouting(board('algorithm', [OPEN, change, LRU[2], LRU[4]]));
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

test('a video opens cold on an animation with no title scene at all, and not on a list or an announcement', () => {
  const cold = analyzeRouting(board('algorithm', [LRU[2], LRU[1], LRU[3], LRU[4]]));
  assert.doesNotMatch(texts(cold.notes), /no title|opens on/i);
  const slide = analyzeRouting(board('algorithm', [LRU[4], LRU[1], LRU[2], LRU[4]]));
  assert.equal(slide.rows[0].status, 'error');
  assert.match(texts(slide.rows[0].reasons), /opens on a list\. The opening is always an animation/);
  const announced = {...LRU[2], beats: [{...LRU[2].beats[0], say: 'In this video we will look at how reading a key counts as a use.'}, ...LRU[2].beats.slice(1)]};
  assert.match(texts(row(analyzeRouting(board('algorithm', [announced, LRU[1], LRU[3], LRU[4]])), announced.id).reasons), /announcing the video/);
  const listed = {...LRU[2], beats: [{...LRU[2].beats[0], say: 'Here are three things every cache has to get right when it fills up.'}, ...LRU[2].beats.slice(1)]};
  assert.match(texts(row(analyzeRouting(board('algorithm', [listed, LRU[1], LRU[3], LRU[4]])), listed.id).reasons), /announcing the video/);
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

test('narration is checked as it is heard: pronouns to resolve, runs of numbers, a joining word as a tic', () => {
  const said = (lines) => board('algorithm', [scene('open', 'motion', lines), LRU[1], LRU[3], LRU[4]]);
  const clear = listenerFindings(said(['A full cache has to forget a key.', 'The key it forgets is the one used longest ago.']));
  assert.deepEqual([clear.pronouns.length, clear.crowded.length, clear.openers.length], [0, 0, 0]);
  const lost = listenerFindings(said(['A request that leaves is marked pending with its cache kept, so when its token comes back it rejoins.']));
  assert.equal(lost.pronouns.length, 1);
  assert.equal(lost.pronouns[0].scene, 'open');
  const table = listenerFindings(said(['Starting at once gives 187, waiting for three gives 208, and waiting for four gives 191.']));
  assert.equal(table.crowded.length, 1);
  const tic = listenerFindings(said(['So it routes each token.', 'So the big model rests.', 'So a batch forms.', 'So the count rises.']));
  assert.equal(tic.openers.length, 1);
  assert.equal(tic.openers[0].word, 'so');
  assert.ok(tic.openers[0].count >= 4);
  const many = said(['It costs 12, then 34, then 56.', 'Later 78 and 90 and 21.', 'Then 43 and 65.']);
  assert.ok(listenerFindings(many).numbers.said > listenerFindings(many).numbers.carries);
  assert.match(texts(analyzeRouting(many).notes), /sentence\(s\) say 3 or more numbers[\s\S]*different numbers; a video of this length carries about 6/);
});

test('a title card names the work straight after the opening', () => {
  const card = scene('named', 'name', ['That is what an LRU cache is for.'], {title: 'LRUCache'});
  assert.equal(resolveRoute({need: 'name'}).kind, 'credit');
  const notes = (scenes) => texts(analyzeRouting(board('algorithm', scenes, {brief: HOOK})).notes);
  const placed = analyzeRouting(board('algorithm', [OPEN, card, LRU[1], LRU[3], LRU[4], CREDIT], {brief: HOOK}));
  assert.equal(row(placed, 'named').status, 'ok');
  assert.doesNotMatch(texts(placed.notes), /title card/);
  // After the opening means after every scene that carries the opening's picture on.
  const ground = scene('ground', 'motion', ['A cache keeps what you asked for lately, in limited room.', 'This one holds three keys, and all three are taken.']);
  assert.doesNotMatch(notes([ground, {...OPEN, continues: true}, card, LRU[1], LRU[3], LRU[4]]), /title card/);
  assert.match(notes([OPEN, LRU[1], card, LRU[3], LRU[4]]), /title card "named" is scene 3\. It goes straight after the opening \(after "open"\)/);
  assert.match(notes([OPEN, card, LRU[1], {...card, id: 'again'}, LRU[3], LRU[4]]), /2 title cards/);
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

test('the hook is agreed first, said in the opening, and returned to at the end', () => {
  const notes = (scenes, brief) => texts(analyzeRouting(board('algorithm', scenes, brief ? {brief} : {})).notes);
  const cold = [OPEN, LRU[1], LRU[3], LRU[4]];
  assert.match(notes(cold), /No hook in the brief/);
  assert.match(notes(cold, {hook: 'A full cache has to forget a key.'}), /No word in the brief's hook is starred/);
  assert.doesNotMatch(notes(cold, HOOK), /hook|context/i);
  // An opening that never gets to the hook.
  assert.match(notes([LRU[2], LRU[1], LRU[3], LRU[4]], HOOK), /opening never says the hook: none of "forget", "wrong" is spoken in "order"/);
  // An ending that does not come back.
  const flat = scene('recap', 'recap', ['So, three things to remember about this cache.', 'Every read moves a key to the newest end.']);
  assert.match(notes([OPEN, LRU[1], LRU[3], flat], HOOK), /closing scene never comes back/);
});

test('the opening gives context first: it is in the brief, and the hook may land in a scene that carries the picture on', () => {
  const notes = (scenes, brief) => texts(analyzeRouting(board('algorithm', scenes, {brief})).notes);
  const cold = [OPEN, LRU[1], LRU[3], LRU[4]];
  assert.match(notes(cold, {hook: HOOK.hook}), /No context in the brief/);
  assert.match(notes(cold, {...HOOK, context: Array(50).fill('word').join(' ')}), /context runs 50 words/);
  // Context in the first scene, the hook in the one that continues it.
  const ground = scene('ground', 'motion', ['A cache keeps what you asked for lately, in limited room.', 'This one holds three keys, and all three are taken.']);
  assert.doesNotMatch(notes([ground, {...OPEN, continues: true}, LRU[1], LRU[3], LRU[4]], HOOK), /never says the hook/);
  // A scene that starts on a fresh picture is past the opening.
  assert.match(notes([ground, {...OPEN, continues: false}, LRU[1], LRU[3], LRU[4]], HOOK), /opening never says the hook: none of "forget", "wrong" is spoken in "ground"/);
});

test('the opening is always an animation; opening on anything else is an error that needs a reason', () => {
  const reasons = (intro) => row(analyzeRouting(board('algorithm', [intro, ...LRU.slice(1)])), 'intro');
  assert.equal(reasons(LRU[0]).status, 'error');
  assert.match(texts(reasons(LRU[0]).reasons), /opens on words\. The opening is always an animation/);
  // Code beside its animation is still not the hook shown happening: a trace scene comes second.
  assert.match(texts(row(analyzeRouting(board('algorithm', [LRU[1], LRU[2], LRU[4]])), 'state').reasons), /opens on code/);
  const excused = reasons({...LRU[0], override: 'A naming convention: there is nothing to show until the names are on screen.'});
  assert.equal(excused.status, 'ok');
  assert.match(texts(excused.reasons), /Opens on words rather than an animation/);
  // Second, after a cold open, a statement is not the opening.
  assert.doesNotMatch(texts(row(analyzeRouting(board('algorithm', [OPEN, LRU[0], LRU[1], LRU[4]])), 'intro').reasons), /opens on words/);
});

test('a scene that starts over instead of following on is flagged', () => {
  const restart = (say) => {
    const next = scene('get', 'trace', [say, 'A hit calls move to end, the line behind the jump.'], {file: 'lru.py', class: 'Read'});
    return texts(row(analyzeRouting(board('algorithm', [OPEN, next, LRU[4]])), 'get').reasons);
  };
  assert.match(restart("Now let's look at how a read works in the code."), /starts over .* pick up where "open" stopped/);
  assert.match(restart('Next, the read path and what it returns for a missing key.'), /starts over/);
  assert.doesNotMatch(restart('But a read has to count as a use, and one line makes it so.'), /starts over/);
  assert.doesNotMatch(restart('So the cache needs to know which key was used longest ago.'), /starts over/);
});

test('the storyboard says the script, whole and in order, and nothing else', () => {
  const scenes = [
    scene('open', 'motion', ['A full cache has to forget a key.', 'The obvious choice is wrong.']),
    scene('get', 'trace', ['So a hit calls move_to_end, and the key is spared.'], {file: 'lru.py', class: 'Read'}),
  ];
  const script = `<!-- notes for the writer -->
# Not spoken

A full cache has to forget a key. The obvious choice
is wrong.

So a hit calls move_to_end, and the key is spared.
`;
  assert.equal(scriptDrift(script, scenes), null, 'line breaks, headings, comments, and punctuation do not count');
  // A line reworded in the storyboard only.
  const reworded = [scenes[0], {...scenes[1], beats: [{say: 'Now a hit calls move_to_end, and the key is spared.'}]}];
  assert.deepEqual(scriptDrift(script, reworded), {scene: 'get', beat: 1, script: 'choice is wrong so a hit calls', storyboard: 'choice is wrong now a hit calls'});
  // A line written into a scene that the script never had, and a line of the script left out.
  assert.equal(scriptDrift(script, [...scenes, scene('recap', 'recap', ['Remember this.'])]).scene, 'recap');
  assert.equal(scriptDrift(script, [scenes[0]]).script, 'choice is wrong so a hit calls');
});

test('a project is asked for its script, and told where the storyboard has left it', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'va-script-'));
  const notes = () => texts(analyzeRouting(board('algorithm', [OPEN, LRU[1], LRU[3], LRU[4]]), {projectDir: dir}).notes);
  assert.match(notes(), /No script\.md\. Write the whole narration there first/);
  const whole = [OPEN, LRU[1], LRU[3], LRU[4]].flatMap((entry) => entry.beats.map((beat) => beat.say)).join(' ');
  writeFileSync(path.join(dir, 'script.md'), whole);
  assert.doesNotMatch(notes(), /script/);
  writeFileSync(path.join(dir, 'script.md'), whole.replace('The whole cache is', 'So the whole cache is'));
  assert.match(notes(), /not the script\. They part at "state" beat 1: script\.md has "shifts out instead so the whole cache", the storyboard has "shifts out instead the whole cache is"/);
});

test('a number said or shown has to be a row of the facts ledger', () => {
  const scenes = [OPEN, LRU[1], LRU[3], LRU[4]];
  const loose = texts(analyzeRouting(board('algorithm', scenes)).notes);
  assert.match(loose, /2 number\(s\) are said or shown but are not in "facts": "two" \(state beat 1\), "three" \(recap beat 1\)/);
  const backed = board('algorithm', scenes, {facts: [{id: 'fields', value: 2}, {id: 'takeaways', value: 3, given: 'the recap has three items'}]});
  assert.doesNotMatch(texts(analyzeRouting(backed).notes), /not in "facts"/);
  // What is on screen counts as much as what is said, and a rounded fact backs the round number said.
  const shown = board('algorithm', scenes, {facts: backed.facts, thumbnail: {text: '*20* looks', from: 'open'}});
  assert.match(texts(analyzeRouting(shown).notes), /"20" \(the thumbnail\)/);
  const rounded = board('algorithm', scenes, {facts: [...backed.facts, {id: 'passes', value: 19.93}], thumbnail: {text: '*20* looks', from: 'open'}});
  assert.doesNotMatch(texts(analyzeRouting(rounded).notes), /not in "facts"/);
});

test('always and never are claims about the edges, and name the fact that tested them', () => {
  const claim = (extra) => scene('order', 'motion', ['A key that was read a moment ago is never the one evicted, and the others shift down.'], extra);
  const bare = analyzeRouting(board('algorithm', [LRU[0], LRU[1], claim({}), LRU[4]]));
  assert.match(texts(row(bare, 'order').reasons), /says "never"\. That is a claim about every case, so try the edges/);
  const tested = claim({});
  tested.beats[0].holds = 'recent-key-survives';
  const report = analyzeRouting(board('algorithm', [LRU[0], LRU[1], tested, LRU[4]]));
  assert.doesNotMatch(texts(row(report, 'order').reasons), /every case/);
});

test('the narration keeps to one word per idea, and to the order the words are explained in', () => {
  const vocabulary = [{word: 'entry', not: ['slot'], defined: 'state'}, {word: 'evict', not: [], defined: 'get'}];
  const scenes = [
    LRU[0],
    LRU[1],
    scene('order', 'motion', ['Reading a key counts as a use, so its slot jumps to the newest end.', 'The oldest entry is evicted.']),
    LRU[3],
    LRU[4],
  ];
  const report = analyzeRouting(board('algorithm', scenes, {vocabulary}));
  assert.match(texts(row(report, 'order').reasons), /Beat 1 says "slot" for what the video calls "entry"/);
  assert.match(texts(row(report, 'order').reasons), /Beat 2 says "evict" before "get", the scene that explains it/);
  assert.doesNotMatch(texts(report.notes), /No "vocabulary"/);
  assert.match(texts(analyzeRouting(board('algorithm', scenes)).notes), /No "vocabulary"/);
});

test('a video of any length is asked for one prediction pause, and no scene for more than two', () => {
  const long = [OPEN, LRU[1], LRU[2], LRU[3], LRU[4]];
  assert.match(texts(analyzeRouting(board('algorithm', long)).notes), /No prediction pause/);
  assert.doesNotMatch(texts(analyzeRouting(board('algorithm', [ASKED, ...long.slice(1)])).notes), /No prediction pause/);
  const ask = (say) => ({say, caption: '', predict: true});
  const eager = {...OPEN, beats: [ask('Which entry goes?'), OPEN.beats[0], ask('And then which?'), OPEN.beats[1], ask('And after that?'), OPEN.beats[1]]};
  assert.match(texts(row(analyzeRouting(board('algorithm', [eager, ...long.slice(1)])), 'open').reasons), /3 prediction pauses in one scene/);
});

test('what a source reports is routed to the scene that shows it: its number, its contrast, its chart, its words, its figure', () => {
  assert.deepEqual(['number', 'contrast', 'chart', 'quote', 'figure'].map((need) => resolveRoute({need}).kind), ['stat', 'compare', 'chart', 'quote', 'figure']);
  // A designed one-off is still a composition you write.
  assert.equal(resolveRoute({need: 'data'}).kind, 'hyperframes');
  const count = scene('count', 'number', ['A shelter took about a million episodes then, and a handful of rounds now.'], {metrics: [{value: '1,000,000', label: 'then'}]});
  const jobs = scene('jobs', 'contrast', ['A simulator remembers, but each new scene has to be drawn by hand.', 'A video model looks real, and forgets.']);
  const report = analyzeRouting(board('mixed', [OPEN, count, jobs, LRU[1], LRU[4]]));
  assert.equal(report.errors, 0);
  assert.equal(row(report, 'jobs').status, 'ok');
  // They come after the hook: a number card is not the hook shown happening, so it does not open the video.
  assert.match(texts(row(analyzeRouting(board('mixed', [count, jobs, LRU[1], LRU[4]])), 'count').reasons), /opens on a number card/);
});

test('an evidence scene whose beats leave the same thing on screen is told so', () => {
  const beats = (second) => [{say: 'A simulator remembers exactly what happened in the world.', caption: '', show: 2}, {say: 'A video model looks real, and that is all it does.', caption: '', ...second}];
  const stuck = scene('jobs', 'contrast', [], {beats: beats({show: 2})});
  assert.match(texts(row(analyzeRouting(board('mixed', [OPEN, stuck, LRU[1], LRU[4]])), 'jobs').reasons), /Beats 1 and 2 show the same thing/);
  for (const moved of [{show: 4}, {show: 2, note: 'and it cannot be corrected'}, {show: 2, cues: [{at: 'looks real', show: 3}]}, {}]) {
    const fine = scene('jobs', 'contrast', [], {beats: beats(moved)});
    assert.doesNotMatch(texts(row(analyzeRouting(board('mixed', [OPEN, fine, LRU[1], LRU[4]])), 'jobs').reasons), /show the same thing/);
  }
  const long = scene('words', 'quote', ['The authors put the whole idea in one long sentence of their abstract.'], {quote: Array.from({length: 50}, () => 'word').join(' ')});
  assert.match(texts(row(analyzeRouting(board('mixed', [OPEN, long, LRU[1], LRU[4]])), 'words').reasons), /quote is 50 words/);
});

test('numbers an evidence scene puts on screen are held to the ledger; a chart\'s axis labels are not', () => {
  const chart = scene('bridge', 'chart', ['The crossing gets quicker with every round the agents play.'], {labels: ['Round 1', 'Round 4'], series: [{label: null, values: [71, 41]}], unit: 's'});
  const stat = scene('speed', 'number', ['The renderer keeps pace with the agent on a single card.'], {metrics: [{value: '36', unit: 'fps', label: 'frames a second', detail: null, delta: null}]});
  const loose = texts(analyzeRouting(board('mixed', [OPEN, chart, stat, LRU[1], LRU[4]], {facts: [{id: 'fields', value: 2}, {id: 'takeaways', value: 3}]})).notes);
  assert.match(loose, /3 number\(s\) are said or shown but are not in "facts": "71" \(bridge, on screen\), "41" \(bridge, on screen\), "36" \(speed, on screen\)/);
  const backed = board('mixed', [OPEN, chart, stat, LRU[1], LRU[4]], {facts: [{id: 'fields', value: 2}, {id: 'takeaways', value: 3}, {id: 'first', value: 71}, {id: 'last', value: 41}, {id: 'fps', value: 36}]});
  assert.doesNotMatch(texts(analyzeRouting(backed).notes), /not in "facts"/);
});

// A project `va paper` has read a paper into: three claims, one of them with a headline number.
const PAPER = {
  title: 'Worlds in Code',
  abstract: 'A practice world must be faithful and realistic. We split it in two. Agents learn a task in 4 rounds.',
  claims: [
    {n: 1, text: 'A practice world must be faithful and realistic.', numbers: []},
    {n: 2, text: 'We split it in two.', numbers: []},
    {n: 3, text: 'Agents learn a task in 4 rounds.', numbers: ['4']},
  ],
  sections: [
    {heading: '1 Results', kind: 'body', text: 'The renderer reaches 36.5 frames per second [ 36 ]. Crossing takes 71 seconds.', figures: [], tables: [1]},
    {heading: 'References', kind: 'references', text: 'Baker et al. Emergent tool use. ICLR 2019, pages 44-58.', figures: [], tables: []},
  ],
  figures: [{n: 1, caption: 'The loop.', file: 'figures/fig-1.png'}],
  tables: [{n: 1, caption: 'Every round.', columns: ['Round 1', '2'], rows: [['71', '68']]}],
  licence: {url: 'http://arxiv.org/licenses/nonexclusive-distrib/1.0/', open: false},
};
const paperProject = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'va-paper-'));
  mkdirSync(path.join(dir, 'paper'));
  writeFileSync(path.join(dir, 'paper', 'paper.json'), JSON.stringify(PAPER));
  return dir;
};

test('a paper video is explained without its code; a trace beat that points at no line is questioned', () => {
  const projectDir = paperProject();
  const coded = analyzeRouting(board('mixed', [OPEN, LRU[3], LRU[4]]), {projectDir});
  assert.equal(row(coded, 'get').status, 'error');
  assert.match(texts(row(coded, 'get').reasons), /This is a paper video, and this scene puts code on screen/);
  const asked = analyzeRouting(board('mixed', [OPEN, {...LRU[3], override: 'The viewer asked to see how the read is written.'}, LRU[4]]), {projectDir});
  assert.notEqual(row(asked, 'get').status, 'error');
  assert.match(texts(row(asked, 'get').reasons), /Code in a paper video: The viewer asked/);
  // The same scene in a video about code is what it should be.
  assert.doesNotMatch(texts(row(analyzeRouting(board('algorithm', [OPEN, LRU[3], LRU[4]])), 'get').reasons), /paper video/);
  // Code held on screen while the voice talks about something else.
  const wallpaper = scene('idle', 'trace', ['A request arrives while the model is busy.', 'So the count is compared with the threshold.'], {
    file: 'lru.py', class: 'Idle', beats: [{say: 'A request arrives while the model is busy.', caption: ''}, {say: 'So the count is compared with the threshold.', caption: '', lines: [[3, 3]]}],
  });
  assert.match(texts(row(analyzeRouting(board('algorithm', [OPEN, wallpaper, LRU[4]])), 'idle').reasons), /Beat 1 of this trace scene points at no line of the code/);
});

test('a paper video accounts for every claim of the abstract: shown by a scene, or set aside with a reason', () => {
  const projectDir = paperProject();
  const scenes = [OPEN, LRU[1], LRU[4]];
  const notes = (extra) => texts(analyzeRouting(board('mixed', scenes, extra), {projectDir}).notes);
  assert.match(notes({}), /abstract makes 3 claims and the storyboard accounts for 0\. Not yet shown or set aside: 1\. "A practice world must be faithful and realistic\."/);
  const partly = notes({claims: [{abstract: 1, scene: 'open', omit: null}, {abstract: 2, scene: null, omit: 'The split is the next video.'}]});
  assert.match(partly, /accounts for 2\. Not yet shown or set aside: 3\. "Agents learn a task in 4 rounds\."/);
  const all = [{abstract: 1, scene: 'open', omit: null}, {abstract: 2, scene: 'state', omit: null}, {abstract: 3, scene: 'recap', omit: null}];
  assert.doesNotMatch(notes({claims: all}), /Not yet shown or set aside/);
  assert.match(notes({claims: [...all, {abstract: 9, scene: 'open', omit: null}]}), /names claim 9 of the abstract, which has 3/);
  const report = analyzeRouting(board('mixed', scenes, {claims: all}), {projectDir});
  assert.deepEqual(report.paper, {title: 'Worlds in Code', claims: 3, shown: 3, omitted: 0});
  // Without a paper in the project none of this applies.
  assert.doesNotMatch(texts(analyzeRouting(board('mixed', scenes)).notes), /abstract/);
});

test('a number the abstract states is said or shown, unless its claim is set aside', () => {
  const projectDir = paperProject();
  const silent = [OPEN, LRU[1], scene('recap', 'recap', ['So the world is split, and that is the whole idea of it.'])];
  const claims = (third) => [{abstract: 1, scene: 'open', omit: null}, {abstract: 2, scene: 'state', omit: null}, third];
  const notes = (scenes, third) => texts(analyzeRouting(board('mixed', scenes, {claims: claims(third)}), {projectDir}).notes);
  assert.match(notes(silent, {abstract: 3, scene: 'recap', omit: null}), /abstract states "4" \(claim 3\), and the video never says or shows it/);
  assert.doesNotMatch(notes(silent, {abstract: 3, scene: null, omit: 'The learning result is the second video.'}), /never says or shows/);
  const spoken = [OPEN, LRU[1], scene('recap', 'recap', ['So the world is split, and agents learn the task in four rounds.'])];
  assert.doesNotMatch(notes(spoken, {abstract: 3, scene: 'recap', omit: null}), /never says or shows/);
});

test('a number said to be the paper\'s has to be in the paper; a citation marker does not vouch for one', () => {
  const projectDir = paperProject();
  const notes = (facts) => texts(analyzeRouting(board('mixed', [OPEN, LRU[1], LRU[4]], {facts}), {projectDir}).notes);
  const given = (id, value) => ({id, value, given: 'the paper, Table 1'});
  // 36.5 is in the text, 71 and 68 in a table, 2019 in the reference list; 36 is only the citation "[ 36 ]", and 58 only a page number.
  assert.doesNotMatch(notes([given('fps', 36.5), given('first', 71), given('second', 68), given('year', 2019)]), /nowhere in the paper/);
  assert.match(notes([given('fps', 36), given('pages', 58)]), /2 fact\(s\) marked "given" are nowhere in the paper: fps = 36, pages = 58/);
  // A fact the oracle computes is the oracle's business, not the paper's.
  assert.doesNotMatch(notes([{id: 'fps', value: 36}]), /nowhere in the paper/);
});

test('a paper video need not show code, and is warned before showing a figure its licence does not grant', () => {
  const projectDir = paperProject();
  const figure = scene('loop', 'figure', ['This is the loop as the authors drew it, from the agent round to the frame.']);
  const report = analyzeRouting(board('mixed', [OPEN, figure, scene('recap', 'recap', ['So the world is split in two, and that is the idea.'])]), {projectDir});
  assert.doesNotMatch(texts(report.notes), /No code scene/);
  assert.match(texts(row(report, 'loop').reasons), /licence .* does not grant reuse/);
  const open = paperProject();
  writeFileSync(path.join(open, 'paper', 'paper.json'), JSON.stringify({...PAPER, licence: {url: 'https://creativecommons.org/licenses/by/4.0/', open: true}}));
  assert.doesNotMatch(texts(row(analyzeRouting(board('mixed', [OPEN, figure, LRU[4]]), {projectDir: open}), 'loop').reasons), /licence/);
});
