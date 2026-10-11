# House rules

These are decisions about taste. Most came from watching a video this skill produced and seeing what was weak in it; the last five in the table come from the production method of [jeffs_math_explainer_videos](https://github.com/Dicklesworthstone/jeffs_math_explainer_videos), where each exists because of a video that got it wrong. What the story needs before any of this applies (the obvious approach first, a count on screen, the limit named) is in [story.md](story.md). Most are checked for you: `va route` before anything is rendered, `va manim` and `va stills` while it is built, `va qc` after. A check that fires is advice with a reason, except where it says it blocks.

| Rule | Why | Checked by |
|---|---|---|
| Code is never shown alone | A block of code is text to read, not an explanation | `va route` (blocks) |
| An algorithm is animated, not flowcharted | The branch is part of the behaviour; show it acting on the data | `va route` (blocks) |
| Open on a Manim animation, with the hook said over it | The first ten seconds decide whether the rest is watched, and a card, a chart, or a block of code is not the hook happening | `va route` (blocks) |
| The hook is agreed before the storyboard | It is the core of the problem or the most interesting part; everything else is arranged around it | `va route` (it is in the brief, said in the opening, returned to at the end) |
| The narration is written whole, then split | Lines written a scene at a time do not follow on from each other | `va route` (the storyboard says `script.md`, in order, and nothing else) |
| Every scene follows on from the one before | A hook followed by a video that starts again is two videos | `va route` (scenes that start over), the reviewer |
| The title promises a payoff | "Introduction to X" gives no reason to click | `va route` |
| The thumbnail is five words and one picture | It is seen 120 pixels wide, beside the title | `va route`, and you: look at `thumbnail-small.png` |
| The source is named last | The viewer who has just understood something is the one who wants its name | `va route` (placement and length) |
| End on the picture, not a list | A slide of bullets is the title-card problem again | `va route` |
| The ending returns to the hook | The opening made a promise; the close should cash it in | `va route` |
| Scenes that share a picture do not blink between them | Fading the same row of slots out and back in breaks the thread | `va route` |
| The voice explains; it does not recite | "self dot items dot move to end" is noise | `va route` |
| No filler | "Simply", "just", "as you can see" pad the sentence and talk down | `va route` |
| The main point is given room to land | A reveal followed at once by the next sentence is lost | `va route` |
| Nothing under 24px | Text that has to be squinted at is not read | `va stills`, `va manim` |
| Palette only | One off-palette blue makes the scene look pasted in | `va manim` |
| Nothing holds still for more than six seconds | A frozen picture under a moving voice is a slide | `va qc` |
| No seams | A cut, a jump, or a silence in the wrong place tells the viewer one thing ended and another began | `va qc`, measured on the rendered file |
| One dataset per video | Changing the example values makes the viewer start over | you |
| Every number is computed | A number typed into a script can be wrong without anything noticing | `va facts` (blocks the build), `va route` |
| Always and never are tested at their edges | The case the video does not show is the one that breaks the claim | `va route`, the expert reviewer |
| One word per idea | Two words for one thing are heard as two things | `va route` (against the storyboard's `vocabulary`) |
| A question is left open before it is answered | The viewer who has guessed is waiting for the answer | `va route` (at least one `predict` beat, at most two a scene) |
| Music stays under the voice | A bed that is noticed during a sentence has cost the sentence | `va render` (measured; refuses a mix closer than 16 LU) |

## End on the picture

The recap is not a slide of text. Each takeaway is shown beside the moment that proved it: the earlier scene itself, frozen at that frame.

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

- `from` names an earlier scene with a picture; `beat` picks the beat whose final frame to show (default: the scene's last). The picture changes as each takeaway arrives.
- A plain string item is shown beside the last picture before the recap, or the scene named by `"over"`.
- Three or four takeaways. Each is a claim, not a topic: "Each pass halves the range", not "Halving".

## Return to the hook

Whatever the hook starred, the last scene says again. If the hook was `A *million* sorted items, searched in *twenty* looks.`, the closing line is "And that is why a million items take only about twenty passes." The viewer was promised an explanation of that number; ending on it tells them they got one.

## Name the source last

The opening does not say what is being explained by name, and does not point anywhere. The last scene does: a `credit` scene after the recap, where the name animates in with one line under it saying where to find it.

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

- `title` is the name as someone would type it into a search box: the paper's title, the function, the repository.
- `subtitle` is enough to find it: authors and year, a file path, a short address. It is read off the screen, so it has to be short enough to copy by eye.
- One spoken line that says the name. The explanation is over; anything past about eight seconds is flagged.
- The recap still returns to the hook. The credit comes after the ending, not instead of it.

## One picture, carried through

When consecutive scenes show the same thing (one row of slots through `state`, `get`, and `put`), mark each later one `"continues": true`. The fade between them is dropped, so the picture stays put while the code beside it changes.

For this to work the second scene must start on exactly the frame the first ended on. In the Manim script, build the opening picture and put it on screen with `self.appear(...)` instead of fading it in; it fades in normally when the scene does not continue anything. Build both scenes' pictures with the same helper functions so they cannot drift apart.

When two scenes are drawn by the same script but show different pictures, say so with `"continues": false`.

## No seams

A seam is a place where the video stops being one continuous thing. `va qc` measures the rendered file for five kinds, and the same file always gets the same answer.

| Seam | How it is measured | The usual cause, and the fix |
|---|---|---|
| A cut | One frame in which more than 2% of the picture changes, at least twice the change in the frames either side. A fade or a move changes several frames a little; a cut changes one a lot | Something large added or removed with `self.add` / `self.remove`: fade or transform it. At a join: a scene that does not fade |
| A jump at a carried-on join | The last frame of one scene against the first frame of the next, where the second is marked `continues`. They must be 99% alike in the picture they share | The second scene did not start on the frame the first ended on. Build both with the same helpers and open with `self.appear(...)` |
| The voice stopping where the picture carries on | More than one second of silence across a `continues` join | A `pause` or `hold` at that join |
| Dead air | Three seconds of silence anywhere | A long `pause` or `hold` |
| A step in the voice | One line more than 4 dB louder or quieter than the rest | The speech engine; reword the line or run `va tts` again |

It also reports an opening with nothing on screen for two seconds.

What makes a join seamless is built in, so most videos pass without effort: scenes fade through the backdrop; a `continues` join drops the fade, shortens the breath to the pause between two beats, and fades the code and the heading across while the animation holds; the recap cross-fades its pictures. A finding means something in the storyboard or a script worked against that.

What these checks cannot see is a seam in the story: a scene that redraws from nothing what the last scene had already built, or a first line that does not follow from the line before. The second is prevented at the source, by writing the narration whole in `script.md` before it is split, and `va route` holds the storyboard to that script. The first is the reviewer's.

## The voice explains

Narration says what a line does. The line is on screen; reading it aloud adds nothing.

| Reciting | Explaining |
|---|---|
| "Then self dot items dot move to end key is called." | "A hit calls `move_to_end`, which sends the key to the newest end." |
| "If len of self dot items is greater than self dot capacity..." | "If that pushed us over capacity..." |

Naming one identifier is good: it moves the highlight to its line. Reciting an expression is not.

Cut filler wherever it appears: simply, just, basically, obviously, clearly, actually, really, very, essentially, of course, kind of, sort of, as you can see, take a look, in order to, it is worth noting. If the sentence means the same without the word, the word goes.

## Let it land

One or two moments in a video are the point: the comparison that finds the target, the eviction, the number that makes the claim. Give that beat `"land": true`. The voice waits 0.7 seconds longer after it before going on, and the picture holds.

Use it once or twice. Every beat landing is no beat landing.

## Readable, and in one palette

- Nothing on screen is smaller than 24px at 1080p. `va stills` measures title, code, and recap text and outlines anything smaller.
- In a Manim script, the floor is `font_size=28` full-frame and `font_size=36` in a trace panel, which is shown smaller. `TEXT_SCALE` is 1.3 inside a trace panel and 1 otherwise; multiply by it when a script serves both.
- A trace scene's code is at most 16 lines of 50 columns, so it fits at 24px.
- Manim scenes use the colours `va_manim` provides and no others. Not `BLUE`, not `WHITE`, not a hex value of your own. `va manim` reports any it finds.

## One dataset

Pick the concrete example once (the list `3, 8, 15, 23, 42, 57, 61` and the target `57`; the keys `A`, `B`, `C`) and use it in every scene. A viewer who has learned where 57 sits does not want a new list in the next scene. Nothing checks this; it is yours to hold.

## Ask, then wait

A question the narration answers in the same breath is decoration. Mark the beat that asks it `"predict": true`: the beat ends on the question, the voice waits a second and a half longer, the picture holds, and the next beat of the same scene answers.

```json
{"say": "Two passes for seven items, because every pass throws away half of what is left. So how many for a million?", "predict": true},
{"say": "A list of n items needs about log base two of n passes. For a million items, that is twenty."}
```

- Ask only what the viewer can work out from what they have just seen. "So how many for a million?" comes after two scenes of halving. A question they have no way to answer makes them feel behind, which is the opposite of the point.
- The picture holds on what they need to answer it. Do not animate the answer in during the pause.
- One or two in a video. `va route` asks for one in anything over 45 seconds and questions a scene with more than two.

## One word per idea

Pick the word for each idea once and list it in the storyboard, with the words it must not also be called and the scene that explains it:

```json
"vocabulary": [
  {"word": "look", "not": ["comparison", "probe"], "defined": "race"},
  {"word": "pass", "not": ["iteration", "round"], "defined": "walk"}
]
```

A writer varies words to avoid repeating them; a listener hears a new word and looks for the new thing it names. `va route` flags a beat that uses a word from a `not` list, and a beat that says the word before the scene named in `defined`. A term that would be said once is replaced by plain words and left out of the list.

## Music stays under the voice

There is no music unless you bring some: `"music": "bed.mp3"` in the storyboard, a path in the project. Nothing is synthesized and no track ships with the skill. What the skill decides is where the bed sits, because that is not a matter of taste:

| | Level |
|---|---|
| While the voice speaks | 18 LU under it (`"under"`; 16 is the least allowed) |
| In a silence of two seconds or more | 10 LU under it (`"gap"`) |
| Pauses shorter than two seconds | still down: the bed does not pump between sentences |

The narration's timeline is known before the bed is laid, so it is ducked ahead of each sentence (down 0.08 seconds before the first word, back up over 1.2 seconds after the last), not in reaction to it. While it is down, its low-mids, the band from 1 to 4 kHz where consonants are, and its top are cut. `va render` then measures the result: how far the bed actually sits under the voice where the voice speaks, and the true peak of the mix. Closer than 16 LU, or over -1 dBTP, fails the render.

Choose a bed that holds still: sustained chords, slow movement, no melody. A melody under speech competes with the words whatever its level. And listen to it once at low volume on laptop speakers; the measurement can rule a mix out, not in.

## Left undecided

One choice is deliberately not made here, because it depends on where the video will be watched:

- **Captions.** They are burned in along the bottom (`"captions": false` turns them off; subtitle files are written either way).
