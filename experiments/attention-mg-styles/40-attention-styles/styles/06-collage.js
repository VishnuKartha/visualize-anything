// Collage / cut-out: a newsprint pinboard; each word a torn paper tag; red string pinned tag to tag; the hero is a
// rubber stamp slammed onto the board; the title is a ransom note of cut-out letters.
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, rng, backOut, easeOut, text, arcAt } from '../story.js';

export const FONTS = ["400 60px 'Anton'", "400 60px 'Bebas Neue'", "400 60px 'Instrument Serif'", "800 40px 'Poppins'"];
const BOARD = '#E9E1CE', RED = '#C8102E', INK = '#161412';
const PAPERS = ['#FFFFFF', '#F7E08A', '#F4C6CF', '#FFFFFF', '#CFE6F2', '#FFFFFF', '#F7E08A'];
const FACES = ['Anton', 'Bebas Neue', 'Instrument Serif', 'Poppins'];
const X = (i) => 340 + i * 207, Y = 690;
const ROT = WORDS.map((_, i) => (rng(30 + i)() - 0.5) * 0.16);

function torn(ctx, w, h, seed) {
  const g = rng(seed); ctx.beginPath();
  const edge = (x0, y0, x1, y1, n) => { for (let k = 0; k <= n; k++) { const u = k / n; ctx.lineTo(lerp(x0, x1, u) + (g() - 0.5) * 5, lerp(y0, y1, u) + (g() - 0.5) * 5); } };
  ctx.moveTo(-w / 2, -h / 2); edge(-w / 2, -h / 2, w / 2, -h / 2, 14); edge(w / 2, -h / 2, w / 2, h / 2, 5); edge(w / 2, h / 2, -w / 2, h / 2, 14); edge(-w / 2, h / 2, -w / 2, -h / 2, 5);
  ctx.closePath();
}
function tag(ctx, i, k) {
  if (k <= 0) return;
  ctx.save(); ctx.translate(X(i), Y); ctx.rotate(ROT[i]); ctx.scale(k, k);
  ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 6;
  ctx.fillStyle = PAPERS[i]; torn(ctx, 176, 92, 50 + i); ctx.fill(); ctx.shadowColor = 'transparent';
  text(ctx, WORDS[i].toUpperCase(), 0, 18, { font: FACES[i % 4], size: i % 4 === 2 ? 58 : 50, weight: i % 4 === 3 ? 800 : 400, color: INK });
  ctx.restore();
}
function pin(ctx, x, y) { ctx.fillStyle = '#7A0A18'; ctx.beginPath(); ctx.arc(x + 2, y + 3, 9, 0, 7); ctx.fill(); ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(x - 3, y - 3, 3, 0, 7); ctx.fill(); }
function string(ctx, pts, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
const arcPts = (i, j, u0, u1, lift = 0) => { const p = []; for (let k = 0; k <= 50; k++) p.push(arcAt(X(i), X(j), Y - 50, 0.4 * Math.abs(X(j) - X(i)) + lift, lerp(u0, u1, k / 50))); return p; };

export function draw(ctx, s, t) {
  ctx.fillStyle = BOARD; ctx.fillRect(0, 0, W, H);
  // newsprint: halftone and a few pasted scraps
  ctx.fillStyle = 'rgba(30,25,20,0.07)';
  for (let y = 0; y < H; y += 14) for (let x = (y / 14) % 2 ? 7 : 0; x < W; x += 14) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 7); ctx.fill(); }
  const g = rng(9);
  for (let k = 0; k < 6; k++) { ctx.save(); ctx.translate(g() * W, g() * H); ctx.rotate((g() - 0.5) * 0.4); ctx.fillStyle = `rgba(255,255,255,${0.25 + g() * 0.2})`; torn(ctx, 240 + g() * 200, 120 + g() * 100, 80 + k); ctx.fill(); ctx.restore(); }

  // threads: black for the bloom, red for the one link
  PAIRS.forEach(([i, j]) => { if (s.bloom > 0) { string(ctx, arcPts(i, j, 0, s.bloom / 2), 'rgba(22,20,18,0.55)', 2); string(ctx, arcPts(i, j, 1 - s.bloom / 2, 1), 'rgba(22,20,18,0.55)', 2); } });
  // the recurrence: red string pinned tag to tag
  const fade = 1 - 0.75 * s.chainFade;
  for (let i = 0; i < N; i++) tag(ctx, i, backOut(clamp((t - s.stepAt(i) + 0.15) / 0.4)));
  ctx.globalAlpha = fade;
  for (let i = 1; i < N; i++) {
    const p = clamp((t - s.stepAt(i - 1)) / (s.stepAt(i) - s.stepAt(i - 1)));
    if (p > 0) string(ctx, [[X(i - 1), Y - 40], [lerp(X(i - 1), X(i), p), Y - 40 + Math.sin(p * Math.PI) * 18]], RED, 4);
  }
  ctx.globalAlpha = 1;
  if (s.link > 0) string(ctx, arcPts(RAN, CAT, 0, s.link, 30), RED, 7);
  for (let i = 0; i < N; i++) if (t > s.stepAt(i) - 0.05) pin(ctx, X(i), Y - 40);

  text(ctx, SEVEN, X(5), Y + 120, { font: 'Bebas Neue', size: 46, weight: 400, color: INK, alpha: s.seven, spacing: 3 });
  const ap = arcAt(X(CAT), X(RAN), Y - 50, 0.4 * (X(RAN) - X(CAT)) + 30, 0.5);
  if (s.one > 0) { ctx.save(); ctx.translate(ap[0], ap[1] - 40); ctx.rotate(-0.04); ctx.globalAlpha = s.one; ctx.fillStyle = '#F7E08A'; torn(ctx, 190, 64, 77); ctx.fill(); ctx.restore(); text(ctx, ONE, ap[0], ap[1] - 22, { font: 'Anton', size: 46, color: RED, alpha: s.one, spacing: 2 }); }

  // the stamp: slams down, ink with gaps
  const st = clamp((t - 5.55) / 0.22);
  if (st > 0) {
    const k = lerp(1.9, 1, backOut(st)), a = Math.min(1, st * 1.6);
    ctx.save(); ctx.translate(W / 2 + 330, 330); ctx.rotate(-0.14); ctx.scale(k, k); ctx.globalAlpha = 0.86 * a;
    ctx.strokeStyle = RED; ctx.lineWidth = 9; ctx.strokeRect(-250, -82, 500, 164);
    text(ctx, 'ONE STEP', 0, 40, { font: 'Anton', size: 118, color: RED, spacing: 8 });
    // the gaps a real stamp leaves
    ctx.globalCompositeOperation = 'destination-out'; const gg = rng(3);
    for (let n = 0; n < 160; n++) { ctx.fillStyle = `rgba(0,0,0,${0.5 + gg() * 0.5})`; ctx.fillRect(-260 + gg() * 520, -90 + gg() * 180, 3 + gg() * 9, 2 + gg() * 4); }
    ctx.restore();
  }
  // the ransom-note title, letter by letter
  if (s.title > 0) {
    let x = W / 2 - 700; const letters = TITLE.split('');
    letters.forEach((ch, n) => {
      const a = easeOut(clamp((t - 7.05 - n * 0.025) / 0.25)); if (ch === ' ') { x += 34; return; }
      const gg = rng(200 + n), face = FACES[n % 4], size = 64 + gg() * 18;
      ctx.save(); ctx.translate(x + 30, 150); ctx.rotate((gg() - 0.5) * 0.25); ctx.scale(a, a);
      ctx.fillStyle = ['#FFFFFF', '#161412', '#F7E08A', '#C8102E', '#CFE6F2'][n % 5]; torn(ctx, 60, 84, 300 + n); ctx.fill();
      text(ctx, ch, 0, size * 0.33, { font: face, size, weight: face === 'Poppins' ? 800 : 400, color: n % 5 === 1 || n % 5 === 3 ? '#FFFFFF' : INK });
      ctx.restore(); x += 64;
    });
  }
  text(ctx, TAGLINE.toUpperCase(), W / 2, 250, { font: 'Bebas Neue', size: 44, color: INK, alpha: s.tagline, spacing: 6 });
}
