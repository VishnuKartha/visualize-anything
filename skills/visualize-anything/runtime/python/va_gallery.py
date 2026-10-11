"""Every ready-made picture in va_manim, on two stills. Render it after changing the kit, and look:

    PYTHONPATH=<skill>/runtime/python VA_THEME=<skill>/runtime/theme.json \
      uv run --python 3.12 --with 'manim==0.22.*' --with 'typst==0.15.*' manim -s -qh va_gallery.py Shapes Numbers
"""
from manim import *
from va_manim import *


def shown(thing, name, width=5.6, height=2.3):
    """One primitive in its cell, shrunk to fit, with the call that makes it written under it."""
    if thing.width > width or thing.height > height:
        thing.scale(min(width / thing.width, height / thing.height))
    return VGroup(thing, Text(name, font=MONO, font_size=22, color=MUTED)).arrange(DOWN, buff=0.3)


class Shapes(Scene):
    def construct(self):
        self.camera.background_color = BG
        row = Cells([3, 8, 15, 23, 42], indices=True)
        row.boxes[2].set_stroke(CURRENT).set_fill(CURRENT, 0.2)
        cells = VGroup(row, row.pointer(2, "mid"), row.span(3, 4, "ruled out", UP, color=ROSE))
        flow = Flow(["agent", "engine", "renderer"], notes=[None, "keeps the state", "only draws"], on=["action", "geometry", "frame"], loop=True)
        left, right = Node("frame"), Node("state", color=CYAN)
        VGroup(left, right).arrange(RIGHT, buff=2.2)
        links = VGroup(left, right, Link(left, right, "never", dashed=True, color=ROSE))
        tree = Net([8, 4, 5, 2, 1], [(8, 4), (8, 5), (4, 2), (4, 1)], root=8)
        tree.vertices[4].set_stroke(CURRENT, family=False).set_fill(CURRENT, 0.3, family=False)
        net = Net(["api", "cache", "db", "queue"], [("api", "cache"), ("api", "db"), ("api", "queue"), ("queue", "db")], radius=0.55)
        track = Track(4, names=["round 1", "2", "3", "4"])
        for pip in track.pips[:2]:
            pip.set_stroke(ACCENT).set_fill(ACCENT, 1)
        grid = VGroup(
            shown(cells, "Cells · pointer · span"), shown(flow, "Flow(..., loop=True)"),
            shown(links, "Node · Link(dashed=True)"), shown(tree, "Net(..., root=8)"),
            shown(net, "Net(vertices, edges)"), shown(track, "Track(4, names=...)"),
        ).arrange_in_grid(3, 2, buff=(0.9, 0.45))
        self.add(grid.scale_to_fit_height(7.4).move_to(ORIGIN))


class Numbers(Scene):
    def construct(self):
        self.camera.background_color = BG
        tally = Tally(end=25_000_000, unit="episodes", owner="2019 · from scratch")
        tally.set(25_000_000)
        chart = bar_chart([71, 68, 45, 41], ["round 1", "2", "3", "4"], y_range=[0, 80, 20], x_length=5, y_length=2.6)
        bars = VGroup(chart, chart.get_bar_labels(label_constructor=label, color=TEXT, font_size=24))
        ax = axes([0, 8, 2], [0, 64, 16], x_length=5, y_length=2.6, axis_config={"include_numbers": True})
        plot = VGroup(ax, curve(ax, lambda x: x * x, "n²", color=ROSE), curve(ax, lambda x: 8 * np.log2(x + 1), "n log n", color=ACCENT))
        words = claim("*1,000,000* items.\n*20* looks.", font_size=56)
        verdicts = VGroup(VGroup(verdict(True), tag(verdict(True), "remembers", RIGHT, color=TEXT)).arrange(RIGHT, buff=0.25), VGroup(verdict(False), tag(verdict(False), "looks real", RIGHT, color=TEXT)).arrange(RIGHT, buff=0.25)).arrange(DOWN, buff=0.3, aligned_edge=LEFT)
        formula = VGroup(Math("T(n) = 2 T(n/2) + n", font_size=44), Count(36.5, num_decimal_places=1, color=ACCENT, font_size=56)).arrange(DOWN, buff=0.4)
        grid = VGroup(
            shown(tally, "Tally(end=..., unit=..., owner=...)"), shown(bars, "bar_chart(values, names)"),
            shown(plot, "axes(...) · curve(ax, fn, name)"), shown(words, 'claim("*1,000,000* items...")'),
            shown(verdicts, "verdict(ok) · tag(target, text)"), shown(formula, "Math(...) · Count(...)"),
        ).arrange_in_grid(3, 2, buff=(0.9, 0.45))
        self.add(grid.scale_to_fit_height(7.4).move_to(ORIGIN))
