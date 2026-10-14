# Evidence scenes

Seven scene kinds show the things that the source reports: its number, its comparison, its measurements, its table, a grid of its values, its words, its figure. They are most important when the subject is a paper, because the claims of a paper are only as good as its evidence. A benchmark in a README or a table in a design document is the same thing.

| `need` | Kind | The question it answers |
|---|---|---|
| `number` | `stat` | How much? How many? One large number, or four at most side by side. |
| `contrast` | `compare` | What are the alternatives, and what does each get right and wrong? |
| `chart` | `chart` | How do these measurements compare, or change from one round to the next? Which system wins a trade-off? |
| `table` | `table` | What exactly did each row score, and which row is the source's own? |
| `matrix` | `matrix` | What does this grid of values look like: where is it strong, where is it weak? |
| `quote` | `quote` | What exactly did the source claim? |
| `figure` | `figure` | What did the source draw, and where must I look in it? |

Remotion draws all seven from the storyboard. You write no script and render no clip first. `va stills` shows them immediately after `va tts`. The tool measures their layout as it does for a title or a recap.

They do not replace the explanation. Animate the idea in Manim or in a diagram. These scenes go before and after it, and say what was measured and what it is compared with. A video made only of these scenes is a slide deck.

## How they move

Each evidence scene has parts: metrics, points, bars, marked phrases, callouts. The `show` of a beat gives the number of parts on screen. Parts arrive when the voice gets to them: a number counts up to its value, a bar grows, a point slides in with its tick or cross, a phrase gets a mark.

- With no `show`, each beat adds the next part and the last beat shows all parts. A `compare` adds the points of one panel in each beat. A `compare`, a `quote`, and a `figure` start empty when the scene has a spare beat. The viewer thus sees the full frame before a part of it gets attention.
- A number takes time. It counts for almost half of the beat that adds it. Its `detail` line arrives when it stops. A long sentence that builds to its number is said over a number that still counts.
- To put a part on a word, use a cue: `{"at": "forty-one", "show": 2}`. A long sentence keeps the picture in motion this way. `va qc` reports an evidence scene that is complete and still for more than six seconds while the voice continues.
- `note` puts a callout below the picture for its beat. Use it for the qualification that a number needs ("not a fair race: these agents arrive pretrained"). The caveat is then on screen at the same moment as the claim.

The facts ledger holds each number in these scenes, as it holds a number in the narration: the value of a metric, the values of a chart, a number in a point or a quote. The axis labels of a chart are the exception. "Round 1" names a position and measures nothing.

For a paper, most numbers belong to the paper, and nothing in the project calculates them. Give each a row with `"given"` and its location in the paper ("Table 2, bridge task, round 1"). See [facts.md](facts.md).

## Where it comes from, and what comes before it

Evidence from a document (a paper, a design doc, documentation) has two more fields. See [sources.md](sources.md).

| Field | Meaning |
|---|---|
| `ref` | The location in the document: `"Table 2"`, `"Figure 4"`, `"Section 3.1"`, `"Abstract"`. A `figure` caption or a `quote` attribution that starts with one is also correct. `va paper` and `va sources` give the number of each figure and table. |
| `after` | The id of the earlier scene that prepares this one: the scene that explains the thing that the viewer sees measured or drawn. |
| `source` | Which source the scene shows, when there is more than one. Use `null` for a picture of the video's own, for example a toy matrix that you calculated. No source reports it. |

The router asks for `ref` and `after` on a `stat`, `chart`, `table`, `matrix`, or `figure` from a document. A `quote` needs only `ref`. An `after` that names a later scene is an error.

## `stat`: the number

```json
{
  "id": "result",
  "need": "number",
  "why": "The two numbers the paper sets against each other, counted up as they are said.",
  "heading": "hide-and-seek, twice",
  "metrics": [
    {"value": "~25,000,000", "unit": "episodes", "label": "2019 · from scratch", "detail": "before one agent built a shelter", "tone": "negative"},
    {"value": "4", "unit": "rounds", "label": "This paper", "detail": "to the same shelter"}
  ],
  "beats": [
    {"say": "In 2019, agents playing hide-and-seek needed about twenty-five million episodes before one of them built a shelter."},
    {"say": "In this paper, agents do it by their fourth round."},
    {"say": "They start out knowing far more, so it is not a fair race.", "note": "Not a fair race: these agents arrive pretrained"}
  ]
}
```

| Metric field | Meaning |
|---|---|
| `value` | The number as it must read: `"36"`, `"25,000,000"`, `"94.3"`, `"~4"`. It counts up to this value and its width does not change. |
| `label` | The thing that it counts or its owner, in a few words. It shows small and in capitals. |
| `unit` | Optional: `"fps"`, `"episodes"`, `"%"`. |
| `detail` | Optional. A line below the number: its meaning, or the thing that it is compared with. |
| `delta` | Optional. A small badge: a change (`"+3.2"`), or a qualifier of two words. A `+` or `-` at the start adds an arrow. |
| `tone` | `positive` (the default, the accent), `negative`, `caution`, or `neutral`. It sets the colour of the number. Use it to show the old number and the new number as different. Do not use it as decoration. |

One metric is as large as the frame permits, with rings around it. Two to four metrics become cards of one size, which the longest value sets. Keep a scene to numbers that are compared with each other. Four numbers with no relation are four scenes or none.

## `compare`: the contrast

```json
{
  "id": "jobs",
  "need": "contrast",
  "why": "The problem: each existing kind of world does one of the two jobs and fails the other.",
  "heading": "what a practice world has to do",
  "title": "Two jobs: *remember* exactly, and *look real*",
  "left": {"label": "A simulator", "points": [{"text": "Remembers exactly what happened", "tone": "positive"}, {"text": "Each new scene needs its own artwork", "tone": "negative"}]},
  "right": {"label": "A video model", "points": [{"text": "Looks real", "tone": "positive"}, {"text": "State is buried in frames nobody can read", "tone": "negative"}]},
  "beats": [
    {"say": "A practice world has two jobs: remember exactly what happened, and look real."},
    {"say": "A simulator remembers, but each new scene needs its own artwork.", "show": 1, "cues": [{"at": "each new scene", "show": 2}]},
    {"say": "A video model looks real, but its state is buried in frames nobody can read or fix.", "show": 3, "cues": [{"at": "its state", "show": 4}]}
  ]
}
```

- Use `left` and `right`, or `panels` for three. Each has a `label` and one to four `points`. An optional `tone` gives a tint to its border and is the default for its points.
- A point is a line of text, or `{"text", "tone"}`. `positive` draws a tick, `negative` a cross, `caution` a warning mark, and `neutral` a dash. Keep a point shorter than approximately 60 characters. It wraps to two lines at most.
- `show` counts points across the panels in reading order. In the example, 1 and 2 belong to the simulator, and 3 and 4 to the video model. The panel with the newest point is lit and the others step back. When all points are on screen, all panels are lit.
- `"versus": true` puts "vs" between two panels. Use it for a direct comparison. Omit it when the panels are two cases of the same thing.

Write the points in parallel. If the left panel says what it remembers and what it costs, the right panel says the same two things in the same order. The viewer then reads across.

## `chart`: the measurements

```json
{
  "id": "bridge",
  "need": "chart",
  "why": "The one measure the paper reports per round: it falls, and the chart shows by how much.",
  "heading": "one-lane bridge",
  "title": "Seconds for two cars to *swap ends*",
  "labels": ["Round 1", "Round 4"],
  "values": [71, 41],
  "unit": "s",
  "axis": "seconds, lower is better",
  "beats": [
    {"say": "On a one-lane bridge, two cars took seventy-one seconds to swap ends in round one, and forty-one by round four.", "show": 1, "cues": [{"at": "forty-one", "show": 2, "focus": ["Round 4"]}]}
  ]
}
```

| Field | Meaning |
|---|---|
| `labels` | Two to thirty-two positions along the axis, in order. Labels that do not fit under their bar are set at an angle. Above sixteen, the values are not written on each bar: show a whole distribution this way (each game of a benchmark, sorted), and say what its shape shows. |
| `values` | One number for each label. Or `series`: one to four of `{"label", "values"}` for grouped bars or some lines, with a legend. A value can be less than zero. |
| `errors` | Optional, in a series: the ± that the source reports for each value. Each is drawn as a whisker on its bar. |
| `stack` | Optional, in a series of a bar chart: series with the same `stack` are one bar, each drawn on top of the one before. Use it for a total and its parts: a run time that is setup plus training. Each part shows its value inside it, and the bar shows the total above it. |
| `chart` | `"bar"` (the default), `"line"`, or `"scatter"`. A line is for an ordered axis (rounds, sizes, time). Bars are for separate things. A scatter is for a trade-off. |
| `unit` | Written after each value when there is one series: `"s"`, `"%"`. |
| `axis` | A short line in the corner of the chart. It says what is measured and which direction is better. |

- `show` is the number of labels drawn. Bars grow from the axis. A line draws to its next point. Each value counts up when its mark arrives.
- `focus` names the labels or series that the sentence is about. With one series, the bars in focus keep the accent and the others become slate.
- The axis of a bar or line chart always starts at zero. A bar that starts at a different value makes the difference look larger than it is. A scatter is different: the eye reads a point by its position, not its length, so the axes of a scatter fit the data.
- Chart only the values that the narration compares. A table of forty cells is not a chart. The four cells that make the point are.

### A chart of changes: the result on each case

An ablation or a comparison with a control is a result on each dataset, task, or setting. One count ("better on 13 of 14") hides the sizes of the differences and the case that went the other way. When the brief has the time and the interest for it, chart the change on each case:

```json
{
  "id": "vary",
  "need": "chart",
  "why": "The paper's ablation, dataset by dataset: what varying the graph gains over freezing it.",
  "ref": "Table 16",
  "after": "compose",
  "title": "Varying the graph, against *freezing* it",
  "labels": ["Cora", "CiteSeer", "PubMed", "Physics"],
  "values": [2.70, 0.84, 0.88, -0.04],
  "unit": "pts",
  "axis": "accuracy gained over Frozen, points",
  "beats": [{"say": "...", "focus": ["Physics"]}]
}
```

- Each value is a difference that the oracle calculates from two `given` cells of the table. Thus the two cells are checked against the paper, and the difference is calculated, not typed.
- A value below zero draws down from the zero line, in rose. The values show their sign.
- Use `errors` for the ± of the source when the sentence says that a difference is larger or smaller than the noise. Give the ± of the values that the chart draws.

### A scatter: the trade-off

```json
{
  "id": "tradeoff",
  "need": "chart",
  "chart": "scatter",
  "why": "Score against cost is a trade-off, so each model is one point that both measures place.",
  "ref": "Table 2",
  "after": "idea",
  "axis": "BLEU, EN-DE (higher is better)",
  "across": "training cost, 10^18 FLOPs (lower is better)",
  "series": [
    {"label": "Earlier models", "points": [{"x": 9.6, "y": 25.16, "label": "ConvS2S"}, {"x": 20, "y": 26.03, "label": "MoE"}]},
    {"label": "Transformer", "points": [{"x": 3.3, "y": 27.3, "label": "base"}, {"x": 23, "y": 28.4, "label": "big"}]}
  ],
  "beats": [
    {"say": "Put cost along the bottom and score up the side."},
    {"say": "The base model is up and to the left: better, and cheaper than all of them.", "focus": ["base"]}
  ]
}
```

- Give `points` (one series) or `series` (one to four of `{"label", "points"}`). Each point is `{"x", "y", "label"}`. Use two to sixteen points in total.
- `axis` tells what is measured up the side. `across` tells what is measured along the bottom. Each tells which direction is better. Both are necessary: a trade-off with no direction is only two numbers.
- `show` counts points, across the series in order. `focus` names point labels or series.

## `table`: the rows that the sentence compares

```json
{
  "id": "results",
  "need": "table",
  "why": "The results of the paper, cut to the rows that the sentence compares.",
  "ref": "Table 2",
  "after": "idea",
  "columns": ["Model", "EN-DE BLEU", "EN-FR BLEU", "Training FLOPs"],
  "rows": [["ConvS2S", "25.16", "40.46", "9.6e18"], ["MoE", "26.03", "40.56", "2.0e19"], ["Transformer (big)", "28.4", "41.8", "2.3e19"]],
  "best": "Transformer (big)",
  "highlight": "EN-DE BLEU",
  "caption": "Table 2, newstest2014",
  "beats": [
    {"say": "Against the strongest models of the time, on English to German translation."},
    {"say": "The big Transformer scores twenty-eight point four, the best in the table.", "focus": ["Transformer (big)"]}
  ]
}
```

| Field | Meaning |
|---|---|
| `columns` | Two to five headings. The first heading names each row. |
| `rows` | One to six rows, with one cell for each column. Write a cell as it must read (`"28.4"`, `"9.6e18"`). Numbers count up when their row arrives. |
| `best` | The name (the first cell) of the row of the source. The tool tints it, gives it an accent edge, and makes its values bold. Mark one in each table from a document. |
| `highlight` | One or more columns that the sentence is about. The heading gets the accent. The values are bold. |
| `caption` | A line under the table that tells where it comes from. |

- The header is on screen from the start. `show` counts rows. Each row comes in when the voice gets to it. If the scene has a beat to spare, the table starts empty.
- `focus` names rows (by their first cell) or columns. The others step back.
- Keep the rows that the sentence compares. Cut a table of twenty rows to the three or four rows that make the point. If the omitted rows are important, the narration says so.

## `matrix`: a grid of values

```json
{
  "id": "weights",
  "need": "matrix",
  "source": null,
  "why": "A toy of what attention calculates: each row is the weights of one word over the sentence.",
  "rows": ["the", "cat", "sat"],
  "columns": ["the", "cat", "sat"],
  "values": [[0.6, 0.3, 0.1], [0.2, 0.5, 0.3], [0.1, 0.6, 0.3]],
  "axis": "each row sums to 1",
  "beats": [
    {"say": "Attention is a grid of weights: each word decides how much to look at each other word."},
    {"say": "Here, sat looks mostly at cat.", "focus": ["sat"]}
  ]
}
```

| Field | Meaning |
|---|---|
| `rows`, `columns` | Two to eight labels each. |
| `values` | One row of numbers for each row label, with one number for each column. |
| `scale` | Optional `[low, high]`: the values for the faintest and the strongest colour. The default is from zero (or the lowest value, if it is less than zero) to the highest. Set it when you compare two matrices, so one colour shows the same value in both. |
| `center` | Optional. The value that means no change: 0 for a difference, 1 for a ratio. Cells above it shade toward the accent, and cells below it toward rose, each by its distance from the centre. A scale that crosses zero has the centre 0 by default. Use it for a grid of gains and losses. |
| `numbers` | `false` shows the colours only. Use it for a grid that is too large to read cell by cell (more than six columns). The facts ledger does not examine values that are not shown. |
| `axis` | A short line under the grid: what a row is, or what the values are. |

- `show` counts rows. Each row fills from left to right when the voice gets to it.
- `focus` names rows or columns. Their cells stay bright. The others become dim. "sat looks at cat" is `"focus": ["sat"]`.
- A matrix that you calculate for the video (a toy) is `"source": null`, and its values come from `facts.py`. A matrix from the paper (a confusion matrix in its appendix) has a `ref`, the same as other evidence.

## `quote`: the source's words

```json
{
  "id": "claim",
  "need": "quote",
  "why": "The paper states the separation in one sentence, more exactly than a paraphrase would.",
  "quote": "...",
  "highlight": ["the phrase that carries the claim"],
  "attribution": "Abstract",
  "beats": [{"say": "The authors put it in one sentence."}, {"say": "..."}]
}
```

- `quote` is the exact words of the source. Copy them from the source, not from memory. No tool examines this. An incorrect quotation is the one mistake here that puts words in the mouth of a named person.
- `highlight` is a phrase of the quote, or a list of phrases. Each `show` marks one. The router makes sure that each is in the quote.
- Keep it shorter than approximately forty-five words. For a longer text, quote the sentence and say the remainder.
- The voice must not read the quote in different words while it is on screen. The narration says it as written, or it says what follows from it and lets the viewer read.

## `figure`: the source's figure

```json
{
  "id": "frames",
  "need": "figure",
  "why": "The agents see only rendered frames; the paper's own figure shows what one looks like.",
  "heading": "what the agent sees",
  "image": "figures/rendered-frames.png",
  "caption": "Figure 4: frames the renderer draws from bare geometry",
  "callouts": [
    {"label": "Bare geometry in", "x": 18, "y": 40},
    {"label": "Rendered frame out", "x": 74, "y": 40, "side": "below"}
  ],
  "beats": [
    {"say": "They see only rendered frames: no coordinates, no map."},
    {"say": "..."},
    {"say": "..."}
  ]
}
```

- `image` is a PNG, JPEG, WebP, or GIF in the project. Export a PDF figure to PNG first, at 1600 pixels wide or more. The tool shows it complete, at its own shape, on white.
- Each callout points at `x`, `y`, as percentages of the image from its top left. `side` is the position of the label from its point: `left`, `right`, `above`, or `below`. The default is right of a point in the left of the image, and left of a point in the right. Use `va stills` to position them: look, move, look again.
- `show` counts callouts. The frame moves a small distance to the newest callout. The earlier labels stay and step back.
- Use the figure of the paper. Do not build it again as a chart or a diagram. The authors selected that picture, and a reader recognises it. Give its source in `caption`. Make sure that you can reproduce it: a figure from an arXiv paper has the licence that the authors selected there.
- A viewer cannot read a dense figure at video size. Show the panel that the narration is about with `crop`: `{"x", "y", "width", "height"}`, as percentages of the image from its top left. The tool shows only that region, at its own shape. The callout positions are then percentages of the region that the viewer sees.
- `va paper` puts the figures of a paper in `paper/figures/`. `va sources <project> --figures` exports the figures of a design doc or documentation to `figures/` as PNGs.

## What they are not for

- **The opening.** A video always opens on a Manim animation of the hook. When the hook is a number, that animation counts it next to the thing that it measures (`Count` in [scene-manim.md](scene-manim.md)). A `number` scene is for a result that comes later.
- **The recap.** That is `recap`. It can show a moment of one of these scenes next to a takeaway (`{"text": "...", "from": "bridge"}`). A `quote` has no picture to show there.
- **How a thing works.** A panel of ticks and crosses says that two things are different. It does not say why. The next scene must show why.
