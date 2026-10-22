from manim import *
from va_manim import *

# One sentence through the whole video. "ran" needs its subject, "cat", five words back.
WORDS = ["The", "cat", "that", "the", "dog", "chased", "ran"]
CAT, RAN = WORDS.index("cat"), WORDS.index("ran")
N = len(WORDS)
ROW_Y = -1.55          # where the sentence sits when something has to be drawn above it


def sentence(y=ROW_Y):
    """The sentence as a row of cells: the same picture in every scene."""
    return Cells(WORDS, size=1.55, gap=0.2, font_size=32).move_to([0, y, 0])


def top(row, i, lift=0.0):
    return row.boxes[i].get_top() + UP * lift


def link(row, i, j, color=ACCENT, height=None, width=4, rise=0.3):
    """An arc from word i up and over to word j: one direct connection."""
    a, b = top(row, i, 0.08), top(row, j, 0.08)
    span_ = abs(b[0] - a[0])
    h = height if height is not None else rise * span_ + 0.3
    mid = (a + b) / 2 + UP * h
    return VMobject(stroke_color=color, stroke_width=width).set_points_smoothly([a, (a + mid) / 2 + UP * h * 0.35, mid, (b + mid) / 2 + UP * h * 0.35, b])


def states(row, y_off=1.15):
    """A hidden-state dot above each word, and the arrows that chain them: the recurrence."""
    dots = VGroup(*[Circle(radius=0.2, stroke_color=CYAN, stroke_width=3, fill_color=CYAN, fill_opacity=0.15)
                    .move_to(top(row, i, y_off)) for i in range(N)])
    arrows = VGroup(*[Arrow(dots[i].get_right(), dots[i + 1].get_left(), buff=0.06, stroke_width=4,
                            max_tip_length_to_length_ratio=0.25, color=CYAN) for i in range(N - 1)])
    ups = VGroup(*[Line(row.boxes[i].get_top(), dots[i].get_bottom(), stroke_color=DIM, stroke_width=2) for i in range(N)])
    return dots, arrows, ups


class Opening(VAScene):
    """A recurrent network walks the sentence one step at a time, with a count; attention rides on top; then the hook."""

    def construct(self):
        row = sentence(-0.9)
        dots, arrows, ups = states(row)
        steps = Tally(end=fact("rnn-steps"), unit=("step", "steps"), owner="in a row", font_size=60).move_to([4.6, 2.35, 0])

        with self.beat(0) as b:
            self.play(FadeIn(row, shift=UP * 0.2), run_time=0.8)
            self.play(Create(ups[0]), FadeIn(dots[0]), row.mark(0, CURRENT), run_time=0.7)
            self.add(steps.set(1)); self.play(FadeIn(steps), run_time=0.4)

        with self.beat(1) as b:
            b.until("waits for the one before")
            for i in range(1, N):
                self.play(GrowArrow(arrows[i - 1]), Create(ups[i]), FadeIn(dots[i]), row.mark(i, CURRENT), row.mark(i - 1, SETTLED), run_time=0.42)
                steps.set(i + 1)
            b.until("seven steps")
            self.play(row.mark(N - 1, SETTLED), Indicate(steps, color=CURRENT, scale_factor=1.12), run_time=0.7)

        # the decoder, looking back at every word, on top of the chain
        decoder = Node("decoder", note=None).scale(0.9).move_to([0, 2.45, 0])
        looks = VGroup(*[Line(decoder.get_bottom(), dots[i].get_top(), stroke_color=AMBER, stroke_width=2.5, stroke_opacity=0.8) for i in range(N)])
        with self.beat(2) as b:
            self.play(FadeOut(steps), FadeIn(decoder, shift=DOWN * 0.2), run_time=0.6)
            b.until("look back at every word")
            self.play(LaggedStart(*[Create(l) for l in looks], lag_ratio=0.08), run_time=1.2)
            b.until("rode on top")
            self.play(Indicate(arrows, color=CYAN, scale_factor=1.04), run_time=1.0)

        # the hook: the chain goes, attention stays, and the result arrives on the words
        hook = claim("*12 hours* on 8 GPUs", font_size=50).move_to([0, 2.75, 0])
        sub = Text("ahead of every published English-to-German system", font=SANS, font_size=30, color=MUTED).next_to(hook, DOWN, buff=0.22)
        direct = VGroup(*[link(row, i, j, ACCENT, width=2.5, rise=0.15).set_stroke(opacity=0.55) for i in range(N) for j in range(i + 1, N)])
        with self.beat(3) as b:
            b.until("Throw the recurrence away")
            self.play(FadeOut(arrows), FadeOut(dots), FadeOut(ups), FadeOut(looks), FadeOut(decoder), *row.mark_all(range(N), FRONTIER), run_time=0.9)
            b.until("keep only attention")
            self.play(LaggedStart(*[Create(d) for d in direct], lag_ratio=0.02), run_time=1.3)
            b.until("twelve hours")
            self.play(Write(hook), run_time=0.9)
            b.until("comes out ahead")
            self.play(FadeIn(sub, shift=UP * 0.1), run_time=0.7)


class Paths(VAScene):
    """Table 1 on the sentence: from ran to cat, five serial steps by recurrence, a stack of layers by convolution,
    one direct link by self-attention."""

    def construct(self):
        row = sentence(-0.85)
        far = span(VGroup(*row.boxes[CAT:RAN + 1]), "five words back", direction=DOWN, color=AMBER)

        with self.beat(0) as b:
            self.play(FadeIn(row, shift=UP * 0.2), run_time=0.7)
            b.until("ran needs its subject")
            self.play(row.mark(RAN, CURRENT), run_time=0.5)
            b.until("cat")
            self.play(row.mark(CAT, ACCENT), run_time=0.5)
            b.until("five words back")
            self.play(FadeIn(far), run_time=0.6)

        dots, arrows, ups = states(row, 0.9)
        rnn = VGroup(*[dots[i] for i in range(CAT, RAN + 1)], *[arrows[i] for i in range(CAT, RAN)])
        rnn_count = Tally(end=fact("cat-to-ran"), unit=("step", "steps"), owner="recurrent", font_size=48, color=CYAN).move_to([-4.3, 2.55, 0])
        with self.beat(1) as b:
            self.play(FadeIn(dots[CAT]), FadeIn(rnn_count.set(0)), run_time=0.6)
            b.until("five steps")
            for k, i in enumerate(range(CAT, RAN)):
                self.play(GrowArrow(arrows[i]), FadeIn(dots[i + 1]), run_time=0.35)
                rnn_count.set(k + 1)
            b.until("none of them in parallel")
            self.play(Indicate(rnn, color=CYAN, scale_factor=1.03), run_time=0.8)

        # convolution: kernel-3 layers stacked until cat and ran meet
        layers = []
        reach = [(CAT, RAN)]
        lo, hi = CAT, RAN
        y = top(row, 0, 0.9)[1]
        pyr = VGroup()
        level = 0
        while hi - lo > 0:
            level += 1
            lo2, hi2 = lo + 1, hi - 1 if hi - lo > 1 else hi
            if hi - lo <= 2:
                lo2 = hi2 = (lo + hi) / 2
            xs = lambda i: row.boxes[0].get_center()[0] + i * (row.boxes[1].get_center()[0] - row.boxes[0].get_center()[0])
            pa = np.array([xs(lo), y + 0.55 * (level - 1), 0]); pb = np.array([xs(hi), y + 0.55 * (level - 1), 0])
            qa = np.array([xs(lo2), y + 0.55 * level, 0]); qb = np.array([xs(hi2), y + 0.55 * level, 0])
            pyr.add(Line(pa, qa, stroke_color=VIOLET, stroke_width=3), Line(pb, qb, stroke_color=VIOLET, stroke_width=3))
            lo, hi = lo2, hi2
            if lo == hi:
                break
        conv_tag = tag(pyr, "ConvS2S: a stack of layers", UP, color=VIOLET)
        with self.beat(2) as b:
            self.play(rnn.animate.set_opacity(0.25), rnn_count.animate.set_opacity(0.35), run_time=0.5)
            b.until("stack of layers")
            self.play(LaggedStart(*[Create(l) for l in pyr], lag_ratio=0.15), FadeIn(conv_tag), run_time=1.6)

        hop = link(row, RAN, CAT, ACCENT, height=1.75, width=6)
        one = Tally(end=1, unit=("step", "steps"), owner="self-attention", font_size=48, color=ACCENT).move_to([4.3, 2.55, 0])
        rest = VGroup(*[link(row, i, j, ACCENT, width=2, rise=0.15).set_stroke(opacity=0.4) for i in range(N) for j in range(i + 1, N) if (i, j) != (CAT, RAN)])
        with self.beat(3) as b:
            self.play(pyr.animate.set_opacity(0.25), FadeOut(conv_tag), FadeOut(far), run_time=0.5)
            b.until("links ran to cat")
            self.play(Create(hop), run_time=1.1)
            self.play(FadeIn(one.set(1)), run_time=0.4)
            b.until("every word does this at once")
            self.play(*[Create(r) for r in rest], run_time=1.0)

        with self.beat(4) as b:
            self.play(FadeOut(pyr), FadeOut(rnn), FadeOut(rest), run_time=0.6)
            path_rnn = Math("O(n)", font_size=44, color=CYAN).next_to(rnn_count, RIGHT, buff=0.4)
            path_att = Math("O(1)", font_size=44, color=ACCENT).next_to(one, LEFT, buff=0.4)
            b.until("paths this short")
            self.play(Write(path_rnn), Write(path_att), run_time=0.8)
            b.until("easier to learn")
            self.play(Indicate(hop, color=ACCENT, scale_factor=1.02), run_time=0.9)


class Attend(VAScene):
    """The link up close: ran's query against every key, scaled, one score per word; softmax into weights; the weighted sum."""

    def construct(self):
        row = sentence(-0.85)
        hop = link(row, RAN, CAT, ACCENT, height=1.75, width=6)
        self.appear(row, hop)

        made_up = Text("made-up vectors, d_k = 4", font=SANS, font_size=28, color=MUTED).move_to([-4.4, -2.15, 0])
        formula = Math("op(\"softmax\")((Q K^T) / sqrt(d_k)) V", font_size=44, color=TEXT).move_to([2.2, 2.75, 0])
        pos = Text("+ position", font=SANS, font_size=28, color=VIOLET).move_to([1.5, -2.15, 0])
        q = Text("q", font=MONO, font_size=34, color=CURRENT, weight=BOLD).next_to(row.boxes[RAN], UP, buff=0.2)
        ks = VGroup(*[Text("k", font=MONO, font_size=30, color=CYAN).next_to(row.boxes[i], UP, buff=0.2) for i in range(N - 1)])
        with self.beat(0) as b:
            self.play(FadeOut(hop), FadeIn(made_up), run_time=0.6)
            b.until("its position")
            self.play(FadeIn(pos, shift=UP * 0.1), run_time=0.6)
            b.until("a query")
            self.play(FadeIn(q, shift=UP * 0.1), run_time=0.4)
            b.until("a key")
            self.play(LaggedStart(*[FadeIn(k, shift=UP * 0.1) for k in ks], lag_ratio=0.06), run_time=0.6)
            b.until("learned projections")
            self.play(Write(formula), run_time=0.9)

        # scores: the toy dot products over sqrt(4) = 2, as bars over each word
        scale = 0.42
        base_y = top(row, 0, 0.75)[1]
        scaled = [fact(f"s-{w.lower()}{i}") / fact("toy-scale") for i, w in enumerate(WORDS)]
        bars = VGroup(*[Rectangle(width=0.9, height=max(0.04, s * scale), stroke_width=0, fill_color=CYAN, fill_opacity=0.8)
                        .move_to([row.boxes[i].get_center()[0], base_y, 0], aligned_edge=DOWN) for i, s in enumerate(scaled)])
        score_tag = Text("score", font=SANS, font_size=28, color=CYAN).next_to(bars[0], UP, buff=0.25)
        with self.beat(1) as b:
            self.play(FadeOut(pos), run_time=0.4)
            b.until("dotted with every key")
            self.play(LaggedStart(*[GrowFromEdge(bar, DOWN) for bar in bars], lag_ratio=0.08), FadeIn(score_tag), run_time=1.2)
            self.play(ks.animate.set_opacity(0.3), q.animate.set_opacity(0.4), made_up.animate.set_opacity(0.4), run_time=0.4)
            b.until("square root")
            self.play(Indicate(formula, color=AMBER, scale_factor=1.05), run_time=0.8)

        weights = [fact(f"w-{w.lower()}{i}") for i, w in enumerate(WORDS)]
        wscale = 2.6
        wbars = VGroup(*[Rectangle(width=0.9, height=max(0.04, w * wscale), stroke_width=0, fill_color=ACCENT if i == CAT else MUTED, fill_opacity=0.85)
                         .move_to([row.boxes[i].get_center()[0], base_y, 0], aligned_edge=DOWN) for i, w in enumerate(weights)])
        weight_tag = Text("weight", font=SANS, font_size=28, color=ACCENT).move_to(score_tag)
        cat_w = Text(f"{fact('cat-weight'):.2f}", font=MONO, font_size=36, color=ACCENT, weight=BOLD).next_to(wbars[CAT], UP, buff=0.15)
        with self.beat(2) as b:
            b.until("Softmax")
            self.play(Transform(bars, wbars), Transform(score_tag, weight_tag), run_time=1.1)
            b.until("goes to cat")
            self.play(FadeIn(cat_w, shift=UP * 0.1), row.mark(CAT, ACCENT), run_time=0.6)

        out = Node("ran, attended", note=None).scale(0.8).move_to([row.boxes[RAN].get_center()[0] - 0.4, 2.0, 0])
        flows = VGroup(*[Line(bars[i].get_top(), out.get_bottom(), stroke_color=ACCENT if i == CAT else MUTED,
                              stroke_width=max(1.0, 10 * weights[i]), stroke_opacity=0.9) for i in range(N)])
        with self.beat(3) as b:
            b.until("weighted sum")
            self.play(FadeOut(formula), FadeIn(out), run_time=0.5)
            self.play(LaggedStart(*[Create(f) for f in flows], lag_ratio=0.05), run_time=1.0)


class Scale(VAScene):
    """Why divide by sqrt(d_k): random 64-dimensional dot products spread about 8 wide; the softmax over such scores is
    nearly one-hot; divided by 8 the spread is 1 and the weights soften."""

    def construct(self):
        formula = Math("op(\"softmax\")((Q K^T) / sqrt(d_k)) V", font_size=56, color=TEXT).move_to([0, 2.5, 0])
        with self.beat(0) as b:
            self.play(Write(formula), run_time=1.0)
            self.play(Circumscribe(formula[-9:-1], color=AMBER), run_time=1.0)

        ax = axes([-30, 30, 10], [0, 0.45, 0.1], x_length=6.2, y_length=3.2, tips=False).move_to([-3.4, -0.5, 0])
        normal = lambda s: (lambda x: np.exp(-x * x / (2 * s * s)) / (s * np.sqrt(2 * np.pi)))
        wide = curve(ax, normal(fact("spread")), color=ROSE, x_range=[-30, 30])
        wide_tag = Text(f"q·k, d_k = {fact('dk')}:  spread ≈ {fact('spread'):.0f}", font=MONO, font_size=28, color=ROSE).next_to(ax, UP, buff=0.2)
        unit = Text("entries: mean 0, variance 1", font=SANS, font_size=28, color=MUTED).next_to(ax, DOWN, buff=0.25)
        with self.beat(1) as b:
            self.play(formula.animate.scale(0.7).move_to([0, 2.8, 0]), FadeIn(ax), run_time=0.8)
            b.until("sixty-four dimensions")
            self.play(Create(wide), FadeIn(wide_tag), FadeIn(unit), run_time=1.2)
            b.until("eight times wider")
            self.play(Indicate(wide_tag, color=ROSE, scale_factor=1.06), run_time=0.8)

        # what such scores do to a softmax over seven words: the mean top weight
        def softbars(top_w, color):
            rest = (1 - top_w) / (N - 1)
            vals = [rest] * 3 + [top_w] + [rest] * 3
            return VGroup(*[Rectangle(width=0.55, height=max(0.03, v * 2.4), stroke_width=0, fill_color=color, fill_opacity=0.85)
                            for v in vals]).arrange(RIGHT, buff=0.14, aligned_edge=DOWN).move_to([3.8, -1.55, 0], aligned_edge=DOWN)
        raw = softbars(fact("top-weight-raw"), ROSE)
        raw_tag = Text(f"top weight ≈ {fact('top-weight-raw'):.2f}", font=MONO, font_size=28, color=ROSE).next_to(raw, UP, buff=0.3)
        soft_tag = Text("softmax over 7 words", font=SANS, font_size=28, color=MUTED).next_to(raw, DOWN, buff=0.25)
        with self.beat(2) as b:
            b.until("all-or-nothing")
            self.play(LaggedStart(*[GrowFromEdge(r, DOWN) for r in raw], lag_ratio=0.06), FadeIn(raw_tag), FadeIn(soft_tag), run_time=1.1)
            b.until("gradients are tiny")
            self.play(Indicate(raw[3], color=ROSE), run_time=0.8)

        narrow = curve(ax, normal(fact("spread-scaled")), color=ACCENT, x_range=[-6, 6])
        narrow_tag = Text(f"÷ {fact('sqrt-dk'):.0f}:  spread ≈ {fact('spread-scaled'):.0f}", font=MONO, font_size=28, color=ACCENT).move_to(wide_tag)
        soft = softbars(fact("top-weight-scaled"), ACCENT)
        soft_top = Text(f"top weight ≈ {fact('top-weight-scaled'):.2f}", font=MONO, font_size=28, color=ACCENT).move_to(raw_tag)
        with self.beat(3) as b:
            b.until("Dividing by eight")
            self.play(ReplacementTransform(wide, narrow), ReplacementTransform(wide_tag, narrow_tag), run_time=1.1)
            self.play(Transform(raw, soft), Transform(raw_tag, soft_top), run_time=0.9)


class Limit(VAScene):
    """Every word scores every word: n squared scores. Cheaper than recurrence only while n < d; generation stays serial."""

    def construct(self):
        size = 0.48
        grid = VGroup(*[Square(size, stroke_color=DIM, stroke_width=2, fill_color=ACCENT, fill_opacity=0) for _ in range(N * N)])
        grid.arrange_in_grid(N, N, buff=0.06).move_to([-3.4, -0.1, 0])
        rows_l = VGroup(*[Text(w, font=MONO, font_size=28, color=MUTED).next_to(grid[i * N], LEFT, buff=0.18) for i, w in enumerate(WORDS)]).set_opacity(0.4)
        count = Tally(end=fact("pairs-7"), unit="scores", owner="7 words", font_size=56).move_to([3.0, 1.4, 0])
        big = Text(f"{fact('long-words'):,} word pieces\n→ {fact('pairs-long'):,} scores", font=MONO, font_size=30, color=AMBER, line_spacing=0.9).move_to([3.0, -0.1, 0])
        per = Text("per head, per layer", font=SANS, font_size=28, color=MUTED).next_to(big, DOWN, buff=0.2)
        with self.beat(0) as b:
            self.play(FadeIn(grid), FadeIn(rows_l), FadeIn(count.set(0)), run_time=0.7)
            b.until("Every word scores every word")
            self.play(LaggedStart(*[sq.animate.set_fill(ACCENT, 0.55) for sq in grid], lag_ratio=0.02), count.to(fact("pairs-7")), run_time=1.8)
            b.until("A thousand")
            self.play(FadeIn(big, shift=UP * 0.1), run_time=0.7)
            b.until("per head")
            self.play(FadeIn(per), run_time=0.5)

        cheaper = Math("n^2 d < n d^2 <=> n < d = 512", font_size=40, color=TEXT).move_to([3.0, -1.55, 0])
        masked = VGroup(*[grid[i * N + j] for i in range(N) for j in range(N) if j > i])
        mask_tag = Text("later words masked", font=SANS, font_size=28, color=ROSE).next_to(grid, UP, buff=0.2)
        with self.beat(1) as b:
            b.until("cheaper per layer")
            self.play(FadeOut(per), big.animate.set_opacity(0.35), Write(cheaper), run_time=1.0)
            b.until("later words masked")
            self.play(*[sq.animate.set_fill(ROSE, 0.25).set_stroke(ROSE) for sq in masked], FadeIn(mask_tag), run_time=0.9)
            b.until("one word at a time")
            for i in range(N):
                self.play(VGroup(*[grid[i * N + j] for j in range(i + 1)]).animate.set_fill(AMBER, 0.75), run_time=0.18)
