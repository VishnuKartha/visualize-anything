import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {test} from 'node:test';
import {analyzeRouting, formatRouting, resolveRoute} from '../lib/router.mjs';
import {codeBlocks, inventory, normalizeSources, proseShare, sourcesOf} from '../lib/sources.mjs';
import {loadStoryboard, projectPaths} from '../lib/storyboard.mjs';

// A small paper as arXiv ships it: a main file with prose, a figure, a table, and an algorithm, and its images.
const PAPER = [
  '\\documentclass{article}',
  '\\begin{document}',
  '\\section{Introduction}',
  'Search in a large graph is slow when every query has to visit most of the nodes before it finds the answer it wants.',
  'We build a hierarchy of graphs so that a query starts at the coarsest layer and moves down only when it has to go further.',
  '\\begin{figure}[t]',
  '\\includegraphics[width=\\linewidth]{figs/layers}',
  '\\caption{The \\textbf{layers} of the index.}',
  '\\label{fig:layers}',
  '\\end{figure}',
  '\\begin{algorithm}',
  '\\begin{algorithmic}',
  '\\State $c \\gets$ entry point',
  '\\For{each layer $l$ from top to bottom}',
  '\\State $c \\gets$ \\Call{Greedy}{$q, c, l$}',
  '\\EndFor',
  '\\end{algorithmic}',
  '\\end{algorithm}',
  '\\begin{table}',
  '\\caption{Recall at ten.}',
  '\\begin{tabular}{lr} HNSW & 0.99 \\\\ \\end{tabular}',
  '\\end{table}',
  '\\section{Results}',
  'It is faster than every baseline we tried on the four public datasets that we were able to run in the time we had.',
  '\\end{document}',
].join('\n');

const workspace = () => {
  const root = mkdtempSync(path.join(tmpdir(), 'va-sources-'));
  mkdirSync(path.join(root, 'paper', 'figs'), {recursive: true});
  writeFileSync(path.join(root, 'paper', 'main.tex'), `${PAPER}\n`);
  writeFileSync(path.join(root, 'paper', 'figs', 'layers.pdf'), '%PDF-1.4\n');
  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'src', 'search.py'), 'def search(q, c):\n    return c\n');
  mkdirSync(path.join(root, 'video', 'figures'), {recursive: true});
  writeFileSync(path.join(root, 'video', 'figures', 'layers.png'), 'png');
  return root;
};

// Scenes as loadStoryboard hands them to the router.
const scene = (id, need, says, extra = {}) => {
  const base = {id, need, why: 'because', beats: says.map((say) => ({say, caption: say})), ...extra};
  return {...base, ...resolveRoute(base)};
};
const row = (report, id) => report.rows.find((entry) => entry.id === id);
const texts = (entries) => entries.map((entry) => entry.text).join('\n');
const PAPER_SOURCE = {id: 'hnsw', kind: 'paper', title: 'HNSW', path: 'paper', url: null};
const CODE_SOURCE = {id: 'hnswlib', kind: 'code', title: null, path: 'src', url: null};
const OPEN = scene('hook', 'motion', ['A query walks a graph.']);
const route = (root, scenes, extra = {}) => analyzeRouting({subject: 'mixed', sourceRoot: '..', sources: [PAPER_SOURCE], scenes, ...extra}, {projectDir: path.join(root, 'video')});

test('sources are checked for shape, and each needs a kind and somewhere to read it', () => {
  const errors = [];
  assert.deepEqual(normalizeSources([{id: 'paper', kind: 'paper', url: 'https://arxiv.org/abs/1603.09320'}], errors), [{id: 'paper', kind: 'paper', title: null, path: null, url: 'https://arxiv.org/abs/1603.09320'}]);
  assert.deepEqual(errors, []);
  normalizeSources([{id: 'a', kind: 'novel', path: 'x'}, {id: 'b', kind: 'paper'}, {id: 'b', kind: 'topic'}], errors);
  assert.match(errors.join('\n'), /"kind" must be one of code, paper, design-doc, docs, topic/);
  assert.match(errors.join('\n'), /give "path"/);
  assert.match(errors.join('\n'), /duplicate id/);
});

test('a scene draws on the sources it names and the ones its files sit in, or else the only one', () => {
  const root = '/work';
  const both = [PAPER_SOURCE, CODE_SOURCE];
  const ids = (scene, sources = both) => sourcesOf(scene, sources, root).map((source) => source.id);
  assert.deepEqual(ids({file: 'src/search.py'}), ['hnswlib']);
  assert.deepEqual(ids({file: 'paper/main.tex'}), ['hnsw']);
  // A design doc's decision beside the code that carries it out draws on both.
  assert.deepEqual(ids({source: 'hnsw', file: 'src/search.py'}), ['hnsw', 'hnswlib']);
  assert.deepEqual(ids({source: ['hnsw', 'hnswlib'], kind: 'manim'}), ['hnsw', 'hnswlib']);
  assert.deepEqual(ids({kind: 'figure'}), []);
  assert.deepEqual(ids({kind: 'figure'}, [PAPER_SOURCE]), ['hnsw']);
  assert.deepEqual(ids({kind: 'figure'}, []), []);
  // The video's own toy example is drawn from no source, so no source's rules apply to it.
  assert.deepEqual(ids({kind: 'matrix', source: null}, [PAPER_SOURCE]), []);
});

test('a document is told apart into prose and code blocks', () => {
  const blocks = codeBlocks(PAPER, 'main.tex');
  assert.deepEqual(blocks.map((block) => [block.env, block.range]), [['algorithm', [11, 18]]]);
  assert.ok(proseShare(PAPER, 'main.tex', [3, 5]).share >= 0.5);
  assert.equal(proseShare(PAPER, 'main.tex', [12, 17]).prose, 0);
  const markdown = '# Design\n\nWe shard by tenant because a single tenant never outgrows one machine in practice.\n\n```go\nfunc shard(t Tenant) int { return hash(t) % n }\n```\n';
  assert.deepEqual(codeBlocks(markdown, 'design.md').map((block) => block.range), [[5, 7]]);
  assert.equal(proseShare(markdown, 'design.md', [5, 7]).prose, 0);
});

test('the inventory of a paper lists its figures with their files, its tables, its algorithms, and its sections', () => {
  const root = workspace();
  const found = inventory(PAPER_SOURCE, root);
  assert.deepEqual(found.figures.map((figure) => [figure.ref, figure.label, figure.caption, figure.paths]), [['Figure 1', 'fig:layers', 'The layers of the index.', ['paper/figs/layers.pdf']]]);
  assert.deepEqual(found.tables.map((table) => [table.ref, table.caption]), [['Table 1', 'Recall at ten.']]);
  assert.deepEqual(found.listings.map((listing) => [listing.env, listing.range]), [['algorithm', [11, 18]]]);
  assert.deepEqual(found.sections.map((section) => section.title), ['Introduction', 'Results']);
  assert.equal(inventory({...PAPER_SOURCE, path: 'missing'}, root).missing, true);
});

test("a paper's paragraph shown as code is an error; from a code source's docs it is only a review", () => {
  const root = workspace();
  const prose = scene('claim', 'trace', ['The paper puts the problem this way.'], {file: 'paper/main.tex', range: [3, 5], class: 'Claim'});
  const report = route(root, [OPEN, prose]);
  assert.equal(row(report, 'claim').status, 'error');
  assert.match(texts(row(report, 'claim').reasons), /are prose.*A paragraph on screen is read, not explained/);
  const asCode = route(root, [OPEN, prose], {sources: [{...CODE_SOURCE, path: 'paper'}]});
  assert.equal(row(asCode, 'claim').status, 'review');
  const overridden = route(root, [OPEN, {...prose, override: 'The exact wording of this definition is what the scene is about.'}]);
  assert.notEqual(row(overridden, 'claim').status, 'error');
});

test("a paper's algorithm block is not prose, but its LaTeX commands are pointed out", () => {
  const root = workspace();
  const report = route(root, [scene('alg', 'trace', ['Each layer narrows the search before the next one starts.'], {file: 'paper/main.tex', range: [13, 16], class: 'Alg'})]);
  assert.doesNotMatch(texts(row(report, 'alg').reasons), /prose/);
  assert.match(texts(row(report, 'alg').reasons), /LaTeX/);
});

test('evidence from a document says where in it, and names the scene that sets it up', () => {
  const root = workspace();
  const setup = scene('layers', 'motion', ['A query starts at the top layer and drops down.']);
  const bare = scene('fig', 'figure', ['This is how the layers look in the paper.'], {image: 'figures/layers.png', caption: 'The layers of the index', callouts: []});
  let reasons = texts(row(route(root, [setup, bare]), 'fig').reasons);
  assert.match(reasons, /but not where it says it/);
  assert.match(reasons, /Name that scene in "after"/);
  const placed = {...bare, caption: 'Figure 1: the layers of the index', after: 'layers'};
  reasons = texts(row(route(root, [setup, placed]), 'fig').reasons);
  assert.doesNotMatch(reasons, /where it says it|"after"/);
  // The same figure from a code source's README is not held to it.
  const fromCode = route(root, [setup, bare], {sources: [{...CODE_SOURCE, path: 'paper'}]});
  assert.doesNotMatch(texts(row(fromCode, 'fig').reasons), /"after"/);
});

test('evidence that shows a word before the scene that explains it is flagged', () => {
  const root = workspace();
  const chart = scene('recall', 'chart', ['It finds the right answer almost every time.'], {ref: 'Table 1', after: 'open', labels: ['Greedy layer', 'Flat graph'], values: [99, 90]});
  const report = route(root, [scene('open', 'motion', ['A query walks a graph.']), chart, scene('layers', 'motion', ['Now the layers.'])], {
    vocabulary: [{word: 'greedy layer', not: [], defined: 'layers'}],
  });
  assert.match(texts(row(report, 'recall').reasons), /shows "greedy layer" before "layers"/);
});

test("a results table from a paper marks the paper's own row", () => {
  const root = workspace();
  const table = scene('results', 'table', ['Against the baselines, it wins on recall.'], {ref: 'Table 1', after: 'open', columns: ['Method', 'Recall'], rows: [['HNSW', '0.99'], ['NSW', '0.90']]});
  assert.match(texts(row(route(root, [scene('open', 'motion', ['A query walks a graph.']), table]), 'results').reasons), /no row marked/);
  assert.doesNotMatch(texts(row(route(root, [scene('open', 'motion', ['A query walks a graph.']), {...table, best: 'HNSW'}]), 'results').reasons), /no row marked/);
});

test('across the video: no sources, a paper with no evidence shown, a slide deck, and a source never used', () => {
  const root = workspace();
  const scenes = [scene('open', 'motion', ['A query walks a graph.']), scene('more', 'motion', ['It drops a layer.']), scene('end', 'recap', ['Remember the layers.'])];
  const none = analyzeRouting({subject: 'mixed', scenes}, {});
  assert.match(texts(none.notes), /No "sources"/);
  const paperOnly = route(root, scenes);
  assert.match(texts(paperOnly.notes), /shows none of its evidence/);
  // Made only from a paper, there is no code to show and the router does not ask for any.
  assert.doesNotMatch(texts(paperOnly.notes), /No code scene/);
  const unused = route(root, scenes, {sources: [PAPER_SOURCE, CODE_SOURCE]});
  assert.match(texts(unused.notes), /"hnswlib" \(code\) is declared but no scene draws from it/);
  assert.match(formatRouting(unused), /Made from: hnsw \(paper, document rules\), hnswlib \(code\)/);
  const deck = route(root, [
    scene('open', 'motion', ['A query walks a graph.']),
    ...['a', 'b', 'c', 'd'].map((id) => scene(id, 'number', ['It is a lot faster than the flat graph on every dataset we tried.'], {ref: 'Table 1', after: 'open', metrics: [{value: '10', label: 'x'}]})),
  ]);
  assert.match(texts(deck.notes), /slide deck of the source/);
});

test('table, matrix, scatter, and a cropped figure are loaded in one shape, and "after" and "source" are checked', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'va-test-'));
  mkdirSync(path.join(dir, 'figures'));
  writeFileSync(path.join(dir, 'figures', 'f.png'), 'png');
  const load = (scenes, extra = {}) => {
    writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({sourceRoot: '.', sources: [{id: 'p', kind: 'paper', url: 'https://arxiv.org/abs/1'}], scenes, ...extra}));
    return loadStoryboard(projectPaths(dir)).storyboard.scenes;
  };
  const one = (fields) => load([{id: 's', why: 'w', beats: [{say: 'It does one thing well.'}], ...fields}])[0];
  const table = one({need: 'table', columns: ['Model', 'BLEU'], rows: [['Transformer', 28.4], ['ConvS2S', 25.2]], best: 'Transformer', highlight: 'BLEU'});
  assert.deepEqual([table.rows, table.best, table.highlight], [[['Transformer', '28.4'], ['ConvS2S', '25.2']], 'Transformer', ['BLEU']]);
  const matrix = one({need: 'matrix', rows: ['the', 'cat'], columns: ['the', 'cat'], values: [[0.9, 0.1], [0.3, 0.7]]});
  assert.deepEqual([matrix.scale, matrix.numbers], [[0, 0.9], true]);
  const scatter = one({need: 'chart', chart: 'scatter', axis: 'BLEU, higher is better', across: 'training cost, lower is better', points: [{x: 1, y: 28, label: 'Ours'}, {x: 8, y: 26, label: 'Theirs'}]});
  assert.deepEqual(scatter.series[0].points.map((point) => point.label), ['Ours', 'Theirs']);
  const figure = one({need: 'figure', image: 'figures/f.png', crop: {x: 0, y: 50, width: 50, height: 50}});
  assert.deepEqual(figure.crop, {x: 0, y: 50, width: 50, height: 50});

  const broken = (fields, pattern) => assert.throws(() => one(fields), pattern);
  broken({need: 'table', columns: ['Model', 'BLEU'], rows: [['A', 1], ['A', 2]]}, /first cell names it/);
  broken({need: 'table', columns: ['Model', 'BLEU'], rows: [['A', 1]], best: 'B'}, /"best" is "B", which names no row/);
  broken({need: 'table', columns: ['Model'], rows: [['A']]}, /two to five/);
  broken({need: 'matrix', rows: ['a', 'b'], columns: ['a', 'b'], values: [[1, 2]]}, /2 rows of 2 numbers/);
  broken({need: 'chart', chart: 'scatter', axis: 'y', points: [{x: 1, y: 2}, {x: 2, y: 1}]}, /"across"/);
  broken({need: 'figure', image: 'figures/f.png', crop: {x: 60, y: 0, width: 50, height: 50}}, /"crop"/);
  broken({need: 'figure', image: 'figures/f.png', source: 'nope'}, /"source" "nope" is not one of/);
  broken({need: 'figure', image: 'figures/f.png', source: ['p', 'p']}, /names a source twice/);
  assert.equal(one({need: 'figure', image: 'figures/f.png', source: ['p']}).source[0], 'p');
  assert.throws(() => load([{id: 'a', need: 'number', after: 'b', metrics: [{value: 1, label: 'x'}], beats: [{say: 'One.'}]}, {id: 'b', need: 'motion', class: 'B', beats: [{say: 'Two.'}]}]), /"after" is "b", which is not an earlier scene/);
});

const DESIGN = [
  '# Write path',
  '',
  'Every write goes through the leader, which appends it to its log before any follower sees it, so a reader never sees a write that could be lost.',
  '',
  '![The write path](write-path.png)',
  '',
].join('\n');

const designWorkspace = () => {
  const root = workspace();
  mkdirSync(path.join(root, 'design'));
  writeFileSync(path.join(root, 'design', 'rfc.md'), DESIGN);
  writeFileSync(path.join(root, 'design', 'write-path.png'), 'png');
  writeFileSync(path.join(root, 'src', 'leader.py'), 'def write(entry):\n    log.append(entry)\n    replicate(entry)\n');
  return root;
};
const RFC = {id: 'rfc', kind: 'design-doc', title: 'Write path RFC', path: 'design', url: null};
const SVC = {id: 'svc', kind: 'code', title: null, path: 'src', url: null};
const twoSources = (root, scenes) => analyzeRouting({subject: 'mixed', sourceRoot: '..', sources: [RFC, SVC], scenes}, {projectDir: path.join(root, 'video')});

test('with a design doc and its code, every scene says which it draws on', () => {
  const root = designWorkspace();
  const silent = scene('flow', 'motion', ['A write reaches the leader first.']);
  let reasons = texts(row(twoSources(root, [OPEN, silent]), 'flow').reasons);
  assert.match(reasons, /draws on 2 sources \(rfc: design-doc, svc: code\)\. Say which this scene draws on/);
  const own = {...silent, source: null};
  assert.doesNotMatch(texts(row(twoSources(root, [OPEN, own]), 'flow').reasons), /Say which/);
  // A file says where it is from, but the scene is still asked whether that is all it rests on.
  const traced = scene('append', 'trace', ['The leader appends before it replicates.'], {file: 'src/leader.py', class: 'Append'});
  assert.match(texts(row(twoSources(root, [OPEN, traced]), 'append').reasons), /Its file is in "svc"; is that all it rests on\?/);
});

test("a scene that sets the doc's decision beside the code says where the doc says it", () => {
  const root = designWorkspace();
  const both = scene('append', 'trace', ['The RFC says writes go through the leader, and this is the line that does it.'], {file: 'src/leader.py', class: 'Append', source: ['rfc', 'svc']});
  const report = twoSources(root, [OPEN, both]);
  assert.deepEqual(row(report, 'append').sources, ['rfc', 'svc']);
  assert.match(texts(row(report, 'append').reasons), /sets what "rfc" says beside the code in "svc"\. Say where the document says it/);
  assert.match(formatRouting(report), /from rfc \+ svc/);
  // The code half is code: it is not held to the prose rule, and with a ref the pair is settled.
  const located = texts(row(twoSources(root, [OPEN, {...both, ref: 'Section: Write path'}]), 'append').reasons);
  assert.doesNotMatch(located, /prose|Say where|Say which/);
  // A scene that names only the doc but quotes the code is told to list both.
  assert.match(texts(row(twoSources(root, [OPEN, {...both, source: 'rfc'}]), 'append').reasons), /leaves "svc" out/);
});

test("each quoted file is held to its own source's rules, and a doc's own figure is preferred to a redrawn one", () => {
  const root = designWorkspace();
  const prose = scene('claim', 'trace', ['The RFC puts the rule in one sentence.'], {file: 'design/rfc.md', range: [3, 3], class: 'Claim', source: ['rfc', 'svc']});
  assert.equal(row(twoSources(root, [OPEN, prose]), 'claim').status, 'error');
  const redrawn = scene('path', 'structure', ['The client, the leader, and two followers.'], {source: 'rfc'});
  assert.match(texts(row(twoSources(root, [OPEN, redrawn]), 'path').reasons), /"rfc" draws 1 figure\(s\) of its own/);
  assert.doesNotMatch(texts(row(twoSources(root, [OPEN, {...redrawn, ref: 'Image 1, redrawn larger'}]), 'path').reasons), /of its own/);
});

test("in a paper project, code on screen is an error unless the scene draws on the paper's released code", () => {
  const root = workspace();
  mkdirSync(path.join(root, 'video', 'paper'), {recursive: true});
  writeFileSync(path.join(root, 'video', 'paper', 'paper.json'), JSON.stringify({title: 'HNSW', claims: [{n: 1, text: 'Search is fast.'}], sections: [], figures: [], tables: []}));
  const traced = scene('step', 'trace', ['This line drops to the next layer.'], {file: 'src/search.py', class: 'Step'});
  const paperOnly = analyzeRouting({subject: 'mixed', sourceRoot: '..', scenes: [OPEN, traced]}, {projectDir: path.join(root, 'video')});
  assert.equal(row(paperOnly, 'step').status, 'error');
  assert.match(formatRouting(paperOnly), /Made from: paper \(paper, document rules\)/);
  const withCode = analyzeRouting({subject: 'mixed', sourceRoot: '..', sources: [PAPER_SOURCE, CODE_SOURCE], scenes: [OPEN, {...traced, source: 'hnswlib'}]}, {projectDir: path.join(root, 'video')});
  assert.notEqual(row(withCode, 'step').status, 'error', texts(row(withCode, 'step').reasons));
});
