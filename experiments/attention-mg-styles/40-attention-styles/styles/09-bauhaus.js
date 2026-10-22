// Geometric Bauhaus: primaries on paper, a strict grid; words as circle / square / triangle; the recurrence is a
// black rule that extends one tick at a time; the link is a red half-disc; hero: a blue half-disc rises behind.
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, easeIO, backOut, text, arcAt, growArc } from '../story.js';

export const FONTS = ["900 60px 'Poppins'", "600 40px 'Poppins'"];
const PAPER = '#F1EADB', INK = '#141414', RED = '#D62828', YEL = '#F2B705', BLU = '#1D4E9E';
const X = (i) => 330 + i * 210, Y = 700;
const FILL = [INK, RED, YEL, BLU, INK, YEL, RED];

function glyph(ctx, i, k) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(X(i), Y); ctx.scale(k, k); ctx.fillStyle = FILL[i];
  const r = 40;
  if (i % 3 === 0) { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); }
  else if (i % 3 === 1) ctx.fillRect(-r, -r, 2 * r, 2 * r);
  else { ctx.beginPath(); ctx.moveTo(0, -r * 1.1); ctx.lineTo(r * 1.1, r); ctx.lineTo(-r * 1.1, r); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}

export function draw(ctx, s, t) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(20,20,20,0.08)'; ctx.lineWidth = 2;
  for (let x = 120; x < W; x += 210) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 70; y < H; y += 140) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // hero: a blue half-disc rises behind the sentence, its diameter the whole row
  if (s.hero > 0) {
    const r = 500, cx = (X(0) + X(RAN)) / 2;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, Y); ctx.clip();
    ctx.fillStyle = BLU; ctx.beginPath(); ctx.arc(cx, Y + (1 - s.hero) * r, r, Math.PI, 0); ctx.fill(); ctx.restore();
    ctx.fillStyle = YEL; ctx.beginPath(); ctx.arc(cx + r * 0.55, Y - r * 0.7 * s.hero, 70 * s.hero, 0, 7); ctx.fill();
  }
  ctx.lineCap = 'butt';
  PAIRS.forEach(([i, j]) => { ctx.strokeStyle = s.hero > 0.5 ? 'rgba(241,234,219,0.75)' : INK; ctx.lineWidth = 3; growArc(ctx, X(i), X(j), Y - 50, (X(j) - X(i)) / 2, s.bloom); });
  // the link: a red half-disc outline, drawn by sweeping
  if (s.link > 0) { const cx = (X(CAT) + X(RAN)) / 2, r = (X(RAN) - X(CAT)) / 2; ctx.strokeStyle = RED; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(cx, Y - 50, r, 0, -Math.PI * s.link, true); ctx.stroke(); }

  for (let i = 0; i < N; i++) {
    const k = backOut(clamp((t - s.stepAt(i) + 0.12) / 0.3));
    glyph(ctx, i, k);
    text(ctx, WORDS[i].toUpperCase(), X(i), Y + 96, { font: 'Poppins', size: 30, weight: 900, color: INK, alpha: k > 0 ? 1 : 0, spacing: 4 });
  }
  // the recurrence: a black rule, one tick per word, in a row
  const fade = 1 - s.chainFade;
  if (fade > 0) {
    ctx.globalAlpha = fade; ctx.fillStyle = INK;
    const end = lerp(X(0) - 180, X(N - 1), clamp(s.walk / N));
    ctx.fillRect(X(0) - 180, Y + 130, end - (X(0) - 180), 12);
    for (let i = 0; i < N; i++) if (s.walk >= i + 1) ctx.fillRect(X(i) - 6, Y + 112, 12, 48);
    ctx.globalAlpha = 1;
  }
  text(ctx, SEVEN, X(N - 1), Y + 200, { font: 'Poppins', size: 30, weight: 900, color: INK, alpha: s.seven, align: 'right', spacing: 4 });
  text(ctx, ONE, (X(CAT) + X(RAN)) / 2, Y - 50 - (X(RAN) - X(CAT)) / 2 - 36, { font: 'Poppins', size: 40, weight: 900, color: RED, alpha: s.one, spacing: 4 });
  text(ctx, 'ATTENTION', 120, 130, { font: 'Poppins', size: 96, weight: 900, color: INK, alpha: s.title, align: 'left', spacing: -2 });
  text(ctx, 'IS ALL YOU NEED', 124, 196, { font: 'Poppins', size: 52, weight: 900, color: RED, alpha: s.title, align: 'left', spacing: 6 });
  text(ctx, TAGLINE.toUpperCase(), W - 120, 196, { font: 'Poppins', size: 26, weight: 600, color: INK, alpha: s.tagline, align: 'right', spacing: 6 });
}
