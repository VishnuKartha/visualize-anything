// Variety captions (综艺花字): loud, bouncy, outlined caption stickers; speed lines; a counter that slams 一 to 七;
// hero: a giant 一步到位！ slam with a screen shake. (16:9 here, so it sits beside the others.)
import { W, H, WORDS, N, CAT, RAN, PAIRS, TITLE, TAGLINE, SEVEN, ONE, lerp, clamp, rng, backOut, easeOut, text, arcAt, growArc, drawArc, roundRect } from '../story.js';

export const FONTS = ["400 60px 'Luckiest Guy'", "400 60px 'ZCOOL KuaiLe'", "900 40px 'Noto Sans SC'"];
const X = (i) => 340 + i * 207, Y = 700;
const BUB = ['#FFE14D', '#FF5DA2', '#5CE1E6', '#FFE14D', '#8C52FF', '#5CE1E6', '#FF5DA2'];
const CN = ['一', '二', '三', '四', '五', '六', '七'];

function sticker(ctx, x, y, w, h, fill, rot = 0, k = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
  ctx.fillStyle = '#111'; roundRect(ctx, -w / 2 + 6, -h / 2 + 8, w, h, 18); ctx.fill();
  ctx.fillStyle = fill; ctx.strokeStyle = '#111'; ctx.lineWidth = 6; roundRect(ctx, -w / 2, -h / 2, w, h, 18); ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function draw(ctx, s, t) {
  // screen shake on the slams
  const shake = 14 * s.heroPulse + 6 * s.linkPulse + 8 * s.bloomPulse;
  const sr = rng(Math.floor(t * 30));
  ctx.setTransform(1, 0, 0, 1, (sr() - 0.5) * shake, (sr() - 0.5) * shake);
  ctx.fillStyle = '#FFF7D6'; ctx.fillRect(-40, -40, W + 80, H + 80);
  // speed lines burst behind the action
  const burst = Math.max(s.bloomPulse, s.heroPulse, s.linkPulse * 0.7);
  if (burst > 0) { ctx.strokeStyle = `rgba(255,93,162,${0.5 * burst})`; ctx.lineWidth = 6; const g = rng(4); for (let k = 0; k < 60; k++) { const a = g() * Math.PI * 2, r0 = 300 + g() * 200; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0, 470 + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a) * 1400, 470 + Math.sin(a) * 1400); ctx.stroke(); } }

  ctx.lineCap = 'round';
  PAIRS.forEach(([i, j], n) => { ctx.strokeStyle = ['#FF5DA2', '#5CE1E6', '#8C52FF', '#FFB800'][n % 4]; ctx.lineWidth = 6; growArc(ctx, X(i), X(j), Y - 50, 0.38 * (X(j) - X(i)), s.bloom); });
  ctx.strokeStyle = '#111'; ctx.lineWidth = 20; drawArc(ctx, X(RAN), X(CAT), Y - 50, 0.38 * (X(RAN) - X(CAT)) + 40, s.link);
  ctx.strokeStyle = '#FF3B30'; ctx.lineWidth = 12; drawArc(ctx, X(RAN), X(CAT), Y - 50, 0.38 * (X(RAN) - X(CAT)) + 40, s.link);

  for (let i = 0; i < N; i++) {
    const k = backOut(clamp((t - s.stepAt(i) + 0.1) / 0.32)); if (k <= 0) continue;
    const rot = (i % 2 ? 1 : -1) * 0.05;
    sticker(ctx, X(i), Y, 176, 86, BUB[i], rot, k * (1 + 0.15 * s.stepPulse(i)));
    ctx.save(); ctx.translate(X(i), Y); ctx.rotate(rot); ctx.scale(k, k);
    text(ctx, WORDS[i].toUpperCase(), 0, 18, { font: 'Luckiest Guy', size: 46, color: '#fff', stroke: '#111', strokeWidth: 10 });
    ctx.restore();
  }
  // the counter: 第一步 … 第七步, slamming in one by one
  const c = Math.max(0, Math.min(N, Math.floor(s.walk + 1e-6)));
  if (c > 0 && s.chainFade < 1) {
    const at = s.stepAt(c - 1), k = backOut(clamp((t - at) / 0.25));
    ctx.save(); ctx.globalAlpha = 1 - s.chainFade; ctx.translate(W - 250, 300); ctx.rotate(0.08); ctx.scale(k, k);
    text(ctx, `第${CN[c - 1]}步`, 0, 0, { font: 'ZCOOL KuaiLe', size: 96, color: '#FFE14D', stroke: '#111', strokeWidth: 14 });
    ctx.restore();
  }
  text(ctx, SEVEN, X(5), Y + 120, { font: 'Luckiest Guy', size: 40, color: '#FF5DA2', stroke: '#111', strokeWidth: 8, alpha: s.seven });
  const ap = arcAt(X(CAT), X(RAN), Y - 50, 0.38 * (X(RAN) - X(CAT)) + 40, 0.5);
  if (s.one > 0) { ctx.save(); ctx.translate(ap[0], ap[1] - 40); ctx.scale(backOut(clamp(s.one * 1.2)), backOut(clamp(s.one * 1.2))); text(ctx, '1 STEP!!', 0, 0, { font: 'Luckiest Guy', size: 60, color: '#FFE14D', stroke: '#111', strokeWidth: 12 }); ctx.restore(); }
  // hero: 一步到位！
  const hk = backOut(clamp((t - 5.55) / 0.3)), hout = 1 - clamp((t - 6.9) / 0.3);
  if (hk > 0 && hout > 0) { ctx.save(); ctx.translate(W / 2, 330); ctx.rotate(-0.06); ctx.scale(hk * 1.05, hk * 1.05); ctx.globalAlpha = hout;
    text(ctx, '一步到位！', 0, 50, { font: 'ZCOOL KuaiLe', size: 200, color: '#FF3B30', stroke: '#111', strokeWidth: 22, shadow: { color: '#FFE14D', blur: 0, x: 12, y: 12 } }); ctx.restore(); }
  const ti = backOut(clamp((t - 7.05) / 0.4));
  if (ti > 0) { ctx.save(); ctx.translate(W / 2, 200); ctx.rotate(-0.03); ctx.scale(ti, ti);
    text(ctx, TITLE, 0, 0, { font: 'Luckiest Guy', size: 84, color: '#FFE14D', stroke: '#111', strokeWidth: 16, shadow: { color: '#FF5DA2', x: 8, y: 8 } }); ctx.restore(); }
  const tg = backOut(clamp((t - 7.55) / 0.35));
  if (tg > 0) { ctx.save(); ctx.translate(W / 2, 290); ctx.scale(tg, tg); text(ctx, '每个词，一步到位 · every word, in one step', 0, 0, { font: 'ZCOOL KuaiLe', size: 46, color: '#fff', stroke: '#111', strokeWidth: 10 }); ctx.restore(); }
}
