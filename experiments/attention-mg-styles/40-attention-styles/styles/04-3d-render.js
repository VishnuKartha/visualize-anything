// 3D Render (soft clay / product look, faked in 2D): glossy pastel spheres on a soft floor with contact shadows;
// a small ball rolls sphere to sphere; glossy tubes arch between them; hero: the spheres bounce in a wave.
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, easeIO, backOut, text, arcAt } from '../story.js';

export const FONTS = ["800 40px 'Poppins'", "600 40px 'Poppins'"];
const COLS = ['#F7B2C4', '#8FD3C8', '#FFD59E', '#B9A7F5', '#A6D8F5', '#F9C2A0', '#FF8FA3'];
const X = (i) => 330 + i * 210, Y = 720, R = 62;

function sphere(ctx, x, y, r, col, sq = 1) {
  // contact shadow on the floor
  const sh = ctx.createRadialGradient(x, Y + R + 8, 0, x, Y + R + 8, r * 1.3);
  sh.addColorStop(0, 'rgba(90,60,120,0.32)'); sh.addColorStop(1, 'rgba(90,60,120,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(x, Y + R + 8, r * 1.3, r * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(x, y); ctx.scale(1 / sq, sq);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.18, col); g.addColorStop(1, shade(col, 0.72));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k)); return `rgb(${c})`; }

function tube(ctx, i, j, g, both, w, col) {
  const pts = (u0, u1) => { const p = []; for (let k = 0; k <= 60; k++) p.push(arcAt(X(i), X(j), Y - R + 6, 0.36 * Math.abs(X(j) - X(i)), lerp(u0, u1, k / 60))); return p; };
  const segs = both ? [[0, g / 2], [1 - g / 2, 1]] : [[0, g]];
  for (const [u0, u1] of segs) {
    if (u1 <= u0) continue;
    const p = pts(u0, u1);
    for (const [lw, c, off] of [[w, shade(col, 0.7), 0], [w * 0.62, col, -w * 0.12], [w * 0.2, 'rgba(255,255,255,0.8)', -w * 0.25]]) {
      ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.beginPath(); p.forEach(([x, y], k) => k ? ctx.lineTo(x, y + off) : ctx.moveTo(x, y + off)); ctx.stroke();
    }
  }
}

export function draw(ctx, s, t) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#F6E9F7'); bg.addColorStop(0.62, '#EADCF5'); bg.addColorStop(1, '#D9C8EE');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // a soft studio light pool
  const pool = ctx.createRadialGradient(W / 2, Y + 80, 50, W / 2, Y + 80, 900);
  pool.addColorStop(0, 'rgba(255,255,255,0.55)'); pool.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = pool; ctx.fillRect(0, 0, W, H);

  PAIRS.forEach(([i, j]) => tube(ctx, i, j, s.bloom, true, 14, COLS[(i + j) % N]));
  tube(ctx, RAN, CAT, s.link, false, 26, '#8FD3C8');

  for (let i = 0; i < N; i++) {
    const pop = backOut(clamp((t - s.stepAt(i) + 0.15) / 0.45));
    if (pop <= 0) continue;
    // hero: a bounce travels across the spheres, with squash on landing
    const ph = clamp((t - 5.55 - i * 0.07) / 0.75);
    const jump = Math.sin(ph * Math.PI) * 120, sq = ph > 0 && ph < 1 ? 1 + 0.12 * Math.cos(ph * Math.PI * 2) : 1 - 0.12 * s.stepPulse(i);
    sphere(ctx, X(i), Y - jump + 3 * Math.sin(s.hold * 2.2 + i), R * pop * (i === CAT ? 1 + 0.12 * s.linkPulse : 1), COLS[i], sq);
    text(ctx, WORDS[i], X(i), Y + R + 70, { font: 'Poppins', size: 34, weight: 700, color: '#5A3E7A', alpha: pop });
  }
  // the rolling ball: one sphere at a time
  const fade = 1 - s.chainFade;
  if (fade > 0) {
    const i = Math.max(0, Math.ceil(s.walk) - 1), f = clamp(s.walk - i);
    const x = lerp(i === 0 ? X(0) - 260 : X(i - 1), X(i), f), y = Y - R - 34 - Math.sin(f * Math.PI) * 90;
    ctx.globalAlpha = fade; sphere(ctx, x, y, 24, '#FF8FA3'); ctx.globalAlpha = 1;
  }
  text(ctx, SEVEN, X(5), Y + R + 130, { font: 'Poppins', size: 30, weight: 700, color: '#7A5A9A', alpha: s.seven, spacing: 2 });
  const ap = arcAt(X(CAT), X(RAN), Y - R + 6, 0.36 * (X(RAN) - X(CAT)), 0.5);
  text(ctx, ONE, ap[0], ap[1] - 40, { font: 'Poppins', size: 42, weight: 800, color: '#3FA796', alpha: s.one });

  const ti = s.titleIn;
  if (ti > 0) { ctx.save(); ctx.translate(W / 2, 112); ctx.scale(ti, ti);
    text(ctx, TITLE, 0, 0, { font: 'Poppins', size: 72, weight: 800, color: '#5A3E7A', spacing: 2, shadow: { color: 'rgba(90,62,122,0.25)', blur: 18, y: 8 } }); ctx.restore(); }
  text(ctx, TAGLINE, W / 2, 168, { font: 'Poppins', size: 34, weight: 600, color: '#B07AC9', alpha: s.tagline });
}
