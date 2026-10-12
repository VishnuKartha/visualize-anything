import assert from 'node:assert/strict';
import test from 'node:test';
import {formatProse, locate, parseVale} from '../lib/prose.mjs';

const REPORT = JSON.stringify({
  'script.md': [
    {Check: 'ai-tells.AffirmativeFormulas', Message: "AI affirmation: 'It turns out'. Cut the flourish and state the point plainly.", Line: 7, Span: [1, 12], Severity: 'error', Match: 'It turns out'},
    {Check: 'proselint.Cliches', Message: "'at the end of the day' is a cliche.", Line: 5, Span: [40, 61], Severity: 'error', Match: 'at the end of the day'},
  ],
});

const LINES = ['<!-- header -->', '', '', '', 'The cache is full, and at the end of the day something has to go.', '', 'It turns out the obvious key is the wrong one. So which one goes?'];
const BOARD = {
  scenes: [
    {id: 'open', beats: [{say: 'The cache is full, and at the end of the day something has to go.'}]},
    {id: 'turn', beats: [{say: 'It turns out the obvious key is the wrong one.'}, {say: 'So which one goes?'}]},
  ],
};

test('a Vale report becomes findings in the order they occur in the script', () => {
  const findings = parseVale(REPORT);
  assert.deepEqual(findings.map((finding) => finding.line), [5, 7]);
  assert.deepEqual(findings[0], {line: 5, column: 40, rule: 'proselint.Cliches', severity: 'error', message: "'at the end of the day' is a cliche.", match: 'at the end of the day'});
  assert.deepEqual(parseVale('{}'), []);
  assert.equal(parseVale('vale: command failed'), null);
});

test('a finding is traced to the beat that says it, and only when one beat does', () => {
  const [cliche, formula] = parseVale(REPORT);
  assert.deepEqual(locate(cliche, LINES, BOARD), {scene: 'open', beat: 1});
  assert.deepEqual(locate(formula, LINES, BOARD), {scene: 'turn', beat: 1});
  assert.equal(locate({...cliche, line: 99}, LINES, BOARD), null);
  assert.equal(locate(cliche, LINES, null), null);
});

test('the report names the rule, the line, and the beat', () => {
  const text = formatProse(parseVale(REPORT), {lines: LINES, storyboard: BOARD});
  assert.match(text, /2 finding\(s\)/);
  assert.match(text, /line 5 · open beat 1\s+'at the end of the day' is a cliche\.\s+\(proselint\.Cliches\)/);
  assert.match(text, /line 7 · turn beat 1/);
  assert.match(formatProse([]), /Nothing found/);
});

test('a drawing that keeps to a corner of its frame is found, once it has had time to arrive', async () => {
  const {sparseStretch} = await import('../lib/media.mjs');
  const samples = [0.02, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.6, 0.6].map((share, index) => ({time: index / 2, share}));
  assert.deepEqual(sparseStretch(samples, 0.35), {start: 1, end: 6, share: 0.2});
  assert.equal(sparseStretch(samples, 0.1), null);
  assert.equal(sparseStretch([], 0.35), null);
});
