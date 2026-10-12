// The prose check. A script reads well to the agent that wrote it; Vale reads it as rules do. Every
// video's script.md is run through two published rule packages: proselint (the advice of working
// editors: clichés, redundancy, hedging, mixed metaphors) and ai-tells (the phrasings that mark
// machine-written prose). Vale is pinned and its release checksum verified, the packages are pinned
// by release URL, and everything lives under VA_HOME, so no project carries a copy of the rules.

import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {VA_HOME, fail, run} from './util.mjs';

export const VALE_VERSION = '3.24.0';
const VALE_DIR = path.join(VA_HOME, 'vendor', 'vale', VALE_VERSION);
export const VALE_BIN = process.env.VA_VALE || path.join(VALE_DIR, process.platform === 'win32' ? 'vale.exe' : 'vale');
// Where the configuration and the synced rule packages live.
export const VALE_HOME = path.join(VA_HOME, 'vale');
const VALE_INI = path.join(VALE_HOME, '.vale.ini');

// The rule packages, each pinned to the release it was checked against.
export const VALE_PACKAGES = {
  proselint: 'https://github.com/vale-cli/proselint/releases/download/v0.3.4/proselint.zip',
  'ai-tells': 'https://github.com/tbhb/vale-ai-tells/releases/download/v1.37.0/ai-tells.zip',
};

// Vale's own release archives, by platform, with the SHA-256 its release publishes for each.
const VALE_ASSETS = {
  'darwin-arm64': ['macOS_arm64.tar.gz', '87b513f26499f6657c15cf7175ba5b058a7c1ff2bb2d4e07265db2dd43451e44'],
  'darwin-x64': ['macOS_64-bit.tar.gz', 'eeb39e86f1daac27cc2a77fef3af1824d50559bdc22329fb25fb921c80c79472'],
  'linux-arm64': ['Linux_arm64.tar.gz', '104cbd349279e50c4cb40adb70adf345d93cc4a3a0191f9e68bdccb97086b582'],
  'linux-x64': ['Linux_64-bit.tar.gz', '867534ddb678abca7f214bc4706ead0922bd5252ffe8035fc227013f66c8b214'],
};

const INI = [
  '# Written by `va setup`. The narration of every video is checked against these two packages.',
  'StylesPath = styles',
  'MinAlertLevel = suggestion',
  `Packages = ${Object.values(VALE_PACKAGES).join(', ')}`,
  '',
  '[*.md]',
  `BasedOnStyles = ${Object.keys(VALE_PACKAGES).join(', ')}`,
  '',
].join('\n');

const packagesSynced = () => Object.keys(VALE_PACKAGES).every((name) => existsSync(path.join(VALE_HOME, 'styles', name)));

/** Whether Vale and both rule packages are in place. */
export const valeReady = () => existsSync(VALE_BIN) && existsSync(VALE_INI) && readFileSync(VALE_INI, 'utf8') === INI && packagesSynced();

/** Fetch the pinned Vale, verify it against its published checksum, and sync the rule packages. */
export const installVale = async () => {
  if (!existsSync(VALE_BIN)) {
    if (process.env.VA_VALE) fail(`VA_VALE points at ${VALE_BIN}, which does not exist.`);
    const asset = VALE_ASSETS[`${process.platform}-${process.arch}`];
    if (!asset) fail(`No pinned Vale build for ${process.platform}-${process.arch}. Install Vale ${VALE_VERSION} yourself (https://vale.sh/docs/install) and set VA_VALE to its path.`);
    const [suffix, sha256] = asset;
    const name = `vale_${VALE_VERSION}_${suffix}`;
    const archive = path.join(VALE_DIR, name);
    mkdirSync(VALE_DIR, {recursive: true});
    await run('curl', ['-fsSL', '-o', archive, `https://github.com/vale-cli/vale/releases/download/v${VALE_VERSION}/${name}`]);
    const found = createHash('sha256').update(readFileSync(archive)).digest('hex');
    if (found !== sha256) fail(`${name} does not match its published checksum (expected ${sha256}, found ${found}). Nothing was installed.`);
    await run('tar', ['-xzf', archive, '-C', VALE_DIR, 'vale']);
  }
  mkdirSync(VALE_HOME, {recursive: true});
  writeFileSync(VALE_INI, INI);
  await run(VALE_BIN, ['--config', VALE_INI, 'sync'], {cwd: VALE_HOME, capture: true});
  if (!packagesSynced()) fail(`\`vale sync\` ran but ${Object.keys(VALE_PACKAGES).join(' and ')} are not both under ${path.join(VALE_HOME, 'styles')}.`);
};

/** Vale's JSON report for one file, as findings in the order they occur. */
export const parseVale = (stdout) => {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
  return Object.values(report)
    .flat()
    .map((alert) => ({
      line: alert.Line,
      column: Array.isArray(alert.Span) ? alert.Span[0] : 1,
      rule: alert.Check,
      severity: alert.Severity,
      message: alert.Message,
      match: alert.Match || '',
    }))
    .sort((a, b) => a.line - b.line || a.column - b.column);
};

/**
 * Where in the storyboard a finding is: the one beat that says the line of the script it is on.
 * `lines` are the script's lines; a finding on a line no single beat can be found in keeps only its line number.
 */
export const locate = (finding, lines, storyboard) => {
  const said = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const line = said(lines[finding.line - 1] || '');
  const match = said(finding.match);
  if (!line || !match) return null;
  const hits = [];
  for (const scene of storyboard?.scenes || []) {
    scene.beats.forEach((beat, index) => {
      const words = said(beat.say);
      if (words && line.includes(words) && words.includes(match)) hits.push({scene: scene.id, beat: index + 1});
    });
  }
  return hits.length === 1 ? hits[0] : null;
};

/** Run Vale over a script. Returns the findings; fails if Vale is not installed or did not run. */
export const lintProse = async (file) => {
  if (!valeReady()) fail('Vale is not installed, or its rule packages are not synced. Run `va setup`. The narration is checked against proselint and ai-tells before anything is built.');
  const result = await run(VALE_BIN, ['--config', VALE_INI, '--output', 'JSON', '--no-exit', file], {capture: true, allowFail: true});
  const findings = parseVale(result.stdout);
  if (!findings) fail(`Vale did not return a report for ${file}.\n${(result.stderr || result.stdout).trim().split('\n').slice(-10).join('\n')}`);
  return findings;
};

const MOST = 30;

/** The findings as text: one line each, with the beat when it can be found. */
export const formatProse = (findings, {lines = [], storyboard = null, file = 'script.md'} = {}) => {
  const packages = Object.keys(VALE_PACKAGES).join(' and ');
  if (!findings.length) return `Prose: ${file} against ${packages}. Nothing found.`;
  const out = [`Prose: ${file} against ${packages}. ${findings.length} finding(s): rewrite the sentence, or leave it if the rule does not fit a line written for the ear.`];
  for (const finding of findings.slice(0, MOST)) {
    const at = locate(finding, lines, storyboard);
    const where = `line ${finding.line}${at ? ` · ${at.scene} beat ${at.beat}` : ''}`;
    out.push(`  ${finding.severity.padEnd(10)} ${where.padEnd(30)} ${finding.message}  (${finding.rule})`);
  }
  if (findings.length > MOST) out.push(`  ... and ${findings.length - MOST} more.`);
  return out.join('\n');
};
