from manim import *
from va_manim import *

SLOT_W, SLOT_H, GAP = 2.3, 1.5, 0.35
ROW_Y = SAFE_CENTER_Y - 0.5
LABEL_Y = 2.65  # status line; high enough that an entry hopping over the row passes beneath it


def slot_x(index: int, count: int = 3) -> float:
    span = count * SLOT_W + (count - 1) * GAP
    return -span / 2 + SLOT_W / 2 + index * (SLOT_W + GAP)


def entry(key: str, color: str = ACCENT) -> VGroup:
    box = RoundedRectangle(width=SLOT_W, height=SLOT_H, corner_radius=0.18, stroke_color=color, stroke_width=4,
                           fill_color=color, fill_opacity=0.14)
    label = Text(key, font=MONO, font_size=54, color=TEXT, weight=BOLD).move_to(box)
    return VGroup(box, label)


LABELS_Y = ROW_Y - 1.35


def axis_ends(count: int):
    return [slot_x(0, count) + 0.9, LABELS_Y, 0], [slot_x(count - 1, count) - 0.95, LABELS_Y, 0]


def row_labels(count: int = 3):
    """The oldest → newest ruler under a row of `count` slots."""
    oldest = Text("oldest", font=SANS, font_size=30, color=MUTED).move_to([slot_x(0, count), LABELS_Y, 0])
    newest = Text("newest", font=SANS, font_size=30, color=MUTED).move_to([slot_x(count - 1, count), LABELS_Y, 0])
    axis = Arrow(*axis_ends(count), buff=0, stroke_width=3, color=DIM, max_tip_length_to_length_ratio=0.06)
    return oldest, newest, axis


def relabel(oldest, newest, axis, count: int):
    """Animations that stretch the ruler to a row of `count` slots."""
    return [
        oldest.animate.move_to([slot_x(0, count), LABELS_Y, 0]),
        newest.animate.move_to([slot_x(count - 1, count), LABELS_Y, 0]),
        axis.animate.put_start_and_end_on(*axis_ends(count)),
    ]


def settle(items, count: int = None):
    """Animations that slide `items`, in order, into the slots of a row."""
    count = count or len(items)
    return [item.animate.move_to([slot_x(index, count), ROW_Y, 0]) for index, item in enumerate(items)]


def capacity_check(entries: int, color: str):
    relation = "<=" if entries <= 3 else ">"
    check = Math(f'underbrace({entries}, "entries") {relation} underbrace(3, "capacity")', font_size=44, color=color)
    return check.move_to([0, 2.2, 0])


class Reorder(VAScene):
    def construct(self):
        a, b, c = entry("A"), entry("B"), entry("C")
        for index, item in enumerate((a, b, c)):
            item.move_to([slot_x(index), ROW_Y, 0])

        capacity = Text("capacity = 3", font=MONO, font_size=30, color=MUTED).move_to([0, LABEL_Y, 0])
        oldest = Text("oldest", font=SANS, font_size=30, color=MUTED).move_to([slot_x(0), ROW_Y - 1.35, 0])
        newest = Text("newest", font=SANS, font_size=30, color=MUTED).move_to([slot_x(2), ROW_Y - 1.35, 0])
        axis = Arrow([slot_x(0) + 0.9, ROW_Y - 1.35, 0], [slot_x(2) - 0.95, ROW_Y - 1.35, 0], buff=0,
                     stroke_width=3, color=DIM, max_tip_length_to_length_ratio=0.06)

        # Beat 0 — the row of slots, oldest on the left.
        with self.beat(0):
            self.play(LaggedStart(*(FadeIn(item, shift=UP * 0.4) for item in (a, b, c)), lag_ratio=0.25), run_time=1.8)
            self.play(FadeIn(capacity), run_time=0.6)
            self.wait(0.6)
            self.play(FadeIn(oldest, shift=UP * 0.2), run_time=0.7)
            self.play(GrowArrow(axis), FadeIn(newest, shift=UP * 0.2), run_time=0.9)

        # Beat 1 — reading A moves it to the newest end.
        with self.beat(1):
            call = Text("get('A')", font=MONO, font_size=34, color=CYAN).next_to(a, UP, buff=0.35)
            self.play(FadeIn(call, shift=DOWN * 0.2), a[0].animate.set_stroke(CYAN).set_fill(CYAN, 0.2), run_time=0.8)
            self.wait(1.4)
            self.play(a.animate.shift(UP * 1.7), FadeOut(call), run_time=0.7)
            self.play(
                a.animate.move_to([slot_x(2), ROW_Y + 1.7, 0]),
                b.animate.move_to([slot_x(0), ROW_Y, 0]),
                c.animate.move_to([slot_x(1), ROW_Y, 0]),
                run_time=1.3,
            )
            self.play(a.animate.move_to([slot_x(2), ROW_Y, 0]), run_time=0.6)
            self.play(a[0].animate.set_stroke(ACCENT).set_fill(ACCENT, 0.14), run_time=0.5)

        # Beat 2 — D arrives at the newest end; four entries in a cache of three.
        d = entry("D", AMBER)
        with self.beat(2):
            d.move_to([slot_x(3, 4), ROW_Y + 1.7, 0])
            call = Text("put('D', ...)", font=MONO, font_size=34, color=AMBER).next_to(d, UP, buff=0.3)
            self.play(FadeIn(d, shift=DOWN * 0.3), FadeIn(call), FadeOut(capacity), run_time=0.8)
            self.play(
                b.animate.move_to([slot_x(0, 4), ROW_Y, 0]),
                c.animate.move_to([slot_x(1, 4), ROW_Y, 0]),
                a.animate.move_to([slot_x(2, 4), ROW_Y, 0]),
                d.animate.move_to([slot_x(3, 4), ROW_Y, 0]),
                oldest.animate.move_to([slot_x(0, 4), ROW_Y - 1.35, 0]),
                newest.animate.move_to([slot_x(3, 4), ROW_Y - 1.35, 0]),
                axis.animate.put_start_and_end_on([slot_x(0, 4) + 0.9, ROW_Y - 1.35, 0], [slot_x(3, 4) - 0.95, ROW_Y - 1.35, 0]),
                FadeOut(call),
                run_time=1.3,
            )
            over = Text("4 entries > capacity 3", font=MONO, font_size=32, color=ROSE).move_to([0, LABEL_Y, 0])
            self.play(FadeIn(over, shift=UP * 0.2), run_time=0.7)

        # Beat 3 — the oldest entry is evicted.
        with self.beat(3):
            self.play(b[0].animate.set_stroke(ROSE).set_fill(ROSE, 0.2), Indicate(oldest, color=ROSE, scale_factor=1.15), run_time=1.0)
            self.wait(0.8)
            self.play(b.animate.shift(DOWN * 0.9).set_opacity(0), run_time=0.9)
            self.remove(b)
            fine = Text("3 entries: back within capacity", font=MONO, font_size=32, color=ACCENT).move_to(over)
            self.play(
                c.animate.move_to([slot_x(0), ROW_Y, 0]),
                a.animate.move_to([slot_x(1), ROW_Y, 0]),
                d.animate.move_to([slot_x(2), ROW_Y, 0]),
                oldest.animate.move_to([slot_x(0), ROW_Y - 1.35, 0]),
                newest.animate.move_to([slot_x(2), ROW_Y - 1.35, 0]),
                axis.animate.put_start_and_end_on([slot_x(0) + 0.9, ROW_Y - 1.35, 0], [slot_x(2) - 0.95, ROW_Y - 1.35, 0]),
                FadeOut(over),
                FadeIn(fine),
                run_time=1.3,
            )
            # Recolour in its own play(): animating d and d[0] together would fight over the box.
            self.play(d[0].animate.set_stroke(ACCENT).set_fill(ACCENT, 0.14), run_time=0.6)


class WritePath(VAScene):
    """put(): the same row, driven by two decisions. Picks up where Reorder left off: C, A, D."""

    def construct(self):
        c, a, d = entry("C"), entry("A"), entry("D")
        for index, item in enumerate((c, a, d)):
            item.move_to([slot_x(index), ROW_Y, 0])
        oldest, newest, axis = row_labels(3)
        capacity = Text("capacity = 3", font=MONO, font_size=30, color=MUTED).move_to([0, LABEL_Y, 0])

        # Beat 0 — decision one: is the key already cached?
        with self.beat(0):
            self.play(FadeIn(VGroup(c, a, d, oldest, newest, axis, capacity)), run_time=0.8)
            call = Text("put('A', 9)", font=MONO, font_size=34, color=CYAN).next_to(a, UP, buff=0.35)
            self.play(FadeIn(call, shift=DOWN * 0.2), run_time=0.6)
            self.wait(1.0)
            self.play(a[0].animate.set_stroke(CYAN).set_fill(CYAN, 0.2), run_time=0.6)
            self.play(Indicate(a, color=CYAN, scale_factor=1.08), run_time=0.8)

        # Beat 1 — it is, so A becomes the newest entry and takes the new value.
        with self.beat(1):
            self.play(a.animate.shift(UP * 1.7), FadeOut(call), FadeOut(capacity), run_time=0.6)
            self.play(a.animate.move_to([slot_x(2), ROW_Y + 1.7, 0]), *settle([c, d], 3), run_time=1.2)
            self.play(a.animate.move_to([slot_x(2), ROW_Y, 0]), run_time=0.5)
            stored = Text("value = 9", font=MONO, font_size=30, color=ACCENT).next_to(a, UP, buff=0.3)
            self.play(FadeIn(stored, shift=UP * 0.15), run_time=0.5)
            self.play(a[0].animate.set_stroke(ACCENT).set_fill(ACCENT, 0.14), run_time=0.5)

        # Beat 2 — decision two: over capacity? Three entries in a cache of three: no.
        check = capacity_check(3, ACCENT)
        verdict = Text("nothing to evict", font=SANS, font_size=30, color=MUTED).next_to(check, RIGHT, buff=0.7)
        with self.beat(2):
            self.play(FadeOut(stored), run_time=0.4)
            self.wait(1.0)
            self.play(Write(check), run_time=1.3)
            self.wait(2.2)
            self.play(FadeIn(verdict, shift=LEFT * 0.2), run_time=0.6)

        # Beat 3 — a key the cache has never seen makes the row four long.
        e = entry("E", AMBER)
        over = capacity_check(4, ROSE)
        with self.beat(3):
            e.move_to([slot_x(3, 4), ROW_Y + 1.7, 0])
            # Clear the verdict first: E arrives where it was, and its call label sits above E, clear of the check.
            call = Text("put('E', 5)", font=MONO, font_size=34, color=AMBER).next_to(e, UP, buff=0.3)
            self.play(FadeOut(verdict), run_time=0.3)
            self.play(FadeIn(e, shift=DOWN * 0.3), FadeIn(call), run_time=0.6)
            self.play(*settle([c, d, a, e], 4), *relabel(oldest, newest, axis, 4), FadeOut(call), run_time=1.2)
            self.play(FadeOut(check), FadeIn(over), run_time=0.6)

        # Beat 4 — the check fails, so the oldest entry goes.
        back = capacity_check(3, ACCENT)
        with self.beat(4):
            self.wait(0.5)
            self.play(c[0].animate.set_stroke(ROSE).set_fill(ROSE, 0.2), Indicate(oldest, color=ROSE, scale_factor=1.15), run_time=0.9)
            self.play(c.animate.shift(DOWN * 0.9).set_opacity(0), run_time=0.8)
            self.remove(c)
            self.play(*settle([d, a, e], 3), *relabel(oldest, newest, axis, 3), FadeOut(over), FadeIn(back), run_time=1.2)
            self.play(e[0].animate.set_stroke(ACCENT).set_fill(ACCENT, 0.14), run_time=0.5)
