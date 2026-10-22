// Liquid motion: every word a droplet; one drop travels droplet to droplet, merging and splitting; a liquid stream
// arcs from "ran" to "cat"; hero: the droplets swell and pool into one.
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, backOut, text, arcAt } from '../story.js';

export const FONTS = ["700 60px 'Sora'", "600 40px 'Sora'"];
const X = (i) => 340 + i * 207, Y = 700;
const S = 0.5;                                  // the goo is computed at half resolution
let off, octx;
export function setup() { off = new OffscreenCanvas(W * S, H * S); octx = off.getContext('2d', { willReadFrequently: true }); }

function goo(ctx, blobs, fill) {
  octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, W * S, H * S);
  octx.filter = 'blur(9px)'; octx.fillStyle = '#fff';
  for (const [x, y, r] of blobs) { if (r <= 0.5) continue; octx.beginPath(); octx.arc(x * S, y * S, r * S, 0, Math.PI * 2); octx.fill(); }
  octx.filter = 'none';
  const img = octx.getImageData(0, 0, W * S, H * S), d = img.data;
  for (let k = 3; k < d.length; k += 4) { const a = d[k]; d[k] = a < 96 ? 0 : a > 140 ? 255 : (a - 96) * 5.8; }   // the threshold that makes blobs merge
  octx.putImageData(img, 0, 0);
  octx.globalCompositeOperation = 'source-in'; octx.fillStyle = fill; octx.fillRect(0, 0, W * S, H * S); octx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, W, H);
}

export function draw(ctx, s, t) {
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0B2545'); bg.addColorStop(1, '#13315C'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const blobs = [];
  const swell = s.hero;
  for (let i = 0; i < N; i++) {
    const pop = backOut(clamp((t - s.stepAt(i) + 0.15) / 0.45));
    const r = (44 + 10 * s.stepPulse(i)) * pop * (1 + 0.15 * Math.sin(t * 3 + i));
    const x = lerp(X(i), W / 2, swell * 0.55), y = lerp(Y, Y + 40, swell);
    blobs.push([x, y, r * (1 + swell * 1.3)]);
  }
  // the travelling drop: one word at a time
  const fade = 1 - s.chainFade;
  if (fade > 0) { const i = Math.max(0, Math.ceil(s.walk) - 1), f = clamp(s.walk - i); blobs.push([lerp(i === 0 ? X(0) - 250 : X(i - 1), X(i), f), Y - Math.sin(f * Math.PI) * 70, 26 * fade]); }
  // streams: beads along the arcs, merged by the goo into one flowing line
  const stream = (i, j, u0, u1, r) => { const n = Math.ceil(Math.abs(X(j) - X(i)) / 16); for (let k = 0; k <= n; k++) { const u = lerp(u0, u1, k / n); const [x, y] = arcAt(X(i), X(j), Y - 30, 0.4 * Math.abs(X(j) - X(i)), u); blobs.push([x, y, r]); } };
  if (s.link > 0) stream(RAN, CAT, 0, s.link, 15);
  if (s.bloom > 0) PAIRS.forEach(([i, j]) => { stream(i, j, 0, s.bloom / 2, 8 * (1 - 0.7 * swell)); stream(i, j, 1 - s.bloom / 2, 1, 8 * (1 - 0.7 * swell)); });
  const fill = ctx.createLinearGradient(0, 200, 0, 900); fill.addColorStop(0, '#7FDBFF'); fill.addColorStop(1, '#2F80ED');
  const g2 = octx.createLinearGradient(0, 100, 0, 450); g2.addColorStop(0, '#9BE7FF'); g2.addColorStop(1, '#2F80ED');
  goo(ctx, blobs, g2);
  // a specular glint on every droplet
  for (const [x, y, r] of blobs.slice(0, N)) if (r > 10) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.22, r * 0.12, -0.6, 0, 7); ctx.fill(); }
  for (let i = 0; i < N; i++) text(ctx, WORDS[i], X(i), Y + 96, { font: 'Sora', size: 32, weight: 600, color: '#CFEFFF', alpha: clamp((t - s.stepAt(i) + 0.1) / 0.3) * (1 - swell * 0.6) });
  text(ctx, SEVEN, X(5), Y + 150, { font: 'Sora', size: 28, weight: 600, color: '#7FDBFF', alpha: s.seven, spacing: 3 });
  const ap = arcAt(X(CAT), X(RAN), Y - 30, 0.4 * (X(RAN) - X(CAT)), 0.5);
  text(ctx, ONE, ap[0], ap[1] - 40, { font: 'Sora', size: 42, weight: 700, color: '#FFFFFF', alpha: s.one, spacing: 2 });
  text(ctx, TITLE, W / 2, 150 + 18 * (1 - s.title), { font: 'Sora', size: 66, weight: 700, color: '#FFFFFF', alpha: s.title, spacing: 3 });
  text(ctx, TAGLINE, W / 2, 210, { font: 'Sora', size: 34, weight: 600, color: '#7FDBFF', alpha: s.tagline });
}
