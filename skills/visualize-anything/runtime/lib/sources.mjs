// What a video is made from. Recognised once, at the brief, and carried through every later step:
// the router applies the rules for a document (a paper, a design doc, documentation) to the scenes
// drawn from one, and leaves scenes drawn from code to the rules for code.
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';

/** The kinds of material a video can be made from. A document's claims are its own; code's are what it does. */
export const SOURCE_KINDS = {
  code: {document: false, says: 'a repository, a file, or a function: what it does is the evidence'},
  paper: {document: true, says: 'a research paper: its claims, its figures, its tables, its algorithms'},
  'design-doc': {document: true, says: 'a design document, RFC, ADR, or specification: its decisions and the reasons for them'},
  docs: {document: true, says: 'documentation, a README, or a technical article'},
  topic: {document: false, says: 'general knowledge with no single source to quote'},
};

export const isDocument = (source) => Boolean(source && SOURCE_KINDS[source.kind]?.document);

// Files whose lines are prose unless they sit inside a code block.
const PROSE_EXT = ['.tex', '.md', '.markdown', '.mdx', '.txt', '.rst', '.adoc', '.org', '.html', '.htm'];
export const isProseFile = (file) => PROSE_EXT.includes(path.extname(String(file)).toLowerCase());

// LaTeX environments that hold code or an algorithm rather than prose.
const TEX_CODE = ['algorithm', 'algorithmic', 'algorithm2e', 'algorithmicx', 'lstlisting', 'verbatim', 'Verbatim', 'minted', 'alltt', 'code', 'listing', 'program', 'pseudocode'];
const TEX_BEGIN = new RegExp(`\\\\begin\\{(${TEX_CODE.join('|')})\\*?\\}`);

/**
 * LaTeX with its comments blanked out, line for line: a `%` to the end of its line (unless escaped),
 * and everything between \iffalse and \fi. Papers keep old figures and tables in comments; they
 * are not part of what the paper says.
 */
export const uncommented = (text) => {
  let hidden = false;
  return String(text)
    .split('\n')
    .map((line) => {
      if (hidden) {
        if (/^\s*\\fi\b/.test(line)) hidden = false;
        return '';
      }
      if (/^\s*\\iffalse\b/.test(line)) {
        hidden = true;
        return '';
      }
      return line.replace(/(^|[^\\])%.*$/, '$1');
    })
    .join('\n');
};

/** Line ranges (1-based, inclusive) of the code blocks in a document: LaTeX listings and algorithms, Markdown fences. */
export const codeBlocks = (text, file) => {
  const ext = path.extname(String(file)).toLowerCase();
  const lines = String(ext === '.tex' ? uncommented(text) : text).split('\n');
  const blocks = [];
  if (ext === '.tex') {
    let open = null;
    lines.forEach((line, index) => {
      if (open === null) {
        const begin = line.match(TEX_BEGIN);
        if (begin) open = {env: begin[1], start: index + 1};
      } else if (new RegExp(`\\\\end\\{${open.env}\\*?\\}`).test(line)) {
        blocks.push({env: open.env, range: [open.start, index + 1]});
        open = null;
      }
    });
  } else {
    let open = null;
    lines.forEach((line, index) => {
      const fence = line.match(/^\s*(```+|~~~+)/);
      if (!fence) return;
      if (open === null) open = {fence: fence[1][0], start: index + 1, lang: line.trim().slice(fence[1].length).trim() || null};
      else if (fence[1][0] === open.fence) {
        blocks.push({env: open.lang || 'code', range: [open.start, index + 1]});
        open = null;
      }
    });
  }
  return blocks;
};

const isComment = (line, ext) => (ext === '.tex' ? /^\s*%/.test(line) : ext === '.html' || ext === '.htm' ? /^\s*<!--/.test(line) : false);

/**
 * How much of an excerpt of a document is prose: lines with words on them that sit outside every
 * code block. A paragraph of a paper shown as code is read, not explained.
 */
export const proseShare = (text, file, [start, end]) => {
  const ext = path.extname(String(file)).toLowerCase();
  const lines = String(text).split('\n');
  const blocks = codeBlocks(text, file);
  const inCode = (number) => blocks.some(({range: [a, b]}) => number >= a && number <= b);
  let prose = 0;
  let counted = 0;
  let longest = 0;
  for (let number = start; number <= end && number <= lines.length; number += 1) {
    const line = lines[number - 1];
    if (!line.trim() || isComment(line, ext)) continue;
    counted += 1;
    longest = Math.max(longest, line.length);
    // A line of prose: several plain words in a row, and not a line of markup alone.
    const words = (line.replace(/\\[a-zA-Z]+(\[[^\]]*\])?(\{[^}]*\})?/g, ' ').match(/\b[A-Za-z]{2,}\b/g) || []).length;
    if (!inCode(number) && words >= 6) prose += 1;
  }
  const macros = String(lines.slice(start - 1, end).join('\n')).match(/\\[a-zA-Z]{2,}/g) || [];
  return {prose, counted, share: counted ? prose / counted : 0, longest, macros: macros.length, inCode: counted > 0 && prose === 0 && inCode(start)};
};

/** Check the storyboard's `sources` and return them in one shape. */
export const normalizeSources = (raw, errors) => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    errors.push('"sources" must be a list of {"id", "kind", "title", "path", "url"}: what the video is made from.');
    return [];
  }
  const seen = new Set();
  return raw.map((entry, index) => {
    const where = `source ${index + 1}${entry?.id ? ` ("${entry.id}")` : ''}`;
    if (!entry || typeof entry !== 'object') {
      errors.push(`${where}: must be {"id", "kind", "title", "path", "url"}.`);
      return null;
    }
    if (typeof entry.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.id)) errors.push(`${where}: "id" must be kebab-case.`);
    else if (seen.has(entry.id)) errors.push(`${where}: duplicate id.`);
    seen.add(entry.id);
    if (!SOURCE_KINDS[entry.kind]) errors.push(`${where}: "kind" must be one of ${Object.keys(SOURCE_KINDS).join(', ')}.`);
    if (entry.kind !== 'topic' && !entry.path && !entry.url) errors.push(`${where}: give "path" (where it is on disk, relative to "sourceRoot") or "url" (where it can be read).`);
    return {id: entry.id, kind: entry.kind, title: typeof entry.title === 'string' ? entry.title : null, path: entry.path || null, url: entry.url || null};
  }).filter(Boolean);
};

const inside = (child, parent) => {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

/** The files a scene quotes: its own, and each version's in a code change. */
export const filesOf = (scene) => [scene.file, ...(scene.versions || []).map((version) => version.file)].filter(Boolean);

/** The source a file sits in, by its `path`; null when no source holds it. `root` is the absolute sourceRoot. */
export const ownerOf = (file, sources, root) =>
  (root && sources.find((source) => source.path && inside(path.resolve(root, file), path.resolve(root, source.path)))) || null;

/** The ids a scene names in `source`: one id or a list of them. Empty for `null` or nothing named. */
export const namedSources = (scene) => (scene.source === undefined || scene.source === null ? [] : [scene.source].flat());

/**
 * The sources a scene draws on. A scene can draw on several at once: a design doc's decision beside
 * the code that carries it out. They are the ones it names, together with the ones its quoted files
 * sit in; with nothing named and no file, the only source there is. Empty for the video's own
 * picture (`"source": null`: a toy example, an animation of the idea) or when it cannot be told.
 */
export const sourcesOf = (scene, sources, root) => {
  if (!sources.length || scene.source === null) return [];
  const named = namedSources(scene);
  const owners = filesOf(scene).map((file) => ownerOf(file, sources, root)).filter(Boolean);
  const drawn = sources.filter((source) => named.includes(source.id) || owners.includes(source));
  if (drawn.length || named.length) return drawn;
  return sources.length === 1 ? [sources[0]] : [];
};

// ---------------------------------------------------------------------------------------------
// What a document holds: its figures, tables, listings, and sections, with where each one is.

const TEXT_FILES = ['.tex', '.md', '.markdown', '.mdx', '.rst', '.txt', '.adoc'];
const SKIP_DIRS = new Set(['node_modules', '.git', '.cache', 'out', 'public']);

const filesUnder = (dir, depth = 0) => {
  if (depth > 4) return [];
  return readdirSync(dir).sort().flatMap((name) => {
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) return SKIP_DIRS.has(name) ? [] : filesUnder(full, depth + 1);
    return [full];
  });
};

/** The argument of a LaTeX command, with balanced braces: `\caption{A {nested} caption}`. */
const braced = (text, from) => {
  const open = text.indexOf('{', from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return null;
};

const plainTex = (text) =>
  String(text || '')
    .replace(/\\(textbf|textit|emph|texttt|mathrm|mathbf|text)\{([^{}]*)\}/g, '$2')
    .replace(/\\(cite|ref|label|eqref|citep|citet)\{[^}]*\}/g, '')
    .replace(/\\[a-zA-Z]+\*?/g, '')
    .replace(/[{}~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** A LaTeX file's figures, tables, listings, and sections, numbered in the order they appear. */
const texInventory = (raw, file, counters) => {
  const found = {figures: [], tables: [], listings: [], sections: []};
  const text = uncommented(raw);
  // Every captioned figure and table, in the order they appear: floats, and \captionof{...} used
  // outside a float (a teaser figure under the title). Numbered afterwards, in page order.
  const entries = [];
  const floats = [];
  for (const match of text.matchAll(/\\begin\{(figure|table|wrapfigure|wraptable)\*?\}([\s\S]*?)\\end\{\1\*?\}/g)) {
    const body = match[2];
    const kind = match[1].endsWith('figure') ? 'figure' : 'table';
    const range = [lineOf(text, match.index), lineOf(text, match.index + match[0].length)];
    floats.push([match.index, match.index + match[0].length]);
    const images = [...body.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/g)].map((image) => image[1]);
    // Each \caption numbers one float; \captionof{figure}{...} inside a minipage numbers one of that kind,
    // so a table* holding a table and a figure side by side is both.
    const captions = [...body.matchAll(/\\caption(of)?\*?/g)].map((hit) => {
      if (!hit[1]) return {kind, caption: plainTex(braced(body, hit.index)), at: hit.index};
      const type = braced(body, hit.index);
      const close = body.indexOf('}', body.indexOf('{', hit.index)) + 1;
      return {kind: type === 'figure' ? 'figure' : 'table', caption: plainTex(braced(body, close)), at: hit.index};
    });
    if (!captions.length) captions.push({kind, caption: null, at: 0});
    const labels = [...body.matchAll(/\\label\{([^}]*)\}/g)];
    captions.forEach((entry, index) => {
      const next = captions[index + 1]?.at ?? body.length;
      const label = labels.find((hit) => hit.index > entry.at && hit.index < next)?.[1] || (captions.length === 1 ? labels[0]?.[1] : null) || null;
      entries.push({pos: match.index + entry.at, kind: entry.kind, caption: entry.caption, label, images: captions.length === 1 ? images : [], range});
    });
  }
  for (const hit of text.matchAll(/\\captionof\{(figure|table)\}/g)) {
    if (floats.some(([from, to]) => hit.index >= from && hit.index < to)) continue;
    const close = hit.index + hit[0].length;
    // The picture it captions is the \includegraphics just before it.
    const before = text.slice(Math.max(0, hit.index - 800), hit.index);
    const images = hit[1] === 'figure' ? [...before.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]*)\}/g)].slice(-1).map((image) => image[1]) : [];
    const after = text.slice(close, close + 1500);
    const line = lineOf(text, hit.index);
    entries.push({pos: hit.index, kind: hit[1], caption: plainTex(braced(text, close)), label: after.match(/^[\s\S]{0,1200}?\\label\{([^}]*)\}/)?.[1] || null, images, range: [Math.max(1, line - 1), line]});
  }
  for (const entry of entries.sort((a, b) => a.pos - b.pos)) {
    if (entry.kind === 'figure') {
      counters.figure += 1;
      found.figures.push({ref: `Figure ${counters.figure}`, label: entry.label, caption: entry.caption, images: entry.images, file, range: entry.range});
    } else {
      counters.table += 1;
      found.tables.push({ref: `Table ${counters.table}`, label: entry.label, caption: entry.caption, file, range: entry.range});
    }
  }
  for (const block of codeBlocks(text, file)) found.listings.push({env: block.env, file, range: block.range});
  for (const match of text.matchAll(/\\(section|subsection)\*?\{/g)) {
    found.sections.push({title: plainTex(braced(text, match.index)), depth: match[1] === 'section' ? 1 : 2, file, line: lineOf(text, match.index)});
  }
  return found;
};

/** A Markdown-like file's images, tables, code blocks, and headings. */
const markdownInventory = (text, file, counters) => {
  const found = {figures: [], tables: [], listings: [], sections: []};
  const lines = text.split('\n');
  const blocks = codeBlocks(text, file);
  const inCode = (number) => blocks.some(({range: [a, b]}) => number >= a && number <= b);
  let table = null;
  lines.forEach((line, index) => {
    const number = index + 1;
    if (inCode(number)) return;
    for (const image of line.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)) {
      counters.figure += 1;
      found.figures.push({ref: `Image ${counters.figure}`, label: null, caption: image[1] || null, images: [image[2]], file, range: [number, number]});
    }
    const heading = line.match(/^(#{1,3})\s+(.*)/);
    if (heading) found.sections.push({title: heading[2].trim(), depth: heading[1].length, file, line: number});
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (!table) table = {start: number};
      table.end = number;
    } else if (table) {
      counters.table += 1;
      found.tables.push({ref: `Table ${counters.table}`, label: null, caption: null, file, range: [table.start, table.end]});
      table = null;
    }
  });
  if (table) {
    counters.table += 1;
    found.tables.push({ref: `Table ${counters.table}`, label: null, caption: null, file, range: [table.start, table.end]});
  }
  for (const block of blocks) found.listings.push({env: block.env, file, range: block.range});
  return found;
};

/**
 * Everything a document source holds that a scene might show, with where it is. For a paper read
 * from its arXiv source this is its figures (and the image files behind them), its tables, its
 * algorithms and code listings, and its sections; for a PDF alone, only that it is a PDF.
 */
export const inventory = (source, root) => {
  const empty = {figures: [], tables: [], listings: [], sections: [], files: [], pdf: null, missing: false};
  if (!source.path) return empty;
  const where = path.resolve(root, source.path);
  if (!existsSync(where)) return {...empty, missing: true};
  if (statSync(where).isFile() && path.extname(where).toLowerCase() === '.pdf') return {...empty, pdf: where};
  const files = statSync(where).isFile() ? [where] : filesUnder(where);
  const counters = {figure: 0, table: 0};
  const found = {...empty, files: files.map((file) => path.relative(root, file))};
  // Files are read in the order the paper prints them: its main file, with each \input or \include
  // in place, so figures and tables are numbered as the paper numbers them.
  const texts = files.filter((file) => TEXT_FILES.includes(path.extname(file).toLowerCase()));
  const ordered = [];
  // LaTeX resolves \input paths from the main file's folder, wherever the \input is written.
  const visit = (file, home = path.dirname(file)) => {
    if (ordered.includes(file)) return;
    ordered.push(file);
    if (path.extname(file).toLowerCase() !== '.tex') return;
    for (const match of uncommented(readFileSync(file, 'utf8')).matchAll(/\\(?:input|include|subfile)\{([^}]*)\}/g)) {
      const names = [path.resolve(home, match[1]), path.resolve(path.dirname(file), match[1])];
      const hit = names.flatMap((name) => [name, `${name}.tex`]).find((candidate) => texts.includes(candidate));
      if (hit) visit(hit, home);
    }
  };
  const mains = texts.filter((candidate) => /\\begin\{document\}/.test(uncommented(readFileSync(candidate, 'utf8'))));
  for (const file of mains) visit(file);
  // A .tex file the paper never includes is a draft left in the archive, not part of the paper.
  for (const file of texts) if (!ordered.includes(file) && !(mains.length && path.extname(file).toLowerCase() === '.tex')) ordered.push(file);
  for (const file of ordered) {
    const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const relative = path.relative(root, file);
    const part = path.extname(file).toLowerCase() === '.tex' ? texInventory(text, relative, counters) : markdownInventory(text, relative, counters);
    for (const key of ['figures', 'tables', 'listings', 'sections']) found[key].push(...part[key]);
  }
  // Each figure's images, found on disk: LaTeX leaves the extension off, and graphics live in subfolders.
  const base = statSync(where).isFile() ? path.dirname(where) : where;
  for (const figure of found.figures) {
    figure.paths = figure.images.map((image) => {
      if (/^https?:/.test(image)) return image;
      const candidates = [image, ...['.pdf', '.png', '.jpg', '.jpeg', '.eps', '.svg'].map((ext) => `${image}${ext}`)];
      const hit = candidates.map((candidate) => path.resolve(base, candidate)).find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
      return hit ? path.relative(root, hit) : null;
    });
  }
  // Source files that are code, shipped beside the paper: the real thing to quote.
  found.code = found.files.filter((file) => /\.(py|c|cc|cpp|h|hpp|js|ts|go|rs|java|jl|m|mlir|td|sh|cu)$/i.test(file));
  return found;
};

/** Where a reference names a figure, table, section, or the abstract: "Table 2", "Fig. 3", "§4.1". */
export const REF_PATTERN = /(^|[^a-z])(fig(ure)?s?\.?|tables?|tab\.|sections?|sec\.|§|abstract|algorithms?|alg\.|listings?|eq(uation)?s?\.?|appendix|page|p\.|chapter|slide)(?![a-z])/i;
