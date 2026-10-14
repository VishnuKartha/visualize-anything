import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {planCodeChange} from '../lib/hyperframes.mjs';
import {countAndRestyle} from '../lib/steps.mjs';
import {subtitleFiles} from '../lib/media.mjs';
import {speakable} from '../lib/speech.mjs';
import {buildSteps, buildTimeline, captionPhrases, loadStoryboard, phraseTime, projectPaths, spokenTokens, withAutoCues} from '../lib/storyboard.mjs';

const words = (text, start = 0.1, each = 0.4) =>
  text.split(' ').map((word, index) => ({text: word.replace(/[.,]/g, ''), start: start + index * each, end: start + index * each + each - 0.05}));

const project = (storyboard) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'va-test-'));
  mkdirSync(path.join(dir, 'src'));
  writeFileSync(path.join(dir, 'src', 'x.py'), Array.from({length: 12}, (_, i) => `line_${i + 1} = ${i + 1}`).join('\n') + '\n');
  writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({sourceRoot: '.', ...storyboard}));
  return projectPaths(dir);
};

test('spoken tokens drop punctuation and split identifiers', () => {
  assert.deepEqual(spokenTokens('A hit calls move_to_end(). Then, done!'), ['a', 'hit', 'calls', 'move', 'to', 'end', 'then', 'done']);
});

test('a phrase is timed by the TTS word it starts on', () => {
  const say = 'Then store, check the size, and evict from the front.';
  const beat = {say, words: words(say), duration: 4.2};
  assert.equal(phraseTime('check the size', beat), 0.1 + 2 * 0.4);
  assert.equal(phraseTime('EVICT', beat), 0.1 + 6 * 0.4);
  assert.equal(phraseTime('never said', beat), null);
});

test('a phrase the TTS tokenized differently falls back to its place in the sentence', () => {
  const say = 'It runs in O of log n time overall.';
  const beat = {say, words: [{text: 'It runs in logarithmic time', start: 0, end: 4}], duration: 4};
  const time = phraseTime('log n', beat);
  assert.ok(time > 1.5 && time < 2.6, `expected mid-sentence, got ${time}`);
});

test('cues become steps that land on their words and carry unchanged fields over', () => {
  const say = 'Then store, check the size, and evict from the front.';
  const scene = {
    id: 'put',
    kind: 'code',
    beats: [
      {say: 'Refresh the key.', lines: [[18, 19]], note: 'first', cues: []},
      {say, lines: [[20, 20]], cues: [{at: 'check the size', lines: [[21, 21]]}, {at: 'evict', lines: [[22, 22]], note: 'oldest end'}]},
    ],
  };
  const timed = {
    frames: 300,
    beats: [
      {cue: 0, from: 15, words: words('Refresh the key.'), duration: 1.2},
      {cue: 60, from: 64, words: words(say), duration: 4.2},
    ],
  };
  const steps = buildSteps(scene, timed, 30);
  assert.deepEqual(steps.map((step) => step.cue), [0, 60, 64 + Math.round((0.9 - 0.1) * 30), 64 + Math.round((2.5 - 0.1) * 30)]);
  assert.deepEqual(steps.map((step) => step.lines[0][0]), [18, 20, 21, 22]);
  assert.deepEqual(steps.map((step) => step.note), ['first', null, null, 'oldest end'], 'a note belongs to its beat, then carries within it');
  assert.equal(steps.reduce((sum, step) => sum + step.cueFrames, 0), 300, 'steps tile the scene exactly');
  assert.deepEqual(steps.map((step) => step.beat), [0, 1, 1, 1]);
});

test('bullets reveal one more item per beat unless a cue says otherwise', () => {
  const scene = {
    id: 'recap',
    kind: 'bullets',
    items: ['a', 'b', 'c', 'd'],
    beats: [{say: 'One thing.', cues: []}, {say: 'Two things.', cues: []}, {say: 'Three, and that is all.', show: 3, cues: [{at: 'that is all', show: 4}]}],
  };
  const timed = {frames: 300, beats: [0, 100, 200].map((cue, i) => ({cue, from: cue + 5, words: words(scene.beats[i].say), duration: 2}))};
  assert.deepEqual(buildSteps(scene, timed, 30).map((step) => step.show), [1, 2, 3, 4]);
  const plain = {...scene, beats: scene.beats.map(({say}) => ({say, cues: []}))};
  assert.deepEqual(buildSteps(plain, timed, 30).map((step) => step.show), [1, 2, 4], 'the last beat shows everything');
});

test('the storyboard loader rejects cues that are not spoken, out of order, or empty', () => {
  const scene = (cues) => ({
    scenes: [{id: 'a', need: 'source', file: 'src/x.py', range: [1, 12], beats: [{say: 'First the top, then the middle, then the end.', lines: 1, cues}]}],
  });
  const load = (cues) => loadStoryboard(project(scene(cues)));
  assert.equal(load([{at: 'then the middle', lines: 5}, {at: 'the end', lines: [10, 12]}]).storyboard.scenes[0].beats[0].cues.length, 2);
  assert.throws(() => load([{at: 'the bottom', lines: 5}]), /is not in this beat's "say"/);
  assert.throws(() => load([{at: 'the end', lines: 5}, {at: 'the top', lines: 2}]), /spoken before the previous cue/);
  assert.throws(() => load([{at: 'the middle'}]), /changes nothing/);
  assert.throws(() => load([{at: 'the middle', lines: 40}]), /fall outside the displayed lines/);
});

test('need supplies the renderer when kind is omitted', () => {
  const {storyboard} = loadStoryboard(
    project({scenes: [{id: 'intro', need: 'question', beats: [{say: 'Why?', text: '*Why?*'}]}, {id: 'flow', need: 'conversation', beats: [{say: 'A calls B.'}]}]}),
  );
  assert.deepEqual(storyboard.scenes.map((scene) => [scene.kind, scene.type]), [['title', undefined], ['diagram', 'sequence']]);
  assert.throws(() => loadStoryboard(project({scenes: [{id: 'x', beats: [{say: 'Hi.'}]}]})), /declare "need"/);
});

test('timeline windows tile each scene and subtitles carry absolute times', () => {
  const storyboard = {fps: 30, scenes: [{id: 'a', beats: [{say: 'One two.'}, {say: 'Three four.'}]}, {id: 'b', beats: [{say: 'Five six.'}]}]};
  const clip = (file, text, duration) => ({file, key: file, duration, words: words(text, 0.05, duration / 2 - 0.05)});
  const timeline = buildTimeline(storyboard, {voice: 'v', rate: '+0%', pitch: '+0Hz', beats: [clip('a-0.mp3', 'One two.', 1.0), clip('a-1.mp3', 'Three four.', 1.5), clip('b-0.mp3', 'Five six.', 1.2)]});
  for (const scene of timeline.scenes) assert.equal(scene.beats.reduce((sum, beat) => sum + beat.cueFrames, 0), scene.frames);
  assert.equal(timeline.scenes[1].from, timeline.scenes[0].frames);
  assert.equal(timeline.totalFrames, timeline.scenes[0].frames + timeline.scenes[1].frames);

  const props = {
    fps: 30,
    scenes: timeline.scenes.map((scene) => ({
      from: scene.from,
      beats: scene.beats.map((beat) => ({from: beat.from, phrases: [{start: 0.05, end: beat.duration, words: beat.words}]})),
    })),
  };
  const {srt, vtt, count} = subtitleFiles(props);
  assert.equal(count, 3);
  assert.match(srt, /^1\n00:00:00,550 --> /);
  assert.match(vtt, /^WEBVTT\n\n00:00:00\.550 --> /);
  const second = (timeline.scenes[1].from + timeline.scenes[1].beats[0].from) / 30 + 0.05;
  assert.ok(srt.includes(`00:00:0${Math.floor(second)},`), 'the second scene is offset by the first scene');
});

test('written narration is converted to what the voice should say', () => {
  assert.equal(speakable('A hit calls move_to_end(). Done.'), 'A hit calls move to end. Done.');
  assert.equal(speakable('It runs in O(log n), not O(n^2).'), 'It runs in O of log n, not O of n squared.');
  assert.equal(speakable('While lo <= hi, compare.'), 'While lo less than or equal to hi, compare.');
  assert.equal(speakable('Call getUserById, e.g. on a miss.'), 'Call get User By Id, for example, on a miss.');
  assert.equal(speakable('Open `lru_cache.py` now.'), 'Open lru cache dot py now.');
  assert.equal(speakable('Plain sentences are left alone, even with 3.5 and commas.'), 'Plain sentences are left alone, even with 3.5 and commas.');
});

test('captions keep the written word and take the time of all the words spoken for it', () => {
  const caption = 'A hit calls move_to_end() now.';
  const spoken = words(speakable(caption)); // A hit calls move to end now
  const [phrase] = captionPhrases(caption, spoken, 3);
  const identifier = phrase.words.find((word) => word.text.startsWith('move_to_end'));
  assert.equal(identifier.start, spoken[3].start, 'starts when "move" is spoken');
  assert.equal(identifier.end, spoken[5].end, 'ends when "end" is spoken');
  assert.equal(phrase.words.at(-1).start, spoken[6].start);
});

test('a code beat with no cue follows the identifiers the narration names', () => {
  const code = {startLine: 17, code: ['def put(self, key, value):', '    if key in self.items:', '        self.items.move_to_end(key)', '    self.items[key] = value', '    if len(self.items) > self.capacity:', '        self.items.popitem(last=False)'].join('\n')};
  const scene = {
    id: 'put',
    kind: 'code',
    beats: [
      {say: 'First, move_to_end refreshes the key. Then, if we are over capacity, popitem evicts the oldest.', lines: null, cues: []},
      {say: 'The value is stored either way.', lines: null, cues: []},
      {say: 'This beat was cued by hand, popitem and all.', lines: [[17, 17]], cues: []},
    ],
  };
  const {scene: cued, notes} = withAutoCues(scene, {code});
  assert.deepEqual(cued.beats[0].lines, [[19, 19]]);
  assert.deepEqual(cued.beats[0].cues, [{at: 'capacity', lines: [[21, 21]]}, {at: 'popitem', lines: [[22, 22]]}]);
  assert.equal(cued.beats[1].lines, null, 'ordinary words such as "value" do not name a line');
  assert.deepEqual(cued.beats[2].lines, [[17, 17]], 'an authored cue is never replaced');
  assert.deepEqual(notes, ['put beat 1: line 19 → line 21 → line 22']);
  assert.deepEqual(withAutoCues({...scene, auto: false}, {code}).scene.beats[0].lines, null);
});

test('a diagram beat with no focus lights each node as its label is spoken', () => {
  const baked = {
    nodes: {web: {label: 'Web App'}, api: {label: 'API'}, redis: {label: 'Redis'}, db: {label: 'Postgres'}},
    edges: {'cache-read': {label: 'read cache', from: 'api', to: 'redis'}, ok: {label: 'ok', from: 'redis', to: 'api'}},
  };
  const scene = {
    id: 'path',
    kind: 'diagram',
    beats: [
      {say: 'The Web App asks the API, which checks Redis before it ever touches Postgres.', cues: []},
      {say: 'Nothing here is named.', cues: []},
      {say: 'The API again.', focus: 'all', cues: []},
    ],
  };
  const {scene: cued} = withAutoCues(scene, {baked});
  assert.deepEqual(cued.beats[0].focus, ['web']);
  assert.deepEqual(cued.beats[0].cues.map((cue) => cue.focus), [['web', 'api'], ['web', 'api', 'redis'], ['web', 'api', 'redis', 'db']]);
  assert.deepEqual(cued.beats[0].cues.map((cue) => cue.at), ['API', 'Redis', 'Postgres']);
  assert.equal(cued.beats[1].focus, undefined);
  assert.equal(cued.beats[2].focus, 'all');
});

test('a code-change scene shows the next version on each beat unless versions are named', () => {
  const beats = (list) => list.map((beat) => ({cues: [], ...beat}));
  const timed = {frames: 400, beats: [0, 100, 250].map((cue, i) => ({cue, from: cue + 5, words: words('one two three four five'), duration: 2}))};
  const scene = {id: 'c', kind: 'hyperframes', versions: [{}, {}, {}], beats: beats([{say: 'one two'}, {say: 'three four'}, {say: 'five six'}])};
  assert.deepEqual(buildSteps(scene, timed, 30).map((step) => step.version), [0, 1, 2]);
  const named = {...scene, beats: beats([{say: 'one two', version: 0}, {say: 'one two three four five', cues: [{at: 'four', version: 2}]}, {say: 'five six'}])};
  assert.deepEqual(buildSteps(named, timed, 30).map((step) => step.version), [0, 0, 2, 2], 'a named version stays until another is named');
});

test('the loader checks a hyperframes scene has versions or a composition, and that versions exist', () => {
  const load = (scene) => loadStoryboard(project({scenes: [{id: 'c', need: 'change', beats: [{say: 'It changes here.'}], ...scene}]}));
  assert.equal(load({versions: [{file: 'src/x.py', range: [1, 3]}, {code: 'a = 1', lang: 'python'}]}).storyboard.scenes[0].kind, 'hyperframes');
  assert.throws(() => load({}), /needs either "versions"/);
  assert.throws(() => load({versions: [{code: 'a'}], composition: 'html/c.html'}), /needs either "versions"/);
  assert.throws(() => load({versions: [{code: 'a'}], effect: 'wipe'}), /"effect" must be "morph" or "diff"/);
  assert.throws(() => load({versions: [{code: 'a'}, {code: 'b'}], beats: [{say: 'It changes here.', version: 2}]}), /whole number from 0 to 1/);
  assert.throws(() => load({versions: [{file: 'src/missing.py'}]}), /file not found/);
  assert.throws(() => load({composition: 'html/none.html'}), /composition not found/);
});

test('planning a code change keys the tokens both versions share and sizes one panel for all versions', async () => {
  const before = {code: 'def search(items, target):\n    for item in items:\n        return item\n    return -1'};
  const after = {code: 'def search(items, target):\n    lo = 0\n    hi = len(items) - 1\n    while lo <= hi:\n        lo += 1\n    return -1'};
  const plan = await planCodeChange({id: 'c', title: 'search.py', lang: 'python', effect: 'morph', versions: [before, after], changes: [{at: 2.5, to: 1}], duration: 6});
  assert.equal(plan.id, 'va-c');
  assert.equal(plan.changes.length, 1);
  const [change] = plan.changes;
  const fromKeys = new Set(change.from.map((token) => token.key));
  const kept = change.to.filter((token) => fromKeys.has(token.key)).map((token) => token.content.trim()).filter(Boolean);
  for (const word of ['def', 'search', 'return']) assert.ok(kept.includes(word), `"${word}" should travel, not blink`);
  assert.ok(!kept.includes('while'), 'new tokens get new keys');
  assert.equal(plan.tallest, 6, 'the panel is sized for the tallest version');
  assert.ok(plan.panel.h <= 790 && plan.panel.y >= 112);
  const still = await planCodeChange({id: 's', title: '', lang: 'python', effect: 'morph', versions: [before], changes: [], duration: 3});
  assert.equal(still.changes.length, 0);
  assert.ok(still.initial.length > 0);
});

test('a beat marked to land is followed by a longer silence', () => {
  const clip = (file) => ({file, key: file, duration: 2, words: words('one two three')});
  const manifest = {voice: 'v', rate: '+0%', pitch: '+0Hz', beats: [clip('a-0.mp3'), clip('a-1.mp3'), clip('a-2.mp3')]};
  const plain = buildTimeline({fps: 30, scenes: [{id: 'a', beats: [{say: 'x'}, {say: 'y'}, {say: 'z'}]}]}, manifest);
  const landed = buildTimeline({fps: 30, scenes: [{id: 'a', beats: [{say: 'x'}, {say: 'y', land: true}, {say: 'z'}]}]}, manifest);
  assert.equal(landed.scenes[0].beats[1].from, plain.scenes[0].beats[1].from, 'the landing beat itself starts on time');
  assert.equal(landed.scenes[0].beats[2].from - plain.scenes[0].beats[2].from, 21, 'the next beat waits 0.7s longer');
  const last = buildTimeline({fps: 30, scenes: [{id: 'a', beats: [{say: 'x'}, {say: 'y'}, {say: 'z', land: true}]}]}, manifest);
  assert.equal(last.scenes[0].frames - plain.scenes[0].frames, 21, 'a final beat that lands holds the scene longer');
});

test('recap items can point at earlier scenes; continues joins two pictures', () => {
  const base = [
    {id: 'intro', need: 'question', beats: [{say: 'Why?', text: '*Why?*'}]},
    {id: 'walk', need: 'trace', file: 'src/x.py', range: [1, 4], class: 'Walk', beats: [{say: 'First.'}, {say: 'Second.'}]},
  ];
  const load = (extra) => loadStoryboard(project({scenes: [...base, ...extra]}));
  const recap = (items) => ({id: 'recap', need: 'recap', items, beats: [{say: 'Remember this.'}]});
  const {storyboard} = load([recap(['Plain text', {text: 'With a moment', from: 'walk', beat: 2}])]);
  assert.deepEqual(storyboard.scenes[2].items, [{text: 'Plain text', from: null, beat: null}, {text: 'With a moment', from: 'walk', beat: 2}]);
  assert.throws(() => load([recap([{text: 'x', from: 'nowhere'}])]), /is not an earlier scene/);
  assert.throws(() => load([recap([{text: 'x', from: 'intro'}])]), /point at a scene with a picture/);
  assert.throws(() => load([recap([{text: 'x', from: 'walk', beat: 3}])]), /"beat" must be a beat number/);
  const more = {id: 'again', need: 'trace', file: 'src/x.py', range: [1, 4], class: 'Again', continues: true, beats: [{say: 'Then.'}]};
  assert.equal(load([more]).storyboard.scenes[2].continues, true);
  assert.throws(() => load([{...recap(['x']), continues: true}]), /joins two scenes that share a picture/);
});

test('a thumbnail names a few words and a pictured scene; a credit needs the name it shows', () => {
  const scenes = [
    {id: 'intro', need: 'question', beats: [{say: 'Why?', text: '*Why?*'}]},
    {id: 'walk', need: 'trace', file: 'src/x.py', range: [1, 4], class: 'Walk', beats: [{say: 'First.'}, {say: 'Second.'}]},
  ];
  const load = (extra, more = []) => loadStoryboard(project({scenes: [...scenes, ...more], ...extra}));
  assert.equal(load({}).storyboard.thumbnail, null);
  assert.deepEqual(load({thumbnail: {text: ' *Two* looks. ', from: 'walk', beat: 2}}).storyboard.thumbnail, {text: '*Two* looks.', from: 'walk', beat: 2});
  assert.throws(() => load({thumbnail: {text: 'x', from: 'nowhere'}}), /is not a scene/);
  assert.throws(() => load({thumbnail: {text: 'x', from: 'intro'}}), /point at a scene with a picture/);
  assert.throws(() => load({thumbnail: {text: 'x', from: 'walk', beat: 3}}), /"beat" must be a beat number/);
  const credit = {id: 'credit', need: 'credit', title: 'x.py', subtitle: 'src/x.py', beats: [{say: 'That is x dot py.'}]};
  assert.equal(load({}, [credit]).storyboard.scenes[2].kind, 'credit');
  assert.throws(() => load({}, [{...credit, title: undefined}]), /credit scene needs "title"/);
  const titled = load({}, []).warnings.length;
  const old = loadStoryboard(project({scenes: [{...scenes[0], title: 'Why it is fast'}, scenes[1]]}));
  assert.equal(old.warnings.length, titled + 1, 'a title on an opening is no longer shown, and says so');
});

test('where the picture carries on across a join, the voice does not stop to breathe', () => {
  const manifest = {voice: 'v', rate: '+0%', pitch: '+0Hz', beats: ['a-0', 'b-0', 'c-0'].map((name) => ({file: `${name}.mp3`, key: name, duration: 2, words: []}))};
  const scenes = (carry) => [{id: 'a', beats: [{say: 'x'}]}, {id: 'b', continues: carry, beats: [{say: 'y'}]}, {id: 'c', beats: [{say: 'z'}]}];
  const faded = buildTimeline({fps: 30, scenes: scenes(false)}, manifest);
  const carried = buildTimeline({fps: 30, scenes: scenes(true)}, manifest);
  const gap = (timeline, index) => {
    const [before, after] = [timeline.scenes[index - 1], timeline.scenes[index]];
    return (after.from + after.beats[0].from - (before.from + before.beats.at(-1).from + 60)) / 30; // 60 frames of speech
  };
  assert.equal(gap(faded, 1), 1.2, 'a fade keeps its breath: 0.7s out, 0.5s in');
  // Scenes end on a whole frame, so the pause is 0.3s to within one frame.
  assert.ok(Math.abs(gap(carried, 1) - 0.3) <= 1 / 30 + 1e-9, `a carried-on join pauses as long as two beats do (${gap(carried, 1)})`);
  assert.equal(gap(carried, 2), 1.2, 'the next join, a fade, is unchanged');
});

test('a prediction pause ends on a question, is answered in the same scene, and holds the picture longer', () => {
  const ask = (beats) => ({scenes: [{id: 'race', need: 'motion', class: 'Race', beats}]});
  assert.throws(() => loadStoryboard(project(ask([{say: 'It gets there in two.', predict: true}, {say: 'Two looks.'}])), {strict: false}), /ends on the question/);
  assert.throws(() => loadStoryboard(project(ask([{say: 'Six looks.'}, {say: 'Can it take fewer?', predict: true}])), {strict: false}), /answered by the next beat of the same scene/);
  const {storyboard} = loadStoryboard(project(ask([{say: 'Six looks.'}, {say: 'Can it take fewer?', predict: true}, {say: 'Two.'}])), {strict: false});
  const clip = (file) => ({file, key: file, duration: 2, words: []});
  const timeline = buildTimeline(storyboard, {voice: 'v', rate: 'r', pitch: 'p', beats: ['race-0.mp3', 'race-1.mp3', 'race-2.mp3'].map(clip)});
  const [first, asked, answer] = timeline.scenes[0].beats;
  // 0.3s between ordinary beats; 1.5s more after the question.
  assert.equal(asked.from - first.from, Math.round(2.3 * 30));
  assert.equal(answer.from - asked.from, Math.round(3.8 * 30));
});

test('facts, the claims that rest on them, and the vocabulary are checked for shape', () => {
  const scenes = [{id: 'race', need: 'motion', class: 'Race', beats: [{say: 'A read key is never evicted.', holds: 'recent-survives'}]}];
  assert.throws(() => loadStoryboard(project({scenes}), {strict: false}), /"holds" names "recent-survives", which is not in "facts"/);
  assert.throws(() => loadStoryboard(project({scenes, facts: [{id: 'recent-survives', value: false}]}), {strict: false}), /whose value is not true/);
  assert.throws(() => loadStoryboard(project({scenes, vocabulary: [{word: 'entry', defined: 'nowhere'}]}), {strict: false}), /"defined" "nowhere" is not a scene/);
  const {storyboard} = loadStoryboard(
    project({scenes, facts: [{id: 'recent-survives', value: true, what: 'a key read last is not the next evicted, at capacity 1 to 5'}], vocabulary: [{word: 'entry', not: ['slot'], defined: 'race'}]}),
    {strict: false},
  );
  assert.deepEqual(storyboard.facts, [{id: 'recent-survives', value: true, what: 'a key read last is not the next evicted, at capacity 1 to 5', given: null}]);
  assert.deepEqual(storyboard.vocabulary, [{word: 'entry', not: ['slot'], defined: 'race'}]);
});

test('a music bed is a file and two distances below the voice, neither of them close', () => {
  const scenes = [{id: 'race', need: 'motion', class: 'Race', beats: [{say: 'Six looks.'}]}];
  const music = (value) => loadStoryboard(project({scenes, music: value}), {strict: false}).storyboard.music;
  assert.equal(music(undefined), null);
  assert.deepEqual(music('bed.mp3'), {file: 'bed.mp3', under: 18, gap: 10});
  assert.deepEqual(music({file: 'bed.mp3', under: 20, gap: 12}), {file: 'bed.mp3', under: 20, gap: 12});
  assert.throws(() => music({file: 'bed.mp3', under: 9}), /"under" must be at least 16/);
  assert.throws(() => music({file: 'bed.mp3', gap: 25}), /"gap" must be between 4 and "under"/);
  assert.throws(() => loadStoryboard(project({scenes, music: 'bed.mp3'})), /"music": file not found/);
});

const EVIDENCE_BEATS = [{say: 'A world has two jobs to do.'}, {say: 'A simulator remembers.'}, {say: 'A video model looks real.'}];
const clockFor = (count) => ({frames: 100 * count, beats: Array.from({length: count}, (_, index) => ({cue: index * 100, from: index * 100 + 4, words: [], duration: 2}))});

test('an evidence scene is checked for its own fields and comes back in one shape', () => {
  const load = (scene) => loadStoryboard(project({scenes: [{id: 's', why: 'w', beats: [{say: 'It does one thing well.'}], ...scene}]})).storyboard.scenes[0];
  const stat = load({need: 'number', metrics: [{value: 36, unit: 'fps', label: 'frames a second'}]});
  assert.deepEqual(stat.metrics, [{value: '36', unit: 'fps', label: 'frames a second', detail: null, delta: null, tone: 'positive'}]);
  // "left" and "right" are two panels; a point takes its panel's tone unless it names its own.
  const compare = load({need: 'contrast', left: {label: 'A', tone: 'negative', points: ['slow', {text: 'exact', tone: 'positive'}]}, right: {label: 'B', points: ['fast']}});
  assert.deepEqual(compare.panels.map((panel) => panel.points.map((point) => point.tone)), [['negative', 'positive'], ['neutral']]);
  const chart = load({need: 'chart', labels: ['Round 1', 'Round 4'], values: [71, 41], unit: 's'});
  assert.deepEqual([chart.chart, chart.series], ['bar', [{label: null, values: [71, 41], errors: null, stack: null}]]);
  // A cost and its parts: two series sharing a stack are one bar.
  const parts = load({need: 'chart', labels: ['Reddit', 'products'], series: [{label: 'split', values: [313.7, 179.3], stack: 'EDiS'}, {label: 'training', values: [518.7, 404.5], stack: 'EDiS'}, {label: 'Full GCN', values: [713.4, 1154]}]});
  assert.deepEqual(parts.series.map((entry) => entry.stack), ['EDiS', 'EDiS', null]);
  // A chart of changes against a control goes below zero, and carries the ± the source reports.
  const gains = load({need: 'chart', labels: ['Cora', 'Physics'], series: [{values: [2.7, -0.04], errors: [0.98, 0.09]}]});
  assert.deepEqual(gains.series, [{label: null, values: [2.7, -0.04], errors: [0.98, 0.09], stack: null}]);
  // A grid of changes is coloured both ways from a centre: zero by default when the scale crosses it, or the one given (1 for ratios).
  assert.equal(load({need: 'matrix', rows: ['a', 'b'], columns: ['x', 'y'], values: [[1, -2], [0.5, 3]]}).center, 0);
  assert.equal(load({need: 'matrix', rows: ['a', 'b'], columns: ['x', 'y'], values: [[0.2, 0.4], [0.6, 0.8]]}).center, null);
  assert.equal(load({need: 'matrix', rows: ['a', 'b'], columns: ['x', 'y'], values: [[1.1, 0.9], [1.6, 1.0]], scale: [0.8, 1.7], center: 1}).center, 1);
  const quote = load({need: 'quote', quote: 'A drawing mistake stays a drawing mistake.', highlight: 'stays a drawing mistake'});
  assert.deepEqual(quote.highlights, [[3, 6]]);

  const broken = (scene, pattern) => assert.throws(() => load(scene), pattern);
  broken({need: 'number', metrics: []}, /needs "metrics"/);
  broken({need: 'number', metrics: [{value: '36'}]}, /needs "label"/);
  broken({need: 'contrast', left: {label: 'A', points: ['x']}}, /needs "left" and "right"/);
  broken({need: 'contrast', left: {label: 'A', tone: 'angry', points: ['x']}, right: {label: 'B', points: ['y']}}, /"tone" must be one of/);
  broken({need: 'chart', labels: ['a', 'b'], values: [1]}, /one number for each of the 2 labels/);
  broken({need: 'chart', labels: ['a', 'b'], series: [{values: [1, 2], errors: [0.1]}]}, /"errors" must be one number, zero or more/);
  broken({need: 'chart', labels: ['a', 'b'], series: [{label: 'p', values: [1, -2], stack: 's'}, {label: 'q', values: [1, 2], stack: 's'}]}, /stacked series .* zero or more/);
  broken({need: 'chart', labels: ['a', 'b'], values: [1, 2], beats: [{say: 'The first one is the tall one.', focus: ['c']}]}, /"focus" names "c"/);
  broken({need: 'quote', quote: 'A drawing mistake stays.', highlight: 'never said'}, /is not in the quote/);
  broken({need: 'matrix', rows: ['a', 'b'], columns: ['x', 'y'], values: [[1.1, 0.9], [1.6, 1.0]], scale: [0.8, 1.7], center: 2}, /"center" is the value that means no change/);
  broken({need: 'figure', image: 'figures/missing.png'}, /image not found/);
  broken({need: 'figure', image: 'figures/paper.pdf'}, /Export a PDF figure to PNG/);
  broken({need: 'number', metrics: [{value: '36', label: 'fps'}], beats: [{say: 'It does one thing well.', show: 2}]}, /asks for more than the 1 this scene has/);
});

test('evidence scenes bring in one more part per beat, and a contrast is made a panel at a time', () => {
  const shows = (scene, count = 3) => buildSteps({...scene, beats: EVIDENCE_BEATS.slice(0, count).map((beat) => ({cues: [], ...beat}))}, clockFor(count), 30).map((step) => step.show);
  const two = [{label: 'A', points: [{}, {}]}, {label: 'B', points: [{}, {}, {}]}];
  // With a beat to spare, the panels stand empty first; then each beat fills one.
  assert.deepEqual(shows({kind: 'compare', panels: two}), [0, 2, 5]);
  assert.deepEqual(shows({kind: 'compare', panels: two}, 2), [2, 5]);
  assert.deepEqual(shows({kind: 'stat', metrics: [{}, {}]}), [1, 2, 2]);
  // Fewer beats than bars: the bars are shared out, and the last beat has them all.
  assert.deepEqual(shows({kind: 'chart', labels: ['a', 'b', 'c', 'd', 'e', 'f'], series: []}), [2, 4, 6]);
  assert.deepEqual(shows({kind: 'figure', callouts: [{}, {}]}), [0, 1, 2]);
  assert.deepEqual(shows({kind: 'quote', highlights: []}), [0, 0, 0]);
  // An authored count wins, and carries until the next one.
  const authored = buildSteps({kind: 'compare', panels: two, beats: [{say: 'A world has two jobs to do.', show: 0, cues: []}, {say: 'A simulator remembers.', show: 1, cues: [{at: 'remembers', show: 2}]}]}, {frames: 200, beats: [{cue: 0, from: 4, words: [], duration: 2}, {cue: 100, from: 104, words: words('A simulator remembers.'), duration: 2}]}, 30);
  assert.deepEqual(authored.map((step) => step.show), [0, 1, 2]);
});

test('an evidence scene holds a little longer, so its picture can leave after the voice has finished', () => {
  const frames = (kind) => {
    const storyboard = {fps: 30, scenes: [{id: 'a', kind, beats: [{say: 'One.'}]}]};
    return buildTimeline(storyboard, {beats: [{file: 'a-0.mp3', key: 'k', duration: 2, words: []}]}).scenes[0].frames;
  };
  assert.equal(frames('chart') - frames('bullets'), 9);
});

test('a Manim script is told when it ignores the kit or reaches for a class that needs LaTeX', async () => {
  const {manimTaste} = await import('../lib/steps.mjs');
  const scene = (body) => `from manim import *\nfrom va_manim import *\n\nclass Open(VAScene):\n    def construct(self):\n${body.split('\n').map((line) => `        ${line}`).join('\n')}\n`;
  const notes = (body) => manimTaste(scene(body), false, 'Open').join('\n');
  assert.equal(notes('row = fit(Cells([3, 8, 15]))\ncount = Tally(end=20, unit="looks")'), '');
  assert.match(notes('box = Rectangle(color=ACCENT)\nname = Text("cache", font_size=32)'), /draws everything by hand/);
  assert.match(notes('n = Integer(3)\nrow = Cells([1])'), /uses DecimalNumber\/Integer.*Use Tally/);
  assert.doesNotMatch(notes('n = Integer(3, mob_class=Text)\nrow = Cells([1])'), /LaTeX/);
  assert.match(notes('chart = BarChart([1, 2])\nrow = Cells([1])'), /uses BarChart.*bar_chart/);
  assert.match(notes('eq = MathTex("x^2")\nrow = Cells([1])'), /uses MathTex\/Tex.*Math\(/);
  // Only the scene being rendered is judged: a neighbour in the same file does not speak for it.
  assert.doesNotMatch(manimTaste(`${scene('row = Cells([1])')}\nclass Other(VAScene):\n    def construct(self):\n        n = Integer(3)\n`, false, 'Open').join(''), /LaTeX/);
});

test('the storyboard says what it does with each claim of a paper\'s abstract', () => {
  const load = (claims) => loadStoryboard(project({claims, scenes: [{id: 'open', need: 'motion', class: 'Open', why: 'w', beats: [{say: 'It does one thing well.'}]}]})).storyboard.claims;
  assert.deepEqual(load([{abstract: 1, scene: 'open'}, {abstract: 2, omit: 'A claim about future work.'}]), [{abstract: 1, scene: 'open', omit: null}, {abstract: 2, scene: null, omit: 'A claim about future work.'}]);
  assert.deepEqual(load(undefined), []);
  assert.throws(() => load([{abstract: 1, scene: 'nowhere'}]), /"scene" "nowhere" is not a scene/);
  assert.throws(() => load([{abstract: 1}]), /give "scene" .* or "omit"/);
  assert.throws(() => load([{abstract: 1, scene: 'open', omit: 'Both at once is neither.'}]), /one or the other/);
  assert.throws(() => load([{abstract: 1, omit: 'no'}]), /"omit" says why/);
  assert.throws(() => load([{abstract: 1, scene: 'open'}, {abstract: 1, scene: 'open'}]), /accounted for twice/);
});

test('a count and a restyle of the same number in one play() is caught; in two plays it is not', () => {
  assert.deepEqual(countAndRestyle('self.play(ChangeDecimalToValue(tally[0], 12), tally[0].animate.set_color(ACCENT), run_time=1.4)'), ['tally[0]']);
  assert.deepEqual(countAndRestyle('self.play(seen.to(9), seen.animate.shift(UP))'), ['seen']);
  assert.deepEqual(countAndRestyle('self.play(ChangeDecimalToValue(tally[0], 12), run_time=1.4)\nself.play(tally[0].animate.set_color(ACCENT))'), []);
  assert.deepEqual(countAndRestyle('self.play(track.reach(1), seen.to(9), other.animate.shift(UP))'), []);
});
