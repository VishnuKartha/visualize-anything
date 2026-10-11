import assert from 'node:assert/strict';
import test from 'node:test';
import {SEAM, findSeams} from '../lib/seams.mjs';

// A 30s video at 30fps: three scenes, the second carrying on from the first.
const scene = (id, from, frames, extra = {}) => ({id, kind: 'trace', from, frames, beats: [], steps: [], ...extra});
const props = {
  fps: 30,
  totalFrames: 900,
  scenes: [scene('a', 0, 300, {fadeOut: false}), scene('b', 300, 300, {fadeIn: false}), scene('c', 600, 300)],
};
// One change score per frame; quiet unless a test says otherwise.
const frames = (set = {}) => Array.from({length: 900}, (_, frame) => ({time: frame / 30, score: set[frame] ?? 0.001}));
const clean = {changes: frames(), joins: [{index: 1, similarity: 0.9999}], silences: [], levels: [], firstPicture: 0.3};
const kinds = (measured) => findSeams(props, {...clean, ...measured}).map((seam) => seam.kind);
const texts = (measured) => findSeams(props, {...clean, ...measured}).map((seam) => seam.text).join('\n');

test('a clean video has no seams', () => {
  assert.deepEqual(findSeams(props, clean), []);
});

test('one frame that changes far more than its neighbours is a cut; a fade is not', () => {
  assert.deepEqual(kinds({changes: frames({450: 0.04})}), ['cut']);
  assert.match(texts({changes: frames({450: 0.04})}), /0:15: the picture changes in a single frame inside "b"/);
  // A six-frame fade on a busy picture: each frame changes about as much as the next.
  assert.deepEqual(kinds({changes: frames({594: 0.023, 595: 0.021, 596: 0.02, 597: 0.019, 598: 0.018, 599: 0.017})}), []);
  // Small things popping in stay under the floor.
  assert.deepEqual(kinds({changes: frames({450: SEAM.cut - 0.005})}), []);
});

test('a cut at a scene boundary names both scenes, and says what kind of join it is', () => {
  assert.match(texts({changes: frames({300: 0.031, 301: 0.007})}), /at the join from "a" into "b"\. The join is marked as carrying on/);
  assert.match(texts({changes: frames({600: 0.05})}), /at the join from "b" into "c"\. Let the first scene end, and the second begin, on a fade/);
});

test('a carried-on join whose frames do not match is a jump', () => {
  assert.deepEqual(kinds({joins: [{index: 1, similarity: 0.95}]}), ['jump']);
  assert.match(texts({joins: [{index: 1, similarity: 0.95}]}), /"b" is marked as continuing "a", but its first frame is not the frame that scene ended on/);
  assert.deepEqual(kinds({joins: [{index: 1, similarity: SEAM.alike}]}), []);
});

test('the voice may breathe at a fade, but not where the picture carries on', () => {
  // 1.7s across the carried-on join a → b.
  assert.deepEqual(kinds({silences: [{start: 9.2, end: 10.9}]}), ['pause']);
  assert.match(texts({silences: [{start: 9.2, end: 10.9}]}), /carries on from "a" into "b", but the voice stops for 1\.7s/);
  // The same pause across the fade b → c is a breath.
  assert.deepEqual(kinds({silences: [{start: 19.2, end: 20.9}]}), []);
  // Three seconds anywhere is dead air; the silence before the first word and after the last is not.
  assert.deepEqual(kinds({silences: [{start: 19, end: 22.2}]}), ['air']);
  assert.deepEqual(kinds({silences: [{start: 0, end: 3.5}, {start: 26, end: 30}]}), []);
});

test('a line much louder or quieter than the rest is a step in the voice', () => {
  const levels = [-19, -20, -19.5, -20.5, -26].map((mean, index) => ({scene: 'b', beat: index + 1, mean}));
  assert.match(texts({levels}), /"b" beat 5 is 6\.0 dB quieter than the rest/);
  assert.deepEqual(kinds({levels: levels.slice(0, 4)}), []);
});

test('an opening with nothing on screen is flagged', () => {
  assert.deepEqual(kinds({firstPicture: 3.4}), ['empty']);
  assert.deepEqual(kinds({firstPicture: null}), ['empty']);
});
