// The page: picks the style from ?style=<slug>, then draws the story with it at any t.
import { story, clamp } from './story.js';
const Q = new URLSearchParams(location.search);
const SLUG = Q.get('style') || '01-flat-vector';
// ---------------------------------------------------------------- the style, and the frame
const style = await import(`/demos/40-attention-styles/styles/${SLUG}.js`);
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
for (const spec of style.FONTS || []) await document.fonts.load(spec, 'ATTENTION catrndogshe 0123456789');
await document.fonts.ready;
if (style.setup) await style.setup(ctx);

window.renderAt = async (t) => {
  t = clamp(t, 0, 10 - 1e-6);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  style.draw(ctx, story(t), t);
};
if (Q.has('t')) await window.renderAt(+Q.get('t'));
window.__ready = true;
