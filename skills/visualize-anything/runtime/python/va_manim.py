"""
Manim helpers for visualize-anything.

A Manim scene here is one clip inside a larger narrated video. Two things must
hold for it to sit well next to the code and diagram scenes around it:

  * it lasts exactly as long as its narration, beat for beat, and
  * it uses the same palette, and keeps clear of the caption strip.

`VAScene.beat(i)` handles the first: animate inside the block and it waits out
whatever is left of beat i's window (or reports an overrun). The colour and
layout constants below handle the second.

Formulas are typeset by Typst, a self-contained LaTeX alternative that arrives
as a Python wheel, so no TeX installation is needed: `Math("O(log n)")`, or
`Math(r"\frac{n}{2}", latex=True)` for LaTeX syntax.

    from manim import *
    from va_manim import *

    class Halving(VAScene):
        def construct(self):
            bar = Rectangle(width=10, height=1, color=ACCENT)
            with self.beat(0):
                self.play(Create(bar), run_time=1.2)
            with self.beat(1) as b:
                self.play(bar.animate.stretch_to_fit_width(5), run_time=min(1.5, b.duration))
"""

import hashlib
import json
import os
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path

from manim import Scene, SVGMobject, config

try:
    import manimpango
    _FONTS = set(manimpango.list_fonts())
except Exception:  # font discovery is a nicety, never a reason to fail a render
    _FONTS = set()


def _first_installed(candidates, fallback):
    return next((name for name in candidates if name in _FONTS), fallback)


_theme_path = os.environ.get("VA_THEME") or str(Path(__file__).resolve().parent.parent / "theme.json")
THEME = json.loads(Path(_theme_path).read_text())

BG = THEME["bg"]
PANEL = THEME["panel"]
BORDER = THEME["panelBorder"]
TEXT = THEME["text"]
MUTED = THEME["muted"]
DIM = THEME["dim"]
ACCENT = THEME["accent"]   # green: the thing being talked about
CYAN = THEME["cyan"]
VIOLET = THEME["violet"]
AMBER = THEME["amber"]     # attention, comparison
ROSE = THEME["rose"]       # removal, error, eviction
ORANGE = THEME["orange"]

MONO = _first_installed(["JetBrains Mono", "SF Mono", "Menlo", "DejaVu Sans Mono", "Consolas"], "monospace")
SANS = _first_installed(["Inter", "SF Pro Display", "Helvetica Neue", "Arial", "DejaVu Sans"], "sans-serif")

# The frame is 8 units tall (y from -4 to 4). Captions cover the bottom strip and the
# scene heading sits top-left, so keep content between these lines.
SAFE_TOP = 3.0
SAFE_BOTTOM = -2.5
SAFE_CENTER_Y = (SAFE_TOP + SAFE_BOTTOM) / 2

config.background_color = BG


# Typst sets formulas at 10pt; this maps its points to Manim units so that a formula and a
# Text() at the same font_size read as the same size on screen.
_UNITS_PER_POINT_AT_SIZE_1 = 1 / 630
_STROKE_UNITS = 100  # Manim stroke widths are hundredths of a frame unit
_MITEX_VERSION = "0.2.7"  # Typst package that reads LaTeX math; fetched once, then cached


def _typst_svg(body: str, color: str) -> Path:
    try:
        import typst
    except ImportError as error:
        raise RuntimeError(
            "Typst is not available. Render through `va manim`, or add `--with typst` to your uv command."
        ) from error
    document = (
        "#set page(width: auto, height: auto, margin: 1pt, fill: none)\n"
        f'#set text(size: 10pt, fill: rgb("{color}"))\n{body}\n'
    )
    cache = Path(os.environ.get("VA_TYPST_CACHE") or Path(tempfile.gettempdir()) / "va-typst")
    cache.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256(document.encode()).hexdigest()[:24]
    svg = cache / f"{key}.svg"
    if not svg.exists():
        source = cache / f"{key}.typ"
        source.write_text(document)
        try:
            typst.compile(str(source), output=str(svg), format="svg")
        except Exception as error:
            raise ValueError(f"Typst could not typeset this:\n  {body}\n{error}") from error
    return svg


class Typst(SVGMobject):
    """Anything Typst can typeset, as a Manim mobject with one submobject per glyph.

    `markup` is raw Typst markup. For a formula, use `Math` instead.
    """

    def __init__(self, markup: str, *, color: str = TEXT, font_size: float = 48, **kwargs):
        super().__init__(str(_typst_svg(markup, color)), height=None, **kwargs)
        factor = font_size * _UNITS_PER_POINT_AT_SIZE_1
        self.scale(factor)
        # Rules such as fraction bars arrive as strokes, whose width Manim does not scale with the shape.
        for part in self.family_members_with_points():
            width = part.get_stroke_width()
            if width > 0:
                part.set_stroke(width=width * factor * _STROKE_UNITS)


class Math(Typst):
    """A formula. Typst math syntax by default; pass latex=True to write LaTeX instead.

        Math("O(log n)")                       Math("sum_(i=1)^n i = (n(n+1))/2")
        Math(r"\\frac{n}{2}", latex=True)       Math("T(n) = 2 T(n/2) + n", color=ACCENT)
    """

    def __init__(self, source: str, *, latex: bool = False, **kwargs):
        if latex:
            if "`" in source:
                raise ValueError("LaTeX source passed to Math(latex=True) cannot contain a backtick.")
            body = f'#import "@preview/mitex:{_MITEX_VERSION}": mitex\n#mitex(`{source}`)'
        else:
            body = f"$ {source} $"
        super().__init__(body, **kwargs)


class Beat:
    def __init__(self, index: int, duration: float, text: str):
        self.index = index
        self.duration = duration  # seconds this beat's visual window lasts
        self.text = text          # the narration line spoken during it


def _load_beats() -> list[Beat]:
    timeline_path = os.environ.get("VA_TIMELINE")
    scene_id = os.environ.get("VA_SCENE_ID")
    if not timeline_path or not scene_id:
        return []
    timeline = json.loads(Path(timeline_path).read_text())
    scene = next((s for s in timeline["scenes"] if s["id"] == scene_id), None)
    if scene is None:
        raise RuntimeError(f"Scene {scene_id!r} is not in {timeline_path}; run `va tts` first.")
    fps = timeline["fps"]
    return [Beat(i, b["cueFrames"] / fps, b["text"]) for i, b in enumerate(scene["beats"])]


class VAScene(Scene):
    """A Scene whose timing is owned by the narration. Render it with `va manim`."""

    def setup(self):
        super().setup()
        self.beats = _load_beats()
        self._beat_end = 0.0

    @contextmanager
    def beat(self, index: int):
        """Animate one narration beat. On exit, hold until the beat's window has elapsed."""
        if not self.beats:  # previewing outside `va manim`: no budget, just run
            yield Beat(index, 0.0, "")
            return
        if index >= len(self.beats):
            raise IndexError(f"beat({index}) but this scene has {len(self.beats)} narration beat(s)")
        current = self.beats[index]
        self._beat_end = sum(b.duration for b in self.beats[: index + 1])
        yield current
        remaining = self._beat_end - self.renderer.time
        if remaining > 1 / config.frame_rate:
            self.wait(remaining)
        elif remaining < -0.1:
            print(f"VA_OVERRUN beat {index} ran {-remaining:.2f}s past its {current.duration:.2f}s window: "
                  f"{current.text[:60]!r}", file=sys.stderr, flush=True)


__all__ = [
    "VAScene", "Beat", "Math", "Typst", "THEME", "BG", "PANEL", "BORDER", "TEXT", "MUTED", "DIM", "ACCENT", "CYAN", "VIOLET",
    "AMBER", "ROSE", "ORANGE", "MONO", "SANS", "SAFE_TOP", "SAFE_BOTTOM", "SAFE_CENTER_Y",
]
