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
| `question` | The hook, as a statement on screen | "When a cache fills up, something has to go." | `title` (see [opening.md](opening.md)) |
| `motion` | Data or state changing step by step | "Watch the array", "A jumps to the end", "the tree rebalances" | `manim` |
| `branching` | Decisions inside one procedure, acting on its data | "First it checks whether..., and if so..." | `manim` |
| `math` | A formula, a growth rate, a plot | "Each step halves the range", "this grows quadratically" | `manim` |
| `trace` | What the code says and what it does: the lines, beside the data they change | "This line does X", "each time around the loop...", "notice this check" | `trace` (code left, animation right) |
| `change` | Which lines of the code were removed and which were added | "The fix is one line", "this check was added", "the pull request replaces..." | `hyperframes` (a diff) |
| `data` | Numbers measured or compared: a chart, a count, a benchmark | "A million comparisons against twenty", "forty percent faster" | `hyperframes` (a composition you write) |
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
- **`data` or `math`?** A measured or counted quantity (a benchmark, a size, a before-and-after number) is `data`. A relationship or formula (halving, growth, a curve) is `math`.

- **`trace` or `motion`?** Use `trace` when the code should be on screen: which line does what, for a loop or short function of up to about 16 lines and 50 columns. Use `motion` when the behaviour is worth watching without the code, such as an overview before the code appears, or two approaches compared. Longer code is split into several trace scenes, one per function or block.
- **`branching` or `process`?** Both have steps and decisions. If every step is a line of the same function, it is `branching`: animate the decisions acting on the data. If the steps belong to different actors or tools, it is `process`.
- **`motion` or `structure`?** If the things on screen exist at the same time and the point is how they connect, it is `structure`. If the point is what happens to them over time, it is `motion`.

## 3. Run the router

```bash
VA route <project>
```

```
Routing: 5 scenes, subject "algorithm", 89s.
  Brief: for programmers who have used a cache but not built one, about 95s.
   ok     intro  question     → title                   13s
   ok     state  trace        → trace                   16s
   ok     read   trace        → trace                   12s
   ok     write  trace        → trace                   29s
   ok     recap  recap        → bullets                 18s
  Screen time: trace 65%, bullets 20%, title 15%.
  Every route checks out.
```

Each scene gets a verdict with its reason:

- **`ERROR`** stops every build step. There are four: a scene that shows code with no visual beside it, a diagram scene in an `algorithm` video, a `question` scene with no statement on screen, and a `need` that disagrees with the scene's explicit `kind` or `type`.
- **`REVIEW`** is advice with a reason attached. Act on it, or leave it when the reason does not apply to this scene.

What the router checks, scene by scene:

| Check | Why |
|---|---|
| The narration supports the declared need | A scene declared `source` whose narration is all "shifts", "evicted", "pointer" probably wants an animation. Cue words never choose the route; they only question it. |
| A diagram has three to seven nodes | Two boxes and an arrow is a sentence. Past seven, labels are too small to read. |
| Each beat changes the picture | Two beats highlighting the same lines, or focusing the same nodes, should be one beat. |
| A scene runs 6 to 40 seconds | Shorter and the cut is abrupt; longer and the picture goes stale. |
| The narration explains and does not recite code or pad | "self dot items dot move to end" and "basically, just" are both noise. |
| Scenes drawn by one script say whether they share a picture | A shared picture should not fade out and back in between scenes. |
| The recap shows the moment behind each takeaway | A list of text is not an ending. |
| Every scene has a `why` | Routing has to be reviewable by someone who was not there. |

And across the sequence:

| Check | Why |
|---|---|
| Opens on a hook statement or cold on a picture, not on bullets or bare code; closes on a recap or code, with at most a short `credit` after it | Hook first; do not end on a new idea. The name of the source comes last. |
| The opening has a statement on screen and its narration does not announce the video; the video's title promises a payoff | A static card under a talking voice loses the viewer in the first ten seconds, so the video opens on no title card. See [opening.md](opening.md). |
| The thumbnail has five words at most, one starred, a picture under them, and does not repeat the title | It is seen about 120 pixels wide, with the title beside it. See [opening.md](opening.md). |
| No three scenes of the same kind in a row (Manim excepted) | Three code scenes read as a slideshow. Consecutive Manim scenes are one continuing animation. |
| An identifier named outside a code scene has a code scene next to it | Viewers trust a claim about `move_to_end` once they have seen its line. |
| An algorithm video has a Manim scene; a system video has a diagram; every video has code | Otherwise the subject is never actually shown. |
| The closing scene returns to what the opening starred | The hook made a promise; the ending cashes it in. |
| One beat is marked to land | The main point needs a moment of quiet after it. |

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
| 1 | "When a cache fills up, something has to go" | `question` | `title`, with the hook on screen |
| 2 | "Two pieces of state: a capacity and an ordered dict" | `trace` | the fields, beside empty slots filling into an ordered row |
| 3 | "Reading A: `move_to_end` sends it to the newest end" | `trace` | `get()`, beside A jumping along the row |
| 4 | "Writing has two decisions: already cached? over capacity?" | `trace` | `put()`, beside the refresh and the eviction |
| 5 | "Three things to remember" | `recap` | `bullets` |
| 6 | "That is `LRUCache`, in lru_cache.py" | `credit` | the name, animated in, and where to find it |

The full project is in `examples/lru-cache/` at the root of this repository.

**A system: how a dashboard request is served** (`"subject": "system"`).

| # | Narration (summary) | `need` | Renderer |
|---|---|---|---|
| 1 | "What happens between a click and a rendered dashboard?" | `question` | `title` |
| 2 | "Four pieces: the web app, the API, Redis, and Postgres" | `structure` | `diagram` · `architecture` |
| 3 | "The API checks the cache, misses, queries the database, writes back" | `conversation` | `diagram` · `sequence` |
| 4 | "The read-through is these six lines in the handler" | `trace` | the handler, beside the cache filling |
| 5 | "Why a short expiry keeps the miss rate low" | `math` | `manim` |
| 6 | "What to remember" | `recap` | `bullets` |

## Extending the router

The vocabulary, the cue words, and every rule live in `runtime/lib/router.mjs`, with tests in `runtime/test/router.test.mjs` (`npm test` in `runtime/`). To add a renderer: add a scene `kind` in `runtime/lib/storyboard.mjs`, a prepare step in `runtime/lib/steps.mjs`, a component in `runtime/src/scenes/`, then one or more needs in `NEEDS` that route to it and a row in the table above. A test fails if a need is missing from this page.
