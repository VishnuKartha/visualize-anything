# Evidence scenes

Five scene kinds show the things that the source reports: its number, its comparison, its measurements, its words, its figure. They are most important when the subject is a paper, because the claims of a paper are only as good as its evidence. A benchmark in a README or a table in a design document is the same thing.

| `need` | Kind | The question it answers |
|---|---|---|
| `number` | `stat` | How much? How many? One large number, or four at most side by side. |
| `contrast` | `compare` | What are the alternatives, and what does each get right and wrong? |
| `chart` | `chart` | How do these measurements compare, or change from one round to the next? |
| `quote` | `quote` | What exactly did the source claim? |
| `figure` | `figure` | What did the source draw, and where must I look in it? |

Remotion draws all five from the storyboard. You write no script and render no clip first. `va stills` shows them immediately after `va tts`. The tool measures their layout as it does for a title or a recap.

They do not replace the explanation. Animate the idea in Manim or in a diagram. These scenes go before and after it, and say what was measured and what it is compared with. A video made only of these scenes is a slide deck.

## How they move

Each evidence scene has parts: metrics, points, bars, marked phrases, callouts. The `show` of a beat gives the number of parts on screen. Parts arrive when the voice gets to them: a number counts up to its value, a bar grows, a point slides in with its tick or cross, a phrase gets a mark.

- With no `show`, each beat adds the next part and the last beat shows all parts. A `compare` adds the points of one panel in each beat. A `compare`, a `quote`, and a `figure` start empty when the scene has a spare beat. The viewer thus sees the full frame before a part of it gets attention.
- A number takes time. It counts for almost half of the beat that adds it. Its `detail` line arrives when it stops. A long sentence that builds to its number is said over a number that still counts.
- To put a part on a word, use a cue: `{"at": "forty-one", "show": 2}`. A long sentence keeps the picture in motion this way. `va qc` reports an evidence scene that is complete and still for more than six seconds while the voice continues.
- `note` puts a callout below the picture for its beat. Use it for the qualification that a number needs ("not a fair race: these agents arrive pretrained"). The caveat is then on screen at the same moment as the claim.

The facts ledger holds each number in these scenes, as it holds a number in the narration: the value of a metric, the values of a chart, a number in a point or a quote. The axis labels of a chart are the exception. "Round 1" names a position and measures nothing.

For a paper, most numbers belong to the paper, and nothing in the project calculates them. Give each a row with `"given"` and its location in the paper ("Table 2, bridge task, round 1"). See [facts.md](facts.md).

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
| `labels` | Two to twelve positions along the axis, in order. |
| `values` | One number for each label, zero or more. Or `series`: one to four of `{"label", "values"}` for grouped bars or some lines, with a legend. |
| `chart` | `"bar"` (the default) or `"line"`. A line is for an ordered axis (rounds, sizes, time). Bars are for separate things. |
| `unit` | Written after each value when there is one series: `"s"`, `"%"`. |
| `axis` | A short line in the corner of the chart. It says what is measured and which direction is better. |

- `show` is the number of labels drawn. Bars grow from the axis. A line draws to its next point. Each value counts up when its mark arrives.
- `focus` names the labels or series that the sentence is about. With one series, the bars in focus keep the accent and the others become slate.
- The axis always starts at zero. A chart that starts at a different value makes the difference look larger than it is.
- Chart only the values that the narration compares. A table of forty cells is not a chart. The four cells that make the point are.

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
- A viewer cannot read a dense figure at video size. Crop the panel that the narration is about before you use it.

## What they are not for

- **The opening.** A video always opens on a Manim animation of the hook. When the hook is a number, that animation counts it next to the thing that it measures (`Count` in [scene-manim.md](scene-manim.md)). A `number` scene is for a result that comes later.
- **The recap.** That is `recap`. It can show a moment of one of these scenes next to a takeaway (`{"text": "...", "from": "bridge"}`). A `quote` has no picture to show there.
- **How a thing works.** A panel of ticks and crosses says that two things are different. It does not say why. The next scene must show why.
