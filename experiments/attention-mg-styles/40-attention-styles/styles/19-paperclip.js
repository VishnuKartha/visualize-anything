// Sticker explainer (回形针 style): calm off-white page, flat icons as die-cut stickers with white borders, thin
// rules, small captions; hero: an honest bar chart, 7 steps against 1.
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, easeOut, backOut, text, arcAt, growArc, drawArc, roundRect } from '../story.js';

export const FONTS = ["800 60px 'Poppins'", "500 40px 'DM Sans'"];
const PAGE = '#F5F2EA', INK = '#202124', BLUE = '#2D6CDF', ORANGE = '#F28C28';
const X = (i) => 330 + i * 210, Y = 560;

function sticker(ctx, i, k) {
  ctx.save(); ctx.translate(X(i), Y); ctx.scale(k, k);
  ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 5;
  ctx.fillStyle = '#fff'; roundRect(ctx, -86, -46, 172, 92, 46); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = i === CAT ? BLUE : i === RAN ? ORANGE : '#E3DED2'; roundRect(ctx, -78, -38, 156, 76, 38); ctx.fill();
  text(ctx, WORDS[i], 0, 12, { font: 'Poppins', size: 32, weight: 800, color: i === CAT || i === RAN ? '#fff' : INK });
  ctx.restore();
}

export function draw(ctx, s, t) {
  ctx.fillStyle = PAGE; ctx.fillRect(0, 0, W, H);
  // a page header, like a printed explainer
  ctx.fillStyle = INK; ctx.fillRect(120, 96, 6, 44);
  text(ctx, 'HOW DOES A WORD FIND ITS SUBJECT?', 146, 132, { font: 'DM Sans', size: 30, weight: 500, color: INK, align: 'left', spacing: 3 });
  ctx.lineCap = 'round';
  ctx.globalAlpha = 1 - 0.85 * s.hero;
  PAIRS.forEach(([i, j]) => { ctx.strokeStyle = 'rgba(32,33,36,0.35)'; ctx.lineWidth = 2.5; growArc(ctx, X(i), X(j), Y - 50, 0.35 * (X(j) - X(i)), s.bloom); });
  ctx.setLineDash([]); ctx.strokeStyle = BLUE; ctx.lineWidth = 6; drawArc(ctx, X(RAN), X(CAT), Y - 50, 0.35 * (X(RAN) - X(CAT)) + 30, s.link);
  ctx.globalAlpha = 1;
  // the recurrence: a dotted path with a step number at each word
  const fade = 1 - s.chainFade;
  for (let i = 0; i < N; i++) {
    const k = backOut(clamp((t - s.stepAt(i) + 0.12) / 0.35)); if (k <= 0) continue;
    sticker(ctx, i, k);
    ctx.globalAlpha = fade * k; ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(X(i), Y + 82, 18, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    text(ctx, String(i + 1), X(i), Y + 91, { font: 'Poppins', size: 22, weight: 800, color: '#fff', alpha: fade * k });
    if (i > 0) { ctx.globalAlpha = fade; ctx.setLineDash([2, 10]); ctx.strokeStyle = ORANGE; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(X(i - 1) + 22, Y + 82); ctx.lineTo(lerp(X(i - 1) + 22, X(i) - 22, clamp((t - s.stepAt(i - 1)) / (s.stepAt(i) - s.stepAt(i - 1)))), Y + 82); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; }
  }
  text(ctx, SEVEN, X(N - 1) + 90, Y + 150, { font: 'DM Sans', size: 28, weight: 500, color: ORANGE, alpha: s.seven, align: 'right', spacing: 3 });
  const ap = arcAt(X(CAT), X(RAN), Y - 50, 0.35 * (X(RAN) - X(CAT)) + 30, 0.5);
  text(ctx, ONE, ap[0], ap[1] - 26, { font: 'DM Sans', size: 34, weight: 700, color: BLUE, alpha: s.one, spacing: 3 });
  // hero: the comparison, as a chart a reader can trust
  if (s.hero > 0) {
    const bx = 560, by = 900, unit = 110;
    ctx.globalAlpha = s.hero;
    ctx.fillStyle = '#fff'; roundRect(ctx, bx - 60, by - 210, 920, 260, 24); ctx.fill();
    text(ctx, 'steps from "cat" to "ran"', bx - 30, by - 160, { font: 'DM Sans', size: 26, weight: 500, color: INK, align: 'left' });
    ctx.fillStyle = ORANGE; ctx.fillRect(bx + 160, by - 120, unit * 5 * easeOut(s.hero), 44);
    ctx.fillStyle = BLUE; ctx.fillRect(bx + 160, by - 50, unit * 1 * easeOut(s.hero), 44);
    text(ctx, 'recurrent', bx + 140, by - 86, { font: 'DM Sans', size: 26, weight: 500, color: INK, align: 'right' });
    text(ctx, 'attention', bx + 140, by - 16, { font: 'DM Sans', size: 26, weight: 500, color: INK, align: 'right' });
    text(ctx, '5', bx + 180 + unit * 5, by - 86, { font: 'Poppins', size: 30, weight: 800, color: ORANGE, align: 'left' });
    text(ctx, '1', bx + 180 + unit, by - 16, { font: 'Poppins', size: 30, weight: 800, color: BLUE, align: 'left' });
    ctx.globalAlpha = 1;
  }
  text(ctx, TITLE, W - 120, 132, { font: 'Poppins', size: 44, weight: 800, color: INK, alpha: s.title, align: 'right', spacing: 2 });
  text(ctx, TAGLINE, W - 120, 182, { font: 'DM Sans', size: 28, weight: 500, color: BLUE, alpha: s.tagline, align: 'right' });
}
