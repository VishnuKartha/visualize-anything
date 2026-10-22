// Isometric 2.5D: the sentence is a street of blocks; a little cart drives block to block; bridges arch between them;
// hero: the blocks rise into towers.
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, easeIO, backOut, text } from '../story.js';

export const FONTS = ["800 40px 'Poppins'", "600 40px 'Poppins'"];
const BG = '#EAF2F4', INK = '#24324A';
const TOPS = ['#FFD6A5', '#7BD3C4', '#FFD6A5', '#FFD6A5', '#FFD6A5', '#FFD6A5', '#FF9B85'];
const S = 92, C30 = Math.cos(Math.PI / 6), S30 = 0.5, OX = W / 2 - 40, OY = 360;
const GX = (i) => (i - 3) * 1.75;
// iso: x along the street, y across it, z up
const P = (x, y, z) => [OX + (x - y) * C30 * S, OY + (x + y) * S30 * S - z * S + 260];

function block(ctx, x, y, h, top, label, alpha = 1) {
  const a = P(x - 0.5, y - 0.5, h), b = P(x + 0.5, y - 0.5, h), c = P(x + 0.5, y + 0.5, h), d = P(x - 0.5, y + 0.5, h);
  const b0 = P(x + 0.5, y - 0.5, 0), c0 = P(x + 0.5, y + 0.5, 0), d0 = P(x - 0.5, y + 0.5, 0);
  ctx.globalAlpha = alpha;
  const poly = (pts, fill) => { ctx.beginPath(); pts.forEach(([px, py], k) => k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  poly([d, c, c0, d0], '#9FB4C7');            // left face
  poly([c, b, b0, c0], '#C7D6E3');            // right face
  poly([a, b, c, d], top);                    // top
  // windows on tall blocks
  if (h > 0.6) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let z = 0.35; z < h - 0.2; z += 0.42) for (const u of [0.25, 0.65]) {
      const p1 = P(x + 0.5, y - 0.5 + u, z), p2 = P(x + 0.5, y - 0.5 + u + 0.18, z), p3 = P(x + 0.5, y - 0.5 + u + 0.18, z + 0.2), p4 = P(x + 0.5, y - 0.5 + u, z + 0.2);
      ctx.beginPath(); ctx.moveTo(...p1); ctx.lineTo(...p2); ctx.lineTo(...p3); ctx.lineTo(...p4); ctx.fill();
    }
  }
  if (label) {   // the word painted on the roof, in the roof's own plane
    const [tx, ty] = P(x, y, h);
    ctx.save(); ctx.setTransform(C30, S30, -C30, S30, tx, ty);
    text(ctx, label, 0, 9, { font: 'Poppins', size: 30, weight: 800, color: INK });
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function bridge(ctx, i, j, g, color, width, both) {
  const n = 80, h = 0.55 * Math.abs(GX(j) - GX(i)) * 0.6;
  const pt = (u) => P(lerp(GX(i), GX(j), u), 0, 0.42 + h * Math.sin(u * Math.PI));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  const seg = (u0, u1) => { ctx.beginPath(); for (let k = 0; k <= n; k++) { const q = pt(lerp(u0, u1, k / n)); k ? ctx.lineTo(...q) : ctx.moveTo(...q); } ctx.stroke(); };
  if (g <= 0) return;
  if (both) { seg(0, g / 2); seg(1 - g / 2, 1); } else seg(0, g);
}

export function draw(ctx, s, t) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  // the street
  const r0 = P(GX(0) - 1.4, 0.75, 0), r1 = P(GX(N - 1) + 1.4, 0.75, 0), r2 = P(GX(N - 1) + 1.4, -0.75, 0), r3 = P(GX(0) - 1.4, -0.75, 0);
  ctx.fillStyle = '#D3DEE6'; ctx.beginPath(); ctx.moveTo(...r0); ctx.lineTo(...r1); ctx.lineTo(...r2); ctx.lineTo(...r3); ctx.fill();

  // bridges behind the blocks' roofs: all at once, then the hero link in front
  PAIRS.forEach(([i, j]) => bridge(ctx, i, j, s.bloom, 'rgba(36,50,74,0.35)', 3, true));
  for (let i = 0; i < N; i++) {
    const pop = backOut(clamp((t - s.stepAt(i) + 0.15) / 0.45));
    const rise = s.hero * (0.6 + 0.35 * ((i * 37) % 5)) * (1 + 0.05 * Math.sin(s.hold * 2 + i));
    const h = 0.42 * pop + rise;
    if (pop > 0) block(ctx, GX(i), 0, h, TOPS[i], WORDS[i]);
  }
  bridge(ctx, RAN, CAT, s.link, '#E4572E', 9, false);

  // the cart: one block at a time
  const fade = 1 - s.chainFade;
  if (fade > 0) {
    const i = Math.max(0, Math.ceil(s.walk) - 1), f = clamp(s.walk - i);
    const x = lerp(i === 0 ? GX(0) - 1.6 : GX(i - 1), GX(i), f);
    const [cx, cy] = P(x, 0.62, 0.15);
    ctx.globalAlpha = fade; ctx.fillStyle = '#E4572E';
    ctx.beginPath(); ctx.ellipse(cx, cy, 26, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  }
  const lab = P(GX(5), 1.3, 0);
  text(ctx, SEVEN, lab[0] + 40, lab[1] + 70, { font: 'Poppins', size: 30, weight: 700, color: INK, alpha: s.seven, spacing: 2 });
  const top = P((GX(CAT) + GX(RAN)) / 2, 0, 0.42 + 0.55 * (GX(RAN) - GX(CAT)) * 0.6);
  text(ctx, ONE, top[0], top[1] - 30, { font: 'Poppins', size: 40, weight: 800, color: '#E4572E', alpha: s.one });

  text(ctx, TITLE, W / 2, 140 - 20 * (1 - s.title), { font: 'Poppins', size: 64, weight: 800, color: INK, alpha: s.title, spacing: 4 });
  text(ctx, TAGLINE, W / 2, 200, { font: 'Poppins', size: 34, weight: 600, color: '#E4572E', alpha: s.tagline });
}
