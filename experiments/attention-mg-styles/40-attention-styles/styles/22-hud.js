// Cyberpunk HUD / FUI: a dark teal console; each word acquired in a bracket with a readout; a scan line walks the
// sequence one slot at a time; the link is a lock-on beam; hero: every target locks at once and the frame flashes.
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, rng, easeOut, text, arcAt, growArc, drawArc } from '../story.js';

export const FONTS = ["600 40px 'Chakra Petch'", "700 40px 'Rajdhani'", "500 30px 'JetBrains Mono'"];
const BG = '#020B10', CY = '#3DF5FF', CY2 = 'rgba(61,245,255,0.35)', AMB = '#FFB020', RED = '#FF3B5C';
const X = (i) => 330 + i * 210, Y = 650;

function bracket(ctx, x, y, w, h, color, k = 1) {
  const l = 18 * k; ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const cx = x + sx * w / 2, cy = y + sy * h / 2; ctx.beginPath(); ctx.moveTo(cx - sx * l, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy - sy * l); ctx.stroke(); }
}

export function draw(ctx, s, t) {
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  // console grid and frame furniture
  ctx.strokeStyle = 'rgba(61,245,255,0.06)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  bracket(ctx, W / 2, H / 2, W - 120, H - 120, CY2, 2);
  text(ctx, `SEQ.ATTN  T+${t.toFixed(2)}`, 90, 90, { font: 'JetBrains Mono', size: 22, weight: 500, color: CY, align: 'left' });
  text(ctx, 'MODE: ENCODER / SELF-ATTENTION', W - 90, 90, { font: 'JetBrains Mono', size: 22, weight: 500, color: CY2, align: 'right' });
  // the scanner: one slot at a time
  const fade = 1 - s.chainFade;
  if (fade > 0 && s.walk > 0) {
    const x = lerp(X(0) - 200, X(N - 1), clamp(s.walk / N));
    ctx.globalAlpha = fade; const g = ctx.createLinearGradient(x - 120, 0, x, 0); g.addColorStop(0, 'rgba(61,245,255,0)'); g.addColorStop(1, 'rgba(61,245,255,0.35)');
    ctx.fillStyle = g; ctx.fillRect(x - 120, Y - 90, 120, 180); ctx.fillStyle = CY; ctx.fillRect(x - 2, Y - 90, 3, 180); ctx.globalAlpha = 1;
  }
  ctx.lineCap = 'butt';
  PAIRS.forEach(([i, j]) => { ctx.strokeStyle = CY2; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]); growArc(ctx, X(i), X(j), Y - 60, 0.38 * (X(j) - X(i)), s.bloom); });
  ctx.setLineDash([]);
  if (s.link > 0) { ctx.save(); ctx.shadowColor = AMB; ctx.shadowBlur = 16; ctx.strokeStyle = AMB; ctx.lineWidth = 4; drawArc(ctx, X(RAN), X(CAT), Y - 60, 0.38 * (X(RAN) - X(CAT)) + 40, s.link); ctx.restore(); }
  for (let i = 0; i < N; i++) {
    const k = easeOut(clamp((t - s.stepAt(i) + 0.1) / 0.3)); if (k <= 0) continue;
    const locked = (i === CAT && t > 3.45) || s.hero > 0.2 + i * 0.08;
    const col = locked ? (i === CAT ? AMB : RED) : CY;
    bracket(ctx, X(i), Y, 170 * (2 - k), 90 * (2 - k), col, k);
    const glitch = k < 1 && rng(i * 31 + Math.floor(t * 30))() > 0.6 ? 6 : 0;
    text(ctx, WORDS[i].toUpperCase(), X(i) + glitch, Y + 12, { font: 'Chakra Petch', size: 34, weight: 600, color: '#E9FFFF', alpha: k, spacing: 3 });
    text(ctx, `[${String(i).padStart(2, '0')}] ${locked ? 'LOCK' : 'ACQ'}`, X(i), Y + 76, { font: 'JetBrains Mono', size: 18, weight: 500, color: col, alpha: k });
  }
  text(ctx, `${SEVEN} · O(n)`, X(5), Y + 140, { font: 'Rajdhani', size: 32, weight: 700, color: CY, alpha: s.seven, spacing: 4 });
  const ap = arcAt(X(CAT), X(RAN), Y - 60, 0.38 * (X(RAN) - X(CAT)) + 40, 0.5);
  text(ctx, `${ONE} · O(1)`, ap[0], ap[1] - 26, { font: 'Rajdhani', size: 40, weight: 700, color: AMB, alpha: s.one, spacing: 4 });
  // hero flash
  if (s.heroPulse > 0) { ctx.fillStyle = `rgba(61,245,255,${0.18 * s.heroPulse})`; ctx.fillRect(0, 0, W, H); }
  text(ctx, TITLE, W / 2, 230 + 14 * (1 - s.title), { font: 'Rajdhani', size: 84, weight: 700, color: '#E9FFFF', alpha: s.title, spacing: 10, shadow: { color: CY, blur: 20 } });
  text(ctx, `> ${TAGLINE.toUpperCase()}_`, W / 2, 290, { font: 'JetBrains Mono', size: 26, weight: 500, color: CY, alpha: s.tagline });
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
}
