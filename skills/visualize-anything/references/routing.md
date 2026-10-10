# Routing: which picture for which part of the story

Routing happens in two layers. You decide what each scene's viewer needs to see and declare it as the scene's `need`. The router (`va route`) turns that into a renderer, checks your declaration against what the narration actually says, and reviews the sequence as a whole. You make the judgement; the router keeps it honest.

## 1. Declare the subject

Set `"subject"` at the top of the storyboard. It decides whether system diagrams belong in the video at all.

| `subject` | The video is about | Pictures |
|---|---|---|
| `algorithm` | How an algorithm, a data structure, or one function behaves | `code` and `manim` only. A diagram scene is a routing error. |
| `system` | How separate components work together | Diagrams carry it; `code` shows the key lines; `manim` only for a quantity that changes. |
| `mixed` | Both: an algorithm and the system it lives in | Anything, each scene on its merits. |

## 2. Declare each scene's `need`

Ask of each scene: **what would the viewer need to see to believe this sentence?** Pick one need. The router supplies the renderer, so `kind` (and a diagram's `type`) can be left out.

| `need` | The viewer must see | The narration sounds like | Renderer |
|---|---|---|---|
| `question` | The question the video answers, or a chapter turn | "When a cache fills up, something has to go." | `title` |
| `source` | What the code literally says | "This line does X", "notice this check", "here is the function" | `code` |
| `motion` | Data or state changing step by step | "Watch the array", "A jumps to the end", "the tree rebalances" | `manim` |
| `branching` | Decisions inside one procedure, acting on its data | "First it checks whether..., and if so..." | `manim` |
| `math` | A formula, a growth rate, a plot | "Each step halves the range", "this grows quadratically" | `manim` |
| `structure` | Separate components and what connects them | "These are the services", "the API sits between..." | `diagram` · `architecture` |
| `conversation` | Ordered messages between components | "The client calls the API, which asks the cache, which..." | `diagram` · `sequence` |
| `pipeline` | Data moving through stages and stores | "The event is parsed, enriched, then written to..." | `diagram` · `dataflow` |
| `process` | A process across several actors, with gates | "CI builds, tests, waits for approval, then deploys" | `diagram` · `workflow` |
| `states` | Named states of an object and its transitions | "An order starts pending, then paid, and can be refunded" | `diagram` · `lifecycle` |
| `recap` | The claims to remember; nothing new | "Three things to remember" | `bullets` |

Two needs are easy to confuse:

- **`branching` or `process`?** Both have steps and decisions. If every step is a line of the same function, it is `branching`: animate the decisions acting on the data. If the steps belong to different actors or tools, it is `process`.
- **`motion` or `structure`?** If the things on screen exist at the same time and the point is how they connect, it is `structure`. If the point is what happens to them over time, it is `motion`.

## 3. Run the router

```bash
VA route <project>
```

```
Routing: 7 scenes, subject "algorithm", 126s.
   ok     intro  question     → title                   13s
   ok     state  source       → code                    16s
   ok     order  motion       → manim                   30s
   ok     get    source       → code                     9s
   ok     write  branching    → manim                   29s
   ok     put    source       → code                    10s
   ok     recap  recap        → bullets                 18s
  Screen time: manim 47%, code 28%, bullets 14%, title 10%.
  Every route checks out.
```

Each scene gets a verdict with its reason:

- **`ERROR`** stops every build step. There are two: a diagram scene in an `algorithm` video, and a `need` that disagrees with the scene's explicit `kind` or `type`.
- **`REVIEW`** is advice with a reason attached. Act on it, or leave it when the reason does not apply to this scene.

What the router checks, scene by scene:

| Check | Why |
|---|---|
| The narration supports the declared need | A scene declared `source` whose narration is all "shifts", "evicted", "pointer" probably wants an animation. Cue words never choose the route; they only question it. |
| A diagram has three to seven nodes | Two boxes and an arrow is a sentence. Past seven, labels are too small to read. |
| Each beat changes the picture | Two beats highlighting the same lines, or focusing the same nodes, should be one beat. |
| A scene runs 6 to 40 seconds | Shorter and the cut is abrupt; longer and the picture goes stale. |
| Every scene has a `why` | Routing has to be reviewable by someone who was not there. |

And across the sequence:

| Check | Why |
|---|---|
| Opens on a title, closes on a recap or code | Orient first; do not end on a new idea. |
| No three scenes of the same kind in a row (Manim excepted) | Three code scenes read as a slideshow. Consecutive Manim scenes are one continuing animation. |
| An identifier named outside a code scene has a code scene next to it | Viewers trust a claim about `move_to_end` once they have seen its line. |
| An algorithm video has a Manim scene; a system video has a diagram; every video has code | Otherwise the subject is never actually shown. |

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

An algorithm video typically alternates `motion` or `branching` with `source`: show the behaviour, then the lines that cause it.

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
| 1 | "When a cache fills up, something has to go" | `question` | `title` |
| 2 | "Two pieces of state: a capacity and an ordered dict" | `source` | `code` |
| 3 | "Reading A moves it to the newest end; adding D evicts the oldest" | `motion` | `manim` |
| 4 | "`move_to_end` is the jump you just saw" | `source` | `code` |
| 5 | "Writing has two decisions: already cached? over capacity?" | `branching` | `manim` |
| 6 | "Here are those two decisions as code" | `source` | `code` |
| 7 | "Three things to remember" | `recap` | `bullets` |

The full project is in `examples/lru-cache/` at the root of this repository.

**A system: how a dashboard request is served** (`"subject": "system"`).

| # | Narration (summary) | `need` | Renderer |
|---|---|---|---|
| 1 | "What happens between a click and a rendered dashboard?" | `question` | `title` |
| 2 | "Four pieces: the web app, the API, Redis, and Postgres" | `structure` | `diagram` · `architecture` |
| 3 | "The API checks the cache, misses, queries the database, writes back" | `conversation` | `diagram` · `sequence` |
| 4 | "The read-through is these six lines in the handler" | `source` | `code` |
| 5 | "Why a short expiry keeps the miss rate low" | `math` | `manim` |
| 6 | "What to remember" | `recap` | `bullets` |

## Extending the router

The vocabulary, the cue words, and every rule live in `runtime/lib/router.mjs`, with tests in `runtime/test/router.test.mjs` (`npm test` in `runtime/`). To add a renderer: add a scene `kind` in `runtime/lib/storyboard.mjs`, a prepare step in `runtime/lib/steps.mjs`, a component in `runtime/src/scenes/`, then one or more needs in `NEEDS` that route to it and a row in the table above. A test fails if a need is missing from this page.
