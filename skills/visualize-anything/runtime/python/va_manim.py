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

from functools import partial

import numpy as np
from manim import (
    BOLD, DOWN, LEFT, RIGHT, TAU, UP, AnimationGroup, Arrow, Axes, BarChart, Brace, ChangeDecimalToValue, Circle, CurvedArrow,
    DashedLine, DecimalNumber, Dot, FadeIn, FadeOut, Graph, Line, MoveAlongPath, RoundedRectangle, Scene, Succession, SVGMobject,
    Text, VGroup, VMobject, config,
)

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
            box.va_row = label.va_row = id(self)  # for on_screen(): the row is one thing to look at
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

    def move(self, i: int, j: int) -> list:
        """Animations that carry cell i to position j over the others, which close up behind it:
        a key refreshed to the newest end, an element inserted into its place. Play them together,
        and play them before asking for the next move. Afterwards cell j is the one that moved."""
        slots = [box.get_center() for box in self.boxes]
        order = list(range(len(self.boxes)))
        order.insert(j, order.pop(i))
        moves = []
        for now, was in enumerate(order):
            if now == was:
                continue
            cell = VGroup(self.boxes[was], self.labels[was])
            # The one that was asked to move goes over the top; the rest slide along the row.
            arc = {"path_arc": -1.1 if j > i else 1.1} if was == i else {}
            moves.append(cell.animate(**arc).shift(slots[now] - slots[was]))
        self.boxes.submobjects = [self.boxes[k] for k in order]
        self.labels.submobjects = [self.labels[k] for k in order]
        return moves

    def swap(self, i: int, j: int) -> list:
        """Animations that exchange cells i and j, one passing over the other: a swap in a sort."""
        a, b = VGroup(self.boxes[i], self.labels[i]), VGroup(self.boxes[j], self.labels[j])
        gap = self.boxes[j].get_center() - self.boxes[i].get_center()
        for group in (self.boxes, self.labels):
            group.submobjects[i], group.submobjects[j] = group.submobjects[j], group.submobjects[i]
        return [a.animate(path_arc=-1.1).shift(gap), b.animate(path_arc=-1.1).shift(-gap)]

    def span(self, first: int, last: int, text, direction=DOWN, **kwargs) -> VGroup:
        """A brace under (or over) cells first to last, with a word on it."""
        over = VGroup(*self.boxes[first : last + 1])
        if hasattr(self, "index_labels") and np.array_equal(direction, UP):
            over.add(*self.index_labels[first : last + 1])  # clear the index numbers too
        return span(over, text, direction, **kwargs)


# Manim's own primitives for numbers and charts typeset their digits with LaTeX unless told otherwise,
# and there is no LaTeX here. These hand them the video's typeface instead, and its palette, and
# otherwise leave them as Manim made them: everything in Manim's documentation for the class applies.

def label(text, **kwargs) -> Text:
    """What Manim is given wherever it would typeset a number or a name: Text, in the video's monospace."""
    kwargs.setdefault("font", MONO)
    kwargs.setdefault("color", MUTED)
    return Text(str(text), **kwargs)


class Count(DecimalNumber):
    """Manim's DecimalNumber for a value that counts on screen: whole, with thousands separators.

        looks = Count(0, color=ACCENT, font_size=72)
        self.play(ChangeDecimalToValue(looks, fact("scan-looks")), run_time=2)   # or looks.set_value(n)

    Pass `num_decimal_places=1` for a measurement, `unit` and the rest as for DecimalNumber.
    """

    def __init__(self, number: float = 0, *, color: str = TEXT, font_size: float = 48, **kwargs):
        kwargs.setdefault("num_decimal_places", 0)
        kwargs.setdefault("group_with_commas", True)
        kwargs.setdefault("mob_class", partial(Text, font=MONO, weight=BOLD))
        super().__init__(number, color=color, font_size=font_size, **kwargs)


def axes(x_range, y_range, **kwargs) -> Axes:
    """Manim's Axes in the video's palette, with its numbers set as Text. `ax.plot(...)`, `ax.c2p(...)`,
    `ax.get_axis_labels(label("n"), label("steps"))` and the rest work as documented."""
    axis = {"color": MUTED, "stroke_width": 3, "include_tip": False, "label_constructor": label, "font_size": 30 * TEXT_SCALE}
    kwargs["axis_config"] = {**axis, **kwargs.get("axis_config", {})}
    return Axes(x_range=x_range, y_range=y_range, **kwargs)


def bar_chart(values, names=None, *, colors=None, **kwargs) -> BarChart:
    """Manim's BarChart in the video's palette, with its labels set as Text.

        chart = bar_chart([71, 68, 45, 41], ["round 1", "2", "3", "4"], y_range=[0, 80, 20])
        self.play(chart.animate.change_bar_values([71, 68, 45, 41]))   # grow bars from an all-zero chart
        chart.get_bar_labels(label_constructor=label, color=TEXT)      # the value over each bar
    """
    axis = {"color": MUTED, "label_constructor": label, "font_size": 30 * TEXT_SCALE}
    for name in ("x_axis_config", "y_axis_config"):
        kwargs[name] = {**axis, **kwargs.get(name, {})}
    kwargs.setdefault("bar_fill_opacity", 0.85)
    return BarChart(values, bar_names=names, bar_colors=colors or [ACCENT], **kwargs)


# ---------------------------------------------------------------------------------------------
# The kit. The pictures an explainer keeps needing, already made: a named box, an arrow between two,
# a pipeline with something travelling along it, a number that counts with its unit, steps along a
# line, a tree, a brace over a range, a verdict. Each is built from Manim's own mobjects, sized for
# this frame and coloured from this palette, and each hands back animations to pass to self.play().
# Reach for these first. A scene written with them is mostly a list of what happens when.

def _size(font_size, default):
    return font_size or default * TEXT_SCALE


def _edge(mobject, toward, buff):
    """Where a line from the middle of `mobject` toward a point leaves its bounding box."""
    shape = getattr(mobject, "box", mobject)
    center = shape.get_center()
    way = np.array(toward) - center
    if np.linalg.norm(way[:2]) < 1e-6:
        return center
    reach = min(
        (shape.width / 2 + buff) / abs(way[0]) if abs(way[0]) > 1e-6 else np.inf,
        (shape.height / 2 + buff) / abs(way[1]) if abs(way[1]) > 1e-6 else np.inf,
    )
    return center + way * min(reach, 1)


class Node(VGroup):
    """A named thing: a box with its name in it, and optionally a line saying what it does.

        engine = Node("engine", note="keeps the state", color=CYAN)
        self.play(engine.mark(ACCENT))        # recolour it when the sentence turns to it
    """

    def __init__(self, name, *, note=None, color: str = MUTED, width: float = None, height: float = None, font_size: float = None, **kwargs):
        super().__init__(**kwargs)
        self.label = Text(str(name), font=SANS, font_size=_size(font_size, 34), color=TEXT, weight=BOLD)
        words = VGroup(self.label)
        if note:
            self.note = Text(str(note), font=SANS, font_size=28 * TEXT_SCALE, color=MUTED)
            words.add(self.note)
            words.arrange(DOWN, buff=0.16)
        self.box = RoundedRectangle(width=width or words.width + 0.9, height=height or words.height + 0.7, corner_radius=0.18,
                                    stroke_color=color, stroke_width=3.5, fill_color=color, fill_opacity=0.12)
        words.move_to(self.box)
        self.add(self.box, words)

    def mark(self, color: str, fill: float = 0.22):
        """An animation that recolours the box."""
        return self.box.animate.set_stroke(color).set_fill(color, fill)


class Link(VGroup):
    """An arrow from the edge of one thing to the edge of another, with an optional word on it.

        call = Link(agent, engine, "action")
        gone = Link(frame, engine, dashed=True, color=ROSE)     # the arrow the design leaves out
        self.play(GrowArrow(call.line), FadeIn(call.label))
    """

    def __init__(self, start, end, text=None, *, color: str = MUTED, dashed: bool = False, bend: float = 0, buff: float = 0.14, font_size: float = None, **kwargs):
        super().__init__(**kwargs)
        a, b = _edge(start, end.get_center(), buff), _edge(end, start.get_center(), buff)
        if bend:
            # A bent arrow leaves and arrives by the same side of both things, and goes round.
            side = DOWN if bend < 0 else UP
            a, b = start.get_edge_center(side) + side * buff, end.get_edge_center(side) + side * buff
            self.line = CurvedArrow(a, b, angle=bend, color=color, stroke_width=4, tip_length=0.24)
        elif dashed:
            self.line = DashedLine(a, b, color=color, stroke_width=4, dash_length=0.16).add_tip(tip_length=0.24, tip_width=0.24)
        else:
            self.line = Arrow(a, b, buff=0, color=color, stroke_width=4, tip_length=0.24, max_tip_length_to_length_ratio=0.5, max_stroke_width_to_length_ratio=20)
        self.add(self.line)
        self.label = None
        if text:
            flat = abs(b[0] - a[0]) >= abs(b[1] - a[1])
            away = (DOWN if bend < 0 else UP) if flat else RIGHT
            spot = self.line.point_from_proportion(0.5) if bend else (a + b) / 2
            self.label = Text(str(text), font=SANS, font_size=_size(font_size, 28), color=color).next_to(spot, away, buff=0.16)
            self.add(self.label)

    def mark(self, color: str):
        return self.animate.set_color(color)

    def send(self, color: str = ACCENT, *, run_time: float = 0.8):
        """An animation: a dot leaves the tail, travels the arrow, and is gone at the head."""
        token = Dot(self.line.get_start(), radius=0.13, color=color)
        return Succession(FadeIn(token, run_time=0.12), MoveAlongPath(token, self.line, run_time=run_time), FadeOut(token, run_time=0.12))


class Flow(VGroup):
    """Stages joined by arrows: a pipeline, a request path, a loop. The stages are `Node`s.

        loop = Flow(["agent", "engine", "renderer"], notes=[None, "keeps the state", "only draws"], on=["action", "geometry", "frame"], loop=True)
        self.play(FadeIn(loop))
        self.play(loop.send(0))                    # a dot travels from stage 0 to stage 1
        self.play(loop.mark(1, CYAN))              # recolour a stage
        loop.node(2), loop.link(1)                 # the pieces, to animate yourself

    `on` names the arrows, in order; with `loop=True` there is one more arrow, from the last stage
    back to the first, and one more name for it. The flow is scaled down to fit the frame if it is too wide.
    """

    def __init__(self, names, *, notes=None, colors=None, on=None, loop: bool = False, gap: float = 1.5, **kwargs):
        super().__init__(**kwargs)
        names = list(names)
        pick = lambda values, i: values[i] if values and i < len(values) else None
        # An arrow has to be longer than the word written on it.
        longest = max((Text(str(word), font=SANS, font_size=28 * TEXT_SCALE).width for word in (on or [])[: len(names) - 1] if word), default=0)
        self.nodes = VGroup(*[Node(name, note=pick(notes, i), color=pick(colors, i) or MUTED) for i, name in enumerate(names)]).arrange(RIGHT, buff=max(gap, longest + 0.9))
        self.links = VGroup(*[Link(self.nodes[i], self.nodes[i + 1], pick(on, i)) for i in range(len(names) - 1)])
        if loop:
            self.links.add(Link(self.nodes[-1], self.nodes[0], pick(on, len(names) - 1), bend=-TAU / 5))
        self.add(self.nodes, self.links)
        fit(self)

    def node(self, i: int) -> Node:
        return self.nodes[i]

    def link(self, i: int) -> Link:
        return self.links[i]

    def mark(self, i: int, color: str, fill: float = 0.22):
        return self.nodes[i].mark(color, fill)

    def send(self, i: int, color: str = ACCENT, *, run_time: float = 0.8):
        """An animation: a dot travels arrow i, from stage i to the next (the last arrow of a loop goes back to the first)."""
        return self.links[i].send(color, run_time=run_time)


class Tally(VGroup):
    """A number that counts, what it counts, and whose it is: the figure the voice says, arriving on screen.

        episodes = Tally(end=fact("shelter-episodes"), unit="episodes", owner="2019 · from scratch")
        self.play(FadeIn(episodes))
        self.play(episodes.to(fact("shelter-episodes")), run_time=3)

    `unit=("look", "looks")` writes the singular while the count stands at one (with `set`; `to` runs
    past one too quickly to matter). Give `end`, the largest value it will reach: the unit is placed clear of that, so nothing shifts
    as the digits change, and the count starts at the smallest number with as many digits (10,000,000
    for 25,000,000; 1 for 4) so its width never changes either. Pass `value` to start somewhere else.
    """

    def __init__(self, value: float = None, *, end: float = None, unit="", owner: str = None, color: str = TEXT, font_size: float = 72, **kwargs):
        super().__init__(**kwargs)
        if value is None:
            value = 10 ** (len(str(int(abs(end)))) - 1) if end else 0
        self.count = Count(value, color=color, font_size=font_size)
        widest = Count(end if end is not None else value, font_size=font_size).move_to(self.count, aligned_edge=LEFT)
        self.add(self.count)
        # A unit given as ("look", "looks") is written in the singular while the count stands at one.
        self._units = tuple(unit) if isinstance(unit, (tuple, list)) else (unit, unit)
        if self._units[1]:
            word = lambda text: Text(str(text), font=SANS, font_size=max(28 * TEXT_SCALE, font_size * 0.45), color=MUTED).next_to(widest, RIGHT, buff=0.3, aligned_edge=DOWN)
            self._unit_forms = [word(form) for form in self._units]
            self.unit = self._unit_forms[0 if value == 1 else 1].copy()
            self.add(self.unit)
        if owner:
            self.owner = Text(str(owner), font=MONO, font_size=28 * TEXT_SCALE, color=MUTED).next_to(widest, UP, buff=0.28, aligned_edge=LEFT)
            self.add(self.owner)

    def to(self, value: float, **kwargs):
        """An animation that counts to `value`. Give self.play() the run_time."""
        return ChangeDecimalToValue(self.count, value, **kwargs)

    def set(self, value: float):
        """Jump to `value` between animations: one tick of a count kept by hand."""
        self.count.set_value(value)
        if hasattr(self, "unit") and self._units[0] != self._units[1]:
            form = self._unit_forms[0 if value == 1 else 1]
            self.unit.become(form.copy().move_to(self.unit, aligned_edge=LEFT).set_opacity(self.unit.get_fill_opacity()).set_color(self.unit.get_color()))
        return self


class Track(VGroup):
    """Steps along a line: rounds, passes, epochs, versions. `reach(i)` lights step i and every step before it.

        rounds = Track(4, names=["round 1", "2", "3", "4"])
        self.play(FadeIn(rounds))
        self.play(rounds.reach(0))
    """

    def __init__(self, steps, *, names=None, color: str = ACCENT, gap: float = 1.5, radius: float = 0.2, font_size: float = None, **kwargs):
        super().__init__(**kwargs)
        count = steps if isinstance(steps, int) else len(steps)
        names = list(names or (steps if not isinstance(steps, int) else [str(i + 1) for i in range(count)]))
        self.lit = color
        self.pips = VGroup(*[Circle(radius=radius, stroke_color=DIM, stroke_width=4, fill_color=BG, fill_opacity=1) for _ in range(count)]).arrange(RIGHT, buff=gap)
        self.rail = Line(self.pips[0].get_center(), self.pips[-1].get_center(), color=DIM, stroke_width=4)
        self.names = VGroup(*[Text(str(name), font=MONO, font_size=_size(font_size, 28), color=MUTED).next_to(pip, DOWN, buff=0.22) for name, pip in zip(names, self.pips)])
        self.add(self.rail, self.pips, self.names)

    def reach(self, i: int):
        """An animation that lights steps 0 to i."""
        return AnimationGroup(*[pip.animate.set_stroke(self.lit).set_fill(self.lit, 1) for pip in self.pips[: i + 1]], self.names[i].animate.set_color(TEXT))


class Net(Graph):
    """Manim's Graph in the palette, with every vertex named: a tree when `root` is given, a network otherwise.

        calls = Net([8, 4, 2, 1], [(8, 4), (4, 2), (2, 1)], root=8)
        self.play(Create(calls))
        self.play(calls.mark(4, CURRENT))            # a vertex changes state
        self.play(calls.walk(8, 4, CURRENT))         # an edge is taken

    `calls.vertices[v]` and `calls.edges[(u, v)]` are Manim's own mobjects, for anything else.
    """

    def __init__(self, vertices, edges, *, root=None, radius: float = 0.42, font_size: float = None, **kwargs):
        vertices, edges = list(vertices), [tuple(edge) for edge in edges]
        if root is not None:
            kwargs.setdefault("layout", "tree")
            kwargs.setdefault("root_vertex", root)
            kwargs.setdefault("layout_config", {"vertex_spacing": (1.5, 1.35)})
        names = {vertex: Text(str(vertex), font=MONO, font_size=_size(font_size, 28), color=TEXT, weight=BOLD) for vertex in vertices}
        # One size of circle for the whole graph, large enough for its longest name.
        radius = max(radius, max(name.width for name in names.values()) / 2 + 0.2)
        if root is None:
            # Evenly spaced and the same on every render, which a spring layout (random start) is not.
            kwargs.setdefault("layout", "kamada_kawai")
            kwargs.setdefault("layout_scale", max(2.2, radius * 1.7 * len(vertices) ** 0.5))
        kwargs.setdefault("vertex_config", {"radius": radius, "fill_color": PANEL, "fill_opacity": 1, "stroke_color": UNVISITED, "stroke_width": 3.5})
        kwargs.setdefault("edge_config", {"stroke_color": DIM, "stroke_width": 4})
        super().__init__(vertices, edges, labels=names, **kwargs)

    def mark(self, vertex, color: str, fill: float = 0.3):
        """An animation that recolours one vertex and leaves its name readable."""
        return self.vertices[vertex].animate.set_stroke(color, family=False).set_fill(color, fill, family=False)

    def walk(self, start, end, color: str = ACCENT):
        """An animation that lights the edge between two vertices."""
        edge = self.edges[(start, end)] if (start, end) in self.edges else self.edges[(end, start)]
        return edge.animate.set_stroke(color, width=7)


def span(target, text, direction=DOWN, *, color: str = MUTED, font_size: float = None) -> VGroup:
    """A brace along something with a word on it: this run of cells, these four frames, the part ruled out.

        kept = span(VGroup(*row.boxes[0:5]), "never dropped", color=ACCENT)      # or row.span(0, 4, "never dropped")
    """
    brace = Brace(target, direction, color=color, buff=0.14)
    words = Text(str(text), font=SANS, font_size=_size(font_size, 28), color=color).next_to(brace, direction, buff=0.12)
    return VGroup(brace, words)


def tag(target, text, direction=UP, *, color: str = MUTED, font_size: float = None, font: str = None, buff: float = 0.22) -> Text:
    """A name beside the thing it names. No legend in a corner: the label goes on the thing."""
    return Text(str(text), font=font or SANS, font_size=_size(font_size, 28), color=color).next_to(target, direction, buff=buff)


def claim(text: str, *, font_size: float = 72, color: str = TEXT, strong: str = ACCENT) -> Text:
    """A line set large with its *starred* words in the accent: the hook's words, on screen as they are said.

        claim("*1,000,000* items.\n*20* looks.")
    """
    starred = re.findall(r"\*([^*]+)\*", text)
    return Text(text.replace("*", ""), font=SANS, font_size=font_size * TEXT_SCALE, color=color, weight=BOLD, line_spacing=0.9, t2c={word: strong for word in starred})


def verdict(ok: bool, size: float = 0.56) -> VGroup:
    """A tick or a cross in a ring: this works, this does not."""
    color = ACCENT if ok else ROSE
    ring = Circle(radius=size / 2, stroke_color=color, stroke_width=3, fill_color=color, fill_opacity=0.16)
    r = size * 0.22
    if ok:
        mark = VMobject(stroke_color=color, stroke_width=6).set_points_as_corners([[-r, 0, 0], [-r * 0.25, -r * 0.75, 0], [r, r * 0.8, 0]])
    else:
        mark = VGroup(Line([-r, -r, 0], [r, r, 0], color=color, stroke_width=6), Line([-r, r, 0], [r, -r, 0], color=color, stroke_width=6))
    return VGroup(ring, mark)


def curve(ax: Axes, function, name=None, *, color: str = ACCENT, x_range=None) -> VGroup:
    """A function drawn on `axes(...)`, named at its right-hand end in its own colour."""
    line = ax.plot(function, x_range=x_range, color=color, stroke_width=5)
    drawn = VGroup(line)
    if name:
        drawn.add(Text(str(name), font=MONO, font_size=28 * TEXT_SCALE, color=color).next_to(line.get_end(), UP, buff=0.14))
    return drawn


def fit(mobject, *, margin: float = 0.25):
    """Centre something in the part of the frame that is clear of the heading and the captions, shrinking
    it if it is too big (never enlarging it). The last line of every layout."""
    wide, tall = (SAFE_RIGHT - SAFE_LEFT) - 2 * margin, (SAFE_TOP - SAFE_BOTTOM) - 2 * margin
    shrink = min(1, wide / max(mobject.width, 1e-6), tall / max(mobject.height, 1e-6))
    if shrink < 1:
        mobject.scale(shrink)
    return mobject.move_to([(SAFE_LEFT + SAFE_RIGHT) / 2, SAFE_CENTER_Y, 0])


def halves():
    """The centres of the left and right halves of the frame: where two things being compared go."""
    return np.array([SAFE_LEFT / 2, SAFE_CENTER_Y, 0]), np.array([SAFE_RIGHT / 2, SAFE_CENTER_Y, 0])


def lanes(count: int) -> list:
    """The heights of `count` rows stacked evenly down the frame: one per approach, run on the same data."""
    step = (SAFE_TOP - SAFE_BOTTOM) / count
    return [SAFE_TOP - step * (i + 0.5) for i in range(count)]


_DIM = 0.4  # at or below this opacity a thing has stepped back: it is context, not something to read


def _opacity(mobject) -> float:
    """How strongly a thing is drawn: the strongest of its fill and its stroke."""
    try:
        return max(float(mobject.get_fill_opacity()), float(mobject.get_stroke_opacity()))
    except Exception:  # a group has no opacity of its own
        return 1.0


def _words(text) -> int:
    return len(re.findall(r"[A-Za-z][A-Za-z'-]*", str(text or "")))


def on_screen(mobjects) -> tuple[int, int]:
    """What a viewer is asked to take in at once: (labelled things, words). A box with its name is one
    thing, and so is a row of cells, a count, a tree, a formula, or a line of text. What has been
    dimmed to step back is not counted: it is there to be recognised, not read."""
    rows = set()  # a row of cells is one thing, however many of its cells are on screen and however they got there

    def walk(group) -> tuple[int, int]:
        things = words = 0
        for mobject in group:
            row = getattr(mobject, "va_row", None)
            if row is not None:  # a cell's box or label, put on screen one cell at a time
                if _opacity(mobject) > _DIM:
                    rows.add(row)
            elif isinstance(mobject, Node):
                if _opacity(mobject.box) > _DIM:
                    things += 1
                    words += _words(mobject.label.text) + _words(getattr(getattr(mobject, "note", None), "text", ""))
            elif isinstance(mobject, (Tally, Track, Graph)):
                if any(_opacity(part) > _DIM for part in mobject.family_members_with_points()[:4]):
                    things += 1
                    words += sum(_words(part.text) for part in mobject.get_family() if isinstance(part, Text))
            elif isinstance(mobject, DecimalNumber):
                if _opacity(mobject) > _DIM:
                    things += 1
            elif isinstance(mobject, Text):
                if _opacity(mobject) > _DIM and _words(mobject.text):
                    things += 1
                    words += _words(mobject.text)
            elif isinstance(mobject, SVGMobject):  # a formula
                if _opacity(mobject) > _DIM:
                    things += 1
            else:
                more = walk(mobject.submobjects)
                things, words = things + more[0], words + more[1]
        return things, words

    things, words = walk(mobjects)
    return things + len(rows), words


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
        # What the beat leaves on screen: `va manim` reports a frame that asks for too much reading.
        things, words = on_screen(self.mobjects)
        print(f"VA_CROWD beat {index} things={things} words={words}", file=sys.stderr, flush=True)
        remaining = self._beat_end - self.renderer.time
        if remaining > 1 / config.frame_rate:
            self.wait(remaining)
        elif remaining < -0.1:
            print(f"VA_OVERRUN beat {index} ran {-remaining:.2f}s past its {current.duration:.2f}s window: "
                  f"{current.text[:60]!r}", file=sys.stderr, flush=True)


__all__ = [
    "VAScene", "Beat", "Math", "Typst", "Cells", "Count", "label", "axes", "bar_chart", "curve", "Node", "Link", "Flow", "Tally", "Track", "Net",
    "span", "tag", "claim", "verdict", "fit", "halves", "lanes", "fact", "THEME", "TRACE", "CONTINUES", "TEXT_SCALE", "FRAME_WIDTH", "FRAME_HEIGHT", "SAFE_LEFT", "SAFE_RIGHT",
    "UNVISITED", "CURRENT", "FRONTIER", "SETTLED", "DISCARDED", "BG", "PANEL", "BORDER", "TEXT", "MUTED", "DIM", "ACCENT", "CYAN", "VIOLET",
    "AMBER", "ROSE", "ORANGE", "MONO", "SANS", "SAFE_TOP", "SAFE_BOTTOM", "SAFE_CENTER_Y",
]
