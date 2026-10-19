# Routing: which picture for which part of the story

Routing has two layers.

1. You decide the thing that the viewer of each scene must see. You declare it as the `need` of the scene.
2. The router (`va route`) changes the `need` into a renderer. It compares your declaration with the narration. It examines the full sequence.

You make the decision. The router keeps it accurate.

## 1. Declare the subject

Set `"subject"` at the top of the storyboard. It controls whether system diagrams can be in the video.

| `subject` | The video is about | Pictures |
|---|---|---|
| `algorithm` | The behaviour of an algorithm, a data structure, or one function | `code`, `trace`, `manim`, and `hyperframes`. A diagram scene is a routing error. |
| `system` | How separate components work together | Diagrams hold it. `code` shows the important lines. Use `manim` only for a quantity that changes. |
| `mixed` | The two: an algorithm and the system that it is in | All kinds. Decide each scene on its merits. |

Also record the `brief`: `audience`, `length` in seconds, `focus`, `context`, `hook`. The router reports a video that is more than one fifth longer or shorter than the length in the brief.

Also record the `sources`: the material that the video is made from. Its kinds are code, a paper, a design doc, documentation, or a topic with no source. A video can have more than one. `subject` tells what the idea is. `sources` tells what the material is. Each scene also tells which sources it uses, before you select its `need`. The router applies the rules of a document to the parts of a scene that come from a document. See [sources.md](sources.md).

## 2. Declare each scene's `need`

For each scene, ask: **what must the viewer see to believe this sentence?** Select one need. The router supplies the renderer, so you can omit `kind` and the `type` of a diagram.

| `need` | The viewer must see | The narration sounds like | Renderer |
|---|---|---|---|
| `question` | A statement on screen: a chapter turn, or (with an `override`) the hook of a subject that has nothing to animate in its first seconds | "Retry at once, and you can take down the service you were waiting for." | `title` (the fallback opening. See [opening.md](opening.md)) |
| `motion` | Data or state that changes step by step | "Watch the array", "A jumps to the end", "the tree rebalances" | `manim` |
| `branching` | Decisions in one procedure, on its data | "First it checks whether..., and if so..." | `manim` |
| `math` | A formula, a growth rate, a plot | "Each step halves the range", "this grows quadratically" | `manim` |
| `trace` | What the code says and what it does: the lines, next to the data that they change | "This line does X", "each time around the loop...", "notice this check" | `trace` (code left, animation right) |
| `change` | Which lines of the code were removed and which were added | "The fix is one line", "this check was added", "the pull request replaces..." | `hyperframes` (a diff) |
| `number` | The one number that the claim depends on, or four at most side by side, counted up as the voice says them | "Thirty-six frames a second", "twenty-five million episodes, or four rounds" | `stat` |
| `contrast` | Two or three alternatives, each with its good point and its cost | "A simulator remembers, but...; a video model looks real, but..." | `compare` (panels side by side) |
| `chart` | Measured values against each other: bars, a line across rounds, or a scatter of systems that two measures place | "Seventy-one seconds in round one, forty-one by round four"; "better, and cheaper than all of them" | `chart` |
| `table` | The rows of a results table that the sentence compares, with the row of the source marked | "Against the strongest models of the time, it scores best" | `table` |
| `matrix` | A grid of values, coloured by size: attention weights, a confusion matrix | "Each word decides how much to look at each other word" | `matrix` |
| `quote` | The words of the source, when the wording is the evidence | "The authors put it this way" | `quote` |
| `figure` | The figure of the source, with pointers to the important parts | "This is the paper's own diagram of the loop" | `figure` |
| `data` | Numbers that need a picture designed for them, which none of the four above draws | "A million comparisons against twenty", as two bars racing | `hyperframes` (a composition that you write) |
| `structure` | Separate components and their connections | "These are the services", "the API sits between..." | `diagram` · `architecture` |
| `conversation` | Ordered messages between components | "The client calls the API, which asks the cache, which..." | `diagram` · `sequence` |
| `pipeline` | Data that moves through stages and stores | "The event is parsed, enriched, then written to..." | `diagram` · `dataflow` |
| `process` | A process across some actors, with gates | "CI builds, tests, waits for approval, then deploys" | `diagram` · `workflow` |
| `states` | The named states of an object and its transitions | "An order starts pending, then paid, and can be refunded" | `diagram` · `lifecycle` |
| `name` | The name of the work, immediately after the opening: a title card, with one line that says this is the aim of the work | "Why, and how to fix it, is what the paper TokenRouter sets out to show." | `credit` (shown as a title card. See [opening.md](opening.md), "Then name it") |
| `recap` | The claims to remember. Nothing new | "Three things to remember" | `bullets` |
| `credit` | The name of the work, and where to find it. The last scene | "That is `LRUCache`, in lru_cache.py." | `credit` (an end card. See [taste.md](taste.md)) |

## Code is never shown alone

A block of code alone is text to read. It is not an explanation. When code is on screen, put a picture of its effect next to it. That is a `trace` scene. The router rejects a scene that shows only code.

- To say what a line does, show the line and its effect together: the highlight on the left, the data that changes on the right.
- For declarations with no behaviour (fields, a signature, configuration), draw the thing that they describe. A field is a labelled box. A capacity is a row of empty slots. A type is the shape of the data.
- If a piece of code has nothing to draw, it is possibly not necessary on screen. Say it in the narration, or add an `override` with the reason. `"need": "source"` exists only for that case.

A `change` scene (a diff) is the one place where code is on screen without a second picture. The change is the thing that the scene shows.

Some needs are easy to confuse:

- **`change` or `trace`?** If the viewer must see the difference between two versions, use `change`. If they must understand what one version does, use `trace`.
- **`change` or `motion`?** `change` is for an edit to the code. Two different approaches to the same job ("instead of scanning, it halves") are different in behaviour, not in a few lines. Run the two on the same data, with a count, in a `motion` scene.
- **`chart` or `math`?** A measured or counted quantity (a benchmark, a size, a number before and after) is `chart`. With only one or two numbers, it is `number`. A relation or a formula (halving, growth, a curve) is `math`.
- **`chart` or `table`?** A chart compares one or two measures across some things. The eye reads the shapes. A table is for numbers that the viewer must read, with some measures on each row and the row of the source marked. Above six rows, chart the column that the sentence is about.
- **`matrix` or `math`?** A matrix shows the values of one grid: these weights, this confusion. The rule that makes them (a softmax of scores) is `math`. Frequently the two are next to each other, the grid first.
- **`chart` or `data`?** Bars or a line are `chart`. You give the values and you build nothing. `data` is for the picture that those cannot draw. It costs a composition that you write and render.
- **`number` or `question`?** The two put a large number on screen. `question` is a sentence. `number` is a measurement with its unit and the thing that it counts. Neither opens a video. When the hook is a number, the opening is a Manim scene that counts it next to the thing that it measures. A `number` scene can say it again later.
- **`contrast` or `motion`?** If the two things are different in what they are (what each keeps, what each costs), put them side by side: `contrast`. If they are different in what they do to the same data, run the two on it: `motion`.
- **`figure` or `structure`?** When the source has the picture, show that picture (`figure`) and point at it. Draw your own diagram (`structure` and the other diagram needs) when there is none, or when the viewer cannot read it at video size.
- **`trace` or `motion`?** Use `trace` when the code must be on screen: which line does what, for a loop or a short function of approximately 16 lines and 50 columns at most. Use `motion` when the behaviour is good to watch without the code: an overview before the code, or two approaches compared. Divide longer code into some trace scenes, one for each function or block.
- **`branching` or `process`?** The two have steps and decisions. If each step is a line of the same function, it is `branching`: animate the decisions on the data. If the steps belong to different actors or tools, it is `process`.
- **`motion` or `structure`?** If the things on screen exist at the same time and the point is their connections, it is `structure`. If the point is what occurs to them in time, it is `motion`.

## 3. Run the router

```bash
VA route <project>
```

```
Routing: 6 scenes, subject "algorithm", 104s.
  Brief: for programmers who have used a cache but not built one, about 95s, focus on how it decides which key to forget.
  Context: A cache keeps what you asked for lately, and it has limited room.
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

Each scene gets a decision with its reason:

- **`ERROR`** stops each build step. There are six errors:
  1. a video that does not open on a Manim animation
  2. a scene that shows code with no visual next to it
  3. a diagram scene in an `algorithm` video
  4. a `question` scene with no statement on screen
  5. a `need` that does not agree with the explicit `kind` or `type` of the scene
  6. a scene that shows code (`trace`, `source`, or `change`) in a paper video, unless its `override` gives the reason
- **`REVIEW`** is advice with a reason. Obey it, or ignore it when the reason does not apply to this scene.

The router examines each scene for these things:

| Check | Why |
|---|---|
| The narration supports the declared need | A scene declared `source` whose narration is all "shifts", "evicted", "pointer" possibly wants an animation. Cue words never select the route. They only question it. |
| A diagram has three to seven nodes | Two boxes and an arrow is a sentence. With more than seven, the labels are too small to read. |
| Each beat of a `trace` scene points at a line of the code | If a sentence is not about a line, the code must not be on screen while the voice says it. Code that nothing points at is wallpaper. |
| Each beat changes the picture | Two beats that highlight the same lines, focus the same nodes, or leave the same parts of a chart or a contrast on screen are one beat. |
| A quote has fewer than approximately forty-five words, and a chart has sixteen marks at most | Above that, one is a paragraph to read and the other is a table. The viewer cannot read them while a person speaks. |
| With more than one source, each scene tells which sources it uses. The part of a scene that comes from a document obeys the rules of a document: no prose shown as code, evidence that tells where it is (`ref`) and which scene prepares it (`after`), a claim of a document next to its code with a `ref`, a results table with its row marked, the figure of the document before a diagram that you draw | See [sources.md](sources.md). Prose shown as code is an error for a document. It is a review for other sources. The other rules are reviews. |
| An evidence scene has 35 words on screen at most, one note of 70 characters at most, and no `detail` below three or more numbers. A takeaway of the recap has 48 characters at most | Parts that pile up are read, and the sentence is not heard. See [taste.md](taste.md), "A frame holds few things". |
| A scene has 6 to 40 seconds | A shorter scene makes a sudden cut. A longer scene makes the picture old. |
| The narration explains. It does not read code aloud or use filler | "self dot items dot move to end" and "basically, just" are noise. |
| Scenes from one script say whether they share a picture | A shared picture must not fade out and in between scenes. |
| The recap shows the moment behind each takeaway | A list of text is not an ending. |
| Each scene has a `why` | A person who was not there must be able to review the routing. |
| A beat that says always, never, at most, or at least names the fact that tested it (`holds`) | A claim about all cases is a claim about the limits. See [facts.md](facts.md). |
| The narration obeys the `vocabulary` of the storyboard: one word for each idea, and no word before the scene that explains it | The viewer hears two words for one thing as two things. See [taste.md](taste.md). |
| A scene has two `predict` beats at most | Above that, the stops become the rhythm. |

The router examines the sequence for these things:

| Check | Why |
|---|---|
| The video opens on a Manim animation (`motion`, `branching`, or `math`) for all subjects. All other openings are an error, unless the `override` gives the reason. The video closes on a recap or code, with one short `credit` at most after it | The video shows the context and the hook from the first second. Do not end on a new idea. The source is named after the opening and again last, with its location. |
| The brief has a context of one or two sentences | The opening starts from where the viewer is. A hook said to a person who does not know the subject is not a hook. See [opening.md](opening.md), "Start where the viewer is". |
| A title card (`name`) comes immediately after the opening, one time at most. A paper video has one | A name means nothing before its reason. After the context and the hook, the viewer knows the purpose of the work. That is the moment to give its name. |
| The brief has a hook with a starred word. The opening says it: in the first scene, or in a scene that continues its picture with `continues`. The closing scene returns to it | The hook is the reason to watch. You select it first, give it immediately after the context, and return to it last. |
| The narration of the storyboard is `script.md`, word for word and in order | You write the narration as one text and then divide it. Thus each line was written as the next sentence after the line before it. |
| No scene after the first starts again ("Now let's look at", "Next,", "Moving on") | Each scene continues where the last scene stopped. See [opening.md](opening.md), "Make it flow". |
| The narration of the opening does not announce the video. The title of the video promises a result | "In this video" gives the viewer nothing. See [opening.md](opening.md). |
| The thumbnail has five words at most, one star, a picture below them, and does not repeat the title | A viewer sees it approximately 120 pixels wide, with the title next to it. See [opening.md](opening.md). |
| No three scenes of the same kind are consecutive (Manim excepted) | Three code scenes look like a slideshow. Consecutive Manim scenes are one animation that continues. |
| In a video about code, an identifier named outside a code scene has a code scene adjacent to it | Viewers believe a claim about `move_to_end` after they see its line. A paper video has no code scene, so this check does not apply to it. |
| An algorithm video has a Manim scene. A system video has a diagram. A video about code has code. A paper video has none | If not, the video does not show its subject. The subject of a paper video is its idea and its evidence, not its code. |
| The closing scene returns to the starred words of the opening | The hook made a promise. The ending keeps it. |
| One beat is marked `land` | The main point needs a moment of quiet after it. |
| Each number said or shown (narration, on-screen text, recap, thumbnail, hook) is a value in `facts` | A typed number can be wrong, and nothing detects it. `va facts` calculates a fact. See [facts.md](facts.md). |
| A video longer than 45 seconds leaves one question open (`predict`) | The viewer who made a guess waits for the answer. |
| The storyboard lists its `vocabulary` | Without it, the vocabulary check has nothing to hold the narration to. |
| In a paper project: a scene shows each claim of the abstract, or the storyboard omits it with a reason (`claims`). The video says or shows each number in the abstract. Each `given` number is in the paper | The abstract is the ranking of the authors. Omit a part of it only on purpose. See [paper.md](paper.md). |

[taste.md](taste.md) gives the reason for each check and how to pass it.

## Disagreeing with the router

The router is a reviewer, not an authority. When a route is correct and the router objects, give the reason in the scene:

```json
{
  "id": "where-it-lives",
  "need": "structure",
  "override": "Steps outside the algorithm for one scene to show which service owns the cache.",
  ...
}
```

`override` needs a real reason: a full phrase, not "ok". It changes the error into a note that stays in the report. Thus the reviewer of the storyboard can see the exception. If you use more than one override in a video, the `subject` is possibly `mixed`.

## Algorithms belong to Manim

When the subject is an algorithm, each scene that explains and is not code is Manim. Do not change to a flowchart for the control flow.

- A flowchart of `if key in items` shows boxes with code labels. The animation shows the key found and moved. The animation explains. The flowchart says the code again.
- Continuity is important. When the viewer has a picture of the data (a row of slots, a tree, two pointers), keep that picture. Let each decision act on it.
- Formulas, invariants, and complexity claims go in the same scenes, typeset with `Math()`.

An algorithm video is mostly `trace` scenes, one for each function or step. Add a `motion` or `math` scene where the behaviour or the cost is good to see without the code.

## A paper is explained with its own evidence

Read the paper into the project with `va paper` first. [paper.md](paper.md) tells you how, and how the plan answers to the abstract. A paper has its measurements and its pictures. The claims of the video are the claims of the paper. Thus, with the animation that explains the idea, show the results of the paper:

- The hook is still a Manim animation: the headline numbers of the paper, counted next to a picture of the thing that they measure.
- A result that comes later is a `number`, counted up on screen as the voice says it. Two numbers side by side (the paper and the earlier work) are the same scene.
- The thing that the paper compares against is a `contrast`: the alternatives as panels, each with its good point and its cost.
- A result across rounds, sizes, or baselines is a `chart`. Chart the values that the sentence compares, not the full table. A trade-off (score against cost) is a scatter: each system is one point.
- When the viewer must read the numbers, use a `table` of the rows that the sentence compares. Mark the row of the paper with `best`.
- Attention weights, a confusion matrix, or a different grid of values is a `matrix`.
- The figure of the paper is a `figure`. Do not draw again a figure that the authors drew. Point at their figure. Crop it to the panel that the sentence is about.
- A sentence that makes the claim better than a paraphrase is a `quote`. One in a video is sufficient.
- Do not show the code of the paper. Explain each mechanism as a full-frame animation. A `trace` scene in a paper video is an error, unless its `override` says that the viewer asked for the code, or the scene uses a code source that you declared next to the paper (its released code). See [paper.md](paper.md), "Its pictures", and [sources.md](sources.md).
- Each result tells where it is in the paper (`ref`: "Table 2") and which scene prepares it (`after`).

The tool draws these scenes from the storyboard. You build and render nothing first. See [scene-evidence.md](scene-evidence.md). The idea still gets an animation. A paper video made only of these scenes is a slide deck of the paper. A paper video with none of them asks the viewer to believe each number without evidence.

## Mixing renderers

A video can cut between Remotion, Manim, Archify, and HyperFrames scenes. Each scene goes to the renderer of its need. All scenes share one backdrop, one palette, and one caption style. Two rules prevent a video that looks stitched together:

- Use the need to select, not the renderer. Do not use a HyperFrames scene because it looks different. Use it when the viewer must see a change or a number.
- Keep one picture of a thing. If the code is first in a `change` scene, show the same excerpt, with the same title, in the `source` or `trace` scene that follows.

## When Archify earns its place

Use a diagram need when the things are separate parts that exist at the same time: services, processes, modules, queues, stores, people, pipeline stages. The test: the boxes are **nouns that the codebase names as components**, not steps of one procedure.

## Judgement the router cannot make

- **Use the cheaper picture when the two explain equally well.** `code` costs nothing to make and cannot be wrong.
- **One renderer for each scene.** If a scene wants two pictures, it is two scenes.
- **Concept, then code.** Show the behaviour or the structure first. Then show the lines that implement it. Let the narration connect them ("that one line is the jump you just saw").

## Worked examples

**An algorithm: an LRU cache class of 20 lines** (`"subject": "algorithm"`).

| # | Narration (summary) | `need` | Renderer |
|---|---|---|---|
| 1 | "A cache keeps what you asked for lately. A full cache has to forget a key, and the obvious choice is wrong" | `motion` | the full row, a new key arriving, the first-in key marked and then spared |
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

The vocabulary, the cue words, and each rule are in `runtime/lib/router.mjs`. The tests are in `runtime/test/router.test.mjs` (`npm test` in `runtime/`). To add a renderer:

1. Add a scene `kind` in `runtime/lib/storyboard.mjs`. Add it to `EVIDENCE` there if the tool draws it from the storyboard alone and shows its parts with `show`.
2. Add a prepare step in `runtime/lib/steps.mjs`.
3. Add a component in `runtime/src/scenes/`.
4. Add one or more needs in `NEEDS` that route to it.
5. Add a row to the table above. A test fails if a need is not on this page.
