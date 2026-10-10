// Archify delivers an interactive HTML page whose SVG is styled by ~190KB of page CSS and
// animated by its own viewer. Remotion needs the opposite: a self-contained SVG whose every
// frame is a pure function of the frame number. Baking loads the page once in Chrome, copies
// each element's computed paint onto the element, and records where every node and edge sits
// so the Diagram scene can reveal, dim, and frame them from narration beats.
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import puppeteer from 'puppeteer-core';
import {fail, findChrome} from './util.mjs';

const inPage = (prefix, keepLegend) => {
  const PAINT = [
    'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray',
    'stroke-linecap', 'stroke-linejoin', 'opacity', 'visibility', 'paint-order', 'filter',
  ];
  const TEXT = ['font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline'];
  const KEEP_DATA = new Set(['data-node-id', 'data-edge-id', 'data-edge-from', 'data-edge-to', 'data-graph-role']);
  const DEFAULTS = {
    'fill-opacity': '1', 'stroke-opacity': '1', opacity: '1', visibility: 'visible', 'paint-order': 'normal',
    filter: 'none', 'stroke-dasharray': 'none', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter',
    'font-style': 'normal', 'letter-spacing': 'normal', 'text-anchor': 'start', 'dominant-baseline': 'auto',
  };

  const svg = document.querySelector('.diagram-container svg') || document.querySelector('svg[viewBox]');
  if (!svg) return {error: 'No diagram <svg> found in the Archify page.'};

  // A narrated video explains its own colours; the legend only costs the diagram screen space.
  if (!keepLegend) for (const legend of svg.querySelectorAll('[data-legend]')) legend.style.display = 'none';

  const clone = svg.cloneNode(true);
  const originals = [svg, ...svg.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  const doomed = [];

  originals.forEach((element, index) => {
    const copy = copies[index];
    const tag = element.tagName.toLowerCase();
    if (tag === 'title' || tag === 'desc' || tag === 'style' || tag === 'script') {
      doomed.push(copy);
      return;
    }
    const computed = getComputedStyle(element);
    if (computed.display === 'none') {
      doomed.push(copy);
      return;
    }
    const inDefs = Boolean(element.closest('defs'));
    const isText = tag === 'text' || tag === 'tspan';
    const isContainer = tag === 'g' || tag === 'svg' || tag === 'defs' || tag === 'marker' || tag === 'pattern';
    const names = isContainer ? ['opacity', 'filter', 'visibility'] : isText ? [...PAINT, ...TEXT] : PAINT;
    const declarations = [];
    for (const name of names) {
      const value = computed.getPropertyValue(name);
      if (value && value !== DEFAULTS[name]) declarations.push(`${name}:${value}`);
    }
    copy.removeAttribute('class');
    for (const attribute of [...copy.attributes]) {
      if (attribute.name.startsWith('data-') && !KEEP_DATA.has(attribute.name)) copy.removeAttribute(attribute.name);
      if (attribute.name.startsWith('aria-') || attribute.name === 'role' || attribute.name === 'tabindex') {
        copy.removeAttribute(attribute.name);
      }
    }
    if (!inDefs || declarations.length) copy.setAttribute('style', declarations.join(';'));
  });
  doomed.forEach((node) => node.remove());

  // Two diagram scenes can be mounted at once, so ids must not collide across them.
  const ids = [...clone.querySelectorAll('[id]')].map((node) => node.id);
  for (const node of clone.querySelectorAll('[id]')) node.id = `${prefix}-${node.id}`;
  const rewrite = (value) =>
    ids.reduce((text, id) => text.split(`url(#${id})`).join(`url(#${prefix}-${id})`).split(`url("#${id}")`).join(`url(#${prefix}-${id})`), value);
  for (const node of [clone, ...clone.querySelectorAll('*')]) {
    for (const attribute of [...node.attributes]) {
      if (attribute.value.includes('url(')) node.setAttribute(attribute.name, rewrite(attribute.value));
      if ((attribute.name === 'href' || attribute.name === 'xlink:href') && attribute.value.startsWith('#')) {
        node.setAttribute(attribute.name, `#${prefix}-${attribute.value.slice(1)}`);
      }
    }
  }

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', '100%');
  clone.setAttribute('height', '100%');
  clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  clone.setAttribute('style', `display:block;overflow:visible;font-family:${getComputedStyle(svg).fontFamily}`);

  // Screen rect → SVG user units, so the result is immune to the viewer's camera transform.
  const inverse = svg.getScreenCTM().inverse();
  const boxOf = (elements) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if (!rect.width && !rect.height) continue;
      for (const [px, py] of [[rect.left, rect.top], [rect.right, rect.bottom]]) {
        const point = new DOMPoint(px, py).matrixTransform(inverse);
        x0 = Math.min(x0, point.x); y0 = Math.min(y0, point.y);
        x1 = Math.max(x1, point.x); y1 = Math.max(y1, point.y);
      }
    }
    if (!Number.isFinite(x0)) return null;
    const round = (n) => Math.round(n * 10) / 10;
    return {x: round(x0), y: round(y0), w: round(x1 - x0), h: round(y1 - y0)};
  };

  const nodes = {};
  for (const element of svg.querySelectorAll('[data-node-id]')) {
    const id = element.getAttribute('data-node-id');
    const box = boxOf([element]);
    if (box) nodes[id] = {label: element.getAttribute('data-node-label') || id, ...box};
  }
  const edges = {};
  for (const element of svg.querySelectorAll('[data-edge-id]')) {
    const id = element.getAttribute('data-edge-id');
    const entry = (edges[id] ||= {
      from: element.getAttribute('data-edge-from'),
      to: element.getAttribute('data-edge-to'),
      label: element.getAttribute('data-edge-label') || '',
      elements: [],
    });
    entry.elements.push(element);
  }
  for (const [id, entry] of Object.entries(edges)) {
    const box = boxOf(entry.elements);
    delete entry.elements;
    if (box) Object.assign(entry, box);
    else delete edges[id];
  }

  // Crop to what is actually drawn (the page-sized grid rect aside) so the diagram fills the frame.
  const authored = svg.viewBox.baseVal;
  const drawn = boxOf(
    [...svg.children].filter((child) => {
      const tag = child.tagName.toLowerCase();
      const isBackdrop = tag === 'rect' && child.getAttribute('width') === '100%';
      return !isBackdrop && !['defs', 'title', 'desc', 'style'].includes(tag) && getComputedStyle(child).display !== 'none';
    }),
  );
  const MARGIN = 18;
  const viewBox = drawn
    ? (() => {
        const x0 = Math.max(authored.x, drawn.x - MARGIN);
        const y0 = Math.max(authored.y, drawn.y - MARGIN);
        const x1 = Math.min(authored.x + authored.width, drawn.x + drawn.w + MARGIN);
        const y1 = Math.min(authored.y + authored.height, drawn.y + drawn.h + MARGIN);
        return {x: x0, y: y0, width: x1 - x0, height: y1 - y0};
      })()
    : authored;

  const page = getComputedStyle(document.body);
  const panel = document.querySelector('.diagram-container');
  return {
    viewBox: [viewBox.x, viewBox.y, viewBox.width, viewBox.height],
    background: (panel && getComputedStyle(panel).backgroundColor) || page.backgroundColor,
    pageBackground: page.backgroundColor,
    svg: new XMLSerializer().serializeToString(clone),
    nodes,
    edges,
  };
};

/** Turn a finalized Archify HTML page into the JSON asset the Diagram scene consumes. */
export const bakeDiagram = async ({htmlPath, sceneId, theme = 'dark', keepLegend = false}) => {
  const executablePath = findChrome();
  if (!executablePath) {
    fail('Chrome was not found. Install Google Chrome, or set VA_CHROME to a Chromium-based browser binary.');
  }
  const browser = await puppeteer.launch({executablePath, headless: true, args: ['--no-first-run', '--hide-scrollbars']});
  try {
    const page = await browser.newPage();
    await page.setViewport({width: 1920, height: 1200, deviceScaleFactor: 1});
    await page.emulateMediaFeatures([
      {name: 'prefers-reduced-motion', value: 'reduce'},
      {name: 'prefers-color-scheme', value: theme},
    ]);
    await page.goto(pathToFileURL(path.resolve(htmlPath)).href, {waitUntil: 'load'});
    await page.evaluate(async (wanted) => {
      document.documentElement.setAttribute('data-theme', wanted);
      document.documentElement.setAttribute('data-motion', 'still');
      const freeze = document.createElement('style');
      freeze.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
      document.head.appendChild(freeze);
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, theme);
    const baked = await page.evaluate(inPage, `va-${sceneId}`, keepLegend);
    if (baked.error) fail(baked.error);
    return baked;
  } finally {
    await browser.close();
  }
};
