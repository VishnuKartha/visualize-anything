// Flat Vector: flat fills, no gradients, bouncy overshoot pops, a hopping ball, a colour wipe for the hero.
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, backOut, easeOut, text, arcAt, growArc, drawArc, roundRect } from '../story.js';

export const FONTS = ["700 60px 'Fredoka'", "600 40px 'Fredoka'"];
const BG = '#FDF6EC', INK = '#1F2041', WIPE = '#5B3FFF';
const COLS = ['#FF6B5B', '#2EC4B6', '#FFC93C', '#00B37E', '#FF8FB1', '#3FA7F5', '#FF9F1C'];
const X = (i) => 360 + i * 200, Y = 660, PW = 168, PH = 76;

function pill(ctx, i, s, k, onWipe) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(X(i), Y); ctx.scale(k, k);
  ctx.fillStyle = 'rgba(31,32,65,0.12)'; roundRect(ctx, -PW / 2 + 6, -PH / 2 + 8, PW, PH, PH / 2); ctx.fill();
  ctx.fillStyle = COLS[i]; roundRect(ctx, -PW / 2, -PH / 2, PW, PH, PH / 2); ctx.fill();
  text(ctx, WORDS[i], 0, 13, { font: 'Fredoka', size: 38, weight: 600, color: i === 2 || i === 0 ? INK : '#fff' });
  ctx.restore();
}

function arcs(ctx, s, white) {
  ctx.lineCap = 'round';
  PAIRS.forEach(([i, j], n) => {
    ctx.strokeStyle = white ? 'rgba(255,255,255,0.75)' : COLS[(i + j) % COLS.length];
    ctx.lineWidth = 7;
    growArc(ctx, X(i), X(j), Y - PH / 2 - 6, 0.42 * (X(j) - X(i)), s.bloom);
  });
  ctx.strokeStyle = white ? '#fff' : '#2EC4B6'; ctx.lineWidth = 16;
  drawArc(ctx, X(RAN), X(CAT), Y - PH / 2 - 6, 0.42 * (X(RAN) - X(CAT)) + 40, s.link);
}

export function draw(ctx, s, t) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  // the hero: a flat colour wipe from "ran", everything inside it turns white-on-violet
  const r = s.hero * 2300;
  const scene = (white) => {
    arcs(ctx, s, white);
    for (let i = 0; i < N; i++) {
      const pop = backOut(clamp((t - s.stepAt(i) + 0.15) / 0.4));
      pill(ctx, i, s, pop * (1 + 0.12 * s.stepPulse(i) + (i === CAT ? 0.18 * s.linkPulse : 0)), white);
    }
  };
  scene(false);
  if (r > 0) {
    ctx.save(); ctx.beginPath(); ctx.arc(X(RAN), Y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = WIPE; ctx.fillRect(0, 0, W, H); scene(true); ctx.restore();
  }

  // the recurrence: one ball hopping word to word, waiting for each landing
  const fade = 1 - s.chainFade;
  if (fade > 0) {
    const i = Math.max(0, Math.ceil(s.walk) - 1), f = clamp(s.walk - i);
    const a = i === 0 ? X(0) - 260 : X(i - 1), b = X(i);
    const x = lerp(a, b, f), y = Y - PH / 2 - 26 - Math.sin(f * Math.PI) * 120;
    ctx.globalAlpha = fade; ctx.fillStyle = '#FF6B5B';
    const sq = 1 - 0.25 * (f < 0.08 || f > 0.92 ? 1 : 0);
    ctx.beginPath(); ctx.ellipse(x, y, 24 / sq, 24 * sq, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  text(ctx, SEVEN, X(5), Y + 110, { font: 'Fredoka', size: 34, weight: 600, color: INK, alpha: s.seven, spacing: 2 });
  text(ctx, ONE, (X(CAT) + X(RAN)) / 2, Y - PH / 2 - 0.42 * (X(RAN) - X(CAT)) - 70, { font: 'Fredoka', size: 44, weight: 700, color: '#2EC4B6', alpha: s.one });

  // title
  const ti = s.titleIn;
  if (ti > 0) {
    ctx.save(); ctx.translate(W / 2, 880); ctx.scale(ti, ti);
    text(ctx, TITLE, 0, 0, { font: 'Fredoka', size: 70, weight: 700, color: '#fff', spacing: 3 });
    ctx.restore();
  }
  text(ctx, TAGLINE, W / 2, 950, { font: 'Fredoka', size: 38, weight: 500, color: '#FFC93C', alpha: s.tagline });
}
