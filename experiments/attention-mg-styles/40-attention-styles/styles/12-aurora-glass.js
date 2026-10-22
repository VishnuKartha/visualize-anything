// Aurora & glassmorphism: drifting aurora light behind frosted-glass cards; a soft light line links the words;
// hero: a large glass pane rises and the aurora brightens through it.
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, easeOut, text, arcAt, growArc, drawArc, roundRect } from '../story.js';

export const FONTS = ["700 60px 'DM Sans'", "500 40px 'DM Sans'"];
const X = (i) => 340 + i * 207, Y = 700, CW = 170, CH = 84;
let bgc;
export function setup() { bgc = new OffscreenCanvas(W / 4, H / 4); }

function aurora(c, t, boost) {
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#070B1E'; c.fillRect(0, 0, W / 4, H / 4);
  const blobs = [['#00F5D4', 0.3, 0.35], ['#9B5DE5', 0.62, 0.3], ['#00BBF9', 0.48, 0.6], ['#F15BB5', 0.8, 0.55]];
  c.globalCompositeOperation = 'lighter';
  blobs.forEach(([col, bx, by], k) => {
    const x = (bx + 0.08 * Math.sin(t * 0.5 + k * 1.7)) * W / 4, y = (by + 0.06 * Math.cos(t * 0.4 + k)) * H / 4, r = (0.22 + 0.1 * boost) * W / 4;
    const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col + (boost > 0.5 ? 'CC' : '99')); g.addColorStop(1, col + '00');
    c.fillStyle = g; c.fillRect(0, 0, W / 4, H / 4);
  });
  c.globalCompositeOperation = 'source-over';
}
function glass(ctx, x, y, w, h, r, a = 1) {
  ctx.save(); ctx.globalAlpha *= a; roundRect(ctx, x, y, w, h, r); ctx.clip();
  ctx.filter = 'blur(10px) brightness(1.25)'; ctx.drawImage(bgc, 0, 0, W, H); ctx.filter = 'none';
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x, y, w, h);
  const sheen = ctx.createLinearGradient(x, y, x, y + h); sheen.addColorStop(0, 'rgba(255,255,255,0.25)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0.02)'); ctx.fillStyle = sheen; ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5; roundRect(ctx, x, y, w, h, r); ctx.stroke(); ctx.restore();
}

export function draw(ctx, s, t) {
  aurora(bgc.getContext('2d'), t, s.hero);
  ctx.imageSmoothingEnabled = true; ctx.filter = 'blur(6px)'; ctx.drawImage(bgc, 0, 0, W, H); ctx.filter = 'none';
  // hero: a big glass pane rises behind the words
  if (s.hero > 0) glass(ctx, 220, lerp(H, 230, easeOut(s.hero)), W - 440, 640, 48, s.hero);
  ctx.lineCap = 'round';
  PAIRS.forEach(([i, j]) => { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; growArc(ctx, X(i), X(j), Y - CH / 2 - 4, 0.4 * (X(j) - X(i)), s.bloom); });
  ctx.save(); ctx.shadowColor = '#00F5D4'; ctx.shadowBlur = 24; ctx.strokeStyle = '#E6FFFA'; ctx.lineWidth = 5; drawArc(ctx, X(RAN), X(CAT), Y - CH / 2 - 4, 0.4 * (X(RAN) - X(CAT)) + 40, s.link); ctx.restore();
  for (let i = 0; i < N; i++) {
    const k = easeOut(clamp((t - s.stepAt(i) + 0.15) / 0.4)); if (k <= 0) continue;
    const lift = 18 * (1 - k) + 6 * s.stepPulse(i);
    glass(ctx, X(i) - CW / 2, Y - CH / 2 + lift, CW, CH, 22, k);
    text(ctx, WORDS[i], X(i), Y + 12 + lift, { font: 'DM Sans', size: 34, weight: 700, color: '#FFFFFF', alpha: k });
  }
  // the recurrence: a bead of light hopping card to card
  const fade = 1 - s.chainFade;
  if (fade > 0) {
    const i = Math.max(0, Math.ceil(s.walk) - 1), f = clamp(s.walk - i), x = lerp(i === 0 ? X(0) - 240 : X(i - 1), X(i), f);
    const g = ctx.createRadialGradient(x, Y + 80, 0, x, Y + 80, 30); g.addColorStop(0, `rgba(255,255,255,${fade})`); g.addColorStop(1, 'rgba(0,245,212,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, Y + 80, 30, 0, 7); ctx.fill();
  }
  text(ctx, SEVEN, X(5), Y + 140, { font: 'DM Sans', size: 28, weight: 500, color: 'rgba(255,255,255,0.8)', alpha: s.seven, spacing: 4 });
  const ap = arcAt(X(CAT), X(RAN), Y - CH / 2 - 4, 0.4 * (X(RAN) - X(CAT)) + 40, 0.5);
  text(ctx, ONE, ap[0], ap[1] - 32, { font: 'DM Sans', size: 38, weight: 700, color: '#FFFFFF', alpha: s.one, spacing: 4 });
  text(ctx, TITLE, W / 2, 150 + 16 * (1 - s.title), { font: 'DM Sans', size: 70, weight: 700, color: '#FFFFFF', alpha: s.title, spacing: 2, shadow: { color: 'rgba(0,245,212,0.5)', blur: 30 } });
  text(ctx, TAGLINE, W / 2, 210, { font: 'DM Sans', size: 32, weight: 500, color: '#BFFCF2', alpha: s.tagline });
}
