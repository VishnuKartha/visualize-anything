// What is written is not what should be spoken. Narration is authored the way it should read
// on screen (`move_to_end`, `O(log n)`, `>=`); this turns it into what the voice should say.
// Only the speech engine sees the result, so captions keep the written form.

const BIG_O = /\bO\(([^()]+)\)/g;
const POWERS = {2: 'squared', 3: 'cubed'};

const spokenMath = (expression) =>
  expression
    .replace(/\^\s*(\w+)/g, (_, power) => ` ${POWERS[power] || `to the ${power}`}`)
    .replace(/\*/g, ' times ')
    .replace(/\s+/g, ' ')
    .trim();

const RULES = [
  // Code spans are for the eye.
  [/`([^`]*)`/g, '$1'],
  [/\be\.g\.,?/g, 'for example,'],
  [/\bi\.e\.,?/g, 'that is,'],
  [/\bvs\.?(?=\s)/g, 'versus'],
  // Complexity and powers: O(n^2) → "O of n squared", 2^k → "2 to the k".
  [BIG_O, (_, inner) => `O of ${spokenMath(inner.replace(/^1$/, 'one'))}`],
  [/(\w)\s*\^\s*(\w+)/g, (_, base, power) => `${base} ${POWERS[power] || `to the ${power}`}`],
  // Comparisons and arrows, when written as code.
  [/\s*>=\s*/g, ' greater than or equal to '],
  [/\s*<=\s*/g, ' less than or equal to '],
  [/\s*!==?\s*/g, ' not equal to '],
  [/\s*===?\s*/g, ' equals '],
  [/\s*=>\s*/g, ' arrow '],
  [/\s*->\s*/g, ' to '],
  [/\s+>\s+/g, ' greater than '],
  [/\s+<\s+/g, ' less than '],
  [/\s*&&\s*/g, ' and '],
  [/\s*\|\|\s*/g, ' or '],
  // Identifiers: calls lose their parentheses, members are read with "dot", words are separated.
  [/\b([A-Za-z_]\w*)\(\)/g, '$1'],
  [/(?<=[A-Za-z0-9_])\.(?=[A-Za-z_])/g, ' dot '],
  [/(?<=[A-Za-z0-9])_+(?=[A-Za-z0-9])/g, ' '],
  [/(?<![A-Za-z])_+|_+(?![A-Za-z0-9])/g, ''],
  [/(?<=[a-z0-9])(?=[A-Z][a-z])/g, ' '],
  [/\s{2,}/g, ' '],
];

/** The spoken form of a line of narration. */
export const speakable = (text) => RULES.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text).trim();

/** Words as the ear hears them: spoken form, lowercase, punctuation dropped. */
export const spokenTokens = (text) =>
  speakable(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

/** Index at which `needle` occurs as a contiguous run in `haystack`, at or after `from`; -1 if absent. */
export const findRun = (haystack, needle, from = 0) => {
  if (!needle.length) return -1;
  for (let i = from; i + needle.length <= haystack.length; i += 1) {
    if (needle.every((token, offset) => haystack[i + offset] === token)) return i;
  }
  return -1;
};
