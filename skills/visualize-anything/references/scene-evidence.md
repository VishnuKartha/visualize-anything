# Evidence scenes

Five scene kinds show what the source itself reports: its number, its comparison, its measurements, its words, its figure. They matter most when the subject is a paper, whose claims are only as good as the evidence it gives, but a benchmark in a README or a table in a design document is the same thing.

| `need` | Kind | It answers |
|---|---|---|
| `number` | `stat` | How much? How many? One number set large, or up to four side by side. |
| `contrast` | `compare` | What are the alternatives, and what does each get right and wrong? |
| `chart` | `chart` | How do these measurements compare, or change from one round to the next? |
| `quote` | `quote` | What exactly did the source claim? |
| `figure` | `figure` | What did the source draw, and where in it should I look? |

All five are drawn by Remotion straight from the storyboard. There is no script to write and no clip to render first, so `va stills` shows them as soon as `va tts` has run, and their layout is measured like a title's or a recap's.

They do not replace the explanation. The idea is still animated, in Manim or a diagram; these are the scenes either side of it that say what was measured and what it is being compared with. A video made only of them is a slide deck.

## How they move

Every evidence scene is made of parts (metrics, points, bars, marked phrases, callouts), and a beat's `show` says how many are on screen. Parts arrive as the voice reaches them: a number counts up to its value, a bar grows, a point slides in with its tick or cross, a phrase is marked.

- With no `show` anywhere, each beat brings the next part and the last beat shows everything. A `compare` brings a panel's points per beat. A `compare`, a `quote`, and a `figure` start bare when the scene has a beat to spare, so the frame is seen whole before anything in it is singled out.
- A number takes its time: it counts for nearly half the beat that brings it, and its `detail` line arrives as it lands. A long sentence that builds to its number is said over a number still on its way.
- To land a part on a word, use a cue: `{"at": "forty-one", "show": 2}`. This is how a long sentence keeps the picture moving; `va qc` reports an evidence scene that sits finished for more than six seconds while the voice carries on.
- `note` puts a callout under the picture for the beat that carries it. Use it for the qualification a number needs ("not a fair race: these agents arrive pretrained"), so the caveat is on screen at the same moment as the claim.

Every number these scenes show is held to the facts ledger like a number in the narration: a metric's value, a chart's values, a number inside a point or a quote. A chart's axis labels are the exception; "Round 1" names a position and measures nothing. For a paper, most numbers are the paper's own and nothing in the project computes them: give each a row with `"given"` saying where in the paper it is ("Table 2, bridge task, round 1"). See [facts.md](facts.md).

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
| `value` | The number as it should read: `"36"`, `"25,000,000"`, `"94.3"`, `"~4"`. It counts up to this without changing width. |
| `label` | What it counts or whose it is, in a few words. Shown small and in capitals. |
| `unit` | Optional: `"fps"`, `"episodes"`, `"%"`. |
| `detail` | Optional line under the number: what it means, or what it is compared with. |
| `delta` | Optional small badge: a change (`"+3.2"`), or a two-word qualifier. A leading `+` or `-` adds an arrow. |
| `tone` | `positive` (default, the accent), `negative`, `caution`, or `neutral`. It colours the number: use it to tell the old number from the new one, not to decorate. |

One metric is set as large as the frame allows, with rings drawing round it. Two to four become cards, all at one size, set by the longest value. Keep a scene to numbers that are compared with each other; four unrelated numbers are four scenes or none.

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

- `left` and `right`, or `panels` for three. Each has a `label`, one to four `points`, and an optional `tone` that tints its border and is the default for its points.
- A point is a line of text, or `{"text", "tone"}`: `positive` draws a tick, `negative` a cross, `caution` a warning mark, `neutral` a dash. Keep a point under about 60 characters; it wraps to two lines at most.
- `show` counts points across the panels in reading order. In the example, 1 and 2 are the simulator's, 3 and 4 the video model's. The panel whose point arrived last is lit and the others step back; once every point is on screen, all are lit.
- `"versus": true` puts a "vs" between two panels. Use it for a head-to-head; leave it off when the panels are two cases of the same thing.

Write the points in parallel. If the left panel says what it remembers and what it costs, the right says the same two things in the same order, so the viewer reads across.

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
| `values` | One number per label, zero or more. Or `series`: one to four of `{"label", "values"}` for grouped bars or several lines, with a legend. |
| `chart` | `"bar"` (default) or `"line"`. A line is for an ordered axis (rounds, sizes, time); bars are for separate things. |
| `unit` | Written after each value when there is one series: `"s"`, `"%"`. |
| `axis` | A short line in the chart's corner saying what is measured and which way is better. |

- `show` is how many labels have been drawn. Bars grow from the axis, a line draws out to its next point, and each value counts up as its mark arrives.
- `focus` names the labels or series the sentence is about. With one series, the bars in focus keep the accent and the rest fall back to slate.
- The axis always starts at zero. A chart that starts anywhere else exaggerates the difference it shows.
- Chart only the values the narration compares. A paper's table of forty cells is not a chart; the four that make the point are.

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

- `quote` is the source's words exactly, copied from it and not from memory. Nothing checks this for you; a misquotation is the one mistake here that names someone else.
- `highlight` is a phrase of the quote, or a list of them, marked one per `show`. The router checks each is in the quote.
- Keep it under about forty-five words. Longer than that, quote the sentence and say the rest.
- The voice should not read the quote out while it is on screen in different words. Either the narration says it as written, or it says what follows from it and lets the viewer read.

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

- `image` is a PNG, JPEG, WebP, or GIF in the project. Export a PDF figure to PNG first, at 1600 pixels wide or more. It is shown whole, at its own shape, on white.
- Each callout points at `x`, `y`, as percentages of the image from its top left. `side` is where the label stands from its point: `left`, `right`, `above`, or `below` (default: right of a point in the left of the image, left of one in the right). `va stills` is how you place them: look, move, look again.
- `show` counts callouts. The frame leans in a little toward the newest one; the earlier labels stay and step back.
- Use the figure the paper drew. Do not rebuild it as a chart or a diagram: the authors chose that picture, and theirs is the one a reader will recognise. Say where it is from in `caption`, and check you may reproduce it: a figure from an arXiv paper is under whatever licence the authors chose there.
- A dense figure cannot be read at video size. Crop the panel the narration is about before using it.

## What they are not for

- The opening. A video opens on a Manim animation of the hook, always; when the hook is a number, that animation counts it beside the thing it measures (`Count` in [scene-manim.md](scene-manim.md)). A `number` scene is for a result stated later.
- The recap: that is `recap`, which can show a moment of any of these beside a takeaway (`{"text": "...", "from": "bridge"}`). A `quote` has no picture to show there.
- How something works. A panel of ticks and crosses says that two things differ, never why. The scene after it has to show the why.
