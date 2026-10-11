// The facts ledger. A number that is typed into narration or onto the screen can be wrong without
// anything noticing. So every number the video says or shows is a row in the storyboard's "facts",
// and every row is computed again by the project's oracle (facts.py or facts.mjs), which runs the
// real code. A sentence that says "always" or "never" is held to the same standard: the oracle
// tries its edges and reports whether it holds. Nothing here executes anything; `va facts` does.

const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = {twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90};
const SCALES = {thousand: 1e3, million: 1e6, billion: 1e9};
const SMALL = {...Object.fromEntries(UNITS.map((word, value) => [word, value])), ...TENS};
const isNumberWord = (word) => word in SMALL || word === 'hundred' || word in SCALES;

const MIN_GIVEN = 12; // a "given" has to say where the number comes from, not "ok"

/** The value of a run of number words ("two hundred and fifty", "a million"). */
const valueOf = (words) => {
  let total = 0;
  let current = 0;
  for (const word of words) {
    if (word in SMALL) current += SMALL[word];
    else if (word === 'hundred') current = (current || 1) * 100;
    else if (word in SCALES) {
      total += (current || 1) * SCALES[word];
      current = 0;
    }
  }
  return total + current;
};

/**
 * Every number in a line of narration or on-screen text, as {value, text}. Digits and number words
 * both count ("57", "1,000,000", "96.5%", "twenty", "a million"). Left out: "one" on its own, which
 * is nearly always a pronoun; ordinals; and anything inside a code span or an identifier.
 */
export const numbersIn = (text) => {
  const plain = String(text || '').replace(/`[^`]*`/g, ' ').replace(/\*/g, '');
  const found = [];
  const tokens = [...plain.matchAll(/\d[\d,]*(?:\.\d+)?|[A-Za-z]+/g)];
  for (let i = 0; i < tokens.length; i += 1) {
    const [raw] = tokens[i];
    const before = plain[tokens[i].index - 1] || '';
    const after = plain[tokens[i].index + raw.length] || '';
    if (/\d/.test(raw)) {
      // `log2`, `x86`, `v1.2`: part of a name, not a quantity. And an exponent is notation.
      if (/[A-Za-z_^.]/.test(before) || /[A-Za-z_]/.test(after)) continue;
      let value = Number(raw.replace(/,(?=\d{3})/g, '').replace(/,$/, ''));
      let shown = raw.replace(/,$/, '');
      const scale = tokens[i + 1]?.[0].toLowerCase();
      if (scale in SCALES || scale === 'hundred') {
        value *= SCALES[scale] || 100;
        shown += ` ${scale}`;
        i += 1;
      }
      if (Number.isFinite(value)) found.push({value, text: shown});
      continue;
    }
    const word = raw.toLowerCase();
    // "a million", "a hundred": the article stands for one.
    const article = word === 'a' && ['hundred', ...Object.keys(SCALES)].includes(tokens[i + 1]?.[0].toLowerCase());
    if (!isNumberWord(word) && !article) continue;
    const run = [];
    let j = article ? i + 1 : i;
    while (j < tokens.length) {
      const next = tokens[j][0].toLowerCase();
      if (isNumberWord(next)) run.push(next);
      else if (next === 'and' && run.length && isNumberWord(tokens[j + 1]?.[0].toLowerCase() || '')) {
        // "a hundred and fifty", not "two and three".
        if (!['hundred', ...Object.keys(SCALES)].includes(run.at(-1))) break;
      } else break;
      j += 1;
    }
    const shown = plain.slice(tokens[i].index, tokens[j - 1].index + tokens[j - 1][0].length);
    i = j - 1;
    if (run.length === 1 && run[0] === 'one') continue;
    found.push({value: valueOf(run), text: shown});
  }
  return found;
};

const decimals = (value) => (String(value).split('.')[1] || '').length;

/** Whether a computed value is the declared one, at the precision the declared one is written to. */
export const sameValue = (declared, computed) => {
  if (typeof declared === 'number' && typeof computed === 'number') {
    const places = decimals(declared);
    return Number(computed.toFixed(places)) === declared;
  }
  return typeof declared === typeof computed && declared === computed;
};

/** Check the storyboard's "facts" for shape. Returns the rows as the rest of the code reads them. */
export const normalizeFacts = (raw, errors) => {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push('"facts" must be a list of {"id": "...", "value": ..., "what": "..."}.');
    return [];
  }
  const seen = new Set();
  const facts = [];
  raw.forEach((fact, index) => {
    const where = `fact ${index + 1}${fact?.id ? ` ("${fact.id}")` : ''}`;
    if (!fact || typeof fact !== 'object') return errors.push(`${where}: must be {"id": "...", "value": ...}.`);
    if (typeof fact.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fact.id)) return errors.push(`${where}: "id" must be kebab-case (a-z, 0-9, hyphens).`);
    if (seen.has(fact.id)) return errors.push(`${where}: duplicate id.`);
    seen.add(fact.id);
    if (!['number', 'boolean', 'string'].includes(typeof fact.value) || (typeof fact.value === 'number' && !Number.isFinite(fact.value))) {
      return errors.push(`${where}: "value" must be a number, true or false, or a string.`);
    }
    if (fact.given !== undefined && (typeof fact.given !== 'string' || fact.given.trim().length < MIN_GIVEN)) {
      return errors.push(`${where}: "given" says where a number comes from when nothing computes it ("the recap has three items"). Write it as a phrase.`);
    }
    facts.push({id: fact.id, value: fact.value, what: typeof fact.what === 'string' ? fact.what.trim() : '', given: fact.given?.trim() || null});
  });
  return facts;
};

/** The oracle prints one JSON object, fact id to value. Anything else on stdout is ignored if the last line is that object. */
export const parseOracle = (stdout) => {
  const text = String(stdout).trim();
  for (const candidate of [text, text.split('\n').at(-1) || '']) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // try the next reading
    }
  }
  return null;
};

/** One row per fact: what the storyboard says, what the oracle computed, and whether they agree. */
export const compareFacts = (facts, computed) =>
  facts.map((fact) => {
    if (fact.given) return {...fact, status: 'given', computed: null};
    if (!computed || !(fact.id in computed)) return {...fact, status: 'missing', computed: null};
    return {...fact, status: sameValue(fact.value, computed[fact.id]) ? 'ok' : 'differs', computed: computed[fact.id]};
  });

/** Everything a storyboard says or shows as text, each with where it is. */
export const authoredText = (storyboard) => {
  const out = [];
  if (storyboard.brief?.hook) out.push({where: 'the brief\'s hook', text: storyboard.brief.hook});
  if (storyboard.thumbnail?.text) out.push({where: 'the thumbnail', text: storyboard.thumbnail.text});
  for (const scene of storyboard.scenes) {
    scene.beats.forEach((beat, index) => {
      out.push({where: `${scene.id} beat ${index + 1}`, text: beat.say});
      for (const shown of [beat.text, ...(beat.cues || []).map((cue) => cue.text)]) {
        if (shown) out.push({where: `${scene.id} beat ${index + 1}, on screen`, text: shown});
      }
    });
    for (const item of scene.items || []) {
      const shown = typeof item === 'string' ? item : item?.text;
      if (shown) out.push({where: `${scene.id}, on screen`, text: shown});
    }
  }
  return out;
};

/** Numbers that are said or shown but are no row of the ledger. */
export const unbackedNumbers = (storyboard) => {
  const values = (storyboard.facts || []).filter((fact) => typeof fact.value === 'number').map((fact) => fact.value);
  const backed = (value) => values.some((declared) => declared === value || sameValue(declared, value) || sameValue(value, declared));
  const loose = [];
  for (const entry of authoredText(storyboard)) {
    for (const number of numbersIn(entry.text)) {
      if (!backed(number.value) && !loose.some((seen) => seen.value === number.value)) loose.push({...number, where: entry.where});
    }
  }
  return loose;
};

// Sentences that claim something holds without exception. Each one is a promise about the edges:
// the empty input, the single item, the tie, the limit.
const ABSOLUTES = [
  'always', 'never', 'every time', 'every single', 'in every case', 'no matter', 'guaranteed', 'guarantees', 'guarantee', 'impossible',
  'without exception', 'at most', 'at least', 'no more than', 'no fewer than', 'cannot ever', 'can never',
].map((phrase) => [phrase, new RegExp(`\\b${phrase}\\b`, 'i')]);

/** The absolute words in a line of narration. */
export const absolutesIn = (text) => {
  // "A key the cache has never seen" tells what happened so far; it promises nothing about every case.
  const said = String(text).replace(/`[^`]*`/g, ' ').replace(/\b(has|have|had|was|were)\s+(never|always)\b/gi, '$1');
  const hits = ABSOLUTES.filter(([, pattern]) => pattern.test(said)).map(([phrase]) => phrase);
  // "can never" already says "never".
  return hits.filter((phrase) => !hits.some((other) => other !== phrase && other.includes(phrase)));
};

/** Check the storyboard's "vocabulary" for shape. */
export const normalizeVocabulary = (raw, errors) => {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push('"vocabulary" must be a list of {"word": "...", "not": ["..."], "defined": "<scene id>"}.');
    return [];
  }
  const out = [];
  raw.forEach((entry, index) => {
    const where = `vocabulary ${index + 1}${entry?.word ? ` ("${entry.word}")` : ''}`;
    if (!entry || typeof entry.word !== 'string' || !entry.word.trim()) return errors.push(`${where}: needs "word", the one word the video uses for this idea.`);
    const others = entry.not === undefined ? [] : entry.not;
    if (!Array.isArray(others) || others.some((word) => typeof word !== 'string' || !word.trim())) return errors.push(`${where}: "not" must be a list of the words it is not to be called.`);
    if (entry.defined !== undefined && typeof entry.defined !== 'string') return errors.push(`${where}: "defined" must be the id of the scene that first explains the word.`);
    out.push({word: entry.word.trim(), not: others.map((word) => word.trim()), defined: entry.defined ?? null});
  });
  return out;
};

// A word and its ordinary endings: "evict" is also "evicts" and "evicted", "entry" also "entries".
const wordPattern = (word) => {
  const safe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const plural = /[^aeiou]y$/i.test(word) ? `|${safe(word.slice(0, -1))}ies` : '';
  return new RegExp(`\\b(?:${safe(word)}(?:s|es|d|ed|ing)?${plural})\\b`, 'i');
};

/**
 * Where the narration breaks its own vocabulary: a second word for an idea that already has one,
 * or a word used before the scene that explains it.
 */
export const vocabularyFindings = (storyboard) => {
  const findings = [];
  const order = new Map(storyboard.scenes.map((scene, index) => [scene.id, index]));
  for (const entry of storyboard.vocabulary || []) {
    const own = wordPattern(entry.word);
    const definedAt = entry.defined !== null ? order.get(entry.defined) : null;
    storyboard.scenes.forEach((scene, sceneIndex) => {
      scene.beats.forEach((beat, beatIndex) => {
        const said = beat.say.replace(/`[^`]*`/g, ' ');
        for (const other of entry.not) {
          if (wordPattern(other).test(said)) findings.push({scene: scene.id, beat: beatIndex + 1, kind: 'synonym', word: entry.word, said: other});
        }
        if (definedAt !== null && definedAt !== undefined && sceneIndex < definedAt && own.test(said)) {
          findings.push({scene: scene.id, beat: beatIndex + 1, kind: 'early', word: entry.word, defined: entry.defined});
        }
      });
    });
  }
  return findings;
};
