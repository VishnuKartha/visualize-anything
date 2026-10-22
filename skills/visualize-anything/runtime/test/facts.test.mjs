import assert from 'node:assert/strict';
import test from 'node:test';
import {absolutesIn, compareFacts, normalizeFacts, numbersIn, parseOracle, sameValue, unbackedNumbers, vocabularyFindings} from '../lib/facts.mjs';
import {VIEWERS, planBrief} from '../lib/viewers.mjs';

const values = (text) => numbersIn(text).map((number) => number.value);

test('numbers are found as digits and as words', () => {
  assert.deepEqual(values('Finding 57 takes six looks.'), [57, 6]);
  assert.deepEqual(values('*1,000,000* items.\n*20* looks.'), [1000000, 20]);
  assert.deepEqual(values('A sorted list of a million items can be searched in twenty looks.'), [1000000, 20]);
  assert.deepEqual(values('It keeps 96.5% of the file, in two hundred and fifty blocks of twenty-one bits.'), [96.5, 250, 21]);
  assert.deepEqual(values('About 3 million keys, 13,002 weights, and 2.5 thousand more.'), [3000000, 13002, 2500]);
  assert.deepEqual(numbersIn('searched in twenty looks').map((number) => number.text), ['twenty']);
  // A chart of changes shows a loss with its sign; a dash between two numbers is a range, not a sign.
  assert.deepEqual(values('-0.04'), [-0.04]);
  assert.deepEqual(values('a drop (-2.5 points), in a 3-4 range'), [-2.5, 3, 4]);
});

test('what is not a quantity is left alone', () => {
  assert.deepEqual(values('One small class, and one more thing, checked one at a time.'), []);
  assert.deepEqual(values('The second pass is the first to find it.'), []);
  assert.deepEqual(values('It calls `range(3)` and log2, in O(n^2), on utf8 from v1.2.'), []);
  // Two numbers side by side stay two numbers.
  assert.deepEqual(values('Two and three make five.'), [2, 3, 5]);
  assert.deepEqual(values('The list is 3, 8, 15.'), [3, 8, 15]);
});

test('a computed value matches at the precision the storyboard writes it to', () => {
  assert.ok(sameValue(20, 19.93));
  assert.ok(sameValue(96.5, 96.4912));
  assert.ok(!sameValue(6, 7));
  assert.ok(!sameValue(20, 20.6));
  assert.ok(sameValue(true, true));
  assert.ok(!sameValue(true, 1));
  assert.ok(sameValue('O(log n)', 'O(log n)'));
});

test('the oracle prints one JSON object, and may log above it', () => {
  assert.deepEqual(parseOracle('{"looks": 6, "holds": true}\n'), {looks: 6, holds: true});
  assert.deepEqual(parseOracle('trying edges...\n{"looks": 6}'), {looks: 6});
  assert.equal(parseOracle('looks 6'), null);
  assert.equal(parseOracle('[6]'), null);
});

test('each fact is compared with what the oracle computed', () => {
  const errors = [];
  const facts = normalizeFacts(
    [{id: 'looks', value: 6, what: 'looks a scan takes'}, {id: 'passes', value: 20}, {id: 'lines', value: 11}, {id: 'takeaways', value: 3, given: 'the recap has three items'}],
    errors,
  );
  assert.deepEqual(errors, []);
  const rows = compareFacts(facts, {looks: 6, passes: 21.2});
  assert.deepEqual(rows.map((entry) => [entry.id, entry.status, entry.computed]), [['looks', 'ok', 6], ['passes', 'differs', 21.2], ['lines', 'missing', null], ['takeaways', 'given', null]]);
});

test('a malformed fact is reported, not guessed at', () => {
  const errors = [];
  normalizeFacts([{id: 'Looks', value: 6}, {id: 'a', value: 1}, {id: 'a', value: 2}, {id: 'b', value: null}, {id: 'c', value: 3, given: 'ok'}], errors);
  assert.equal(errors.length, 4);
  assert.match(errors.join('\n'), /kebab-case[\s\S]*duplicate id[\s\S]*"value" must be[\s\S]*"given" says where/);
});

test('numbers on screen and in the hook are held to the ledger too', () => {
  const storyboard = {
    brief: {hook: 'A *million* items in *twenty* looks.'},
    thumbnail: {text: '*20* looks'},
    facts: [{id: 'passes', value: 20}],
    scenes: [{id: 'recap', beats: [{say: 'Each pass halves it.', text: 'Half, *7* times'}], items: [{text: 'Twenty looks for a million'}, 'Sorted first']}],
  };
  assert.deepEqual(unbackedNumbers(storyboard).map((number) => [number.value, number.where]), [[1000000, "the brief's hook"], [7, 'recap beat 1, on screen']]);
});

test('what an evidence scene shows is read for numbers, whichever way its fields were written', () => {
  const scenes = [
    {id: 'a', kind: 'stat', beats: [{say: 'It is quick.'}], metrics: [{value: '~25,000,000', unit: 'episodes', label: 'in 2019', delta: '+3.2'}]},
    {id: 'b', kind: 'compare', beats: [{say: 'It is quick.'}], left: {label: 'Before', points: ['12 steps']}, right: {label: 'After', points: [{text: 'one step'}]}},
    {id: 'c', kind: 'chart', beats: [{say: 'It is quick.'}], labels: ['Round 1', 'Round 4'], values: [71, 41]},
  ];
  assert.deepEqual(unbackedNumbers({scenes, facts: []}).map((number) => number.value), [25000000, 2019, 3.2, 12, 71, 41]);
  assert.deepEqual(unbackedNumbers({scenes, facts: [25000000, 2019, 3.2, 12, 71, 41].map((value, index) => ({id: `f${index}`, value}))}), []);
});

test('absolute words are found, once each', () => {
  assert.deepEqual(absolutesIn('A key that was read is never the one evicted.'), ['never']);
  assert.deepEqual(absolutesIn('It can never take more than that, and always halves.'), ['always', 'can never']);
  assert.deepEqual(absolutesIn('At most twenty looks, guaranteed.'), ['guaranteed', 'at most']);
  assert.deepEqual(absolutesIn('Check every item in turn; `never_evict` is a flag.'), []);
  // What has happened so far is history, not a promise.
  assert.deepEqual(absolutesIn('But write a key the cache has never seen, and the row grows.'), []);
});

test('vocabulary findings name the beat, the word, and what it should have been', () => {
  const storyboard = {
    vocabulary: [{word: 'look', not: ['probe', 'comparison'], defined: 'walk'}],
    scenes: [
      {id: 'race', beats: [{say: 'Six looks against two.'}]},
      {id: 'walk', beats: [{say: 'Each look is one comparison.'}, {say: 'Two probes are enough.'}]},
    ],
  };
  assert.deepEqual(vocabularyFindings(storyboard), [
    {scene: 'walk', beat: 1, kind: 'synonym', word: 'look', said: 'comparison'},
    {scene: 'walk', beat: 2, kind: 'synonym', word: 'look', said: 'probe'},
    {scene: 'race', beat: 1, kind: 'early', word: 'look', defined: 'walk'},
  ].sort((a, b) => (a.scene === b.scene ? a.beat - b.beat : a.scene === 'race' ? -1 : 1)));
});

test('each viewer gets the same plan and their own instructions; only those who can read code get the source', () => {
  const storyboard = {
    title: 'Why binary search needs so few steps',
    brief: {audience: 'programmers new to it', focus: 'why halving is fast', length: 70, hook: 'A *million* items, *twenty* looks.'},
    facts: [{id: 'scan-looks', value: 6, what: 'looks a scan takes', given: null}, {id: 'takeaways', value: 3, what: '', given: 'the recap has three items'}],
    vocabulary: [{word: 'look', not: ['probe'], defined: 'race'}],
    scenes: [
      {id: 'race', kind: 'manim', why: 'Both ways on one list.', beats: [{say: 'Finding 57 takes six looks. Can it take fewer?', predict: true}, {say: 'Two.', land: true}]},
      {id: 'walk', kind: 'trace', beats: [{say: 'Look at the middle.', lines: [[3, 3]], cues: [{at: 'the middle', lines: [[4, 5]], note: 'mid'}]}]},
      {id: 'recap', kind: 'bullets', items: [{text: 'Each pass halves the range', from: 'walk', beat: null}], beats: [{say: 'Each pass halves the range.'}]},
    ],
  };
  const ledger = {rows: [{id: 'scan-looks', status: 'differs', computed: 5}], loose: [{text: '57', where: 'race beat 1'}]};
  const brief = (viewer) => planBrief({viewer, storyboard, script: 'Finding 57 takes six looks.', routingText: 'Routing: ok', ledger, sources: ['/src/binary_search.py'], reportPath: `/out/${viewer}.md`});
  assert.deepEqual(Object.keys(VIEWERS), ['newcomer', 'practitioner', 'expert']);
  for (const viewer of Object.keys(VIEWERS)) {
    const page = brief(viewer);
    assert.ok(page.startsWith(`# Plan review as ${VIEWERS[viewer].name}`));
    assert.match(page, /\| 1 \| Finding 57 takes six looks\. Can it take fewer\? \| the animation \(its script comes after this review\); the picture holds while the question hangs \|/);
    assert.match(page, /\| 1 \| Look at the middle\. \| highlights line 3; at "the middle", highlights line 4–5; at "the middle", callout "mid" \|/);
    assert.match(page, /Takeaways shown: "Each pass halves the range" \(beside "walk"\)/);
    assert.match(page, /\| scan-looks \| 6 \| looks a scan takes \| DIFFERS: computed 5 \|/);
    assert.match(page, /\| takeaways \| 3 \|  \| not computed: the recap has three items \|/);
    assert.match(page, /Numbers said or shown with no row: "57" \(race beat 1\)/);
    assert.match(page, /\*\*look\*\*, never "probe"; explained in "race"/);
    assert.match(page, new RegExp(`Write it to /out/${viewer}\\.md`));
    assert.match(page, /1\. \*\*Say each scene back\.\*\*/);
  }
  assert.doesNotMatch(brief('newcomer'), /binary_search\.py/);
  assert.match(brief('expert'), /## The source[\s\S]*\/src\/binary_search\.py/);
  assert.match(brief('expert'), /find its row in the facts ledger/);
  assert.match(brief('newcomer'), /where you would have stopped watching/);
});

test('a place in a document is not a number to check', () => {
  assert.deepEqual(numbersIn('Table 2 and Figure 4, Section 3.1, but 15 percent').map((number) => number.value), [15]);
});

test('a note under a picture is on screen, so its numbers are held to the ledger', () => {
  const scenes = [{id: 'r', kind: 'chart', beats: [{say: 'It is quick.', note: '3.5 days on 8 P100 GPUs', cues: [{at: 'quick', note: 'about 41.8'}]}], labels: ['A'], values: [1]}];
  assert.deepEqual(unbackedNumbers({scenes, facts: [{id: 'one', value: 1}]}).map((number) => [number.value, number.where]), [[3.5, 'r beat 1, on screen'], [8, 'r beat 1, on screen'], [41.8, 'r beat 1, on screen']]);
});
