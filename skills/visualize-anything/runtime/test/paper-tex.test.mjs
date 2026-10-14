import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

// The LaTeX reader in paper.py recovers tables the arXiv HTML edition lost. Papers lay tables out in
// many ways; each case here is one LaTeX numbers in its own way, and the reader must number it the same.
const PAPER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'python', 'paper.py');
const TEX = String.raw`
\begin{table}\caption{Main results}\begin{tabular}[t]{lcc}\toprule A & B & C\\ \midrule x & 1.0 & \makecell{2\\3}\\ \bottomrule\end{tabular}\end{table}
\begin{table}\begin{subtable}{.5\linewidth}\caption{part a}\begin{tabular}{cc}p&q\\1&2\end{tabular}\end{subtable}\begin{subtable}{.5\linewidth}\caption{part b}\begin{tabular}{cc}r&s\\3&4\end{tabular}\end{subtable}\caption{Two parts}\end{table}
\begin{table}\caption*{unnumbered}\begin{tabular}{cc}a&b\\1&2\end{tabular}\end{table}
\begin{figure}\captionof{figure}{a figure}\end{figure}
\begin{minipage}{.4\linewidth}\captionof{table}{Side table}\begin{tabular}{cc}m&n\\5&6\end{tabular}\end{minipage}
\begin{longtable}{lc}\caption{Long one}\\ \toprule k & v\\ \endfirsthead \caption{Long one (cont.)}\\ \endhead a & 7\\ b & 8\\ \end{longtable}
\begin{table*}\caption{Wide}\begin{tabularx}{\textwidth}{XX} w1 & w2\\ 9 & 10\\\end{tabularx}\end{table*}
`;
const SCRIPT = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("paper", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print(json.dumps(m.source_tables(sys.stdin.read())))
`;

const uv = spawnSync('uv', ['--version']);
test('LaTeX tables are numbered as LaTeX numbers them, with their rows', {skip: uv.status !== 0 && 'uv is not installed'}, () => {
  const run = spawnSync('uv', ['run', '--quiet', '--python', '3.12', '--with', 'beautifulsoup4', '--with', 'lxml', '--with', 'pymupdf', 'python', '-c', SCRIPT, PAPER], {input: TEX, encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
  const tables = JSON.parse(run.stdout.trim().split('\n').at(-1));
  assert.deepEqual(tables.map((table) => table.caption), ['Main results', 'Two parts', 'Side table', 'Long one', 'Wide']);
  // A line break inside one cell is not a new row; a table with two subtables is one table holding both.
  assert.deepEqual(tables[0].rows, [['A', 'B', 'C'], ['x', '1.0', '2 3']]);
  assert.deepEqual(tables[1].rows, [['p', 'q'], ['1', '2'], ['r', 's'], ['3', '4']]);
  assert.deepEqual(tables[3].rows, [['k', 'v'], ['a', '7'], ['b', '8']]);
  assert.deepEqual(tables[4].rows, [['w1', 'w2'], ['9', '10']]);
});
