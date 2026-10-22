// ATTENTION — one story, fifteen styles. The story (what happens, and when) lives here; each style in styles/<slug>.js
// only decides how it looks. Every frame is a pure function of t.
//   0.30–2.22 s  seven words, one step each, in a row          (the recurrent network)
//   2.55–3.45 s  one direct link from "ran" back to "cat"      (self-attention: one step)
//   3.95–4.65 s  every other pair of words links at once       (in parallel)
//   5.55–6.75 s  the style's hero moment
//   7.05 s →     ATTENTION IS ALL YOU NEED · every word, in one step
export const W = 1920, H = 1080;
window.DEMO = { width: W, height: H, fps: 30, duration: 10, motionBlur: { samples: 1 } };

export const C = await (await fetch('/demos/40-attention-styles/cues.json')).json();
export const WORDS = C.words, N = WORDS.length, CAT = 1, RAN = N - 1;
export const TITLE = 'ATTENTION IS ALL YOU NEED', TAGLINE = 'every word, in one step';
export const SEVEN = '7 STEPS, IN A ROW', ONE = '1 STEP';

// ---------------------------------------------------------------- maths
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const span = (t, a, b) => clamp((t - a) / (b - a));
export function cubicBezier(p1x, p1y, p2x, p2y) {
  const bx = (t) => 3 * p1x * t * (1 - t) ** 2 + 3 * p2x * t * t * (1 - t) + t ** 3;
  const by = (t) => 3 * p1y * t * (1 - t) ** 2 + 3 * p2y * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (bx(m) < x) lo = m; else hi = m; }
    return by((lo + hi) / 2);
  };
}
export const easeIO = cubicBezier(0.65, 0, 0.35, 1);
export const easeOut = cubicBezier(0.16, 1, 0.3, 1);
export const backOut = cubicBezier(0.34, 1.56, 0.64, 1);       // the overshoot pop
export const smooth = (x) => x * x * (3 - 2 * x);
export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const pulse = (t, at, len = 0.35) => { const k = (t - at) / len; return k < 0 || k > 1 ? 0 : Math.sin(k * Math.PI); };

// every pair but the hero link (cat-ran), the arcs that bloom at once
export const PAIRS = [];
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (!(i === CAT && j === RAN)) PAIRS.push([i, j]);

/** The story at time t: every phase as an eased 0..1, so a style only maps numbers to pictures. */
export function story(t) {
  const st = C.steps;
  // how far the recurrence has walked: k words closed, plus the eased fraction toward the next
  let walk = 0;
  for (let i = 0; i < N; i++) {
    const t0 = i === 0 ? 0 : st[i - 1], t1 = st[i];
    walk += easeIO(span(t, t0 + (i === 0 ? 0.0 : 0.04), t1));
  }
  return {
    t,
    walk,                                                  // 0..7: loops closed so far (fractional while moving)
    stepAt: (i) => st[i],
    stepPulse: (i) => pulse(t, st[i] - 0.05, 0.35),
    seen: (i) => easeOut(span(t, st[i] - 0.12, st[i] + 0.2)),   // word i has appeared
    link: easeIO(span(t, C.link[0], C.link[1])),
    linkPulse: pulse(t, C.link[1] - 0.05, 0.45),
    bloom: easeIO(span(t, C.bloom[0], C.bloom[1])),
    bloomPulse: pulse(t, C.bloom[0] - 0.05, 0.4),
    chainFade: easeIO(span(t, C.bloom[0], C.bloom[0] + 0.6)),
    hero: easeIO(span(t, C.fill[0], C.fill[1])),
    heroPulse: pulse(t, C.fill[0] - 0.05, 0.5),
    title: easeOut(span(t, C.wordmark, C.wordmark + 0.7)),
    titleIn: backOut(span(t, C.wordmark, C.wordmark + 0.55)),
    tagline: easeOut(span(t, C.tagline, C.tagline + 0.6)),
    rules: easeIO(span(t, C.rules[0], C.rules[1])),
    glint: span(t, C.glint[0], C.glint[1]),
    seven: easeOut(span(t, C.label_steps, C.label_steps + 0.35)) * (1 - span(t, C.bloom[0], C.bloom[0] + 0.4)),
    one: easeOut(span(t, C.label_link, C.label_link + 0.3)) * (1 - span(t, C.bloom[1] + 0.1, C.bloom[1] + 0.5)),
    hold: t > C.glint[0] ? (t - C.glint[0]) : 0,          // seconds into the end hold, for living micro-motion
  };
}

// ---------------------------------------------------------------- drawing helpers shared by the styles
export function text(ctx, str, x, y, { font = 'Inter', size = 40, weight = 600, italic = false, spacing = 0, color = '#fff', alpha = 1, align = 'center', baseline = 'alphabetic', stroke = null, strokeWidth = 0, shadow = null } = {}) {
  if (alpha <= 0.004) return 0;
  ctx.save();
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px '${font}'`;
  ctx.letterSpacing = `${spacing}px`;
  ctx.textAlign = align; ctx.textBaseline = baseline; ctx.globalAlpha *= alpha;
  const dx = align === 'center' ? spacing / 2 : 0;
  if (shadow) { ctx.shadowColor = shadow.color; ctx.shadowBlur = shadow.blur || 0; ctx.shadowOffsetX = shadow.x || 0; ctx.shadowOffsetY = shadow.y || 0; }
  if (stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth; ctx.strokeText(str, x + dx, y); ctx.shadowColor = 'transparent'; }
  ctx.fillStyle = color; ctx.fillText(str, x + dx, y);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}
/** Points along a half-ellipse arc between (xa, y) and (xb, y), rising by h; u in 0..1. */
export function arcAt(xa, xb, y, h, u) {
  const ph = u * Math.PI, mid = (xa + xb) / 2, half = (xb - xa) / 2;
  return [mid - half * Math.cos(ph), y - h * Math.sin(ph)];
}
/** Stroke an arc from both ends toward its apex, g of the way (0..1). */
export function growArc(ctx, xa, xb, y, h, g, n = 90) {
  if (g <= 0) return;
  for (const [u0, u1] of [[0, g / 2], [1 - g / 2, 1]]) {
    ctx.beginPath();
    for (let k = 0; k <= n; k++) { const [x, yy] = arcAt(xa, xb, y, h, lerp(u0, u1, k / n)); k ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
    ctx.stroke();
  }
}
/** Stroke an arc drawn by one pen from xa toward xb, p of the way. */
export function drawArc(ctx, xa, xb, y, h, p, n = 120) {
  if (p <= 0) return;
  ctx.beginPath();
  for (let k = 0; k <= n; k++) { const [x, yy] = arcAt(xa, xb, y, h, p * k / n); k ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
  ctx.stroke();
}
export function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

