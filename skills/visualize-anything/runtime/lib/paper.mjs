// A paper, once `va paper` has read it into the project. The abstract is the authors' own account
// of what the paper is for and which results matter, so the storyboard is held to it: every claim
// of the abstract is either shown by a scene or set aside with a reason, every number it states is
// said or shown, and a number the storyboard says comes from the paper has to be in the paper.
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {authoredText, numbersIn, sameValue} from './facts.mjs';

const MIN_REASON = 12; // setting a claim aside takes an actual reason

/** The ingested paper of a project, or null when it is not a paper project. */
export const loadPaper = (projectDir) => {
  const file = projectDir ? path.join(projectDir, 'paper', 'paper.json') : null;
  if (!file || !existsSync(file)) return null;
  try {
    const paper = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(paper.claims) ? paper : null;
  } catch {
    return null;
  }
};

/** Check the storyboard's "claims" for shape: what the video does with each claim of the abstract. */
export const normalizeClaims = (raw, sceneIds, errors) => {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push('"claims" must be a list of {"abstract": n, "scene": "<scene id>"} or {"abstract": n, "omit": "<why>"}.');
    return [];
  }
  const seen = new Set();
  const out = [];
  raw.forEach((entry, index) => {
    const where = `claim ${index + 1}`;
    if (!entry || !Number.isInteger(entry.abstract) || entry.abstract < 1) return errors.push(`${where}: "abstract" is the number of the claim in the paper's abstract (paper/paper.md lists them), counted from 1.`);
    if (seen.has(entry.abstract)) return errors.push(`${where}: claim ${entry.abstract} of the abstract is accounted for twice.`);
    seen.add(entry.abstract);
    const shown = typeof entry.scene === 'string' && entry.scene.trim();
    const set = typeof entry.omit === 'string' && entry.omit.trim();
    if (Boolean(shown) === Boolean(set)) return errors.push(`${where}: give "scene" (the scene that shows this claim) or "omit" (why the video leaves it out), one or the other.`);
    if (shown && !sceneIds.includes(entry.scene)) return errors.push(`${where}: "scene" "${entry.scene}" is not a scene.`);
    if (set && set.length < MIN_REASON) return errors.push(`${where}: "omit" says why the claim is left out, as a phrase.`);
    out.push({abstract: entry.abstract, scene: shown ? entry.scene : null, omit: set || null});
  });
  return out;
};

const short = (text, most = 90) => (text.length > most ? `${text.slice(0, most - 3).trimEnd()}...` : text);

/** Every number in the paper: its abstract, its sections, its captions, and the cells of its tables. */
export const paperNumbers = (paper) => {
  // A citation marker ("[ 13 ]") is a pointer, not a measurement, and a reference list is page ranges and
  // volume numbers. Neither may vouch for a number; the years in the reference list may, since "2019" is
  // how a video dates the work a paper builds on.
  const prose = (body) => String(body || '').replace(/\[\s*\d+(?:\s*[,;–-]\s*\d+)*\s*\]/g, ' ');
  const sections = paper.sections || [];
  const text = [
    paper.abstract,
    ...sections.filter((section) => section.kind !== 'references').map((section) => prose(section.text)),
    ...(paper.figures || []).map((figure) => prose(figure.caption)),
    ...(paper.tables || []).flatMap((table) => [table.caption, ...(table.columns || []), ...(table.rows || []).flat()].map(prose)),
  ].filter(Boolean);
  const found = new Set();
  for (const section of sections.filter((entry) => entry.kind === 'references')) {
    for (const year of String(section.text).match(/\b(?:19|20)\d{2}\b/g) || []) found.add(Number(year));
  }
  // A cell is read on its own, so "13" and "14" in neighbouring cells stay two numbers.
  for (const piece of text) for (const number of numbersIn(piece)) found.add(number.value);
  return [...found];
};

/**
 * What a storyboard has not yet squared with the paper it is about. Each list is empty when all is well.
 *   unaccounted  claims of the abstract with no scene and no reason for leaving them out
 *   unknown      entries of "claims" that name a claim the abstract does not have
 *   unsaid       numbers the abstract states that the video neither says nor shows
 *   notInPaper   facts marked "given" whose number is nowhere in the paper
 */
export const paperFindings = (storyboard, paper) => {
  const accounted = new Map((storyboard.claims || []).map((entry) => [entry.abstract, entry]));
  const unaccounted = paper.claims.filter((claim) => !accounted.has(claim.n)).map((claim) => ({n: claim.n, text: short(claim.text)}));
  const unknown = [...accounted.keys()].filter((n) => !paper.claims.some((claim) => claim.n === n));

  const voiced = authoredText(storyboard).flatMap((entry) => numbersIn(entry.text).map((number) => number.value));
  const said = (value) => voiced.some((other) => other === value || sameValue(other, value) || sameValue(value, other));
  const unsaid = [];
  for (const claim of paper.claims) {
    const entry = accounted.get(claim.n);
    if (entry?.omit) continue; // a claim set aside takes its numbers with it
    for (const number of numbersIn(claim.text)) {
      if (!said(number.value) && !unsaid.some((seen) => seen.value === number.value)) unsaid.push({value: number.value, text: number.text, claim: claim.n});
    }
  }

  const inPaper = paperNumbers(paper);
  const notInPaper = (storyboard.facts || [])
    .filter((fact) => fact.given && typeof fact.value === 'number')
    .filter((fact) => !inPaper.some((value) => value === fact.value || sameValue(fact.value, value)))
    .map((fact) => ({id: fact.id, value: fact.value}));
  return {unaccounted, unknown, unsaid, notInPaper, shown: [...accounted.values()].filter((entry) => entry.scene).length, omitted: [...accounted.values()].filter((entry) => entry.omit).length};
};
