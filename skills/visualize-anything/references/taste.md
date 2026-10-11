# House rules

These are decisions about taste. Each one came from watching a video this skill produced and seeing what was weak in it. What the story needs before any of this applies (the obvious approach first, a count on screen, the limit named) is in [story.md](story.md). Most are checked for you: `va route` before anything is rendered, `va manim` and `va stills` while it is built, `va qc` after. A check that fires is advice with a reason, except where it says it blocks.

| Rule | Why | Checked by |
|---|---|---|
| Code is never shown alone | A block of code is text to read, not an explanation | `va route` (blocks) |
| An algorithm is animated, not flowcharted | The branch is part of the behaviour; show it acting on the data | `va route` (blocks) |
| Open on the picture, with the hook said over it | The first ten seconds decide whether the rest is watched, and words on a card are not the subject | `va route` |
| The hook is agreed before the storyboard | It is the core of the problem or the most interesting part; everything else is arranged around it | `va route` (it is in the brief, said in the opening, returned to at the end) |
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
| One dataset per video | Changing the example values makes the viewer start over | you |

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

## Left undecided

Two choices are deliberately not made here, because they depend on where the video will be watched:

- **Sound.** There is none besides the voice.
- **Captions.** They are burned in along the bottom (`"captions": false` turns them off; subtitle files are written either way).
