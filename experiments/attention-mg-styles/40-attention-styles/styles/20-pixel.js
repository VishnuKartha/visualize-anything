// Pixel art: the whole frame is drawn at 320×180 and scaled up with no smoothing; a little sprite hops word to word
// collecting a coin each time; the link is a dotted pixel arc; hero: LEVEL UP with a pixel burst.
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, rng, text, arcAt } from '../story.js';

export const FONTS = ["400 8px 'Press Start 2P'"];
const PW = 320, PH = 180, X = (i) => Math.round(40 + i * 40), Y = 120;
let px, p;
export function setup() { px = new OffscreenCanvas(PW, PH); p = px.getContext('2d'); }
const PAL = { sky: '#1B1036', sky2: '#2E1A5C', ground: '#3A2A6B', tile: '#F4D35E', tile2: '#EE964B', ink: '#0D0A1A', link: '#F95738', arc: '#5BC0EB', white: '#FFFFFF' };
function ptext(str, x, y, color, size = 8, align = 'center') { p.font = `${size}px 'Press Start 2P'`; p.textAlign = align; p.textBaseline = 'alphabetic'; p.fillStyle = PAL.ink; p.fillText(str, x + 1, y + 1); p.fillStyle = color; p.fillText(str, x, y); }
function dots(i, j, u0, u1, lift, color, step = 4) { const n = Math.max(2, Math.round(Math.abs(X(j) - X(i)) * 1.6 / step)); p.fillStyle = color; for (let k = 0; k <= n; k++) { const [x, y] = arcAt(X(i), X(j), Y - 10, 0.4 * Math.abs(X(j) - X(i)) + lift, lerp(u0, u1, k / n)); p.fillRect(Math.round(x), Math.round(y), 2, 2); } }

export function draw(ctx, s, t) {
  p.fillStyle = PAL.sky; p.fillRect(0, 0, PW, PH);
  p.fillStyle = PAL.sky2; for (let y = 0; y < 90; y += 6) p.fillRect(0, y + (Math.floor(t * 4 + y) % 2), PW, 1);
  const st = rng(3); p.fillStyle = PAL.white; for (let k = 0; k < 30; k++) if ((Math.floor(t * 6) + k) % 7) p.fillRect(Math.floor(st() * PW), Math.floor(st() * 80), 1, 1);
  p.fillStyle = PAL.ground; p.fillRect(0, Y + 8, PW, PH - Y - 8);
  // bloom arcs and the link
  if (s.bloom > 0) PAIRS.forEach(([i, j]) => { dots(i, j, 0, s.bloom / 2, 0, PAL.arc, 6); dots(i, j, 1 - s.bloom / 2, 1, 0, PAL.arc, 6); });
  if (s.link > 0) dots(RAN, CAT, 0, s.link, 6, PAL.link, 3);
  // word tiles
  for (let i = 0; i < N; i++) {
    if (t < s.stepAt(i) - 0.1) continue;
    const bump = s.stepPulse(i) > 0.5 ? -2 : 0;
    p.fillStyle = PAL.ink; p.fillRect(X(i) - 15, Y - 6 + bump, 31, 15);
    p.fillStyle = i === CAT || i === RAN ? PAL.tile2 : PAL.tile; p.fillRect(X(i) - 14, Y - 5 + bump, 29, 13);
  }
  // the sprite: hops tile to tile, a coin pops each landing
  const fade = s.chainFade < 1;
  if (fade) {
    const i = Math.max(0, Math.ceil(s.walk) - 1), f = clamp(s.walk - i);
    const x = Math.round(lerp(i === 0 ? X(0) - 30 : X(i - 1), X(i), f)), y = Math.round(Y - 14 - Math.sin(f * Math.PI) * 16);
    p.fillStyle = PAL.link; p.fillRect(x - 3, y - 6, 7, 7); p.fillStyle = PAL.white; p.fillRect(x, y - 4, 2, 2); p.fillStyle = PAL.ink; p.fillRect(x - 3, y + 1, 2, 2); p.fillRect(x + 2, y + 1, 2, 2);
    for (let k = 0; k < N; k++) { const c = clamp((t - s.stepAt(k)) / 0.4); if (c > 0 && c < 1) { p.fillStyle = PAL.tile; p.fillRect(X(k) - 2, Y - 24 - Math.round(c * 14), 4, 4); } }
  }
  if (s.seven > 0.5) ptext(SEVEN, X(4), Y + 44, PAL.tile, 5);
  if (s.one > 0.5) { const ap = arcAt(X(CAT), X(RAN), Y - 10, 0.4 * (X(RAN) - X(CAT)) + 6, 0.5); ptext(ONE, ap[0], ap[1] - 6, PAL.link, 6); }
  // hero: LEVEL UP and a pixel burst
  if (s.hero > 0 && t < 7.1) {
    const r = Math.round(s.hero * 120), g = rng(11);
    for (let k = 0; k < 60; k++) { const a = g() * Math.PI * 2, d = r * (0.4 + g() * 0.6); p.fillStyle = [PAL.tile, PAL.link, PAL.arc, PAL.white][k % 4]; p.fillRect(Math.round(PW / 2 + Math.cos(a) * d), Math.round(70 + Math.sin(a) * d * 0.6), 2, 2); }
    if (Math.floor(t * 8) % 2 === 0 || s.hero > 0.8) ptext('LEVEL UP!', PW / 2, 60, PAL.tile, 12);
  }
  if (t >= 7.05) ptext('ATTENTION IS', PW / 2, 34, PAL.white, 10), ptext('ALL YOU NEED', PW / 2, 50, PAL.white, 10);
  if (t >= 7.55) ptext('EVERY WORD, ONE STEP', PW / 2, 66, PAL.arc, 6);
  if (t >= 8.4 && Math.floor(t * 2) % 2 === 0) ptext('PRESS START', PW / 2, 170, PAL.white, 5);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(px, 0, 0, W, H);
  // the words, in the pixel face at 3× its native size so every glyph pixel stays square
  for (let i = 0; i < N; i++) if (t >= s.stepAt(i) - 0.1) text(ctx, WORDS[i], X(i) * 6, (Y + 26) * 6, { font: 'Press Start 2P', size: 24, weight: 400, color: '#FFFFFF', shadow: { color: '#0D0A1A', x: 6, y: 6 } });
}
