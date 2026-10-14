# Manim scenes

A Manim scene in this skill is one clip in a larger video. It must have the exact length of its narration, beat for beat. It must look the same as the code and diagram scenes around it. The `va_manim` helper does these two things.

## What to draw

The helper controls the timing and the layout. The content on screen controls whether the video explains a thing. These patterns work for algorithms and data structures.

- **Show concrete data first.** Run the algorithm on one small, real input (seven to ten elements) before you say a general thing. Show the real array, tree, or queue. Do not open with an abstract description.
- **Do one operation in each beat.** A comparison, a swap, a pointer move, an eviction: one change, and then let the viewer see it. If a beat has three changes, hold each to its words with `beat.until(...)`.
- **Colour is state, and its meaning does not change.** Use the state colours below for the current work of each element. Use them the same way in each scene of the video.
- **Keep the object. Change its state.** The viewer builds a picture of the data in the first animation. Each subsequent scene starts from that picture, not from a new one.
- **Show the invariant.** If the algorithm works because "everything left of `lo` is ruled out", give that region a colour and keep it.
- **Numbers before formulas.** Show `4 > 3` on the real values, then the rule. Show the range halve, then `log₂ n`.
- **Keep the count on screen.** When the narration claims a cost (looks, steps, moves, bytes), put a `Tally` next to the data. Increment it at each step. Its last value is the number that the voice says, and it arrives on that word. `Race` in `examples/binary-search/video/manim/search.py` does this, with one `Tally` for each lane.
- **Put the label on the thing.** A name is next to the object that it names, in the colour of that object. Do not use a legend in a corner. The viewer must not look away from the data to learn what it is.
- **Nothing moves without a reason.** An object moves when its data moves. It changes colour when its state changes. If neither occurs, it stays. See [story.md](story.md).

| The claim is about | Draw | Notes |
|---|---|---|
| An array, list, queue, or cache | `Cells([...])`, a row of labelled boxes | `mark()` cells with state colours. `pointer()` for indices such as `lo`, `mid`, `hi` |
| A loop that runs on data | A `trace` scene: `Cells` next to the code | The code cursor and the animation move on the same words |
| Divide and conquer, recursion | `Net(..., root=...)`: a tree that grows down, then resolves up | Children come below their parent. Results light from leaf to root with `mark` |
| A graph or tree traversal | `Net`, with colours for visited, in the queue, and done | Keep the queue or the stack on screen as a second `Cells` row |
| Cost and growth | `axes` with one `curve` for each complexity class, or a `bar_chart` that grows or shrinks | Annotate one concrete size (n = 1,000,000 → 20 steps) |
| Two approaches compared | The same input run two times, on `lanes(2)` or in `halves()`, each with its `Tally` | Same data, same colours, different step counts |
| Components and the things that go between them | `Flow`, with `send` on the words that name each hand-off | An arrow that the design omits is a dashed `Link`: show it and then remove it |
| Rounds or repeated tries | `Track`, with `reach(i)` when each one is complete | Put the measure that changes next to it as a `Tally` |

State colours from `va_manim`:

| Name | Means | Colour |
|---|---|---|
| `UNVISITED` | Not examined | grey |
| `FRONTIER` | Still a candidate: in range, in the queue, on the stack | cyan |
| `CURRENT` | Examined in this step | amber |
| `SETTLED` | Done: found, sorted, final | green |
| `DISCARDED` | Ruled out, evicted, removed | rose |

`Cells` in brief:

```python
row = Cells([3, 8, 15, 23, 42, 57, 61], size=1.15, indices=True).move_to([0, SAFE_CENTER_Y, 0])
lo = row.pointer(0, "lo", FRONTIER)                      # a labelled arrow under cell 0
mid = row.pointer(3, "mid", CURRENT, below=False)        # or above it
self.play(FadeIn(row), FadeIn(lo))
self.play(row.mark(3, CURRENT))                          # recolour one cell
self.play(*row.mark_all(range(0, 4), DISCARDED, 0.06))   # or several
self.play(row.move_pointer(lo, 4))                       # slide a pointer to another cell
row.cell(5)                                              # the box and its label, as one group
```

When the topic permits a choice, give the story one of these shapes:

- a result that looks wrong, and then the reason that it is correct
- simple pieces that make a surprising thing together
- one thing seen two ways that are the same

## Start from the kit

Do not draw from nothing. `va_manim` has the pictures that an explainer needs again and again. They have the correct size for this frame and the colours of this palette. To write a scene, select from this table and say what occurs on which words.

| The sentence is about | Use | It gives you |
|---|---|---|
| A list, array, queue, cache, or window | `Cells([...], indices=True)` | `mark(i, colour)`, `mark_all(...)`, `pointer(i, "lo")`, `move_pointer(...)`, `move(i, j)` (one cell jumps to a new position and the others close), `swap(i, j)`, `span(i, j, "ruled out")`, `cell(i)` |
| A number said aloud | `Tally(end=n, unit="episodes", owner="2019 · from scratch")` | `to(n)` counts to it. `set(n)` increments it by hand. The width of the count does not change and the unit does not move. `unit=("look", "looks")` writes the singular at one |
| Parts and the things that go between them: a pipeline, a request path, a loop | `Flow(["agent", "engine", "renderer"], notes=[...], on=["action", "geometry", "frame"], loop=True)` | `send(i)` moves a dot along arrow i. `mark(i, colour)`, `node(i)`, `link(i)` |
| One named thing, or an arrow that you position | `Node("engine", note="keeps the state")`, `Link(a, b, "frame", dashed=True)` | `mark(colour)`, `Link.send()` |
| Rounds, passes, epochs, versions | `Track(4, names=["round 1", "2", "3", "4"])` | `reach(i)` lights step i and the steps before it |
| Recursion, a hierarchy, a traversal, a dependency graph | `Net(vertices, edges, root=8)` (a tree), `Net(vertices, edges)` (a network) | `mark(v, colour)`, `walk(u, v)`. It is the `Graph` of Manim |
| How a cost grows | `ax = axes([0, 8, 2], [0, 64, 16])`, then `curve(ax, lambda n: n * n, "n²", color=ROSE)` | The `Axes` of Manim and a named curve |
| A few measured values | `bar_chart(values, names, y_range=[0, 80, 20])` | The `BarChart` of Manim. Make it grow with `chart.animate.change_bar_values(...)` |
| A range, a group, an invariant | `span(target, "never dropped")`, `row.span(0, 4, "kept")` | A brace with its word |
| The name of a thing | `tag(target, "the world they practise in", DOWN, color=ACCENT)` | A label next to the thing that it names |
| The words of the hook | `claim("*1,000,000* items.\n*20* looks.")` | Large text with the starred words in the accent |
| This works, that does not | `verdict(True)`, `verdict(False)` | A tick or a cross in a ring |
| A formula | `Math("O(log n)")` | Typeset by Typst. See Formulas |
| Where things go | `fit(group)`, `halves()`, `lanes(2)` | Centre and shrink into the safe area. The two sides of a comparison. Rows for the same data run more than one time |

These rules make the kit strict:

- **Use the kit first.** If a row above fits, use it. Do not build a counter from `Text`, a pipeline from rectangles and arrows, or a tree from circles and lines. A hand-built picture has a different size and a different colour, and it is wrong at the edges of the frame.
- **Each kit function gives animations.** `row.mark(2, CURRENT)`, `flow.send(0)`, `tally.to(20)`, `track.reach(1)`: give each to `self.play(...)`. A beat then reads as a list of events.
- **End each layout with `fit(...)`.** It puts the picture in the centre, clear of the heading and the captions. It shrinks the picture only if necessary. If it must shrink much, there is too much on screen.
- **Use Manim directly only for the object of the subject.** A cache is `Cells`. A hide-and-seek arena with panels is not in the kit. Draw that one thing from the shapes of Manim (next section). Take all things around it from the kit: the two numbers next to it are `Tally`s, and its caption is a `tag`.
- **Do not use a different drawing library. Do not use LaTeX.**
- **`va manim` holds you to this.** After each render, it gives a warning when the script of a scene uses nothing from the kit. It also gives a warning when the script calls a Manim class that typesets with LaTeX (`Integer`, `DecimalNumber`, `BarChart`, `MathTex`, numbered axes). It names the kit piece to use.

`runtime/python/va_gallery.py` draws each kit piece on two stills. Render it (the command is at the top of the file) to see your choices, and after a change to the kit.

## Manim's own primitives

For the one object that the kit does not have, build it from [Manim Community](https://github.com/ManimCommunity/manim): its mobjects for the things on screen, and its animations for their changes. `from manim import *` imports all of them. Its [reference](https://docs.manim.community/en/stable/reference.html) documents each. The kit uses the same pieces: `Cells` is a `VGroup` of `RoundedRectangle` and `Text`, `Tally` is a `DecimalNumber`, and `Net` is a `Graph`. The skill pins Manim to the release that we tested (`manim==0.22.*`. Change it with `VA_MANIM_SPEC`).

| To show | Use | Notes |
|---|---|---|
| A thing | `Circle`, `Dot`, `Square`, `Rectangle`, `RoundedRectangle`, `Polygon`, `Triangle`, `Star`, `Ellipse`, `Arc`, `Annulus`, `Sector` | Colour and fill give its state |
| A connection or a direction | `Line`, `DashedLine`, `Arrow`, `CurvedArrow` | Draw an arrow that is absent on purpose as a `DashedLine` and then remove it. Do not omit it |
| Things that belong together | `VGroup(...)`, then `.arrange(RIGHT, buff=...)`, `.arrange_in_grid(...)` | Move and fade the group. Change the colour of a member in a separate `play()` |
| Words and names | `Text`, `MarkupText`, `Paragraph` | `font=MONO` for identifiers and values, `font=SANS` for prose |
| A formula | `Math(...)` from `va_manim` | Never `MathTex` or `Tex` |
| Emphasis on a thing that is there | `SurroundingRectangle`, `Underline`, `Cross`, `Brace` with `BraceText`, `BackgroundRectangle` | Add it, say the sentence, remove it |
| A measured quantity along a scale | `NumberLine(..., label_constructor=label)` | |
| A value tied to a thing that moves | `ValueTracker` with `always_redraw(lambda: ...)` | For a plain count, `Tally` |
| A directed graph | `DiGraph(vertices, edges, labels={v: Text(...)})` | For a tree or an undirected graph, `Net` |
| A grid of values | `Table`, `IntegerTable`, `MobjectTable` | `table.get_cell((row, col))` to highlight one |
| The path of a thing | `TracedPath(dot.get_center)` | |

For changes:

| To do | Use |
|---|---|
| Add a thing | `FadeIn(m, shift=UP * 0.2)`, `Create` (outlines), `Write` (text and formulas), `GrowFromCenter`, `GrowArrow`, `DrawBorderThenFill` |
| Remove it | `FadeOut`, `Uncreate`, `ShrinkToCenter` |
| Move it or change its state | `m.animate.shift(...)`, `.move_to(...)`, `.set_color(...)`, `.set_opacity(...)`. `MoveAlongPath` to follow a route |
| Change one thing into a different thing | `Transform` (continue to use the first name), `ReplacementTransform` (continue to use the second), `TransformFromCopy` (the original stays), `FadeTransform` |
| Point at it | `Indicate`, `Circumscribe`, `Flash`, `Wiggle`, `FocusOn`, `ShowPassingFlash` |
| Do some things | `AnimationGroup` (together), `LaggedStart(..., lag_ratio=0.15)` (one after the other, with overlap), `Succession` (strictly in turn) |

These need LaTeX, which is not installed. Use the replacement:

| Fails | Use |
|---|---|
| `MathTex`, `Tex` | `Math(...)`, `Text(...)` |
| `DecimalNumber(...)`, `Integer(...)`, `Variable` | `Count(...)`, or pass `mob_class=Text` |
| `BarChart(...)` | `bar_chart(...)`, or pass `x_axis_config` and `y_axis_config` with `"label_constructor": label` |
| `NumberLine(include_numbers=True)`, `Axes` with numbered axes, `ax.get_axis_labels("n", "t")` | `axes(...)`. `label_constructor=label`. Pass `label(...)` or `Text` objects, never strings |
| `Graph(..., labels=True)` | `labels={vertex: Text(...)}` |
| `Matrix`, `MobjectMatrix`, `BraceLabel` | `MobjectTable`. `BraceText` |

## The shape of a script

Write `manim/<scene-id>.py`. Make a subclass of `VAScene`. Put the animation of each narration beat in `with self.beat(i):`.

```python
from manim import *
from va_manim import *


class Halving(VAScene):
    def construct(self):
        cells = VGroup(*[Square(0.9, stroke_color=MUTED, stroke_width=3) for _ in range(8)]).arrange(RIGHT, buff=0.12)
        cells.move_to([0, SAFE_CENTER_Y, 0])

        # Beat 0: "Start with a sorted array of eight items."
        with self.beat(0):
            self.play(LaggedStart(*(Create(c) for c in cells), lag_ratio=0.1), run_time=1.6)

        # Beat 1: "Each comparison throws away half of what is left."
        with self.beat(1) as b:
            self.play(cells[4:].animate.set_stroke(DIM).set_opacity(0.3), run_time=min(1.2, b.duration))
            self.play(cells[:4].animate.set_stroke(ACCENT), run_time=0.6)
```

When a `with self.beat(i)` block ends, the scene waits for the remaining time of the window of that beat. The next beat thus starts in step with the voice. `b.duration` is the window in seconds, and `b.text` is the narration line. If the animations in a block are longer than the window, `va manim` reports the overrun. Decrease the `run_time` values until it is clean.

Use one block for each beat, in order, for all beats in the storyboard. Read the budget that `va tts` printed before you select `run_time` values. A beat of 3 seconds holds approximately two short animations.

### Beside the code: trace scenes

In a `trace` scene the clip is a 4:3 panel to the right of the code, not the full frame. Nothing is over it, so the safe area is larger and the frame is narrower:

- The frame is 10.7 units wide and 8 units tall.
- `SAFE_TOP` and `SAFE_BOTTOM` are ±3.6.
- `SAFE_LEFT` and `SAFE_RIGHT` give the horizontal limits.
- `TRACE` is `True` when the tool renders the script this way.

Put the composition in the centre, on the origin, and make it fill the panel. A row of seven cells at `size=1.15` does.

The storyboard moves the code highlight (`lines` and `cues`). The script moves the data. Give the two the same phrases. If the storyboard has a cue for line 8 at "lo jumps", write `beat.until("lo jumps")` before the pointer moves.

A trace scene is a weak picture when the two halves do not work together. Obey these rules:

- **Use a trace scene only for a video about code.** A paper video explains its mechanisms as full-frame animations ([paper.md](paper.md), "Its pictures").
- **Fill the panel from the first beat.** Build the full layout first, then put it in the centre. Do not draw one object at the top and add the others below it later. A panel that is one fifth full for the first beat looks incomplete. `va manim` measures this and gives a warning.
- **Make the objects large.** The panel shows at approximately 60% of the scale of a full frame. Seven cells must fill its width.
- **Each beat points at a line.** If a sentence is not about a line of the code, do not say it in this scene. Say it in a `motion` scene before, and bring the code on screen when the voice gets to the line. `va route` reports a beat that points at no line.
- **Use the names of the code in the picture.** If the line says `count >= B[i]`, the picture shows a count and a mark for `B`. The viewer must see that the two halves are the same thing.
- **Put a label on each object.** A dot without a name is not a request. The viewer cannot ask what it is.
- **Select the excerpt for the viewer.** Use the lines that the narration speaks about. Do not select a different function because its lines fit the 50 columns. If the real lines do not fit, do not show code. Animate the behaviour.

### Carrying the picture across scenes

When the storyboard marks a scene `"continues": true`, the scene starts on the last picture of the scene before it, with no fade. Put the opening picture on screen with `self.appear(...)`:

```python
class Get(VAScene):
    def construct(self):
        a, b, c = placed("ABC")            # the same helper the previous scene used
        with self.beat(0) as beat:
            self.appear(a, b, c, ruler, limit)   # already there if this scene continues; fades in if not
            beat.until("Say we ask for A")
            ...
```

Build the pictures of the two scenes with the same functions. End the first scene in the exact state where the second scene starts: the same objects, positions, and colours. `CONTINUES` is `True` when the tool renders the scene this way.

### Landing a move on a word

In a beat, `b.until("<phrase>")` holds until the voice says that phrase. The next animation then starts on the words that describe it. Use it. Do not guess a `self.wait()`.

```python
# "Reading a key, say A, counts as a use. So A jumps to the newest end, and the others shift down."
with self.beat(1) as b:
    self.play(FadeIn(call), run_time=0.8)          # the read is named first
    b.until("So A jumps")                          # then wait for the sentence to get there
    self.play(a.animate.shift(UP * 1.7), run_time=0.7)
    b.until("the others shift")
    self.play(rest.animate.shift(LEFT * 2.65), run_time=1.0)
```

The phrase must be words from the narration of that beat. An unknown phrase is an error. If the animations before an anchor are too long, `va manim` reports that the scene got to the anchor late. Make them shorter.

`va qc` flags a beat where all changes occur in the first second and then nothing moves. Put the moves across the sentence with `until`.

`va manim` sets the resolution and the frame rate from the storyboard. Do not set `config.pixel_width`, `config.frame_rate`, or `config.background_color` in the script.

Some scenes can share one file. When an algorithm has two or three animation scenes, put them in one script with shared helpers (how to draw an element, where the slots are). Point the `script` of each scene at that file. The picture then stays the same from scene to scene. Start each scene from the last state of the scene before it.

### Numbers come from the ledger

Read a number on screen from the `facts` of the storyboard. Do not type it: `Text(str(fact("scan-looks")))`. It is then the number that `va facts` compared with the real code, and the number that the voice says. A counter that counts while the animation runs is better. The fact confirms where it stops. See [facts.md](facts.md).

## Formulas

[Typst](https://typst.app/docs/reference/math/) typesets the formulas. `va setup` downloads it as a Python wheel. No LaTeX installation is necessary. Do not use `MathTex` and `Tex`.

```python
Math("O(log n)")                                   # Typst math syntax
Math("T(n) = 2 T(n/2) + n", color=ACCENT, font_size=56)
Math(r"\frac{n(n+1)}{2} = \sum_{i=1}^{n} i", latex=True)   # or write LaTeX
```

`Math` is a Manim mobject with one submobject for each glyph. Thus `Write`, `FadeIn`, transforms, and `eq[0:4].animate.set_color(ROSE)` all work. A `Math` at a given `font_size` has the same size as a `Text` at that size. `Typst(markup)` typesets Typst markup when a formula is not sufficient.

Typst math in brief, for when you do not pass `latex=True`:

| To get | Write | Not |
|---|---|---|
| fraction | `(n+1)/2` or `frac(n+1, 2)` | `\frac{n+1}{2}` |
| subscript, superscript | `x_i`, `x^2`, `x_(i+1)`, `2^(n-1)` | `x_{i+1}` |
| sum, product, integral | `sum_(i=1)^n i`, `product_(k=1)^n`, `integral_0^1` | `\sum_{i=1}^{n}` |
| root | `sqrt(x)`, `root(3, x)` | `\sqrt{x}` |
| relations | `<=`, `>=`, `!=`, `approx`, `->`, `=>` | `\le`, `\ge`, `\neq` |
| Greek and symbols | `alpha`, `theta`, `Theta`, `oo`, `dot`, `times` | `\alpha`, `\infty` |
| named functions | `log`, `min`, `max`, `floor(x)`, `ceil(x)`, `abs(x)` | `\log`, `\lfloor x \rfloor` |
| words in math | `"entries" <= "capacity"` (quoted) | `\text{entries}` |
| labelled brace | `underbrace(3, "entries")` | `\underbrace{3}_{\text{entries}}` |
| matrix, vector | `mat(1, 2; 3, 4)`, `vec(x, y)` | `\begin{pmatrix}` |

In Typst math, adjacent letters make one name. Write `n k` or `n dot k` for a product, because Typst reads `nk` as an unknown variable. `latex=True` gets a small Typst package the first time that you use it.

## Matching the rest of the video

`from va_manim import *` gives:

| Name | Use |
|---|---|
| `TEXT`, `MUTED`, `DIM` | Primary text, secondary labels, parts with less emphasis |
| `ACCENT` | The thing that the voice speaks about (green, the main accent of the video) |
| `CYAN`, `VIOLET`, `AMBER`, `ORANGE` | Second and third categories, attention, comparison |
| `ROSE` | Removal, error, eviction |
| `PANEL`, `BORDER`, `BG` | Filled surfaces and outlines. The tool sets the background |
| `MONO`, `SANS` | Font names: `MONO` for identifiers and values, `SANS` for prose labels |
| `Math`, `Typst` | Formulas and other typeset material (see Formulas) |
| `Cells` | A row of labelled boxes with state colours and pointers (see What to draw) |
| `Tally`, `Flow`, `Node`, `Link`, `Track`, `Net`, `span`, `tag`, `claim`, `verdict`, `fit`, `halves`, `lanes` | The other kit pieces (see Start from the kit) |
| `Count`, `label`, `axes`, `curve`, `bar_chart` | The `DecimalNumber`, `Text`, `Axes`, and `BarChart` of Manim, in the typeface and palette of the video, with no LaTeX |
| `UNVISITED`, `FRONTIER`, `CURRENT`, `SETTLED`, `DISCARDED` | State colours |
| `SAFE_LEFT`, `SAFE_RIGHT`, `FRAME_WIDTH`, `TRACE` | Horizontal limits, frame width, and whether this is a trace panel |
| `SAFE_TOP`, `SAFE_BOTTOM`, `SAFE_CENTER_Y` | Vertical limits for content |

Layout rules:

- The frame is 14.2 units wide and 8 units tall. The captions cover the bottom strip, and the scene heading is at the top left. Keep all content between `SAFE_BOTTOM` (-2.5) and `SAFE_TOP` (3.0). Put the centre of a composition on `SAFE_CENTER_Y`.
- Text smaller than `font_size=28` is hard to read in the final video. In a trace panel, which shows smaller, the minimum is 36. `TEXT_SCALE` is 1.3 in a trace panel and 1 in a full frame. `va manim` reports text below the minimum.
- Use only the colours of `va_manim`. `va manim` reports the colour names of Manim (`BLUE`, `WHITE`, ...) and hex values that are not in the palette.
- A colour has one meaning in the full video. If the diagram scene shows the cache in green, keep it green here.

## Things that go wrong

- **`MathTex` and `Tex`.** They need a LaTeX installation that most machines do not have, and they fail at render time. Use `Math(...)` for formulas, `Text(..., font=MONO)` for identifiers and code, and `Tally` (or a `Count`) for values that count. Plain `DecimalNumber`, `Integer`, `BarChart`, and numbered axes fail the same way, because they typeset their digits with LaTeX. The table in "Manim's own primitives" has the replacement for each.
- **A Typst error.** `va manim` prints the message of Typst with the formula that failed. The cause is almost always LaTeX syntax in a Typst string. Correct the syntax with the table above, or add `latex=True`.
- **A count and a restyle of the same number in one `play()`.** `self.play(ChangeDecimalToValue(n, 12), n.animate.set_color(ACCENT))` leaves the number on its old value: the voice says 12 and the screen still shows 40. The same occurs with `tally.to(9)` and `tally.animate`. Count in one `play()`, then recolour or move the number in the next. `va manim` reports this.
- **An animation of a group and its member in one `play()`.** `self.play(g.animate.move_to(p), g[0].animate.set_color(c))` leaves `g[0]` behind, because the two animations target the same mobject. Do the move and then the colour change in separate `play()` calls.
- **A wait by hand.** Do not add `self.wait()` at the end of a beat to fill it. The `beat` block does that. Use `self.wait()` only for a pause between two animations in a beat.
- **A drawing below the captions or the heading.** `va manim` examines the rendered clip. It gives a warning, with times, when a thing is drawn in the caption strip or the heading area. Move it into the safe area.
- **Text overlap.** After `va manim`, make stills (`va stills <project> <scene-id>`) and look. Position labels with `next_to(..., buff=...)` relative to the thing that they describe. Do not use absolute coordinates if you can prevent it.
- **Objects that stay.** Objects stay on screen until you remove them. `FadeOut` each object that the next beat does not need.
- **`Create()` on text.** It draws the outlines of the letters. Use `Write()` or `FadeIn()` for `Text` and `Math`.
- **`Transform(a, b)`, then an animation of `b`.** `b` was not added to the scene. `a` now looks like `b`. Use `ReplacementTransform(a, b)` when you continue to work with `b`.
- **`.animate` outside `play()`.** `mob.animate.shift(UP)` is an animation builder, not a mobject. It has an effect only in `self.play(...)`.
- **The order of chained `.animate` calls.** `.animate.scale(2).shift(RIGHT)` and `.animate.shift(RIGHT).scale(2)` end in different positions.
- **A second name for the same object.** `other = mob` is not a copy. Use `mob.copy()`.
- **A drawing in one corner.** `va manim` measures the area that the drawing fills. It gives a warning when the drawing fills less than 35% of a trace panel, or less than 12% of a full frame, for four seconds or more. Build the full layout first and put it in the centre. Make its parts larger. Put the things that arrive later in a position that leaves no hole.
- **Stacked fractions in labels.** `Math("n/16")` is two lines tall and goes out of a small space. Write an inline slash, `Math(r"n \/ 16")`, for labels.

## Running it

```bash
VA manim <project> [scene-id...]        # add --draft for a pass at half resolution
```

The tool sets the output to the exact frame count of the scene. If the animation is short, it holds the last frame. If the animation is long, it cuts the end. Each case prints a warning. Each case tells you to correct the timing of the script. Do not depend on this safety function.

To preview a script alone, without narration timing, run Manim directly with `va_manim` on the path:

```bash
PYTHONPATH=<skill>/runtime/python uv run --python 3.12 --with manim --with 'typst==0.15.*' manim -ql manim/<scene-id>.py <ClassName>
```
