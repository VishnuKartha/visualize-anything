// The three viewers. A plan that only its author has read is tuned to its author. Before anything
// is recorded or drawn, the script and storyboard are read three times, each by a fresh agent that
// is one particular person and nobody else. The rendered video is then judged against the same
// three contracts.

export const VIEWERS = {
  newcomer: {
    name: 'the newcomer',
    short: 'Can program; has never seen this code, algorithm, or system and does not know its words; closes the tab when lost.',
    who: 'You can program, and you have never seen this code, this algorithm, or this system. You do not know its vocabulary. You are watching because someone sent you the link, and you stop the moment you feel lost: you do not rewind, you close the tab.',
    needs: [
      'Something you can picture before anything abstract.',
      'Every new word explained the first time it is said, in plain words, and then used the same way each time. Two words for one thing sound like two things to you.',
      'Numbers small enough to check in your head.',
      'The same object changing in front of you, not being swapped for a new one.',
      'A moment where you can guess what comes next, and find out whether you were right.',
    ],
    contract: 'After every scene you can say in one sentence what just happened and why it mattered. If a scene needs something you do not know, it gives it to you in a few seconds or goes around it.',
    look: [
      'Mark the first word in each scene that you could not define from what the video had told you so far.',
      'Say where you would have stopped watching, and what was on screen.',
      'Say which prediction pause you could answer, and which asked something you had no way to work out.',
    ],
  },
  practitioner: {
    name: 'the practitioner',
    short: 'Writes code daily and has to use or change this next week; dislikes unexplained jargon and unearned confidence.',
    who: 'You write code every day and will have to use, change, or debug this next week. You are comfortable with data structures, complexity, and concurrency as far as threads and locks. You dislike jargon that is not explained and confidence that is not earned.',
    needs: [
      'The mechanism, not only the result: what runs, in what order, on what state.',
      'A connection to something you have handled yourself.',
      'What it costs and how it fails, stated plainly.',
      'Enough precision that you could write it again from memory.',
    ],
    contract: 'After the video you could explain the idea to a colleague and write a small version of it. Nothing in it turns out, once you read the real code, to have been simplified in a way that matters in practice.',
    look: [
      'Name each step you could not reimplement from what was shown, and what was missing.',
      'Name each cost, limit, or failure the video left out that you would hit in real use.',
      'Say where the example is too kind: an input the explanation quietly avoids.',
    ],
  },
  expert: {
    name: 'the expert',
    short: 'Knows the code and the ideas behind it thoroughly; notices every claim that is only nearly true.',
    who: 'You know this code and the ideas behind it thoroughly; you may have written it. You notice every claim that is only nearly true: an "always" that is "usually", a complexity that holds on average and not in the worst case, a name used for the wrong thing, a number rounded one way in the voice and another on screen.',
    needs: [
      'Statements that are correct at the level of generality they are made.',
      'The exact version of anything simplified, kept somewhere a viewer can find it.',
      'Every number traceable to something that computed it.',
    ],
    contract: 'Nothing in the video is incorrect or misleading, and you would send it to someone joining the team.',
    look: [
      'Open the source and check every claim the narration makes against the lines themselves.',
      'For every sentence that says always, never, every, at most, or at least: name the case that would break it, and say whether the facts ledger shows that case was tried.',
      'For every number said or shown: find its row in the facts ledger. Say which have none, and which rows nothing computes.',
      'Name anything true but misleading: a guarantee stated without its condition, a cost stated without its unit.',
    ],
  },
};

// When the three disagree: what is true is not negotiable; then the newcomer sets the pace and the
// words; then the practitioner decides which mechanisms and costs earn their seconds.
export const PRIORITY = 'Where the three pull apart: the expert decides what is true and that is not traded away; the newcomer decides pacing and vocabulary; the practitioner decides which mechanisms and costs make the cut. A better example usually satisfies all three.';

// What `show` counts in each kind of scene that reveals its parts.
const PARTS = {stat: 'number(s)', compare: 'point(s)', chart: 'value(s)', quote: 'marked phrase(s)', figure: 'callout(s)'};

/** What a beat puts on screen, as far as the storyboard says. */
const pictureOf = (scene, beat) => {
  const parts = [];
  const range = (lines) => (Array.isArray(lines) ? lines.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(', ') : null);
  const describe = (cue) => {
    const out = [];
    if (cue.lines) out.push(`highlights line ${range(cue.lines)}`);
    if (cue.note) out.push(`callout "${cue.note}"`);
    if (Array.isArray(cue.focus)) out.push(`lights ${cue.focus.join(', ')}`);
    if (cue.focus === 'all') out.push('lights everything');
    if (cue.text) out.push(`shows "${cue.text.replace(/\n/g, ' / ')}"`);
    if (cue.version !== undefined && cue.version !== null) out.push(`shows version ${cue.version}`);
    if (cue.show !== undefined && cue.show !== null) out.push(`${cue.show} ${PARTS[scene.kind] || 'takeaway(s)'} visible`);
    return out;
  };
  parts.push(...describe(beat));
  for (const cue of beat.cues || []) parts.push(...describe(cue).map((text) => `at "${cue.at}", ${text}`));
  if (beat.predict) parts.push('the picture holds while the question hangs');
  if (beat.land) parts.push('a longer pause after');
  if (beat.holds) parts.push(`claim tested as fact "${beat.holds}"`);
  // What an animation draws is in its script, which is written after the narration is timed.
  if (scene.kind === 'manim' || (scene.kind === 'trace' && !parts.some((part) => part.includes('highlights')))) parts.unshift('the animation (its script comes after this review)');
  if (scene.kind === 'bullets' && !parts.length) parts.push('the next takeaway appears');
  if (PARTS[scene.kind] && !parts.some((part) => part.includes('visible'))) parts.push(`the next ${PARTS[scene.kind].replace('(s)', '')} arrives`);
  if (scene.kind === 'credit') parts.push(`the name "${scene.title}"${scene.subtitle ? ` over "${scene.subtitle}"` : ''}`);
  return parts.join('; ') || '(nothing declared)';
};

const SHOWN_AS = {
  title: 'a statement on screen', credit: 'the end card', code: 'code alone', trace: 'code beside an animation of what it does', hyperframes: 'a code diff or chart', manim: 'an animation', diagram: 'a diagram',
  bullets: 'the recap, each takeaway beside the moment that proved it',
  stat: 'a number counted up on screen', compare: 'panels side by side', chart: 'a chart', quote: "the source's words, quoted", figure: "the source's own figure",
};

/** What an evidence scene is made of, in words, for the plan a reviewer reads. */
const madeOf = (scene) => {
  if (scene.kind === 'stat') return `Numbers shown: ${scene.metrics.map((metric) => `${metric.value}${metric.unit ? ` ${metric.unit}` : ''} (${metric.label})`).join('; ')}`;
  if (scene.kind === 'compare') return `Panels: ${scene.panels.map((panel) => `"${panel.label}": ${panel.points.map((point) => `${point.text} [${point.tone}]`).join(', ')}`).join(' | ')}`;
  if (scene.kind === 'chart') return `A ${scene.chart} chart${scene.unit ? ` in ${scene.unit}` : ''}: ${scene.series.map((entry) => `${entry.label ? `${entry.label}: ` : ''}${scene.labels.map((label, index) => `${label} = ${entry.values[index]}`).join(', ')}`).join(' | ')}`;
  if (scene.kind === 'quote') return `Quoted: "${scene.quote}"${scene.attribution ? ` (${scene.attribution})` : ''}`;
  if (scene.kind === 'figure') return `Figure: ${scene.image}${scene.caption ? `, captioned "${scene.caption}"` : ''}${scene.callouts.length ? `; pointed out: ${scene.callouts.map((callout) => callout.label).join(', ')}` : ''}`;
  return null;
};

/**
 * The page one viewer is handed before anything is recorded: the whole script, the plan scene by
 * scene, the facts ledger, and what to report. Pure text in, text out.
 */
export const planBrief = ({viewer, storyboard, script, routingText, ledger, sources, reportPath}) => {
  const person = VIEWERS[viewer];
  const out = [];
  out.push(`# Plan review as ${person.name}: ${storyboard.title}`, '');
  out.push('This is the plan for a short narrated explainer video about code: its script and its storyboard. Nothing has been recorded or drawn yet, so everything here is still cheap to change. You did not write it, and nobody will tell you what was intended beyond this page.', '');
  out.push('## Who you are', '', person.who, '', 'What you need from a video:', ...person.needs.map((need) => `- ${need}`), '', `**The contract the video has with you:** ${person.contract}`, '');
  out.push('Read as this person and only as this person. Do not review it as an editor or as an engineer in general; two other reviewers are reading it as the other two viewers.', '');

  out.push('## What the video is for', '');
  const brief = storyboard.brief || {};
  out.push(`- Audience it was written for: ${brief.audience || '(not stated)'}`, `- The question it answers: ${brief.focus || '(not stated)'}`, `- Length asked for: ${brief.length ? `about ${brief.length}s` : '(not stated)'}`);
  if (brief.hook) out.push(`- The hook it means to open on: ${brief.hook.replace(/\*/g, '')}`);
  out.push('');

  out.push('## The script, as it will be heard', '', script.trim() || '(no script.md; the lines are in the plan below)', '');

  out.push('## The plan, scene by scene', '');
  storyboard.scenes.forEach((scene, index) => {
    out.push(`### ${index + 1}. ${scene.id}: ${SHOWN_AS[scene.kind]}`, '');
    if (scene.why) out.push(`Why this picture: ${scene.why}`, '');
    if (scene.kind === 'bullets') out.push(`Takeaways shown: ${scene.items.map((item) => `"${item.text}"${item.from ? ` (beside "${item.from}")` : ''}`).join('; ')}`, '');
    if (madeOf(scene)) out.push(madeOf(scene), '');
    out.push('| Beat | Heard | On screen |', '|---|---|---|');
    scene.beats.forEach((beat, beatIndex) => out.push(`| ${beatIndex + 1} | ${beat.say.replace(/\|/g, '\\|')} | ${pictureOf(scene, beat).replace(/\|/g, '\\|')} |`));
    out.push('');
  });

  out.push('## The facts ledger', '');
  if (!storyboard.facts.length) out.push('No facts are declared: no number in this video is computed by anything.', '');
  else {
    out.push('Every number the video says or shows is meant to be a row here, computed again by a script that runs the real code.', '');
    out.push('| Fact | Value | What it is | Checked |', '|---|---|---|---|');
    for (const fact of storyboard.facts) {
      const checked = ledger?.rows.find((entry) => entry.id === fact.id);
      const status = fact.given ? `not computed: ${fact.given}` : !checked ? 'not run yet' : checked.status === 'ok' ? 'computed, agrees' : checked.status === 'differs' ? `DIFFERS: computed ${checked.computed}` : 'MISSING from the oracle';
      out.push(`| ${fact.id} | ${fact.value} | ${fact.what || ''} | ${status} |`);
    }
    out.push('');
  }
  if (ledger?.loose.length) out.push(`Numbers said or shown with no row: ${ledger.loose.map((number) => `"${number.text}" (${number.where})`).join(', ')}.`, '');
  if (storyboard.vocabulary.length) {
    out.push('## The vocabulary it has committed to', '');
    for (const entry of storyboard.vocabulary) out.push(`- **${entry.word}**${entry.not.length ? `, never ${entry.not.map((word) => `"${word}"`).join(' or ')}` : ''}${entry.defined ? `; explained in "${entry.defined}"` : ''}`);
    out.push('');
  }
  if (viewer !== 'newcomer' && sources.length) {
    out.push('## The source', '', 'Read it before you judge anything:', ...sources.map((file) => `- ${file}`), '');
  }
  out.push('## What the automated checks found', '', '```', routingText, '```', '');

  out.push('## What to do', '');
  out.push('1. **Say each scene back.** For every scene, write the one sentence you would give a friend: what happened, and why it mattered. If you cannot, write "could not" and what stopped you. That is a blocker for the scene, whoever is right.');
  person.look.forEach((item, index) => out.push(`${index + 2}. ${item}`));
  out.push('', '## Your report', '');
  out.push(`Write it to ${reportPath}, under 450 words, with no praise:`, '');
  out.push(
    '- **Scene by scene:** your one sentence for each.',
    '- **Findings**, most serious first, one per line: `scene · beat | blocker, major, or minor | what confused, bored, or misled you, in your own words | what would fix it`.',
    '- **Verdict:** GO or REVISE. REVISE if any finding is a blocker.',
  );
  return `${out.join('\n')}\n`;
};

/** The three contracts, for the reviewer of the finished video to hold it against. */
export const viewerContracts = () => [
  ...Object.values(VIEWERS).map((person) => `- **${person.name[0].toUpperCase()}${person.name.slice(1)}.** ${person.short} The contract: ${person.contract}`),
  '',
  PRIORITY,
];
