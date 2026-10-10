# Manim scenes

A Manim scene here is one clip inside a larger video. It has to last exactly as long as its narration, beat for beat, and look like it belongs next to the code and diagram scenes. The `va_manim` helper handles both.

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

`va manim` sets resolution and frame rate from the storyboard. Do not set `config.pixel_width`, `config.frame_rate`, or `config.background_color` in the script.

Several scenes can share one file. When an algorithm takes two or three animation scenes, put them in one script with shared helpers (how an element is drawn, where slots sit) and point each scene's `script` at it, so the picture stays identical from scene to scene. Start each scene from the state the previous one ended in.

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
| `SAFE_TOP`, `SAFE_BOTTOM`, `SAFE_CENTER_Y` | Vertical bounds for content |

Layout rules:

- The frame is 14.2 units wide and 8 tall. Captions cover the bottom strip and the scene heading sits top-left, so keep everything between `SAFE_BOTTOM` (-2.5) and `SAFE_TOP` (3.0), and centre compositions on `SAFE_CENTER_Y`.
- Text smaller than `font_size=28` is hard to read in the final video. Prefer fewer, larger labels.
- Colour carries meaning across the whole video. If the diagram scene shows the cache in green, keep it green here.

## Things that go wrong

- **`MathTex` and `Tex`.** They need a LaTeX installation that most machines here do not have, and they fail at render time. Use `Math(...)` for formulas, `Text(..., font=MONO)` for identifiers and code, and `DecimalNumber` or `Integer` for values that count.
- **A Typst error.** `va manim` prints Typst's message with the offending formula. It is nearly always LaTeX syntax in a Typst string: fix the syntax using the table above, or add `latex=True`.
- **Animating a group and its member in one `play()`.** `self.play(g.animate.move_to(p), g[0].animate.set_color(c))` leaves `g[0]` behind, because both animations target the same mobject. Do the move, then the recolour, in separate `play()` calls.
- **Waiting by hand.** Do not add `self.wait()` at the end of a beat to pad it out; the `beat` block does that. Use `self.wait()` only for a pause between two animations inside a beat.
- **Text overlap.** After `va manim`, capture stills (`va stills <project> <scene-id>`) and look. Position labels with `next_to(..., buff=...)` relative to what they describe instead of absolute coordinates where possible.
- **Leftovers.** Objects stay on screen until removed. `FadeOut` anything the next beat does not need.

## Running it

```bash
VA manim <project> [scene-id...]        # add --draft for a half-resolution pass
```

Output is normalized to the scene's exact frame count: if the animation is short, the last frame is held; if long, the end is trimmed. Both cases print a warning, and both mean the script's timing should be fixed rather than left to the safety net.

To preview a script on its own, without narration timing, run Manim directly with `va_manim` on the path:

```bash
PYTHONPATH=<skill>/runtime/python uv run --python 3.12 --with manim --with 'typst==0.15.*' manim -ql manim/<scene-id>.py <ClassName>
```
