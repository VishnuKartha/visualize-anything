# Routing: which picture for which part of the story

Routing happens in two layers. You decide what each scene's viewer needs to see and declare it as the scene's `need`. The router (`va route`) turns that into a renderer, checks your declaration against what the narration actually says, and reviews the sequence as a whole. You make the judgement; the router keeps it honest.

## 1. Declare the subject

Set `"subject"` at the top of the storyboard. It decides whether system diagrams belong in the video at all.

| `subject` | The video is about | Pictures |
|---|---|---|
| `algorithm` | How an algorithm, a data structure, or one function behaves | `code`, `trace`, `manim`, and `hyperframes`. A diagram scene is a routing error. |
| `system` | How separate components work together | Diagrams carry it; `code` shows the key lines; `manim` only for a quantity that changes. |
| `mixed` | Both: an algorithm and the system it lives in | Anything, each scene on its merits. |

Also record the `brief` you agreed with the user (`audience`, `length` in seconds, `focus`). The router reports when the video runs more than a fifth over or under the length asked for.

## 2. Declare each scene's `need`

Ask of each scene: **what would the viewer need to see to believe this sentence?** Pick one need. The router supplies the renderer, so `kind` (and a diagram's `type`) can be left out.

| `need` | The viewer must see | The narration sounds like | Renderer |
|---|---|---|---|
| `question` | A statement on screen: a chapter turn, or (with an `override`) the hook of a subject with nothing to animate in its first seconds | "Retry at once, and you can take down the service you were waiting for." | `title` (the fallback opening; see [opening.md](opening.md)) |
| `motion` | Data or state changing step by step | "Watch the array", "A jumps to the end", "the tree rebalances" | `manim` |
| `branching` | Decisions inside one procedure, acting on its data | "First it checks whether..., and if so..." | `manim` |
| `math` | A formula, a growth rate, a plot | "Each step halves the range", "this grows quadratically" | `manim` |
| `trace` | What the code says and what it does: the lines, beside the data they change | "This line does X", "each time around the loop...", "notice this check" | `trace` (code left, animation right) |
| `change` | Which lines of the code were removed and which were added | "The fix is one line", "this check was added", "the pull request replaces..." | `hyperframes` (a diff) |
| `number` | The one number the claim rests on, or up to four side by side, counted up as they are said | "Thirty-six frames a second", "twenty-five million episodes, or four rounds" | `stat` |
| `contrast` | Two or three alternatives, each with what it gets right and what it costs | "A simulator remembers, but...; a video model looks real, but..." | `compare` (panels side by side) |
| `chart` | Measured values against each other: bars, or a line across rounds | "Seventy-one seconds in round one, forty-one by round four" | `chart` |
| `quote` | The source's own words, when the wording is the evidence | "The authors put it this way" | `quote` |
| `figure` | The source's own figure, with the parts worth seeing pointed out | "This is the paper's own diagram of the loop" | `figure` |
| `data` | Numbers that need a picture designed for them, which none of the four above draws | "A million comparisons against twenty", as two bars racing | `hyperframes` (a composition you write) |
| `structure` | Separate components and what connects them | "These are the services", "the API sits between..." | `diagram` · `architecture` |
| `conversation` | Ordered messages between components | "The client calls the API, which asks the cache, which..." | `diagram` · `sequence` |
| `pipeline` | Data moving through stages and stores | "The event is parsed, enriched, then written to..." | `diagram` · `dataflow` |
| `process` | A process across several actors, with gates | "CI builds, tests, waits for approval, then deploys" | `diagram` · `workflow` |
| `states` | Named states of an object and its transitions | "An order starts pending, then paid, and can be refunded" | `diagram` · `lifecycle` |
| `recap` | The claims to remember; nothing new | "Three things to remember" | `bullets` |
| `credit` | The name of what was explained, and where to find it; the last scene | "That is `LRUCache`, in lru_cache.py." | `credit` (an end card; see [taste.md](taste.md)) |

## Code is never shown alone

A block of code on its own is text to be read, not an explanation. Whenever code is on screen, a picture of what it does is beside it: that is a `trace` scene. The router rejects a scene that shows only code.

- To say what a line does, show the line and its effect together: the highlight on the left, the data changing on the right.
- For declarations with no behaviour (fields, a signature, configuration), draw what they describe: a field is a labelled box, a capacity is a row of empty slots, a type is the shape of the data.
- If a piece of code truly has nothing to draw, it probably does not need to be on screen. Say it in the narration, or add an `override` with the reason; `"need": "source"` exists only for that case.

A `change` scene (a diff) is the one place code appears without a second picture, because the change itself is what is being shown.

Some needs are easy to confuse:

- **`change` or `trace`?** If the viewer needs to see what is different between two versions, it is `change`. If they need to understand what one version does, it is `trace`.
- **`change` or `motion`?** `change` is for an edit to the code. Two different approaches to the same job ("instead of scanning, it halves") differ in behaviour, not in a few lines: run both on the same data, with a count, in a `motion` scene.
- **`chart` or `math`?** A measured or counted quantity (a benchmark, a size, a before-and-after number) is `chart`, or `number` when there are only one or two of them. A relationship or formula (halving, growth, a curve) is `math`.
- **`chart` or `data`?** Bars or a line are `chart`: you give the values and nothing is built. `data` is for the picture those cannot draw, and costs a composition you write and render.
- **`number` or `question`?** Both put a large number on screen. `question` is a sentence. `number` is a measurement with its unit and what it counts. Neither opens a video: when the hook is a number, the opening is a Manim scene that counts it beside the thing it measures, and a `number` scene can restate it later.
- **`contrast` or `motion`?** If the two things differ in what they are (what each keeps, what each costs), set them side by side: `contrast`. If they differ in what they do to the same data, run both on it: `motion`.
- **`figure` or `structure`?** When the source already drew the picture, show theirs (`figure`) and point at it. Draw your own diagram (`structure` and the other diagram needs) when there is none, or when theirs cannot be read at video size.

- **`trace` or `motion`?** Use `trace` when the code should be on screen: which line does what, for a loop or short function of up to about 16 lines and 50 columns. Use `motion` when the behaviour is worth watching without the code, such as an overview before the code appears, or two approaches compared. Longer code is split into several trace scenes, one per function or block.
- **`branching` or `process`?** Both have steps and decisions. If every step is a line of the same function, it is `branching`: animate the decisions acting on the data. If the steps belong to different actors or tools, it is `process`.
- **`motion` or `structure`?** If the things on screen exist at the same time and the point is how they connect, it is `structure`. If the point is what happens to them over time, it is `motion`.

## 3. Run the router

```bash
VA route <project>
```

```
Routing: 6 scenes, subject "algorithm", 104s.
  Brief: for programmers who have used a cache but not built one, about 95s, focus on how it decides which key to forget.
  Hook: A full cache has to *forget* a key, and the obvious choice is *wrong*.
   ok     forget  motion       → manim                   20s
   ok     state   trace        → trace                   18s
   ok     read    trace        → trace                   12s
   ok     write   trace        → trace                   30s
   ok     recap   recap        → bullets                 18s
   ok     credit  credit       → credit                   6s
  Screen time: trace 58%, manim 19%, bullets 17%, credit 6%.
  Every route checks out.
```

Each scene gets a verdict with its reason:

- **`ERROR`** stops every build step. There are five: a video that does not open on a Manim animation, a scene that shows code with no visual beside it, a diagram scene in an `algorithm` video, a `question` scene with no statement on screen, and a `need` that disagrees with the scene's explicit `kind` or `type`.
- **`REVIEW`** is advice with a reason attached. Act on it, or leave it when the reason does not apply to this scene.

What the router checks, scene by scene:

| Check | Why |
|---|---|
| The narration supports the declared need | A scene declared `source` whose narration is all "shifts", "evicted", "pointer" probably wants an animation. Cue words never choose the route; they only question it. |
| A diagram has three to seven nodes | Two boxes and an arrow is a sentence. Past seven, labels are too small to read. |
| Each beat changes the picture | Two beats highlighting the same lines, focusing the same nodes, or leaving the same parts of a chart or a contrast on screen, should be one beat. |
| A quote is under about forty-five words, and a chart has at most sixteen marks | Past that, one is a paragraph to read and the other a table; neither is taken in while someone is talking. |
| A scene runs 6 to 40 seconds | Shorter and the cut is abrupt; longer and the picture goes stale. |
| The narration explains and does not recite code or pad | "self dot items dot move to end" and "basically, just" are both noise. |
| Scenes drawn by one script say whether they share a picture | A shared picture should not fade out and back in between scenes. |
| The recap shows the moment behind each takeaway | A list of text is not an ending. |
| Every scene has a `why` | Routing has to be reviewable by someone who was not there. |
| A beat that says always, never, at most, or at least names the fact that tested it (`holds`) | A claim about every case is a claim about the edges. See [facts.md](facts.md). |
| The narration keeps to the storyboard's `vocabulary`: one word per idea, none before the scene that explains it | Two words for one thing are heard as two things. See [taste.md](taste.md). |
| A scene has at most two `predict` beats | Past that, the stopping becomes the rhythm. |

And across the sequence:

| Check | Why |
|---|---|
| Opens on a Manim animation (`motion`, `branching`, or `math`), whatever the subject; anything else is an error unless its `override` says why. Closes on a recap or code, with at most a short `credit` after it | The hook is shown happening, from the first second; do not end on a new idea. The name of the source comes last. |
| The brief has a hook with a starred word; the opening scene says it; the closing scene returns to it | The hook is the reason to watch. It is chosen first, delivered first, and paid off last. |
| The storyboard's narration is `script.md`, word for word and in order | The narration is written whole and then split, so every line was written as the next sentence of the one before. |
| No scene after the first starts over ("Now let's look at", "Next,", "Moving on") | Each scene picks up where the last stopped. See [opening.md](opening.md), "Make it flow". |
| The opening's narration does not announce the video; the video's title promises a payoff | "In this video" gives the viewer nothing. See [opening.md](opening.md). |
| The thumbnail has five words at most, one starred, a picture under them, and does not repeat the title | It is seen about 120 pixels wide, with the title beside it. See [opening.md](opening.md). |
| No three scenes of the same kind in a row (Manim excepted) | Three code scenes read as a slideshow. Consecutive Manim scenes are one continuing animation. |
| An identifier named outside a code scene has a code scene next to it | Viewers trust a claim about `move_to_end` once they have seen its line. |
| An algorithm video has a Manim scene; a system video has a diagram; every video has code | Otherwise the subject is never actually shown. |
| The closing scene returns to what the opening starred | The hook made a promise; the ending cashes it in. |
| One beat is marked to land | The main point needs a moment of quiet after it. |
| Every number said or shown (narration, on-screen text, recap, thumbnail, hook) is a value in `facts` | A typed number can be wrong without anything noticing; a fact is computed by `va facts`. See [facts.md](facts.md). |
| A video over 45 seconds leaves one question open (`predict`) | The viewer who has guessed is waiting for the answer. |
| The storyboard lists its `vocabulary` | The check above has nothing to hold the narration to without it. |

The reasoning behind these, and how to satisfy each, is in [taste.md](taste.md).

## Disagreeing with the router

The router is a reviewer, not an authority. When a route is right and the router objects, say why in the scene:

```json
{
  "id": "where-it-lives",
  "need": "structure",
  "override": "Steps outside the algorithm for one scene to show which service owns the cache.",
  ...
}
```

`override` needs a real reason (a full phrase, not "ok"). It turns the error into a note that stays in the report, so the exception is visible to whoever reviews the storyboard. If you find yourself overriding more than once in a video, the `subject` is probably `mixed`.

## Algorithms belong to Manim

When the subject is an algorithm, every explanatory scene that is not code is Manim. Do not switch to a flowchart for the control flow.

- A flowchart of `if key in items` shows boxes labelled with code. The animation shows the key being found and moved. The second one explains; the first one restates.
- Continuity matters. Once the viewer has a picture of the data (a row of slots, a tree, two pointers), keep that picture and let each decision act on it.
- Formulas, invariants, and complexity claims go in the same scenes, typeset with `Math()`.

An algorithm video is mostly `trace` scenes, one per function or step, with a `motion` or `math` scene where the behaviour or the cost is worth seeing without the code.

## A paper is explained with its own evidence

A paper has already done the measuring and drawn its pictures, and the video's claims are the paper's claims. So alongside the animation that explains the idea, show what the paper itself reports:

- The hook is still a Manim animation: the paper's headline numbers counted beside a picture of what they measure.
- A result stated later is a `number`, counted up on screen as it is said. Two numbers side by side (theirs and the prior work's) is the same scene.
- What it is compared against is a `contrast`: the alternatives as panels, each with what it gets right and what it costs.
- A result across rounds, sizes, or baselines is a `chart`. Chart the values the sentence compares, not the whole table.
- Its own figure is a `figure`. Do not redraw a figure the authors drew; point at theirs.
- A sentence that makes the claim better than a paraphrase could is a `quote`. One a video is plenty.

These five are drawn from the storyboard, with nothing to build or render first: see [scene-evidence.md](scene-evidence.md). The idea itself still gets an animation. A paper video made only of these is a slide deck of the paper; one with none of them asks the viewer to take every number on trust.

## Mixing renderers

A video can cut between Remotion, Manim, Archify, and HyperFrames scenes freely; each scene goes to whichever renderer its need maps to, and they share one backdrop, palette, and caption style. Two things keep a mixed video from looking stitched together:

- Follow the need, not the renderer. Do not reach for a HyperFrames scene because it looks different; reach for it when the viewer needs to see a change or a number.
- Keep one picture of a thing. If the code first appears in a `change` scene, show the same excerpt, with the same title, in the `source` or `trace` scene that follows.

## When Archify earns its place

Use a diagram need when the things being related are separate parts that exist at the same time: services, processes, modules, queues, stores, people, pipeline stages. The test is whether the boxes are **nouns the codebase would name as components**, not steps of one procedure.

## Judgement the router cannot make

- **Prefer the cheaper picture when both explain equally well.** `code` costs nothing to produce and cannot be wrong.
- **One renderer per scene.** If a scene wants two pictures, it is two scenes.
- **Concept, then code.** Show the behaviour or the structure first, then the lines that implement it, and let the narration link them ("that one line is the jump you just saw").

## Worked examples

**An algorithm: a 20-line LRU cache class** (`"subject": "algorithm"`).

| # | Narration (summary) | `need` | Renderer |
|---|---|---|---|
| 1 | "A full cache has to forget a key, and the obvious choice is wrong" | `motion` | the full row, a new key arriving, the first-in key marked and then spared |
| 2 | "Keeping track of that takes two pieces of state: a capacity and an ordered dict" | `trace` | the fields, beside empty slots filling into an ordered row |
| 3 | "Reading A: `move_to_end` sends it to the newest end" | `trace` | `get()`, beside A jumping along the row |
| 4 | "Writing has two decisions: already cached? over capacity?" | `trace` | `put()`, beside the refresh and the eviction |
| 5 | "Three things to remember" | `recap` | `bullets` |
| 6 | "That is `LRUCache`, in lru_cache.py" | `credit` | the name, animated in, and where to find it |

The full project is in `examples/lru-cache/` at the root of this repository.

**A system: how a dashboard request is served** (`"subject": "system"`).

| # | Narration (summary) | `need` | Renderer |
|---|---|---|---|
| 1 | "The same dashboard takes two seconds to load, or twenty milliseconds" | `motion` | `manim`: the same request run twice, each with its clock counting, which the rest explains |
| 2 | "Four pieces: the web app, the API, Redis, and Postgres" | `structure` | `diagram` · `architecture` |
| 3 | "The API checks the cache, misses, queries the database, writes back" | `conversation` | `diagram` · `sequence` |
| 4 | "The read-through is these six lines in the handler" | `trace` | the handler, beside the cache filling |
| 5 | "Why a short expiry keeps the miss rate low" | `math` | `manim` |
| 6 | "What to remember" | `recap` | `bullets` |

## Extending the router

The vocabulary, the cue words, and every rule live in `runtime/lib/router.mjs`, with tests in `runtime/test/router.test.mjs` (`npm test` in `runtime/`). To add a renderer: add a scene `kind` in `runtime/lib/storyboard.mjs` (and to `EVIDENCE` there if it is drawn from the storyboard alone and reveals its parts by `show`), a prepare step in `runtime/lib/steps.mjs`, a component in `runtime/src/scenes/`, then one or more needs in `NEEDS` that route to it and a row in the table above. A test fails if a need is missing from this page.
