from manim import *
from va_manim import *

VALUES = [3, 8, 15, 23, 42, 57, 61]
TARGET = 57


class Race(VAScene):
    """The same list searched two ways, with a count of how many items each one looks at."""

    def construct(self):
        found = VALUES.index(TARGET)

        def lane(name, y):
            row = Cells(VALUES, size=1.0).move_to([0.2, y, 0])
            label = Text(name, font=SANS, font_size=32, color=MUTED).next_to(row, LEFT, buff=0.5)
            return row, label

        def tally(row, n):
            return Text(f"{n} look{'s' if n != 1 else ''}", font=MONO, font_size=32, color=TEXT).next_to(row, RIGHT, buff=0.5)

        scan, scan_label = lane("scan", SAFE_CENTER_Y + 1.25)
        halve, halve_label = lane("halve", SAFE_CENTER_Y - 1.25)

        # Beat 0 — the scan looks at every item until it reaches the target.
        with self.beat(0) as beat:
            self.play(FadeIn(scan), FadeIn(scan_label), FadeIn(halve), FadeIn(halve_label), run_time=0.8)
            beat.until("check every item")
            count = None
            for i in range(found + 1):
                self.play(scan.mark(i, CURRENT), run_time=0.22)
                if count:
                    self.remove(count)
                count = tally(scan, i + 1)
                self.add(count)
                if i < found:
                    self.play(scan.mark(i, DISCARDED, 0.06), scan.labels[i].animate.set_opacity(0.3), run_time=0.18)
            beat.until("six looks")
            self.play(scan.mark(found, SETTLED, 0.3), count.animate.set_color(DISCARDED), run_time=0.5)

        # Beat 1 — halving looks at the middle, drops half, and is done on the second look.
        with self.beat(1) as beat:
            beat.until("checks the middle")
            self.play(halve.mark(3, CURRENT), run_time=0.4)
            count = tally(halve, 1)
            self.add(count)
            beat.until("throws half")
            self.play(*halve.mark_all(range(0, 4), DISCARDED, 0.06), *[halve.labels[i].animate.set_opacity(0.3) for i in range(4)], run_time=0.7)
            beat.until("gets there")
            self.play(halve.mark(found, CURRENT), run_time=0.35)
            self.remove(count)
            count = tally(halve, 2)
            self.add(count)
            self.play(halve.mark(found, SETTLED, 0.3), count.animate.set_color(SETTLED), run_time=0.5)


class Search(VAScene):
    """One binary search, drawn beside the code that runs it. The colours say what each cell is to the
    search right now: still a candidate, being examined, ruled out, or found."""

    def construct(self):
        row = Cells(VALUES, size=1.15, indices=True).move_to([0, 0.35, 0])
        goal = Text(f"target = {TARGET}", font=MONO, font_size=36, color=MUTED).move_to([0, SAFE_TOP - 0.3, 0])
        verdict_at = [0, -2.45, 0]
        lo = row.pointer(0, "lo", FRONTIER)
        hi = row.pointer(len(VALUES) - 1, "hi", FRONTIER)

        # Beat 0 — lo and hi bracket the whole list.
        with self.beat(0) as beat:
            self.play(FadeIn(row, shift=UP * 0.3), FadeIn(goal), run_time=1.0)
            beat.until("lo and hi")
            self.play(FadeIn(lo, shift=UP * 0.2), FadeIn(hi, shift=UP * 0.2), run_time=0.7)
            self.play(*row.mark_all(range(len(VALUES)), FRONTIER, 0.12), run_time=0.6)

        # Beat 1 — look at the middle item.
        mid = row.pointer(3, "mid", CURRENT, below=False)
        with self.beat(1) as beat:
            beat.until("look at the middle")
            self.play(FadeIn(mid, shift=DOWN * 0.2), row.mark(3, CURRENT), run_time=0.7)

        # Beat 2 — too small: discard the lower half, move lo past the middle.
        compare = Math("23 < 57", font_size=46, color=CURRENT).move_to(verdict_at)
        with self.beat(2) as beat:
            self.play(Write(compare), run_time=0.8)
            beat.until("ruled out")
            self.play(
                *row.mark_all(range(0, 4), DISCARDED, 0.06),
                *[row.labels[i].animate.set_opacity(0.3) for i in range(4)],
                FadeOut(mid),
                run_time=0.9,
            )
            beat.until("lo jumps")
            self.play(row.move_pointer(lo, 4), run_time=0.7)

        # Beat 3 — the new middle is the target.
        mid = row.pointer(5, "mid", CURRENT, below=False)
        found = Math("57 = 57", font_size=46, color=SETTLED).move_to(verdict_at)
        result = Text("returns index 5", font=MONO, font_size=36, color=SETTLED).next_to(found, DOWN, buff=0.25)
        with self.beat(3) as beat:
            beat.until("The middle is now")
            self.play(FadeOut(compare), FadeIn(mid, shift=DOWN * 0.2), row.mark(5, CURRENT), run_time=0.7)
            beat.until("which is the target")
            self.play(row.mark(5, SETTLED, 0.3), Write(found), run_time=0.8)
            beat.until("return its index")
            self.play(FadeIn(result, shift=UP * 0.15), run_time=0.6)


class Halving(VAScene):
    """Why it is fast: the range that could still hold the answer halves on every pass."""

    def construct(self):
        top = SAFE_CENTER_Y + 0.9
        left = -5.0
        bar = Rectangle(width=10, height=0.9, stroke_color=FRONTIER, stroke_width=3, fill_color=FRONTIER, fill_opacity=0.18)
        bar.move_to([0, top, 0])
        size = Math("n", font_size=48).next_to(bar, UP, buff=0.3).set_x(left + 5)

        # Beat 0 — each pass keeps half.
        with self.beat(0) as beat:
            self.play(FadeIn(bar), FadeIn(size), run_time=0.7)
            beat.until("throws away half")
            width = 10.0
            # An inline slash keeps each label one line tall; a stacked fraction would climb into the heading.
            for label in (r"n \/ 2", r"n \/ 4", r"n \/ 8", r"n \/ 16"):
                width /= 2
                smaller = Math(label, font_size=48).next_to(bar, UP, buff=0.3).set_x(max(left + width / 2, left + 0.9))
                self.play(bar.animate.stretch_to_fit_width(width, about_edge=LEFT), FadeOut(size), FadeIn(smaller), run_time=0.5)
                size = smaller

        # Beat 1 — so the number of passes is a logarithm.
        formula = Math('"passes" approx log_2 n', font_size=60, color=ACCENT).move_to([0, SAFE_CENTER_Y - 0.55, 0])
        million = Math("log_2 10^6 approx 20", font_size=50).next_to(formula, DOWN, buff=0.45)
        with self.beat(1) as beat:
            beat.until("log base two")
            self.play(Write(formula), run_time=1.0)
            beat.until("For a million items")
            self.play(Write(million), run_time=0.9)
