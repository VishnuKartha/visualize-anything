import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {BED, duckPoints, envelopeExpression, frameChanges, speechRegions} from '../lib/media.mjs';
import {SEAM, findSeams} from '../lib/seams.mjs';

// Evaluate the ffmpeg expression the way ffmpeg would, for one value of t.
const follow = (expression, t) => {
  const lt = (a, b) => (a < b ? 1 : 0);
  const pick = (test, yes, no) => (test ? yes : no);
  return Function('t', 'lt', 'pick', `return ${expression.replaceAll('if(', 'pick(')};`)(t, lt, pick);
};

test('pauses shorter than the gap are speech; longer ones split it', () => {
  const clips = [{start: 0.5, duration: 3}, {start: 3.8, duration: 2}, {start: 7.6, duration: 2}, {start: 12, duration: 1}];
  // 0.3s and 1.8s pauses are held through; the 2.4s one is a gap.
  assert.deepEqual(speechRegions(clips), [{start: 0.5, end: 9.6}, {start: 12, end: 13}]);
  assert.deepEqual(speechRegions([]), []);
});

test('the bed is down before the first word and back up only in a real gap', () => {
  const regions = [{start: 0.5, end: 9.6}, {start: 12, end: 13}];
  const points = duckPoints(regions, 20);
  const at = (t) => follow(envelopeExpression(points), t);
  // A half-second head is not a gap: the bed starts under the voice instead of swelling and dropping.
  assert.equal(at(0), 0);
  assert.equal(at(5), 0);
  // Down for `hold` after the last word, then up over `release`.
  assert.equal(at(9.6 + BED.hold - 0.01), 0);
  assert.ok(Math.abs(at(9.6 + BED.hold + BED.release / 2) - 0.5) < 0.01);
  assert.equal(at(11.5), 1);
  // Fully down `early` before the next word.
  assert.equal(at(12 - BED.early), 0);
  assert.ok(at(12 - BED.early - BED.attack / 2) > 0.4);
  // The tail is long enough to come up in.
  assert.equal(at(19), 1);
  for (let i = 1; i < points.length; i += 1) assert.ok(points[i].t >= points[i - 1].t, 'points run forward in time');
});

test('a long opening is a gap; no narration at all leaves the bed up', () => {
  const at = (t) => follow(envelopeExpression(duckPoints([{start: 3, end: 8}], 9)), t);
  assert.equal(at(1), 1);
  assert.equal(at(3 - BED.early), 0);
  assert.equal(at(8.9), 0);
  assert.equal(follow(envelopeExpression(duckPoints([], 10)), 4), 1);
});

// Three seconds of one scene, drawn by ffmpeg and measured the way `va qc` measures a render: a
// bright panel on a dark backdrop, as opaque at frame N as `opacity` says.
const FRAMES = 90;
const scene = {fps: 30, totalFrames: FRAMES, scenes: [{id: 'only', kind: 'chart', from: 0, frames: FRAMES, beats: [], steps: []}]};
const cutsIn = async (opacity) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'va-cuts-'));
  try {
    const file = path.join(dir, 'clip.nut');
    const picture = `color=c=black:s=320x180:r=30,format=yuv420p,geq=lum='20+200*between(X,40,280)*between(Y,20,120)*(${opacity})':cb=128:cr=128`;
    const drawn = spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', picture, '-frames:v', String(FRAMES), '-c:v', 'rawvideo', file], {encoding: 'utf8'});
    assert.equal(drawn.status, 0, drawn.stderr);
    const changes = await frameChanges(file);
    return {changes, cuts: findSeams(scene, {changes, joins: [], silences: [], levels: [], firstPicture: 0}).filter((seam) => seam.kind === 'cut')};
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
};
const noFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0 ? false : 'ffmpeg is not installed';

test('a scene fading in over nine frames and out over six has no cut', {skip: noFfmpeg}, async () => {
  // The fades every scene gets: up from frame 0 to 9, down from 83 to 89.
  const {changes, cuts} = await cutsIn('clip(N/9,0,1)*clip((89-N)/6,0,1)');
  assert.equal(changes.length, FRAMES, 'one measurement per frame');
  assert.deepEqual(cuts, []);
  // Not because the fade is too faint to count: each of its frames changes more than a cut needs to, and all alike.
  const out = changes.slice(84).map((change) => change.score);
  assert.equal(out.length, 6);
  for (const score of out) {
    assert.ok(score > 5 * SEAM.cut, `a frame of the fade changes ${score}`);
    assert.ok(Math.abs(score - out[0]) < 0.05 * out[0], `the fade's frames change alike: ${out.join(', ')}`);
  }
  assert.ok(changes[83].score < SEAM.cut / 10 && changes[40].score < SEAM.cut / 10, 'a held picture does not change');
});

test('the same picture swapped in one frame is a cut', {skip: noFfmpeg}, async () => {
  const {changes, cuts} = await cutsIn('lt(N,45)');
  assert.equal(cuts.length, 1);
  assert.equal(Math.round(cuts[0].at * scene.fps), 45);
  assert.match(cuts[0].text, /0:01: the picture changes in a single frame inside "only"/);
  // The panel covers 240×100 of the 320×144 measured, and steps 200 of 255 levels.
  assert.ok(Math.abs(changes[45].score - ((240 * 100) / (320 * 144)) * (200 / 255)) < 0.01, `the swap measures ${changes[45].score}`);
});

test('a cut in the middle of a fade is still a cut', {skip: noFfmpeg}, async () => {
  // Fading out over thirty frames, and gone on the tenth.
  const {cuts} = await cutsIn('clip((70-N)/30,0,1)*lt(N,50)');
  assert.equal(cuts.length, 1);
  assert.equal(Math.round(cuts[0].at * scene.fps), 50);
});
