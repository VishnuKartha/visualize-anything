# House rules

These are decisions about taste. Most came from a video that this skill made and a weakness that we saw in it. The last five rows of the table come from the production method of [jeffs_math_explainer_videos](https://github.com/Dicklesworthstone/jeffs_math_explainer_videos). Each of those rows exists because a video got it wrong.

[story.md](story.md) gives the things that the story needs before these rules apply: the obvious approach first, a count on screen, and the limit named.

The tools examine most rules for you:

- `va route`, before a render
- `va manim` and `va stills`, during the build
- `va qc`, after the render

A check that fires is advice with a reason, unless the table says that it blocks.

| Rule | Why | Checked by |
|---|---|---|
| Do not show code alone | A block of code is text to read, not an explanation | `va route` (blocks) |
| Animate an algorithm, do not draw a flowchart of it | The branch is part of the behaviour. Show it on the data | `va route` (blocks) |
| Open on a Manim animation, and say the hook over it | The first ten seconds control whether the viewer stays. A card, a chart, or a block of code does not show the hook as it occurs | `va route` (blocks) |
| Give the context before the hook | A hook works only for a viewer who knows the subject. Without context, a reversal is two numbers | `va route` (the brief has a `context`), the newcomer reviewer |
| Agree the hook before the storyboard | It is the core of the problem or the most interesting part. All other parts are arranged around it | `va route` (it is in the brief, in the opening, and in the ending) |
| Write the narration as one text, then divide it | Lines that you write one scene at a time do not continue from each other | `va route` (the storyboard says `script.md`, in order, and no other words) |
| Each scene continues from the scene before it | A hook before a video that starts again is two videos | `va route` (scenes that start again), the reviewer |
| The title promises a result | "Introduction to X" gives no reason to click | `va route` |
| The thumbnail has five words and one picture | A viewer sees it 120 pixels wide, next to the title | `va route`, and you: look at `thumbnail-small.png` |
| Name the work after the opening, on a title card | A name means nothing before its reason. After the hook, the viewer asks what this is | `va route` (position, one card at most, necessary for a paper) |
| Name the source again last, with its location | The viewer who now understands wants to go and read it | `va route` (position and length) |
| End on the picture, not on a list | A slide of bullets is the title-card problem again | `va route` |
| The ending returns to the hook | The opening made a promise. The ending must keep it | `va route` |
| Scenes that share a picture do not fade between each other | If the same row of slots fades out and in, the thread breaks | `va route` |
| The voice explains. It does not read code aloud | "self dot items dot move to end" is noise | `va route` |
| No filler | "Simply", "just", and "as you can see" make the sentence longer and talk down to the viewer | `va route` |
| Vale reads the script | The writer of a sentence does not see its cliché or its machine-made phrase. A rule does | `va route`, `va prose` (Vale with `proselint` and `ai-tells`. The check must run. A finding is advice) |
| Give the main point time | A reveal with the next sentence immediately after it is lost | `va route` |
| No text smaller than 24px | The viewer does not read text that is too small | `va stills`, `va manim` |
| Use only the palette | One blue that is not in the palette makes the scene look pasted in | `va manim` |
| Nothing stays still for more than six seconds | A still picture below a voice that continues is a slide | `va qc` |
| A frame holds few things | A viewer who reads a full frame does not listen. Things that only arrive, and do not leave, fill the frame | `va manim` (things and words at the end of each beat), `va route` (words, notes, and details of evidence scenes, length of a takeaway) |
| No seams | A cut, a jump, or a silence in the incorrect place tells the viewer that one thing ended and another started | `va qc`, measured on the rendered file |
| One dataset in each video | If the example values change, the viewer must start again | you |
| Calculate each number | A number that you type into a script can be wrong, and nothing detects it | `va facts` (blocks the build), `va route` |
| Test "always" and "never" at their limits | The case that the video does not show is the case that breaks the claim | `va route`, the expert reviewer |
| One word for each idea | The viewer hears two words for one thing as two things | `va route` (against the `vocabulary` of the storyboard) |
| Leave a question open before you answer it | The viewer who made a guess waits for the answer | `va route` (one `predict` beat or more, two at most in a scene) |
| The music stays below the voice | If the viewer notices the music during a sentence, the sentence is lost | `va render` (measured. It refuses a mix nearer than 16 LU) |

## End on the picture

The recap is not a slide of text. It shows each takeaway next to the moment that proved it: the earlier scene, stopped at that frame. One takeaway is on screen at a time, in large text. The picture has most of the frame, so that the viewer can read it. The takeaway before it leaves when the next arrives.

```json
{
  "id": "recap",
  "need": "recap",
  "why": "Recap: the claims the viewer should leave with, each beside the moment that showed it.",
  "title": "What to remember",
  "items": [
    {"text": "Order of use lives in one ordered dictionary", "from": "state"},
    {"text": "Every read and write moves a key to the newest end", "from": "read", "beat": 2},
    {"text": "Over capacity? Drop the oldest end", "from": "write", "beat": 4},
    {"text": "That is how it decides what to forget", "from": "write"}
  ],
  "beats": [
    {"say": "So, three things to remember. The order of use lives in a single ordered dictionary."},
    {"say": "Every read and every write moves a key to the newest end."},
    {"say": "And when the cache is over capacity, it drops the oldest end. That is how it decides what to forget.", "show": 3, "cues": [{"at": "That is how", "show": 4}]}
  ]
}
```

- `from` names an earlier scene that has a picture. `beat` selects the beat whose last frame the recap shows. The default is the last beat of the scene. The picture changes when each takeaway arrives.
- An item that is only a string shows next to the last picture before the recap, or next to the scene that `"over"` names.
- Use three or four takeaways. Each one is a claim, not a topic: "Each pass halves the range", not "Halving".
- Keep a takeaway to 48 characters or fewer: six to eight words. `va route` reports a longer one.
- Select a moment whose picture is simple. A frame that had twelve things on it does not become clear when it is smaller.

## Return to the hook

The last scene says the starred words of the hook again. If the hook was `A *million* sorted items, searched in *twenty* looks.`, the closing line is "And that is why a million items take only about twenty passes." The opening promised an explanation of that number. The ending tells the viewer that they got it.

## Name the source last

The video does not start with the name of the work. It does not point to a location at the start. The name arrives two times.

1. On a title card immediately after the opening (`"need": "name"`). The context and the hook give the purpose of the work first. See [opening.md](opening.md), "Then name it".
2. In the last scene: a `credit` scene after the recap. The name animates in, with one line below it that tells where to find the work.

```json
{
  "id": "credit",
  "need": "credit",
  "why": "Close: name the paper, for anyone who wants to read it.",
  "kicker": "The paper",
  "title": "Attention Is All You Need",
  "subtitle": "Vaswani et al., 2017 · arxiv.org/abs/1706.03762",
  "beats": [{"say": "The paper is Attention Is All You Need."}]
}
```

- `title` is the name as a person types it into a search box: the title of the paper, the function, the repository.
- `subtitle` is sufficient to find it: the authors and the year, a file path, a short address. The viewer reads it from the screen. Make it short, so that they can copy it by eye.
- Use one spoken line that says the name. The explanation is complete. The router flags a credit longer than approximately eight seconds.
- The recap still returns to the hook. The credit comes after the ending. It does not replace the ending.

## One picture, carried through

When consecutive scenes show the same thing (one row of slots through `state`, `get`, and `put`), mark each later scene `"continues": true`. The tool removes the fade between them. The picture stays while the code next to it changes.

The second scene must start on the exact frame where the first scene ended. In the Manim script:

- Build the opening picture and put it on screen with `self.appear(...)`. Do not fade it in. When the scene does not continue another scene, `appear` fades it in normally.
- Build the pictures of the two scenes with the same helper functions. Then they cannot become different.

When the same script draws two scenes with different pictures, set `"continues": false`.

## No seams

A seam is a place where the video stops being one continuous thing. `va qc` measures the rendered file for five kinds of seam. The same file always gets the same result.

| Seam | How it is measured | The usual cause, and the correction |
|---|---|---|
| A cut | One frame in which more than 2% of the picture changes, and the change is two times or more that of the adjacent frames. A fade or a move changes many frames a small quantity. A cut changes one frame a large quantity | You added or removed a large object with `self.add` or `self.remove`. Fade it or transform it. At a join: a scene that does not fade |
| A jump at a join that continues | The last frame of one scene against the first frame of the next scene, where the second is marked `continues`. The shared picture must be 99% the same | The second scene did not start on the last frame of the first scene. Build the two scenes with the same helpers and open with `self.appear(...)` |
| The voice stops where the picture continues | More than one second of silence across a `continues` join | A `pause` or a `hold` at that join |
| Dead air | Three seconds of silence at any position | A long `pause` or `hold` |
| A step in the voice | One line more than 4 dB louder or quieter than the others | The speech engine. Write the line again or run `va tts` again |

It also reports an opening with nothing on screen for two seconds.

The tool makes joins without seams automatically, so most videos pass:

- Scenes fade through the backdrop.
- A `continues` join removes the fade. It makes the breath as short as the pause between two beats. It fades the code and the heading across the join while the animation holds.
- The recap fades between its pictures.

A finding tells you that the storyboard or a script worked against this.

These checks cannot see a seam in the story:

- A scene that draws again from nothing a thing that the last scene built. The reviewer finds this.
- A first line that does not continue from the line before it. You prevent this at the source: write the narration as one text in `script.md` before you divide it. `va route` holds the storyboard to that script.

## The voice explains

The narration says what a line does. The line is on screen. If the voice reads it aloud, the voice adds nothing.

| Reading aloud | Explaining |
|---|---|
| "Then self dot items dot move to end key is called." | "A hit calls `move_to_end`, which sends the key to the newest end." |
| "If len of self dot items is greater than self dot capacity..." | "If that pushed us over capacity..." |

It is good to name one identifier, because that moves the highlight to its line. Do not read an expression aloud.

Remove filler: simply, just, basically, obviously, clearly, actually, really, very, essentially, of course, kind of, sort of, as you can see, take a look, in order to, it is worth noting. If the sentence means the same without the word, remove the word.

### The narration is not Simplified Technical English

This guide uses a controlled language. The narration does not. A viewer hears the narration one time, at the speed of speech. Write it as a good teacher speaks to one person:

- **Write for the ear.** Read each line aloud. If you cannot say it in one breath, cut it.
- **Change the length of the sentences.** A short sentence after two longer sentences gives the point its weight. Sentences of the same length sound like a list.
- **Let sentences lean on each other.** Use "but", "so", and "and then" to join them. One sentence makes the viewer want the next.
- **Use plain, warm words.** Use contractions where a person uses them. Speak to the viewer, not about the subject.
- **Use the concrete thing.** "A jumps to the newest end" is better than "the entry is repositioned".
- **Keep the surprise.** A turn ("It should be faster. It was slower.") is the reason that the viewer listens.

Do not apply the 20-word limit, the approved-word list, or the one-instruction rule to a `say` line. Apply the rules of this section, of "Write for a listener" below, and of [opening.md](opening.md), "Make it flow".

## Write for a listener

A reader can look back. A listener cannot. The viewer hears each sentence one time, at the speed of speech, while they also watch a picture. A script can be correct and clean and still lose them. These rules come from a script that did.

| Rule | Why | Checked by |
|---|---|---|
| Name the subject | A listener cannot look back to find what "it" refers to | `va route` (three pronouns or more in a sentence), the newcomer reviewer |
| Give each word when the viewer needs it | The argument stops at the first word that the viewer does not have | the newcomer reviewer |
| Explain the idea that the mechanism depends on | A viewer who does not know why a batch is good cannot follow why a wait for a batch is good | the practitioner reviewer |
| One word has one meaning | "Model" for a language model and then for a formula is two things with one name | the practitioner reviewer, `vocabulary` |
| Say the point | Do not make the listener do arithmetic to find the claim | the newcomer reviewer |
| Say why it is important | A number without a reason to care is noise | the newcomer reviewer |
| Say few numbers | A listener keeps three or four numbers from a video | `va route` (numbers in a sentence, numbers in the video) |
| Ask before you answer | An answer to a question that nobody asked is a fact. An answer to a question that the viewer has is a relief | `va route` (`predict`), the reviewer |
| Use one concrete example | A thing that the viewer can picture holds the abstract statement | the newcomer reviewer |
| Change how sentences start | The same first word again and again is a tic when a person hears it | `va route` (the same joining word more than three times) |
| Cut an idea, not the joining words | A script that is cut word by word becomes notes | you |
| A claim is as wide as its evidence | One measured case does not prove the general statement | the expert reviewer. See [paper.md](paper.md) |

### Name the subject

Use the noun. Use a pronoun only when one thing can be the referent, and that thing is the subject of the sentence before. If two nouns come before the pronoun, the listener must guess.

| A pronoun to resolve | The subject named |
|---|---|
| "The small model's step takes 6 milliseconds and the big one's almost 28, so it idles for most of each step." | "The small model finishes its step in 6 milliseconds. The big model needs almost 28. So the small model sits idle while it waits." |
| "A request that leaves is marked pending, with its cache kept, so when its token comes back it rejoins the batch." | "When a request goes to the big model, the small model keeps that request's cache. The token comes back, and the request picks up where it left off." |
| "Too few, and batches stay small. Too many, and the small model runs out of work. So how many?" | "Wait for too few requests, and the batch is hardly a batch. Wait for too many, and the small model has nothing to do. So how many requests should the big model wait for?" |

"That", "this", and "they" at the start of a sentence have the same problem. Say what "that" is: not "That is one line", but "That rule is one line".

### Give each word when the viewer needs it

Before you divide the script, list each term that the argument uses. For each term, find the sentence that gives it to the viewer. If there is none, add one clause at the first use.

- A term needs only a clause: "a token, which is a word or a piece of one".
- An idea that a mechanism depends on needs a sentence and a picture. If the video explains a wait for a batch, it must first say what a batch is and why a larger batch is better. This is the idea that a writer most frequently forgets, because the writer knows it.
- Do not use one word for two things. If "model" is the language model, the formula of the authors is "their formula" or "their calculation". List the word in `vocabulary` with the words that it must not be.
- Do not change the word for a thing. "Questions" in one paragraph and "requests" in the next are two things to a listener. If the word must change, say so one time: "each question, or request, as the server calls it".

### Say the point, and say why it is important

Do not give two numbers and let the listener compare them. Say the comparison.

| The listener does the work | The script does the work |
|---|---|
| "R2R's published code made about 90 tokens a second. The big model alone made 145." | "R2R's published code came out slower than using the big model for everything: about 90 tokens a second, against 145." |
| "The model itself ran for 1.56 milliseconds: 4.2 percent of the step." | "Of every step, the model itself was running for about four percent. The rest was bookkeeping." |

Say early why the viewer cares. "The big model is better, but it is slow and it costs more to run" is one sentence. Without it, "send fewer tokens to the big model" has no purpose.

### Say few numbers

Select the three or four numbers that are the story. Say those. Show the others on screen and do not say them: a chart can hold six values while the voice says one.

- Say one number in a sentence. Three numbers in a sentence are a table that a person reads aloud.
- Use round numbers in speech: "about four percent", not "4.2 percent". The picture shows the exact value.
- Give a number its meaning in the same sentence: slower or faster, more or less, than what.

`va route` counts the different numbers in the narration. It tells you when the video says more than a listener can keep.

### Ask before you answer, and use one concrete example

Find the question that the viewer has at each turn, and say it before you answer. "So why was it slower?" is better than "The routing was not the problem." Do not give the question to the source ("the paper sets out to show why"). Ask the viewer.

Give one example that the viewer can picture, early, and return to it. For "most tokens are easy": show a real sentence, where "the" and "of" are easy and the one number in the answer is hard. One example does more than three abstract statements.

### Change how sentences start, and cut ideas

- Do not start more than three sentences with the same joining word ("So", "But", "And"). Let some sentences continue with no joining word.
- Do not give each paragraph the same shape: a claim, then "but", then a number.
- Do not read a list of steps aloud ("matches, locks, updates, and unlocks"). The picture shows the steps. The voice says what they add up to.
- When the script is too long, remove an idea. Do not remove articles, subjects, and joining words to save seconds. A script that reads as notes was cut this way. A video that explains two things well is better than a video that names five.

## Vale reads the script

[Vale](https://vale.sh) is a linter for prose. `va route`, `va check`, `va build`, and `va prose` run it on `script.md` with two rule packages:

| Package | It finds | Source |
|---|---|---|
| `proselint` | The faults that editors name: clichés, redundancy, hedging, mixed metaphors, jargon | [vale.sh/explorer/proselint](https://vale.sh/explorer/proselint) |
| `ai-tells` | The phrases and shapes that mark machine-written text: stock openers, sets of three, empty emphasis, absolute claims | [vale.sh/explorer/ai-tells](https://vale.sh/explorer/ai-tells) |

`va setup` installs Vale and the two packages. They are pinned to one release each. The files are in `~/.visualize-anything/`.

```
Prose: script.md against proselint and ai-tells. 2 finding(s): ...
  error      line 5 · route beat 1          AI tricolon: '...'. Restructure or vary the count.  (ai-tells.VerbTricolon)
  error      line 25 · credit beat 1        AI punctuation: ': Efficient'. Lowercase the word after the colon unless it is a proper noun.  (ai-tells.ColonUsage)
```

Read each finding. Then do one of these:

- **Rewrite the sentence.** Most findings point at a sentence that a person would not say. Say the concrete thing.
- **Leave the sentence.** The rules are for written text, and the narration is for the ear. A rule can be wrong about a literal statement ("a request that reaches the big model"), the title of a paper, or a name.

To stop the report of a finding that you leave, turn the rule off for that line in `script.md`. Use Vale comments, and give the reason. `va route` ignores comments when it compares the script with the storyboard.

```markdown
<!-- The title of the paper has a colon. -->
<!-- vale ai-tells.ColonUsage = NO -->
The paper is TokenRouter: Efficient Serving System for Token-Level LLM Routing.
<!-- vale ai-tells.ColonUsage = YES -->
```

Do not turn a package off for the full script. Do not rewrite a good spoken line only to make the report empty. A finding is advice. The check must run: without Vale, the commands stop.

## Let it land

One or two moments in a video are the point: the comparison that finds the target, the eviction, the number that makes the claim. Give that beat `"land": true`. The voice waits 0.7 seconds longer after it, and the picture holds.

Use it one or two times. If each beat lands, no beat lands.

## A frame holds few things

The viewer listens while they look. A frame with many boxes, labels, and numbers makes them read, and then they do not hear the sentence. Things pile up when a scene adds a thing in each beat and removes none.

| Scene | The limit | Checked by |
|---|---|---|
| A Manim or trace scene | Nine labelled things and 25 words on screen at the end of a beat. A dimmed thing is not counted | `va manim` |
| A `number`, `chart`, `contrast`, or `figure` scene | 35 words on screen. One note, of 70 characters or fewer. With three or four numbers, no `detail` | `va route` |
| The recap | One takeaway on screen at a time. 48 characters or fewer in a takeaway | the scene, `va route` |

To obey the limit, do these in this order:

1. Remove the thing that the voice left.
2. Dim the thing that is only context.
3. Say the words in place of showing them.
4. Divide the scene.

[scene-manim.md](scene-manim.md), "A frame holds few things", tells you how in a Manim script. [scene-evidence.md](scene-evidence.md) tells you how in an evidence scene.

## Readable, and in one palette

- Nothing on screen is smaller than 24px at 1080p. `va stills` measures the title, code, and recap text. It puts an outline on smaller text.
- In a Manim script, the minimum is `font_size=28` in a full frame and `font_size=36` in a trace panel, which shows smaller. `TEXT_SCALE` is 1.3 in a trace panel and 1 in a full frame. Multiply by it when a script is for the two layouts.
- The code of a trace scene has 16 lines of 50 columns at most. Then it fits at 24px.
- Manim scenes use only the colours of `va_manim`. Do not use `BLUE`, `WHITE`, or your own hex value. `va manim` reports each one that it finds.

## One dataset

Select the concrete example one time: the list `3, 8, 15, 23, 42, 57, 61` and the target `57`, or the keys `A`, `B`, `C`. Use it in each scene. A viewer who knows where 57 is does not want a new list in the next scene. No tool examines this. You must hold it.

## Ask, then wait

A question that the narration answers in the same breath is decoration. Mark the beat that asks the question `"predict": true`. The beat ends on the question. The voice waits one and a half seconds longer. The picture holds. The next beat of the same scene answers.

```json
{"say": "Two passes for seven items, because every pass throws away half of what is left. So how many for a million?", "predict": true},
{"say": "A list of n items needs about log base two of n passes. For a million items, that is twenty."}
```

- Ask only a question that the viewer can answer from the last pictures. "So how many for a million?" comes after two scenes of halving. A question that they cannot answer makes them feel behind.
- The picture holds on the things that they need for the answer. Do not animate the answer during the pause.
- Use one or two in a video. `va route` asks for one in a video longer than 45 seconds. It questions a scene with more than two.

## One word per idea

Select the word for each idea one time. List it in the storyboard, with the words that it must not also be and the scene that explains it:

```json
"vocabulary": [
  {"word": "look", "not": ["comparison", "probe"], "defined": "race"},
  {"word": "pass", "not": ["iteration", "round"], "defined": "walk"}
]
```

A writer changes words so that they do not repeat. A listener hears a new word and looks for the new thing that it names. `va route` flags a beat that uses a word from a `not` list. It also flags a beat that says the word before the scene in `defined`. If a term occurs only one time, use plain words and omit it from the list.

## Music stays under the voice

There is no music unless you supply it: `"music": "bed.mp3"` in the storyboard, a path in the project. The skill does not synthesize music and does not include a track. The skill decides the level of the music, because that is not a decision about taste:

| | Level |
|---|---|
| While the voice speaks | 18 LU below it (`"under"`. 16 is the minimum) |
| In a silence of two seconds or more | 10 LU below it (`"gap"`) |
| Pauses shorter than two seconds | The music stays down. It does not go up and down between sentences |

The tool knows the timeline of the narration before it adds the music. It decreases the music before each sentence: down 0.08 seconds before the first word, and up again during 1.2 seconds after the last word. While the music is down, the tool cuts its low-mids, its top, and the band from 1 to 4 kHz, where the consonants are.

`va render` then measures the result: the distance of the music below the voice where the voice speaks, and the true peak of the mix. A distance smaller than 16 LU, or a peak above -1 dBTP, fails the render.

Select music that stays still: sustained chords, slow movement, no melody. A melody below speech competes with the words at all levels. Listen to it one time at low volume on laptop speakers. The measurement can reject a mix. It cannot approve one.

## Left undecided

The skill does not make one decision, because it depends on where people watch the video:

- **Captions.** The tool burns them in along the bottom. `"captions": false` turns them off. The tool writes the subtitle files in the two cases.
