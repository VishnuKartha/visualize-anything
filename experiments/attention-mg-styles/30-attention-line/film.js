// ATTENTION — "One line, all at once". Line Art on midnight: one champagne-gold line of constant width.
// The pen crawls through seven word loops one at a time (a recurrent network: one step per word), lifts and draws ONE
// arc from "ran" straight back to "cat" (self-attention: one step), then every other pair of words gets its arc at once.
// Hero: the outer arc's dome fills with gold from the anchor at "ran" and the arcs inside it become engraved lines.
// Canvas2D; every frame is a pure function of t. World units = poster pixels (the frame at zoom 1).
const W = 1920, H = 1080, FPS = 30, DUR = 10;
window.DEMO = { width: W, height: H, fps: FPS, duration: DUR, motionBlur: { samples: 1, shutter: 0.5 } };

const cues = await (await fetch('/demos/30-attention-line/cues.json')).json();

// ---------------------------------------------------------------- palette and type
const BG = '#0B1320', GOLD = '#E9D7A5', GOLD_HI = '#F6EBCB', GOLD_LO = '#C9B27A';
const LINE_W = 3;
const SERIF = "'Cormorant Garamond'";

// ---------------------------------------------------------------- easing
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
function cubicBezier(p1x, p1y, p2x, p2y) {
  const bx = (t) => 3 * p1x * t * (1 - t) ** 2 + 3 * p2x * t * t * (1 - t) + t ** 3;
  const by = (t) => 3 * p1y * t * (1 - t) ** 2 + 3 * p2y * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (bx(m) < x) lo = m; else hi = m; }
    return by((lo + hi) / 2);
  };
}
const easeIO = cubicBezier(0.65, 0, 0.35, 1);     // the style's signature ease: slows into every corner
const easeOut = cubicBezier(0.16, 1, 0.3, 1);
const span01 = (t, a, b) => clamp((t - a) / (b - a));

// ---------------------------------------------------------------- geometry (world)
const WORDS = cues.words;
const N = WORDS.length;
const X0 = 330, DX = 210, BY = 730, R = 17;            // node x, baseline, loop radius
const nx = (i) => X0 + i * DX;
const TOP = (i) => [nx(i), BY - 2 * R];                 // the top of word i's loop: where arcs land

// A piece is a dense polyline with its cumulative length, so any prefix can be drawn exactly.
function piece(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
function lineTo(pts, x, y, step = 3) {
  const [x0, y0] = pts[pts.length - 1], n = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / step));
  for (let k = 1; k <= n; k++) pts.push([lerp(x0, x, k / n), lerp(y0, y, k / n)]);
}
function cubicTo(pts, c1, c2, p, n = 160) {
  const p0 = pts[pts.length - 1];
  for (let k = 1; k <= n; k++) {
    const t = k / n, u = 1 - t;
    pts.push([u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p[0],
              u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p[1]]);
  }
}

// The chain: a run-in along the baseline, a cursive loop at each word (tangent to the baseline, so the line never
// kinks), and a short tail past "ran" where the pen rests. Marks record the length at which each loop closes.
const chainPts = [[-260, BY]];
const loopEnd = [];
let tmp;
for (let i = 0; i < N; i++) {
  lineTo(chainPts, nx(i), BY);
  const cx = nx(i), cy = BY - R;
  for (let k = 1; k <= 72; k++) { const th = Math.PI / 2 - (k / 72) * 2 * Math.PI; chainPts.push([cx + R * Math.cos(th), cy + R * Math.sin(th)]); }
  tmp = piece(chainPts); loopEnd.push(tmp.len);
}
// past "ran" the pen goes half a turn more, to the top of its loop: where the link leaves from
{ const cx = nx(N - 1), cy = BY - R; for (let k = 1; k <= 36; k++) { const th = Math.PI / 2 - 2 * Math.PI - (k / 36) * Math.PI; chainPts.push([cx + R * Math.cos(th), cy + R * Math.sin(th)]); } }
const CHAIN = piece(chainPts);
const runIn = (() => { const p = piece([[-260, BY], [150, BY]]); return p.len; })();

// The link: from the top of "ran"'s loop, up and over, landing on the top of "cat"'s loop: the same family of arc as
// every other pair, drawn by the pen, right to left.

// Every other pair: a half-ellipse from loop top to loop top, its height in proportion to its span.
const ARCS = [];
const arcPts = (i, j, n = 140) => {
  const [xa, ya] = TOP(i), [xb] = TOP(j), mid = (xa + xb) / 2, half = (xb - xa) / 2, h = 0.4 * (xb - xa);
  const pts = [];
  for (let k = 0; k <= n; k++) { const ph = (k / n) * Math.PI; pts.push([mid - half * Math.cos(ph), ya - h * Math.sin(ph)]); }
  return pts;
};
for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
  if (i === 1 && j === N - 1) continue;   // cat-ran is the pen's own link
  const hsh = Math.sin((i + 1) * 12.9898 + (j + 1) * 78.233) * 43758.5453;
  ARCS.push({ i, j, p: piece(arcPts(i, j)), delay: (hsh - Math.floor(hsh)) * 0.16, outer: i === 0 && j === N - 1 });
}
const OUTER = ARCS.find((a) => a.outer);
const LINK = piece(arcPts(1, N - 1, 220).reverse());

// The dome the fill runs through: under the outer arc, down to the baseline.
const DOME = [...OUTER.p.pts, [nx(N - 1), BY], [nx(0), BY]];
const ANCHOR = [nx(N - 1), BY - R];

// ---------------------------------------------------------------- the pen's arc length over time
const steps = cues.steps;
// Keyframes [t, s]: run-in already drawn at t=0 (the film opens on ink), then one eased move per word, decelerating
// into each loop's close: the recurrence, one step after another.
const KF = [[0, runIn], ...steps.map((t, i) => [t, loopEnd[i]]), [cues.hold[0] + 0.16, CHAIN.len]];
function chainS(t) {
  if (t >= KF[KF.length - 1][0]) return CHAIN.len;
  let k = 0; while (t > KF[k + 1][0]) k++;
  const [t0, s0] = KF[k], [t1, s1] = KF[k + 1];
  return lerp(s0, s1, easeIO((t - t0) / (t1 - t0)));
}
const linkP = (t) => easeIO(span01(t, cues.link[0], cues.link[1]));

// ---------------------------------------------------------------- drawing helpers
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
let CAM = { x: 960, y: 540, z: 1 };

function pointAt(pc, s) {
  s = clamp(s, 0, pc.len);
  let lo = 0, hi = pc.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pc.cum[m] < s) lo = m; else hi = m; }
  const seg = pc.cum[hi] - pc.cum[lo] || 1, u = (s - pc.cum[lo]) / seg;
  return [lerp(pc.pts[lo][0], pc.pts[hi][0], u), lerp(pc.pts[lo][1], pc.pts[hi][1], u)];
}
function strokeRange(pc, s0, s1, color, alpha, width = LINE_W) {
  if (s1 <= s0 + 0.01) return;
  ctx.beginPath();
  const a = pointAt(pc, s0); ctx.moveTo(a[0], a[1]);
  for (let k = 0; k < pc.pts.length; k++) if (pc.cum[k] > s0 && pc.cum[k] < s1) ctx.lineTo(pc.pts[k][0], pc.pts[k][1]);
  const b = pointAt(pc, s1); ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = width / CAM.z;   // constant width on screen at every zoom
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke(); ctx.globalAlpha = 1;
}
function tip(p, strength, size = 1) {
  if (strength <= 0.01) return;
  const rr = 28 * size / CAM.z;
  const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rr);
  g.addColorStop(0, `rgba(246,235,203,${0.65 * strength})`);
  g.addColorStop(0.35, `rgba(233,215,165,${0.22 * strength})`);
  g.addColorStop(1, 'rgba(233,215,165,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], rr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = GOLD_HI; ctx.globalAlpha = strength; ctx.beginPath(); ctx.arc(p[0], p[1], 2.6 * size / CAM.z, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
}
function text(str, x, y, { size = 26, weight = 500, italic = false, spacing = 0, color = GOLD, alpha = 1, align = 'center' } = {}) {
  if (alpha <= 0.005) return;
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${SERIF}`;
  ctx.letterSpacing = `${spacing}px`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  // letter-spacing adds space after the last glyph too; shift a centred line back by half of it
  const shift = align === 'center' ? spacing / 2 : 0;
  ctx.fillStyle = color; ctx.globalAlpha = alpha; ctx.fillText(str, x + shift, y); ctx.globalAlpha = 1;
  ctx.letterSpacing = '0px';
}
function domePath() {
  const p = new Path2D(); p.moveTo(DOME[0][0], DOME[0][1]);
  for (const q of DOME) p.lineTo(q[0], q[1]);
  p.closePath(); return p;
}
const DOME_PATH = domePath();

// ---------------------------------------------------------------- camera
function camera(t) {
  const c = cues.camera;
  const follow = { x: lerp(250, 1340, easeIO(span01(t, 0, c.follow_until + 0.15))), y: BY - 70, z: c.zoom_start };
  const poster = { x: 960, y: 540, z: lerp(1, c.drift_end, easeIO(span01(t, c.dolly[1], DUR))) };
  const k = easeIO(span01(t, c.dolly[0], c.dolly[1]));
  // interpolate the visible window, not the raw zoom, so the dolly reads as one smooth pull-back
  return { x: lerp(follow.x, poster.x, k), y: lerp(follow.y, poster.y, k), z: 1 / lerp(1 / follow.z, 1 / poster.z, k) };
}

// ---------------------------------------------------------------- the frame
function draw(t) {
  CAM = camera(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(CAM.z, 0, 0, CAM.z, W / 2 - CAM.x * CAM.z, H / 2 - CAM.y * CAM.z);

  const sChain = chainS(t);
  const bloom = cues.bloom, fill = cues.fill;
  const chainAlpha = lerp(1, 0.42, easeIO(span01(t, bloom[0], bloom[0] + 0.6)));   // older line steps back as the arcs arrive

  // the chain (the recurrence)
  const retract = easeIO(span01(t, bloom[1], fill[0])) * (loopEnd[0] - 2 * Math.PI * R);
  strokeRange(CHAIN, retract, sChain, GOLD, chainAlpha);

  // the link (self-attention: one step)
  const lp = linkP(t);
  strokeRange(LINK, 0, lp * LINK.len, GOLD, 1);

  // every other pair, all at once: each arc grows from both of its words toward its apex
  const grow = ARCS.map(() => easeIO(span01(t, bloom[0], bloom[1])));   // all at once: one ease, one frame
  ARCS.forEach((a, k) => {
    const g = grow[k]; if (g <= 0) return;
    const alpha = a.outer ? 0.85 : 0.35;
    strokeRange(a.p, 0, g * a.p.len / 2, GOLD, alpha);
    strokeRange(a.p, a.p.len * (1 - g / 2), a.p.len, GOLD, alpha);
  });

  // line-to-fill: gold runs through the dome from the anchor at "ran"; the lines inside become engraved
  const fk = easeIO(span01(t, fill[0], fill[1]));
  if (fk > 0) {
    const r = 40 + fk * 1500;
    ctx.save(); ctx.clip(DOME_PATH);
    const g = ctx.createRadialGradient(ANCHOR[0], ANCHOR[1], 0, ANCHOR[0], ANCHOR[1], r);
    g.addColorStop(0, GOLD_HI); g.addColorStop(0.55, GOLD); g.addColorStop(1, GOLD_LO);
    const breathe = 1 + 0.02 * Math.sin(Math.max(0, t - fill[1]) * 2 * Math.PI / 2.6);
    ctx.globalAlpha = 0.72 * breathe;
    ctx.beginPath(); ctx.arc(ANCHOR[0], ANCHOR[1], r, 0, Math.PI * 2); ctx.clip();   // a hard leading edge
    ctx.fillStyle = g; ctx.fillRect(-W, -H, 3 * W, 3 * H); ctx.globalAlpha = 1;
    // engraving: the same lines, in the ground colour, only where the gold has arrived
    strokeRange(LINK, 0, LINK.len, BG, 0.95);
    ARCS.forEach((a) => { if (!a.outer) strokeRange(a.p, 0, a.p.len, BG, 0.78); });
    strokeRange(CHAIN, retract, CHAIN.len, BG, 0.9);
    ctx.restore();
    strokeRange(OUTER.p, 0, OUTER.p.len, GOLD_HI, 1);   // the outline stays a line
  }

  // a light runs along the dome's edge once the gold has settled: living micro-motion for the end frame
  const gl = span01(t, cues.glint[0], cues.glint[1]);
  if (gl > 0 && gl < 1) {
    const s = easeIO(gl) * OUTER.p.len;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    strokeRange(OUTER.p, Math.max(0, s - 90), s, GOLD_HI, 0.85 * Math.sin(gl * Math.PI), LINE_W + 1.5);
    ctx.restore();
  }

  // the words, each arriving as the pen closes its loop
  WORDS.forEach((w, i) => {
    const a = easeOut(span01(t, steps[i] - 0.12, steps[i] + 0.22));
    const key = i === 1 || i === N - 1;
    const back = lerp(1, 0.62, easeIO(span01(t, cues.wordmark, cues.wordmark + 0.6)));
    text(w.toUpperCase(), nx(i), BY + 62 - 8 * (1 - a), { size: 27, weight: key ? 600 : 500, spacing: 6, alpha: a * back * (key ? 1 : 0.74) });
  });

  // the two counts: seven steps in a row, then one
  const ls = easeOut(span01(t, cues.label_steps, cues.label_steps + 0.35)) * (1 - span01(t, bloom[0], bloom[0] + 0.4));
  text('SEVEN STEPS, IN A ROW', nx(N - 2), BY + 128, { size: 24, weight: 600, spacing: 6, alpha: ls * 0.85 });
  const apex = pointAt(LINK, LINK.len * 0.5);
  const l1 = easeOut(span01(t, cues.label_link, cues.label_link + 0.3)) * (1 - span01(t, bloom[1] + 0.1, bloom[1] + 0.5));
  text('ONE STEP', apex[0], apex[1] - 28, { size: 28, weight: 600, spacing: 7, alpha: l1 * 0.95 });

  // pen tips: the one pen through the chain and the link; a bead at each growing end of the bloom
  if (t < cues.link[1] + 0.3) {
    const onLink = t >= cues.link[0];
    const p = onLink ? pointAt(LINK, lp * LINK.len) : pointAt(CHAIN, sChain);
    tip(p, onLink && t > cues.link[1] ? 1 - span01(t, cues.link[1], cues.link[1] + 0.3) : 1);
  }
  // the one flash that sets every arc going: the pen, resting on "cat", fires once
  const fl = span01(t, bloom[0] - 0.12, bloom[0] + 0.15);
  if (fl > 0 && fl < 1) tip(TOP(1), Math.sin(fl * Math.PI), 1 + 1.2 * Math.sin(fl * Math.PI));

  // the sign-off: the paper's name, letter-spaced, and a tagline between two short rules drawn from the centre out
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const wm = easeOut(span01(t, cues.wordmark, cues.wordmark + 0.7));
  text('ATTENTION IS ALL YOU NEED', W / 2, 892 + 14 * (1 - wm), { size: 46, weight: 500, spacing: 15, alpha: wm });
  const tg = easeOut(span01(t, cues.tagline, cues.tagline + 0.6));
  text('every word, in one step', W / 2, 948 + 8 * (1 - tg), { size: 30, weight: 400, italic: true, spacing: 1.5, alpha: tg * 0.85 });
  const rl = easeIO(span01(t, cues.rules[0], cues.rules[1]));
  if (rl > 0) {
    ctx.strokeStyle = GOLD; ctx.globalAlpha = 0.7; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const x0 = W / 2 + side * 168;
      ctx.beginPath(); ctx.moveTo(x0, 938); ctx.lineTo(x0 + side * 110 * rl, 938); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // a soft vignette keeps the eye on the line
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(5,9,16,0)'); v.addColorStop(1, 'rgba(5,9,16,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

await document.fonts.load(`500 46px ${SERIF}`, 'ATTENTION IS ALL YOU NEED');
await document.fonts.load(`600 27px ${SERIF}`, 'THE CAT RAN 7 STEPS');
await document.fonts.load(`italic 400 30px ${SERIF}`, 'every word, in one step');
await document.fonts.ready;

window.renderAt = async (t) => { draw(clamp(t, 0, DUR - 1e-6)); };
const Q = new URLSearchParams(location.search);
if (Q.has('t')) await window.renderAt(+Q.get('t'));
window.__ready = true;
