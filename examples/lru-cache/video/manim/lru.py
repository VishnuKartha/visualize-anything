from manim import *
from va_manim import *

# Three trace scenes share one picture of the cache: a row of slots, oldest on the left.
# Each scene starts from the row the previous one ended on.
SLOT_W, SLOT_H, GAP = 2.1, 1.5, 0.28
ROW_Y = 0.1
STATUS_Y = SAFE_TOP - 0.45   # one line of status above the row
RULER_Y = ROW_Y - 1.4        # the oldest → newest ruler under it
VERDICT_Y = -2.75            # the capacity check at the bottom
HOP = 1.75                   # how high an entry lifts to pass over the row


def slot_x(index: int, count: int = 3) -> float:
    span = count * SLOT_W + (count - 1) * GAP
    return -span / 2 + SLOT_W / 2 + index * (SLOT_W + GAP)


def entry(key: str, color: str = ACCENT) -> VGroup:
    box = RoundedRectangle(width=SLOT_W, height=SLOT_H, corner_radius=0.16, stroke_color=color, stroke_width=4,
                           fill_color=color, fill_opacity=0.14)
    label = Text(key, font=MONO, font_size=54, color=TEXT, weight=BOLD).move_to(box)
    return VGroup(box, label)


def placed(keys, count: int = None):
    """Entries for `keys`, already sitting in their slots."""
    items = [entry(key) for key in keys]
    for index, item in enumerate(items):
        item.move_to([slot_x(index, count or len(keys)), ROW_Y, 0])
    return items


def axis_ends(count: int):
    return [slot_x(0, count) + 1.0, RULER_Y, 0], [slot_x(count - 1, count) - 1.05, RULER_Y, 0]


def ruler(count: int = 3):
    oldest = Text("oldest", font=SANS, font_size=36, color=MUTED).move_to([slot_x(0, count), RULER_Y, 0])
    newest = Text("newest", font=SANS, font_size=36, color=MUTED).move_to([slot_x(count - 1, count), RULER_Y, 0])
    axis = Arrow(*axis_ends(count), buff=0, stroke_width=3, color=DIM, max_tip_length_to_length_ratio=0.07)
    return oldest, newest, axis


def reruler(oldest, newest, axis, count: int):
    return [
        oldest.animate.move_to([slot_x(0, count), RULER_Y, 0]),
        newest.animate.move_to([slot_x(count - 1, count), RULER_Y, 0]),
        axis.animate.put_start_and_end_on(*axis_ends(count)),
    ]


def settle(items, count: int = None):
    count = count or len(items)
    return [item.animate.move_to([slot_x(index, count), ROW_Y, 0]) for index, item in enumerate(items)]


def status(text: str, color: str = MUTED):
    return Text(text, font=MONO, font_size=36, color=color).move_to([0, STATUS_Y, 0])


def returned():
    return Text("returns A's value", font=MONO, font_size=36, color=ACCENT).move_to([0, VERDICT_Y + 0.4, 0])


def capacity_check(entries: int, color: str):
    relation = "<=" if entries <= 3 else ">"
    return Math(f'underbrace({entries}, "entries") {relation} underbrace(3, "capacity")', font_size=40, color=color).move_to([0, VERDICT_Y, 0])


def recolor(item, color: str, fill: float = 0.14):
    return item[0].animate.set_stroke(color).set_fill(color, fill)


class State(VAScene):
    """What the class stores: a size limit, and a row that keeps its order."""

    def construct(self):
        name = status("LRUCache", TEXT)
        slots = VGroup(*[
            RoundedRectangle(width=SLOT_W, height=SLOT_H, corner_radius=0.16, stroke_color=DIM, stroke_width=3).move_to([slot_x(i), ROW_Y, 0])
            for i in range(3)
        ])
        limit = status("capacity = 3", AMBER).move_to([0, ROW_Y + 1.45, 0])
        a, b, c = placed("ABC")
        oldest, newest, axis = ruler()

        with self.beat(0):
            self.play(FadeIn(name, shift=DOWN * 0.2), run_time=0.8)

        with self.beat(1) as beat:
            beat.until("A capacity")
            self.play(LaggedStart(*(Create(slot) for slot in slots), lag_ratio=0.25), run_time=1.2)
            self.play(FadeIn(limit, shift=UP * 0.15), run_time=0.5)

        with self.beat(2) as beat:
            beat.until("an ordered dictionary")
            self.play(LaggedStart(*(FadeIn(item, shift=UP * 0.3) for item in (a, b, c)), lag_ratio=0.3), FadeOut(slots), run_time=1.5)
            # "Remembers the order": touch each entry in turn, so the order is something seen, not just said.
            beat.until("remembers the order")
            self.play(LaggedStart(*(Indicate(item, color=CYAN, scale_factor=1.12) for item in (a, b, c)), lag_ratio=0.55), run_time=2.0)
            beat.until("Oldest at the front")
            self.play(FadeIn(oldest, shift=UP * 0.15), recolor(a, AMBER, 0.2), run_time=0.6)
            beat.until("newest at the back")
            self.play(GrowArrow(axis), FadeIn(newest, shift=UP * 0.15), recolor(a, ACCENT), recolor(c, AMBER, 0.2), run_time=0.8)
            # Settle into the picture the next scene starts on: just the row, its ruler, and the limit above it.
            self.play(recolor(c, ACCENT), FadeOut(name), limit.animate.move_to([0, STATUS_Y, 0]).set_color(MUTED), run_time=0.6)


class Get(VAScene):
    """get(): reading A sends it to the newest end. Starts on A, B, C."""

    def construct(self):
        a, b, c = placed("ABC")
        oldest, newest, axis = ruler()
        limit = status("capacity = 3")

        with self.beat(0) as beat:
            self.appear(a, b, c, oldest, newest, axis, limit)
            beat.until("Say we ask for A")
            call = Text("get('A')", font=MONO, font_size=36, color=CYAN).next_to(a, UP, buff=0.3)
            self.play(FadeIn(call, shift=DOWN * 0.2), recolor(a, CYAN, 0.2), run_time=0.7)

        with self.beat(1) as beat:
            beat.until("sends it to the newest end")
            self.play(a.animate.shift(UP * HOP), FadeOut(call), run_time=0.55)
            self.play(a.animate.move_to([slot_x(2), ROW_Y + HOP, 0]), *settle([b, c], 3), run_time=1.1)
            self.play(a.animate.move_to([slot_x(2), ROW_Y, 0]), run_time=0.5)

        with self.beat(2) as beat:
            beat.until("its value")
            got = returned()
            self.play(FadeIn(got, shift=UP * 0.15), recolor(a, ACCENT), run_time=0.6)


# Not named Write: that would shadow Manim's Write animation inside the scene.
class Put(VAScene):
    """put(): two decisions, each acting on the row. Starts on B, C, A, where Get left it."""

    def construct(self):
        b, c, a = placed("BCA")
        oldest, newest, axis = ruler()
        limit = status("capacity = 3")

        # Decision one: is the key already here?
        with self.beat(0) as beat:
            got = returned()
            self.appear(b, c, a, oldest, newest, axis, limit, got)
            self.play(FadeOut(got), run_time=0.4)
            beat.until("is this key already cached")
            call = Text("put('B', 9)", font=MONO, font_size=36, color=CYAN).next_to(b, UP, buff=0.3)
            self.play(FadeIn(call, shift=DOWN * 0.2), recolor(b, CYAN, 0.2), run_time=0.7)

        # It is: refresh it, then store the value.
        with self.beat(1) as beat:
            beat.until("it is refreshed")
            self.play(b.animate.shift(UP * HOP), FadeOut(call), run_time=0.5)
            self.play(b.animate.move_to([slot_x(2), ROW_Y + HOP, 0]), *settle([c, a], 3), run_time=1.0)
            self.play(b.animate.move_to([slot_x(2), ROW_Y, 0]), run_time=0.45)
            beat.until("the new value is stored")
            stored = Text("value = 9", font=MONO, font_size=36, color=ACCENT).next_to(b, UP, buff=0.3)
            self.play(FadeIn(stored, shift=UP * 0.15), recolor(b, ACCENT), run_time=0.6)

        # Decision two: over capacity? Three in a cache of three: no.
        check = capacity_check(3, ACCENT)
        with self.beat(2) as beat:
            self.play(FadeOut(stored), run_time=0.4)
            beat.until("Did that push us")
            self.play(Write(check), run_time=1.1)
            beat.until("nothing is evicted")
            self.play(Indicate(check, color=ACCENT, scale_factor=1.1), run_time=0.8)

        # A new key makes the row four long.
        d = entry("D", AMBER)
        over = capacity_check(4, ROSE)
        with self.beat(3) as beat:
            d.move_to([slot_x(3, 4), ROW_Y + HOP, 0])
            call = Text("put('D', 5)", font=MONO, font_size=36, color=AMBER).next_to(d, UP, buff=0.25)
            beat.until("a key the cache has never seen")
            self.play(FadeIn(d, shift=DOWN * 0.3), FadeIn(call), FadeOut(limit), run_time=0.6)
            beat.until("grows to four")
            self.play(*settle([c, a, b, d], 4), *reruler(oldest, newest, axis, 4), FadeOut(call), run_time=1.0)
            self.play(FadeOut(check), FadeIn(over), run_time=0.5)

        # The check fails, so the oldest entry goes.
        back = capacity_check(3, ACCENT)
        with self.beat(4) as beat:
            beat.until("popitem drops the oldest end")
            self.play(recolor(c, ROSE, 0.2), Indicate(oldest, color=ROSE, scale_factor=1.15), run_time=0.8)
            self.play(c.animate.shift(DOWN * 0.8).set_opacity(0), run_time=0.7)
            self.remove(c)
            beat.until("back within our limit")
            self.play(*settle([a, b, d], 3), *reruler(oldest, newest, axis, 3), FadeOut(over), FadeIn(back), run_time=1.0)
            self.play(recolor(d, ACCENT), run_time=0.5)
