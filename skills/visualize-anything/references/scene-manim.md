# Manim scenes

A Manim scene here is one clip inside a larger video. It has to last exactly as long as its narration, beat for beat, and look like it belongs next to the code and diagram scenes. The `va_manim` helper handles both.

## What to draw

Timing and layout are handled for you; what goes on screen is the part that decides whether the video explains anything. These patterns are the ones that work for algorithms and data structures.

- **Concrete data first.** Run the algorithm on one small, real input (seven to ten elements) before saying anything general. Show the actual array, tree, or queue. Never open with an abstract description.
- **One operation per beat.** A comparison, a swap, a pointer move, an eviction: one change, then let the viewer see it. If a beat has three changes, hold each to its words with `beat.until(...)`.
- **Colour is state, and it never changes meaning.** Use the state colours below for what each element is doing right now, the same way in every scene of the video.
- **Keep the object, change its state.** The viewer builds a picture of the data in the first animation. Every later scene should start from that picture, not a new one.
- **Show the invariant.** If the algorithm works because "everything left of `lo` is ruled out", colour that region and keep it coloured.
- **Numbers before formulas.** Show `4 > 3` on the actual values, then the rule. Show the range halving, then `log₂ n`.
- **Keep the count on screen.** When the narration claims a cost (looks, steps, moves, bytes), put a `Tally` beside the data and tick it as each step happens. Its last value is the number the voice says, and it lands on that word. `Race` in `examples/binary-search/video/manim/search.py` does this, one `Tally` per lane.
- **Label the thing, on the thing.** A name sits next to the object it names, in that object's colour when it has one. No legend in a corner: the viewer should not have to look away from the data to learn what it is.
- **Nothing moves without a reason.** An object moves when the data it stands for moves and changes colour when its state changes. Otherwise it stays put. See [story.md](story.md).

| The claim is about | Draw | Notes |
|---|---|---|
| An array, list, queue, or cache | `Cells([...])`, a row of labelled boxes | `mark()` cells with state colours; `pointer()` for indices such as `lo`, `mid`, `hi` |
| A loop running on data | A `trace` scene: `Cells` beside the code | The code cursor and the animation advance on the same words |
| Divide and conquer, recursion | `Net(..., root=...)`: a tree that grows downward, then resolves upward | Children appear under their parent; results light up leaf to root with `mark` |
| A graph or tree traversal | `Net`, coloured by visited / in the queue / done | Keep the queue or stack on screen as a second `Cells` row |
| Cost and growth | `axes` with one `curve` per complexity class, or a `bar_chart` that shrinks or grows | Annotate one concrete size (n = 1,000,000 → 20 steps) |
| Two approaches compared | The same input run twice, on `lanes(2)` or in `halves()`, each with its `Tally` | Same data, same colours, different step counts |
| Components and what passes between them | `Flow`, with `send` on the words that name each hand-off | An arrow the design leaves out is a dashed `Link`, shown and then taken away |
| Rounds or repeated attempts | `Track`, with `reach(i)` as each one finishes | Put the measure that changes beside it as a `Tally` |

State colours from `va_manim`:

| Name | Means | Colour |
|---|---|---|
| `UNVISITED` | Not looked at yet | grey |
| `FRONTIER` | Still a candidate: in range, queued, on the stack | cyan |
| `CURRENT` | Being examined in this step | amber |
| `SETTLED` | Done: found, sorted, finalised | green |
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

A shape for the story, when the topic allows a choice: a result that looks wrong and then the reason it is right; simple pieces that combine into something surprising; or one thing seen two ways that turn out to be the same.

## Start from the kit

Do not draw from scratch. `va_manim` has the pictures an explainer keeps needing already made, sized for this frame and coloured from this palette. Writing a scene is choosing from this table and saying what happens on which words.

| The sentence is about | Use | It gives you |
|---|---|---|
| A list, array, queue, cache, or window | `Cells([...], indices=True)` | `mark(i, colour)`, `mark_all(...)`, `pointer(i, "lo")`, `move_pointer(...)`, `move(i, j)` (one cell jumps to a new place and the rest close up), `swap(i, j)`, `span(i, j, "ruled out")`, `cell(i)` |
| A number said aloud | `Tally(end=n, unit="episodes", owner="2019 · from scratch")` | `to(n)` counts to it, `set(n)` ticks it by hand. The count never changes width and the unit never shifts; `unit=("look", "looks")` writes the singular at one |
| Parts and what passes between them: a pipeline, a request path, a loop | `Flow(["agent", "engine", "renderer"], notes=[...], on=["action", "geometry", "frame"], loop=True)` | `send(i)` runs a dot along arrow i, `mark(i, colour)`, `node(i)`, `link(i)` |
| One named thing, or an arrow you place yourself | `Node("engine", note="keeps the state")`, `Link(a, b, "frame", dashed=True)` | `mark(colour)`, `Link.send()` |
| Rounds, passes, epochs, versions | `Track(4, names=["round 1", "2", "3", "4"])` | `reach(i)` lights step i and those before it |
| Recursion, a hierarchy, a traversal, a dependency graph | `Net(vertices, edges, root=8)` (a tree), `Net(vertices, edges)` (a network) | `mark(v, colour)`, `walk(u, v)`; it is Manim's `Graph` underneath |
| How a cost grows | `ax = axes([0, 8, 2], [0, 64, 16])`, then `curve(ax, lambda n: n * n, "n²", color=ROSE)` | Manim's `Axes` and a plotted, named curve |
| A few measured values | `bar_chart(values, names, y_range=[0, 80, 20])` | Manim's `BarChart`; grow it with `chart.animate.change_bar_values(...)` |
| A range, a group, an invariant | `span(target, "never dropped")`, `row.span(0, 4, "kept")` | A brace with its word |
| The name of something | `tag(target, "the world they practise in", DOWN, color=ACCENT)` | A label placed beside the thing it names |
| The hook's own words | `claim("*1,000,000* items.\n*20* looks.")` | Large text with the starred words in the accent |
| This works, that does not | `verdict(True)`, `verdict(False)` | A tick or a cross in a ring |
| A formula | `Math("O(log n)")` | Typeset by Typst; see Formulas |
| Where things go | `fit(group)`, `halves()`, `lanes(2)` | Centre and shrink into the safe area; the two sides of a comparison; rows for the same data run more than once |

The rules that make this opinionated:

- **Kit first.** If a row above fits, use it. Do not rebuild a counter out of `Text`, a pipeline out of rectangles and arrows, or a tree out of circles and lines; the hand-built one will be a different size, a different colour, and wrong at the edges of the frame.
- **Everything returns animations.** `row.mark(2, CURRENT)`, `flow.send(0)`, `tally.to(20)`, `track.reach(1)`: each is something to hand to `self.play(...)`, so a beat reads as a list of what happens.
- **End every layout with `fit(...)`.** It centres the picture clear of the heading and the captions and shrinks it only if it has to. If it has to shrink much, there is too much on screen.
- **Drop to Manim only for the subject's own object.** A cache is `Cells`; a hide-and-seek arena with panels in it is not in the kit, so that one thing is drawn from Manim's shapes (next section) and everything around it still comes from the kit: the two numbers counted beside it are `Tally`s, and its caption is a `tag`.
- **Never another drawing library, never LaTeX.**
- **`va manim` holds you to it.** After each render it warns when a scene's script uses nothing from the kit, and when it calls a Manim class that typesets with LaTeX (`Integer`, `DecimalNumber`, `BarChart`, `MathTex`, numbered axes), naming the kit piece to use instead.

`runtime/python/va_gallery.py` draws every one of these on two stills. Render it (the command is at the top of the file) to see what you are choosing from, and after changing the kit.

## Manim's own primitives

For the one object the kit has no shape for, build it from what [Manim Community](https://github.com/ManimCommunity/manim) provides: its mobjects for what is on screen and its animations for how it changes. `from manim import *` brings all of them in, and its [reference](https://docs.manim.community/en/stable/reference.html) documents each. The kit is made of the same pieces: `Cells` is a `VGroup` of `RoundedRectangle` and `Text`, `Tally` is a `DecimalNumber`, `Net` is a `Graph`. The skill pins Manim to the release these were checked against (`manim==0.22.*`; override with `VA_MANIM_SPEC`).

| To show | Use | Notes |
|---|---|---|
| A thing | `Circle`, `Dot`, `Square`, `Rectangle`, `RoundedRectangle`, `Polygon`, `Triangle`, `Star`, `Ellipse`, `Arc`, `Annulus`, `Sector` | Colour and fill say what state it is in |
| A connection or a direction | `Line`, `DashedLine`, `Arrow`, `CurvedArrow` | An arrow that is deliberately absent is drawn as a `DashedLine` and then removed, not left out |
| Things that belong together | `VGroup(...)`, then `.arrange(RIGHT, buff=...)`, `.arrange_in_grid(...)` | Move and fade the group; recolour a member in a separate `play()` |
| Words and names | `Text`, `MarkupText`, `Paragraph` | `font=MONO` for identifiers and values, `font=SANS` for prose |
| A formula | `Math(...)` from `va_manim` | Never `MathTex` or `Tex` |
| Emphasis on something already there | `SurroundingRectangle`, `Underline`, `Cross`, `Brace` with `BraceText`, `BackgroundRectangle` | Add it, say the sentence, take it away |
| A measured quantity along a scale | `NumberLine(..., label_constructor=label)` | |
| A value tied to something moving | `ValueTracker` with `always_redraw(lambda: ...)` | For a plain count, `Tally` |
| A directed graph | `DiGraph(vertices, edges, labels={v: Text(...)})` | For a tree or an undirected graph, `Net` |
| A grid of values | `Table`, `IntegerTable`, `MobjectTable` | `table.get_cell((row, col))` to highlight one |
| The path something took | `TracedPath(dot.get_center)` | |

And for how it changes:

| To do | Use |
|---|---|
| Bring something in | `FadeIn(m, shift=UP * 0.2)`, `Create` (outlines), `Write` (text and formulas), `GrowFromCenter`, `GrowArrow`, `DrawBorderThenFill` |
| Take it away | `FadeOut`, `Uncreate`, `ShrinkToCenter` |
| Move it or change its state | `m.animate.shift(...)`, `.move_to(...)`, `.set_color(...)`, `.set_opacity(...)`; `MoveAlongPath` to follow a route |
| Turn one thing into another | `Transform` (keep using the first name), `ReplacementTransform` (keep using the second), `TransformFromCopy` (the original stays), `FadeTransform` |
| Point at it | `Indicate`, `Circumscribe`, `Flash`, `Wiggle`, `FocusOn`, `ShowPassingFlash` |
| Do several things | `AnimationGroup` (together), `LaggedStart(..., lag_ratio=0.15)` (one after another, overlapping), `Succession` (strictly in turn) |

What needs LaTeX, which is not installed here, and what to use in its place:

| Fails | Use |
|---|---|
| `MathTex`, `Tex` | `Math(...)`, `Text(...)` |
| `DecimalNumber(...)`, `Integer(...)`, `Variable` | `Count(...)`, or pass `mob_class=Text` |
| `BarChart(...)` | `bar_chart(...)`, or pass `x_axis_config` and `y_axis_config` with `"label_constructor": label` |
| `NumberLine(include_numbers=True)`, `Axes` with numbered axes, `ax.get_axis_labels("n", "t")` | `axes(...)`; `label_constructor=label`; pass `label(...)` or `Text` objects, never strings |
| `Graph(..., labels=True)` | `labels={vertex: Text(...)}` |
| `Matrix`, `MobjectMatrix`, `BraceLabel` | `MobjectTable`; `BraceText` |

## The shape of a script

Write `manim/<scene-id>.py`. Subclass `VAScene`, and put each narration beat's animation inside `with self.beat(i):`.

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

When a `with self.beat(i)` block ends, the scene waits out whatever is left of that beat's window, so the next beat starts in step with the voice. `b.duration` is the window in seconds and `b.text` is the narration line. If the animations inside a block take longer than the window, `va manim` reports the overrun; shorten the `run_time` values until it is clean.

Use one block per beat, in order, covering every beat in the storyboard. Read the budget `va tts` printed before choosing `run_time` values: a 3-second beat fits about two short animations.

### Beside the code: trace scenes

In a `trace` scene the clip is a 4:3 panel to the right of the code, not the full frame. Nothing is laid over it, so the safe bounds widen and the frame narrows: it is 10.7 units wide and 8 tall, `SAFE_TOP` and `SAFE_BOTTOM` are ±3.6, and `SAFE_LEFT` / `SAFE_RIGHT` give the horizontal bounds. `TRACE` is `True` when the script is being rendered this way. Centre the composition on the origin and make it fill the panel; a seven-cell row at `size=1.15` does.

The storyboard moves the code highlight (`lines` and `cues`); the script moves the data. Give both the same phrases: if the storyboard cues line 8 at "lo jumps", write `beat.until("lo jumps")` before the pointer moves.

### Carrying the picture across scenes

When the storyboard marks a scene `"continues": true`, it starts on the picture the previous scene ended on, with no fade between them. Put the opening picture on screen with `self.appear(...)`:

```python
class Get(VAScene):
    def construct(self):
        a, b, c = placed("ABC")            # the same helper the previous scene used
        with self.beat(0) as beat:
            self.appear(a, b, c, ruler, limit)   # already there if this scene continues; fades in if not
            beat.until("Say we ask for A")
            ...
```

Build both scenes' pictures with the same functions, and end the first scene in the exact state the second begins in (same objects, positions, and colours). `CONTINUES` is `True` when the scene is being rendered this way.

### Landing a move on a word

Inside a beat, `b.until("<phrase>")` holds until that phrase is spoken, so the next animation starts on the words that describe it. Use it instead of guessing a `self.wait()`.

```python
# "Reading a key, say A, counts as a use. So A jumps to the newest end, and the others shift down."
with self.beat(1) as b:
    self.play(FadeIn(call), run_time=0.8)          # the read is named first
    b.until("So A jumps")                          # then wait for the sentence to get there
    self.play(a.animate.shift(UP * 1.7), run_time=0.7)
    b.until("the others shift")
    self.play(rest.animate.shift(LEFT * 2.65), run_time=1.0)
```

The phrase must be words from that beat's narration; an unknown phrase is an error. If the animations before an anchor run long, `va manim` reports that the anchor was reached late; shorten them. A beat where everything happens in the first second and then nothing moves is what `va qc` flags as a still stretch: spread the moves across the sentence with `until`.

`va manim` sets resolution and frame rate from the storyboard. Do not set `config.pixel_width`, `config.frame_rate`, or `config.background_color` in the script.

Several scenes can share one file. When an algorithm takes two or three animation scenes, put them in one script with shared helpers (how an element is drawn, where slots sit) and point each scene's `script` at it, so the picture stays identical from scene to scene. Start each scene from the state the previous one ended in.

### Numbers come from the ledger

A number drawn on screen is read from the storyboard's `facts`, not typed: `Text(str(fact("scan-looks")))`. It is then the number `va facts` checked against the real code, and the one the voice says. A counter that counts as the animation runs is better still; the fact confirms where it stops. See [facts.md](facts.md).

## Formulas

Formulas are typeset by [Typst](https://typst.app/docs/reference/math/), which `va setup` downloads as a Python wheel. No LaTeX installation is involved, and `MathTex` and `Tex` should not be used.

```python
Math("O(log n)")                                   # Typst math syntax
Math("T(n) = 2 T(n/2) + n", color=ACCENT, font_size=56)
Math(r"\frac{n(n+1)}{2} = \sum_{i=1}^{n} i", latex=True)   # or write LaTeX
```

`Math` is a Manim mobject with one submobject per glyph, so `Write`, `FadeIn`, transforms, and `eq[0:4].animate.set_color(ROSE)` all work. A `Math` at a given `font_size` matches a `Text` at the same size. `Typst(markup)` typesets arbitrary Typst markup when a formula is not enough.

Typst math in brief, for when you are not passing `latex=True`:

| To get | Write | Not |
|---|---|---|
| fraction | `(n+1)/2` or `frac(n+1, 2)` | `\frac{n+1}{2}` |
| subscript, superscript | `x_i`, `x^2`, `x_(i+1)`, `2^(n-1)` | `x_{i+1}` |
| sum, product, integral | `sum_(i=1)^n i`, `product_(k=1)^n`, `integral_0^1` | `\sum_{i=1}^{n}` |
| root | `sqrt(x)`, `root(3, x)` | `\sqrt{x}` |
| relations | `<=`, `>=`, `!=`, `approx`, `->`, `=>` | `\le`, `\ge`, `\neq` |
| Greek and symbols | `alpha`, `theta`, `Theta`, `oo`, `dot`, `times` | `\alpha`, `\infty` |
| named functions | `log`, `min`, `max`, `floor(x)`, `ceil(x)`, `abs(x)` | `\log`, `\lfloor x \rfloor` |
| words inside math | `"entries" <= "capacity"` (quoted) | `\text{entries}` |
| labelled brace | `underbrace(3, "entries")` | `\underbrace{3}_{\text{entries}}` |
| matrix, vector | `mat(1, 2; 3, 4)`, `vec(x, y)` | `\begin{pmatrix}` |

In Typst math, adjacent letters form one name: write `n k` or `n dot k` for a product, since `nk` is read as an unknown variable. `latex=True` fetches a small Typst package the first time it is used.

## Matching the rest of the video

`from va_manim import *` provides:

| Name | Use |
|---|---|
| `TEXT`, `MUTED`, `DIM` | Primary text, secondary labels, de-emphasized parts |
| `ACCENT` | The thing being talked about (green, the video's main accent) |
| `CYAN`, `VIOLET`, `AMBER`, `ORANGE` | Second and third categories, attention, comparison |
| `ROSE` | Removal, error, eviction |
| `PANEL`, `BORDER`, `BG` | Filled surfaces and outlines; background is set for you |
| `MONO`, `SANS` | Font names: `MONO` for identifiers and values, `SANS` for prose labels |
| `Math`, `Typst` | Formulas and other typeset material (see Formulas below) |
| `Cells` | A row of labelled boxes with state colours and pointers (see What to draw) |
| `Tally`, `Flow`, `Node`, `Link`, `Track`, `Net`, `span`, `tag`, `claim`, `verdict`, `fit`, `halves`, `lanes` | The rest of the kit (see Start from the kit) |
| `Count`, `label`, `axes`, `curve`, `bar_chart` | Manim's `DecimalNumber`, `Text`, `Axes`, and `BarChart`, set in the video's typeface and palette with no LaTeX |
| `UNVISITED`, `FRONTIER`, `CURRENT`, `SETTLED`, `DISCARDED` | State colours |
| `SAFE_LEFT`, `SAFE_RIGHT`, `FRAME_WIDTH`, `TRACE` | Horizontal bounds, frame width, and whether this is a trace panel |
| `SAFE_TOP`, `SAFE_BOTTOM`, `SAFE_CENTER_Y` | Vertical bounds for content |

Layout rules:

- The frame is 14.2 units wide and 8 tall. Captions cover the bottom strip and the scene heading sits top-left, so keep everything between `SAFE_BOTTOM` (-2.5) and `SAFE_TOP` (3.0), and centre compositions on `SAFE_CENTER_Y`.
- Text smaller than `font_size=28` is hard to read in the final video, and in a trace panel, which is shown smaller, the floor is 36. `TEXT_SCALE` is 1.3 in a trace panel and 1 otherwise. `va manim` reports any text below the floor.
- Use only the colours `va_manim` provides. `va manim` reports Manim's own colour names (`BLUE`, `WHITE`, ...) and hex values outside the palette.
- Colour carries meaning across the whole video. If the diagram scene shows the cache in green, keep it green here.

## Things that go wrong

- **`MathTex` and `Tex`.** They need a LaTeX installation that most machines here do not have, and they fail at render time. Use `Math(...)` for formulas, `Text(..., font=MONO)` for identifiers and code, and `Tally` (or a bare `Count`) for values that count. Plain `DecimalNumber`, `Integer`, `BarChart`, and numbered axes fail the same way, because they typeset their digits with LaTeX; the table under Manim's own primitives has the replacement for each.
- **A Typst error.** `va manim` prints Typst's message with the offending formula. It is nearly always LaTeX syntax in a Typst string: fix the syntax using the table above, or add `latex=True`.
- **Animating a group and its member in one `play()`.** `self.play(g.animate.move_to(p), g[0].animate.set_color(c))` leaves `g[0]` behind, because both animations target the same mobject. Do the move, then the recolour, in separate `play()` calls.
- **Waiting by hand.** Do not add `self.wait()` at the end of a beat to pad it out; the `beat` block does that. Use `self.wait()` only for a pause between two animations inside a beat.
- **Drawing under the captions or heading.** `va manim` checks the rendered clip and warns, with times, when anything is drawn where the caption strip or the scene heading will sit. Move it inside the safe bounds.
- **Text overlap.** After `va manim`, capture stills (`va stills <project> <scene-id>`) and look. Position labels with `next_to(..., buff=...)` relative to what they describe instead of absolute coordinates where possible.
- **Leftovers.** Objects stay on screen until removed. `FadeOut` anything the next beat does not need.
- **`Create()` on text.** It traces letter outlines. Use `Write()` or `FadeIn()` for `Text` and `Math`.
- **`Transform(a, b)`, then animating `b`.** `b` was never added to the scene; `a` now looks like `b`. Use `ReplacementTransform(a, b)` when you will keep working with `b`.
- **`.animate` outside `play()`.** `mob.animate.shift(UP)` is an animation builder, not a mobject. It only does anything inside `self.play(...)`.
- **Order of chained `.animate` calls.** `.animate.scale(2).shift(RIGHT)` and `.animate.shift(RIGHT).scale(2)` end in different places.
- **A second name for the same object.** `other = mob` is not a copy. Use `mob.copy()`.
- **Stacked fractions in labels.** `Math("n/16")` is two lines tall and will climb out of a tight spot. Write an inline slash, `Math(r"n \/ 16")`, for labels.

## Running it

```bash
VA manim <project> [scene-id...]        # add --draft for a half-resolution pass
```

Output is normalized to the scene's exact frame count: if the animation is short, the last frame is held; if long, the end is trimmed. Both cases print a warning, and both mean the script's timing should be fixed rather than left to the safety net.

To preview a script on its own, without narration timing, run Manim directly with `va_manim` on the path:

```bash
PYTHONPATH=<skill>/runtime/python uv run --python 3.12 --with manim --with 'typst==0.15.*' manim -ql manim/<scene-id>.py <ClassName>
```
