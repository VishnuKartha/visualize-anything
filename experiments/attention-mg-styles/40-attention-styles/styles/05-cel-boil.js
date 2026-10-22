// Frame-by-frame / line boil: ink on paper, every line redrawn with a fresh wobble on twos (12 drawings a second),
// hand-lettered words; the hero is a watercolour wash that blooms under the arcs.
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, rng, text, arcAt } from '../story.js';

export const FONTS = ["700 60px 'Caveat'", "600 40px 'Caveat'"];
const PAPER = '#F4EEE1', INK = '#1E1B18', RED = '#D7392B';
const X = (i) => 350 + i * 204, Y = 700;

let R = Math.random;
function wob(x, y, amp = 2.4) { return [x + (R() - 0.5) * amp * 2, y + (R() - 0.5) * amp * 2]; }
function inkPath(ctx, pts, width, color, amp) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // two passes, slightly apart: the doubled line of a real pen
  for (let pass = 0; pass < 2; pass++) {
    ctx.globalAlpha = pass ? 0.45 : 1;
    ctx.beginPath(); pts.forEach(([x, y], k) => { const [a, b] = wob(x, y, amp); k ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
const arcPts = (i, j, u0, u1, lift = 0) => { const p = []; for (let k = 0; k <= 40; k++) p.push(arcAt(X(i), X(j), Y - 54, 0.4 * Math.abs(X(j) - X(i)) + lift, lerp(u0, u1, k / 40))); return p; };
const ring = (x, y, r) => { const p = []; for (let k = 0; k <= 26; k++) { const a = -Math.PI / 2 + k / 24 * Math.PI * 2; p.push([x + r * 1.25 * Math.cos(a), y + r * 0.62 * Math.sin(a)]); } return p; };

export function draw(ctx, s, t) {
  R = rng(Math.floor(t * 12) * 7919 + 13);               // a new drawing every 2 frames
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  // paper tooth
  const g = rng(5);
  ctx.fillStyle = 'rgba(120,100,70,0.06)';
  for (let k = 0; k < 900; k++) ctx.fillRect(g() * W, g() * H, 2, 2);

  // the wash: watercolour blooms under the dome, from "ran" outward
  if (s.hero > 0) {
    for (let k = 0; k < 7; k++) {
      const w = rng(100 + k), cx = lerp(X(RAN), X(k), s.hero), cy = Y - 160 - w() * 200, r = (120 + w() * 160) * s.hero;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grd.addColorStop(0, 'rgba(215,57,43,0.20)'); grd.addColorStop(0.8, 'rgba(215,57,43,0.12)'); grd.addColorStop(1, 'rgba(215,57,43,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  // the chain: arrows drawn one after another
  const fade = 1 - 0.8 * s.chainFade;
  for (let i = 0; i < N; i++) {
    const seen = clamp((t - s.stepAt(i) + 0.12) / 0.2);
    if (seen <= 0) continue;
    ctx.globalAlpha = 1;
    text(ctx, WORDS[i], X(i) + (R() - 0.5) * 2, Y + 14 + (R() - 0.5) * 2, { font: 'Caveat', size: 58, weight: 700, color: INK });
    inkPath(ctx, ring(X(i), Y - 4, 52).slice(0, Math.max(2, Math.round(26 * seen))), 3.2, i === CAT || i === RAN ? RED : INK, 1.8);
    if (i > 0) {
      const p = clamp((t - s.stepAt(i - 1)) / (s.stepAt(i) - s.stepAt(i - 1)));
      const a = [X(i - 1) + 68, Y + 46], b = [lerp(X(i - 1) + 68, X(i) - 68, p), Y + 46];
      ctx.globalAlpha = fade; inkPath(ctx, [a, [(a[0] + b[0]) / 2, Y + 56], b], 3, INK, 1.6);
      if (p >= 1) inkPath(ctx, [[b[0] - 14, Y + 38], b, [b[0] - 14, Y + 54]], 3, INK, 1.2);
      ctx.globalAlpha = 1;
    }
  }
  if (s.link > 0) inkPath(ctx, arcPts(RAN, CAT, 0, s.link, 40), 6, RED, 2.6);
  if (s.bloom > 0) PAIRS.forEach(([i, j]) => { inkPath(ctx, arcPts(i, j, 0, s.bloom / 2), 2.4, INK, 1.8); inkPath(ctx, arcPts(i, j, 1 - s.bloom / 2, 1), 2.4, INK, 1.8); });

  text(ctx, SEVEN.toLowerCase(), X(5), Y + 130, { font: 'Caveat', size: 50, weight: 700, color: INK, alpha: s.seven });
  const ap = arcAt(X(CAT), X(RAN), Y - 54, 0.4 * (X(RAN) - X(CAT)) + 40, 0.5);
  text(ctx, ONE.toLowerCase() + '!', ap[0], ap[1] - 26, { font: 'Caveat', size: 64, weight: 700, color: RED, alpha: s.one });

  if (s.title > 0) {
    text(ctx, 'Attention Is All You Need', W / 2 + (R() - 0.5) * 3, 150 + (R() - 0.5) * 3, { font: 'Caveat', size: 104, weight: 700, color: INK, alpha: s.title });
    inkPath(ctx, [[W / 2 - 420 * s.title, 182], [W / 2 + 420 * s.title, 176]], 4, RED, 2);
  }
  text(ctx, TAGLINE, W / 2, 238, { font: 'Caveat', size: 52, weight: 600, color: RED, alpha: s.tagline });
}
