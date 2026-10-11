import assert from 'node:assert/strict';
import test from 'node:test';
import {BED, duckPoints, envelopeExpression, speechRegions} from '../lib/media.mjs';

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
