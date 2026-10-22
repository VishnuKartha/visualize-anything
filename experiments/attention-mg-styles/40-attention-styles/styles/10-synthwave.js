// 80s Synthwave / VHS: a striped sun over a scrolling neon grid; the words in neon; a light-cycle runs word to word;
// the link is a hot-pink neon arc; hero: the sun flares and the grid surges; chrome title; scanlines.
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, rng, backOut, text, arcAt } from '../story.js';

export const FONTS = ["italic 900 80px 'Archivo'", "400 40px 'Michroma'"];
const X = (i) => 330 + i * 210, Y = 560, HOR = 600;

function neon(ctx, pts, color, w) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [lw, a, blur] of [[w * 3, 0.25, 30], [w, 1, 12], [w * 0.4, 1, 0]]) {
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.globalAlpha *= a; ctx.strokeStyle = lw === w * 0.4 ? '#FFFFFF' : color; ctx.lineWidth = lw;
    ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.restore();
  }
}
const arcPts = (i, j, u0, u1, lift = 0) => { const p = []; for (let k = 0; k <= 40; k++) p.push(arcAt(X(i), X(j), Y - 40, 0.26 * Math.abs(X(j) - X(i)) + lift, lerp(u0, u1, k / 40))); return p; };

export function draw(ctx, s, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, HOR); sky.addColorStop(0, '#0D0221'); sky.addColorStop(0.6, '#2A0A4A'); sky.addColorStop(1, '#7A1E6C');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HOR);
  // the sun, striped, flaring at the hero
  const sunR = 300 + 40 * s.heroPulse, sunY = HOR - 40 - 60 * s.hero;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, HOR); ctx.clip();
  const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR); sg.addColorStop(0, '#FFE66D'); sg.addColorStop(0.5, '#FF6B9D'); sg.addColorStop(1, '#C3186E');
  ctx.shadowColor = '#FF6B9D'; ctx.shadowBlur = 60 + 80 * s.heroPulse; ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(W / 2, sunY, sunR, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#2A0A4A'; for (let k = 0; k < 7; k++) { const y = sunY + 20 + k * 34, h = 4 + k * 2.4; ctx.fillRect(W / 2 - sunR, y, sunR * 2, h); }
  ctx.restore();
  // the floor grid, scrolling toward us; faster in the hero
  ctx.fillStyle = '#0D0221'; ctx.fillRect(0, HOR, W, H - HOR);
  ctx.strokeStyle = 'rgba(255,60,200,0.75)'; ctx.lineWidth = 2; ctx.shadowColor = '#FF3CC8'; ctx.shadowBlur = 8;
  for (let k = -24; k <= 24; k++) { ctx.beginPath(); ctx.moveTo(W / 2 + k * 40, HOR); ctx.lineTo(W / 2 + k * 260, H); ctx.stroke(); }
  const scroll = (t * 0.6 + s.hero * 1.5) % 1;
  for (let k = 0; k < 14; k++) { const z = (k + scroll) / 14, y = HOR + (H - HOR) * z * z; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.shadowBlur = 0;

  PAIRS.forEach(([i, j]) => { if (s.bloom > 0) { neon(ctx, arcPts(i, j, 0, s.bloom / 2), '#29E7FF', 2); neon(ctx, arcPts(i, j, 1 - s.bloom / 2, 1), '#29E7FF', 2); } });
  if (s.link > 0) neon(ctx, arcPts(RAN, CAT, 0, s.link, 40), '#FF2E97', 6);
  for (let i = 0; i < N; i++) {
    const k = clamp((t - s.stepAt(i) + 0.1) / 0.2), flick = k < 1 ? (rng(i * 99 + Math.floor(t * 30))() > 0.4 ? 1 : 0.3) : 1;
    text(ctx, WORDS[i].toUpperCase(), X(i), Y + 10, { font: 'Michroma', size: 30, weight: 400, color: '#E8FCFF', alpha: k * flick, stroke: '#1A0630', strokeWidth: 8, spacing: 2 });
    text(ctx, WORDS[i].toUpperCase(), X(i), Y + 10, { font: 'Michroma', size: 30, weight: 400, color: '#E8FCFF', alpha: k * flick, shadow: { color: '#29E7FF', blur: 18 }, spacing: 2 });
  }
  // the light-cycle: one word at a time, a trail behind it
  const fade = 1 - s.chainFade;
  if (fade > 0 && s.walk > 0) {
    const x = lerp(X(0) - 200, X(N - 1), s.walk / N);
    ctx.globalAlpha = fade; neon(ctx, [[Math.max(X(0) - 200, x - 260), Y + 40], [x, Y + 40]], '#FF2E97', 4); ctx.globalAlpha = 1;
  }
  text(ctx, SEVEN, X(5), Y + 100, { font: 'Michroma', size: 22, color: '#FF9BD1', alpha: s.seven, spacing: 4 });
  const ap = arcAt(X(CAT), X(RAN), Y - 40, 0.26 * (X(RAN) - X(CAT)) + 40, 0.5);
  text(ctx, ONE, ap[0], ap[1] - 30, { font: 'Michroma', size: 32, color: '#FFFFFF', alpha: s.one, shadow: { color: '#FF2E97', blur: 24 }, spacing: 4 });
  // chrome title
  if (s.title > 0) {
    ctx.save(); ctx.globalAlpha = s.title; ctx.font = "italic 900 92px 'Archivo'"; ctx.textAlign = 'center';
    const g = ctx.createLinearGradient(0, 40, 0, 130); g.addColorStop(0, '#E0F7FF'); g.addColorStop(0.48, '#7FB8FF'); g.addColorStop(0.5, '#2B2B6B'); g.addColorStop(1, '#FFB3E6');
    ctx.lineWidth = 6; ctx.strokeStyle = '#FF2E97'; ctx.strokeText(TITLE, W / 2, 120); ctx.fillStyle = g; ctx.fillText(TITLE, W / 2, 120); ctx.restore();
  }
  text(ctx, TAGLINE.toUpperCase(), W / 2, 175, { font: 'Michroma', size: 26, color: '#29E7FF', alpha: s.tagline, spacing: 8, shadow: { color: '#29E7FF', blur: 14 } });
  // VHS: scanlines and a little chroma wobble
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
}
