# /// script
# dependencies = ["numpy"]
# ///
"""The oracle: every number the video says or shows.

A paper video has no code of its own to run, so this reads the numbers from the paper as `va paper`
read it (paper/paper.json), and computes everything derived from them: the scatter's coordinates,
the margins, the pair counts. The toy attention the animation draws is computed here too, with the
paper's own formula, softmax(q·K^T / sqrt(d_k)), so the bars on screen are this computation.
"""

import json
import re
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
paper = json.loads((HERE / "paper" / "paper.json").read_text())


def table(n):
    return next(t for t in paper["tables"] if t["n"] == n)


def flops(cell):
    """'2.3· 10^ 19' as the paper prints it, as a number."""
    found = re.match(r"([\d.]+)\s*·\s*10\^\s*(\d+)", cell.strip())
    return float(found.group(1)) * 10 ** int(found.group(2)) if found else None


# ---------------------------------------------------------------------------------------------
# The sentence the video uses throughout, and what recurrence costs on it.

SENTENCE = "The cat that the dog chased ran".split()
CONV_K = 3
subject, verb = SENTENCE.index("cat"), SENTENCE.index("ran")

# ---------------------------------------------------------------------------------------------
# Toy attention for one query, "ran", over the seven words: d_k = 4, so the scale is sqrt(4) = 2.
# The vectors are made up for the picture (the paper reports no such toy); the arithmetic is the paper's.

D_TOY = 4
q_ran = np.array([1.0, 2.0, 0.0, 1.0])
K = np.array([
    [0.2, 0.1, 0.3, 0.0],   # The
    [1.2, 1.8, 0.1, 1.1],   # cat: points the same way as ran's query
    [0.1, 0.2, 0.4, 0.1],   # that
    [0.2, 0.1, 0.3, 0.0],   # the
    [0.6, 0.4, 0.2, 0.3],   # dog
    [0.3, 0.7, 0.2, 0.4],   # chased
    [0.4, 0.5, 0.3, 0.5],   # ran
])
scores = K @ q_ran
scaled = scores / np.sqrt(D_TOY)
raw_weights = np.exp(scores - scores.max())
raw_weights /= raw_weights.sum()
weights = np.exp(scaled - scaled.max())
weights /= weights.sum()

# ---------------------------------------------------------------------------------------------
# Why divide by sqrt(d_k): the paper's footnote. With components of mean 0 and variance 1, q·k has
# variance d_k. Measured on random vectors at the paper's d_k = 64, then after the paper's scaling.

BODY = " ".join(s["text"] for s in paper["sections"])
d_k = int(re.search(r"d_ k =d_ v =d_ model /h=(\d+)", BODY).group(1))
rng = np.random.default_rng(0)
q = rng.standard_normal((20000, d_k))
k = rng.standard_normal((20000, d_k))
dots = (q * k).sum(axis=1)
spread = float(dots.std())
spread_scaled = float((dots / np.sqrt(d_k)).std())

# How peaked a softmax over seven such scores gets, unscaled against scaled: the mean top weight.
rows = rng.standard_normal((5000, len(SENTENCE), d_k))
qs = rng.standard_normal((5000, d_k))
raw = np.einsum("nwd,nd->nw", rows, qs)


def top_weight(s):
    e = np.exp(s - s.max(axis=1, keepdims=True))
    return float((e / e.sum(axis=1, keepdims=True)).max(axis=1).mean())


# ---------------------------------------------------------------------------------------------
# Table 2: BLEU on newstest2014 and training cost. Columns as read: name, EN-DE, EN-FR, -, EN-DE cost, EN-FR cost.

rows2 = {re.sub(r"\s*\[\d+\]", "", r[0]).strip(): r for r in table(2)["rows"]}


def bleu(name, col=1):
    return float(rows2[name][col])


def cost(name):
    return flops(rows2[name][4])


earlier = ["GNMT + RL", "ConvS2S", "MoE", "GNMT + RL Ensemble", "ConvS2S Ensemble"]
# The first row after the header is the sub-header (EN-DE, EN-FR); a model row has a number in its BLEU column.
earlier_ende = [n for n in rows2 if not n.startswith("Transformer") and re.fullmatch(r"[\d.]+", rows2[n][1])]
best_earlier = max(bleu(n) for n in earlier_ende)
best_earlier_name = max(earlier_ende, key=bleu)
base, big = "Transformer (base model)", "Transformer (big)"

# Table 1: the per-layer costs the scene with the two paths cites.
t1 = {r[0]: r for r in table(1)["rows"]}

# Section 5.2 and the abstract: how long the models trained.
training = next(s["text"] for s in paper["sections"] if s["heading"].endswith("Training"))
base_hours = int(re.search(r"100,000 steps or (\d+) hours", training).group(1))
big_days = float(re.search(r"300,000 steps \(([\d.]+) days\)", training).group(1))
gpus = int(re.search(r"(\d+) NVIDIA P100 GPUs", training).group(1))
heads = int(re.search(r"employ h=(\d+) parallel attention layers", BODY).group(1))

N_LONG = 1000
D_MODEL = int(re.search(r"embedding layers, produce outputs of dimension d_ model =(\d+)", BODY).group(1))


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("transformer (base model)", "base").replace("transformer (big)", "big")).strip("-")

print(json.dumps({
    "words": len(SENTENCE),
    "conv-kernel": CONV_K,
    # a centred kernel of width k widens each position's reach by (k - 1) / 2 words each way per layer
    "conv-layers": -(-(verb - subject) // ((CONV_K - 1) // 2)),
    "rnn-steps": len(SENTENCE),
    "cat-to-ran": verb - subject,
    "toy-dk": D_TOY,
    "toy-scale": float(np.sqrt(D_TOY)),
    "cat-score": round(float(scores[subject]), 2),
    "cat-weight": round(float(weights[subject]), 2),
    "cat-weight-raw": round(float(raw_weights[subject]), 2),
    "top-is-cat-raw": bool(int(raw_weights.argmax()) == subject),
    **{f"r-{w.lower()}{i}": round(float(x), 2) for i, (w, x) in enumerate(zip(SENTENCE, raw_weights))},
    **{f"w-{w.lower()}{i}": round(float(x), 2) for i, (w, x) in enumerate(zip(SENTENCE, weights))},
    **{f"s-{w.lower()}{i}": round(float(x), 1) for i, (w, x) in enumerate(zip(SENTENCE, scores))},
    "top-is-cat": bool(int(weights.argmax()) == subject),
    "weights-sum": round(float(weights.sum()), 6),
    "dk": d_k,
    "sqrt-dk": float(np.sqrt(d_k)),
    "spread": round(spread, 1),
    "spread-scaled": round(spread_scaled, 2),
    "top-weight-raw": round(top_weight(raw), 2),
    "top-weight-scaled": round(top_weight(raw / np.sqrt(d_k)), 2),
    "heads": heads,
    "d-model": int(re.search(r"embedding layers, produce outputs of dimension d_ model =(\d+)", BODY).group(1)),
    "crossover-words": next(n for n in range(1, 10000) if n * n * D_MODEL >= n * D_MODEL * D_MODEL),
    "self-attention-cheaper-below-d": t1["Self-Attention"][1] == "O(n^ 2 · d)" and t1["Recurrent"][1] == "O(n· d^ 2)",
    "base-hours": base_hours,
    "gpus": gpus,
    "big-days": big_days,
    "base-bleu": bleu(base),
    "big-bleu": bleu(big),
    "best-earlier": best_earlier,
    "best-earlier-is-ensemble": "Ensemble" in best_earlier_name,
    "base-beats-all-earlier": all(bleu(base) > bleu(n) for n in earlier_ende),
    "big-margin": round(bleu(big) - best_earlier, 2),
    "big-margin-over-2": bleu(big) - best_earlier > 2,
    "big-margin-points": int(bleu(big) - best_earlier),
    "enfr-big": bleu(big, 2),
    "base-cheapest": all(cost(base) < cost(n) for n in rows2 if n != base and flops(rows2[n][4])),
    # The scatter: one point per model, training cost in units of 10^18 FLOPs along, EN-DE BLEU up.
    **{f"x-{slug(n)}": round(cost(n) / 1e18, 1) for n in earlier + [base, big]},
    **{f"y-{slug(n)}": bleu(n) for n in earlier + [base, big]},
    "pairs-7": len(SENTENCE) ** 2,
    "long-words": N_LONG,
    "pairs-long": N_LONG ** 2,
    "self-attention-complexity": t1["Self-Attention"][1],
    "wmt-year": int(re.search(r"WMT (\d{4})", training).group(1)),
}))
