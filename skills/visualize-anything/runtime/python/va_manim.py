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
import re
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path

from manim import BOLD, DOWN, UP, Arrow, FadeIn, RoundedRectangle, Scene, SVGMobject, Text, VGroup, config

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

# The frame is 8 units tall (y from -4 to 4) and as wide as the clip's shape makes it.
# Full-frame scenes sit under the caption strip and beside the scene heading, so their content
# stays between SAFE_BOTTOM and SAFE_TOP. A trace scene's clip is its own panel beside the code:
# nothing overlays it, so nearly the whole frame is usable and it is 10.7 units wide, not 14.2.
TRACE = os.environ.get("VA_LAYOUT") == "trace"
# True when the storyboard says this scene continues the one before it: the picture is already
# on screen when the scene starts, so nothing should fade in.
CONTINUES = os.environ.get("VA_CONTINUES") == "1"
# A trace panel is shown at about 60% of full-frame scale. Text set at TEXT_SCALE times its usual
# size reads the same there. Minimum sizes: 28 full-frame, 36 in a trace panel.
TEXT_SCALE = 1.3 if TRACE else 1.0
config.frame_width = config.frame_height * config.pixel_width / config.pixel_height
FRAME_WIDTH = config.frame_width
FRAME_HEIGHT = config.frame_height
SAFE_TOP = 3.6 if TRACE else 3.0
SAFE_BOTTOM = -3.6 if TRACE else -2.5
SAFE_CENTER_Y = (SAFE_TOP + SAFE_BOTTOM) / 2
SAFE_LEFT = -FRAME_WIDTH / 2 + 0.5
SAFE_RIGHT = FRAME_WIDTH / 2 - 0.5

# What a thing is doing right now, in the same colour throughout a video.
UNVISITED = THEME["dim"]     # not looked at yet
CURRENT = THEME["amber"]     # being examined in this step
FRONTIER = THEME["cyan"]     # queued, in range, still a candidate
SETTLED = THEME["accent"]    # done: sorted, found, finalised
DISCARDED = THEME["rose"]    # ruled out, evicted, removed

config.background_color = BG

_facts_path = os.environ.get("VA_FACTS")
_FACTS = json.loads(Path(_facts_path).read_text()) if _facts_path and Path(_facts_path).exists() else {}


def fact(name: str):
    """A value from the storyboard's "facts", by id.

    A number typed into a script can drift from the code it describes. Read it instead, so what is
    drawn is what `va facts` checked:

        looks = Text(str(fact("scan-looks")), font_size=40, color=AMBER)
    """
    if name not in _FACTS:
        raise KeyError(f'fact({name!r}): not in the storyboard\'s "facts". Known: {", ".join(sorted(_FACTS)) or "(none)"}')
    return _FACTS[name]


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


def _tokens(text: str) -> list[str]:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).split()


class Cells(VGroup):
    """A row of labelled boxes: the usual picture of an array, list, or queue.

        row = Cells([3, 8, 15, 23, 42]).move_to([0, SAFE_CENTER_Y, 0])
        self.play(row.mark(2, CURRENT))            # recolour one cell
        self.play(*row.mark_all(range(0, 2), DISCARDED))
        lo = row.pointer(0, "lo")                  # a labelled arrow under a cell
        self.play(row.move_pointer(lo, 3))
    """

    def __init__(self, values, *, size: float = 1.0, gap: float = 0.14, font_size: float = None, indices: bool = False, **kwargs):
        super().__init__(**kwargs)
        font_size = font_size or 36 * TEXT_SCALE
        self.size, self.gap = size, gap
        self.boxes, self.labels = VGroup(), VGroup()
        for i, value in enumerate(values):
            box = RoundedRectangle(width=size, height=size, corner_radius=0.1 * size, stroke_color=UNVISITED,
                                   stroke_width=3.5, fill_color=UNVISITED, fill_opacity=0.12)
            box.move_to([i * (size + gap), 0, 0])
            label = Text(str(value), font=MONO, font_size=font_size, color=TEXT, weight=BOLD).move_to(box)
            self.boxes.add(box)
            self.labels.add(label)
        self.add(self.boxes, self.labels)
        if indices:
            self.index_labels = VGroup(*[
                Text(str(i), font=MONO, font_size=font_size * 0.6, color=MUTED).next_to(box, UP, buff=0.12)
                for i, box in enumerate(self.boxes)
            ])
            self.add(self.index_labels)
        self.center()

    def cell(self, i: int) -> VGroup:
        return VGroup(self.boxes[i], self.labels[i])

    def mark(self, i: int, color: str, fill: float = 0.2):
        """An animation that recolours cell i. Pass it to self.play()."""
        return self.boxes[i].animate.set_stroke(color).set_fill(color, fill)

    def mark_all(self, indices, color: str, fill: float = 0.2):
        return [self.mark(i, color, fill) for i in indices]

    def pointer(self, i: int, name: str, color: str = CURRENT, below: bool = True) -> VGroup:
        """A labelled arrow pointing at cell i from below (or above)."""
        direction = DOWN if below else UP
        clear = 0.12 + (0.55 if not below and hasattr(self, "index_labels") else 0)  # stay off the index numbers
        tip = self.boxes[i].get_edge_center(direction) + direction * clear
        arrow = Arrow(tip + direction * 0.7, tip, buff=0, stroke_width=5, color=color, max_tip_length_to_length_ratio=0.35)
        label = Text(name, font=MONO, font_size=28 * TEXT_SCALE, color=color).next_to(arrow, direction, buff=0.1)
        marker = VGroup(arrow, label)
        marker.below = below
        return marker

    def move_pointer(self, marker: VGroup, i: int):
        """An animation that slides a pointer made by pointer() to cell i."""
        return marker.animate.set_x(self.boxes[i].get_x())


class Beat:
    def __init__(self, index: int, duration: float, text: str, lead: float = 0.0, words=None):
        self.index = index
        self.duration = duration  # seconds this beat's visual window lasts
        self.text = text          # the narration line spoken during it
        self._lead = lead         # seconds from the window opening to the first word
        self._words = words or []
        self._scene = None
        self._start = 0.0

    def time_of(self, phrase: str):
        """Seconds into this beat's window at which `phrase` is spoken, or None if it is not said."""
        needle = _tokens(phrase)
        timed = [(token, word["start"]) for word in self._words for token in _tokens(word["text"])]
        spoken = [token for token, _ in timed]
        for i in range(len(spoken) - len(needle) + 1):
            if needle and spoken[i:i + len(needle)] == needle:
                return self._lead + timed[i][1]
        said = _tokens(self.text)
        for i in range(len(said) - len(needle) + 1):
            if needle and said[i:i + len(needle)] == needle and self._words:
                begin, finish = self._words[0]["start"], self._words[-1]["end"]
                return self._lead + begin + (finish - begin) * i / len(said)
        return None

    def until(self, phrase: str, lead: float = 0.1):
        """Hold until `phrase` is spoken, so the next animation lands on that word.

            with self.beat(1) as b:
                self.play(FadeIn(label), run_time=0.6)
                b.until("jumps to the newest end")
                self.play(a.animate.shift(RIGHT * 4), run_time=1.2)
        """
        scene = self._scene
        if scene is None:  # previewing outside `va manim`: there is no narration to wait for
            return
        at = self.time_of(phrase)
        if at is None:
            raise ValueError(f'beat({self.index}).until({phrase!r}): that phrase is not in this beat: {self.text!r}')
        remaining = self._start + max(0.0, at - lead) - scene.renderer.time
        if remaining > 1 / config.frame_rate:
            scene.wait(remaining)
        elif remaining < -0.2:
            print(f"VA_LATE beat {self.index} reached {phrase!r} {-remaining:.2f}s after it was spoken",
                  file=sys.stderr, flush=True)


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
    return [Beat(i, b["cueFrames"] / fps, b["text"], lead=(b["from"] - b["cue"]) / fps, words=b.get("words"))
            for i, b in enumerate(scene["beats"])]


class VAScene(Scene):
    """A Scene whose timing is owned by the narration. Render it with `va manim`."""

    def setup(self):
        super().setup()
        self.beats = _load_beats()
        self._beat_end = 0.0

    def appear(self, *mobjects, run_time: float = 0.7):
        """Put the scene's opening picture on screen. Fades it in, unless this scene continues the
        previous one, in which case it is simply there, exactly as that scene left it."""
        if CONTINUES:
            self.add(*mobjects)
        else:
            self.play(*(FadeIn(mobject) for mobject in mobjects), run_time=run_time)

    @contextmanager
    def beat(self, index: int):
        """Animate one narration beat. On exit, hold until the beat's window has elapsed."""
        if not self.beats:  # previewing outside `va manim`: no budget, just run
            yield Beat(index, 0.0, "")
            return
        if index >= len(self.beats):
            raise IndexError(f"beat({index}) but this scene has {len(self.beats)} narration beat(s)")
        current = self.beats[index]
        current._scene = self
        current._start = sum(b.duration for b in self.beats[:index])
        self._beat_end = current._start + current.duration
        yield current
        remaining = self._beat_end - self.renderer.time
        if remaining > 1 / config.frame_rate:
            self.wait(remaining)
        elif remaining < -0.1:
            print(f"VA_OVERRUN beat {index} ran {-remaining:.2f}s past its {current.duration:.2f}s window: "
                  f"{current.text[:60]!r}", file=sys.stderr, flush=True)


__all__ = [
    "VAScene", "Beat", "Math", "Typst", "Cells", "fact", "THEME", "TRACE", "CONTINUES", "TEXT_SCALE", "FRAME_WIDTH", "FRAME_HEIGHT", "SAFE_LEFT", "SAFE_RIGHT",
    "UNVISITED", "CURRENT", "FRONTIER", "SETTLED", "DISCARDED", "BG", "PANEL", "BORDER", "TEXT", "MUTED", "DIM", "ACCENT", "CYAN", "VIOLET",
    "AMBER", "ROSE", "ORANGE", "MONO", "SANS", "SAFE_TOP", "SAFE_BOTTOM", "SAFE_CENTER_Y",
]
