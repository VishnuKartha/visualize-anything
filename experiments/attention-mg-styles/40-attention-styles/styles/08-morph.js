// Shape morph: one shape language, every state a morph. Each word is a square that morphs into a circle when it is
// read; the link and the arcs grow; hero: every shape slides together and morphs into one ring, then a star burst.
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, easeIO, backOut, text, arcAt, growArc, drawArc } from '../story.js';

export const FONTS = ["800 60px 'Unbounded'", "600 40px 'Unbounded'"];
const X = (i) => 350 + i * 204, Y = 690, M = 72;
const COLS = ['#FF5E5B', '#FFB13B', '#FFE45C', '#5BE7A9', '#3EC1F3', '#7B6CFF', '#FF6FD8'];
// a closed shape as M points: square, circle, star
const square = (r) => Array.from({ length: M }, (_, k) => { const a = k / M * Math.PI * 2 - Math.PI / 4; const c = Math.cos(a), s = Math.sin(a), m = Math.max(Math.abs(c), Math.abs(s)); return [r * c / m * 0.86, r * s / m * 0.86]; });
const circle = (r) => Array.from({ length: M }, (_, k) => { const a = k / M * Math.PI * 2 - Math.PI / 4; return [r * Math.cos(a), r * Math.sin(a)]; });
const star = (r) => Array.from({ length: M }, (_, k) => { const a = k / M * Math.PI * 2 - Math.PI / 4; const rr = r * (k % 12 < 6 ? 1 : 0.55); return [rr * Math.cos(a), rr * Math.sin(a)]; });
const mix = (A, B, u) => A.map(([x, y], k) => [lerp(x, B[k][0], u), lerp(y, B[k][1], u)]);
function shape(ctx, pts, x, y, fill, rot = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); pts.forEach(([a, b], k) => k ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.restore(); }

export function draw(ctx, s, t) {
  ctx.fillStyle = '#0E0B1F'; ctx.fillRect(0, 0, W, H);
  const merge = s.hero;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 1 - merge;
  PAIRS.forEach(([i, j]) => { ctx.strokeStyle = COLS[(i + j) % N] + 'AA'; ctx.lineWidth = 4; growArc(ctx, X(i), X(j), Y - 50, 0.4 * (X(j) - X(i)), s.bloom); });
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 10; drawArc(ctx, X(RAN), X(CAT), Y - 50, 0.4 * (X(RAN) - X(CAT)) + 30, s.link);
  ctx.globalAlpha = 1;
  for (let i = 0; i < N; i++) {
    const appear = backOut(clamp((t - s.stepAt(i) + 0.3) / 0.35));
    if (appear <= 0) continue;
    const read = easeIO(clamp((t - s.stepAt(i) + 0.05) / 0.3));                  // square -> circle as the word is read
    let pts = mix(square(46 * appear), circle(46 * appear), read);
    const x = lerp(X(i), W / 2, merge), y = lerp(Y, 470, merge);
    if (merge > 0) pts = mix(pts, circle(170), merge);
    shape(ctx, pts, x, y, COLS[i], (1 - read) * 0.6 + merge * 0.8);
    text(ctx, WORDS[i], X(i), Y + 100, { font: 'Unbounded', size: 28, weight: 600, color: '#fff', alpha: appear * (1 - merge) });
  }
  // after the merge: the one ring morphs into a burst, and breathes
  const burst = easeIO(clamp((t - 6.75) / 0.5));
  if (burst > 0) {
    const pts = mix(circle(170), star(230 + 8 * Math.sin(s.hold * 3)), burst);
    const g = ctx.createLinearGradient(W / 2 - 220, 300, W / 2 + 220, 640); COLS.forEach((c, k) => g.addColorStop(k / (N - 1), c));
    shape(ctx, pts, W / 2, 470, g, t * 0.2);
    text(ctx, '1', W / 2, 520, { font: 'Unbounded', size: 150, weight: 800, color: '#0E0B1F' });
  }
  text(ctx, SEVEN, X(5), Y + 160, { font: 'Unbounded', size: 26, weight: 600, color: '#FFB13B', alpha: s.seven, spacing: 3 });
  const ap = arcAt(X(CAT), X(RAN), Y - 50, 0.4 * (X(RAN) - X(CAT)) + 30, 0.5);
  text(ctx, ONE, ap[0], ap[1] - 30, { font: 'Unbounded', size: 38, weight: 800, color: '#FFFFFF', alpha: s.one * (1 - merge) });
  text(ctx, TITLE, W / 2, 850 + 20 * (1 - s.title), { font: 'Unbounded', size: 58, weight: 800, color: '#FFFFFF', alpha: s.title, spacing: 2 });
  text(ctx, TAGLINE, W / 2, 920, { font: 'Unbounded', size: 30, weight: 600, color: '#5BE7A9', alpha: s.tagline });
}
