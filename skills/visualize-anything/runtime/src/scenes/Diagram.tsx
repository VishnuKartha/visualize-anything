import type React from 'react';
import {useLayoutEffect, useMemo, useRef} from 'react';
import {useCurrentFrame} from 'remotion';
import {beatAt, lerp, ramp} from '../theme';
import type {Box, DiagramScene} from '../types';

const AREA = {x: 80, y: 104, w: 1760, h: 800};
const DIM = 0.2;
const FOLLOW = 0.72; // how far the camera commits to the focused region (1 = fully framed)
const MAX_ZOOM = 2;

type Level = {vis: number; lit: number};
type State = {nodes: Record<string, Level>; edges: Record<string, Level>; view: Box};

const union = (boxes: Box[]): Box | null => {
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
};

/** Grow a box to the stage's aspect ratio around its centre. */
const fit = (box: Box, aspect: number): Box => {
  const w = Math.max(box.w, box.h * aspect);
  const h = w / aspect;
  return {x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2, w, h};
};

/** What is visible, what is lit, and where the camera sits, for every beat. Pure data, no DOM. */
const planStates = (scene: DiagramScene): State[] => {
  const aspect = AREA.w / AREA.h;
  const [vx, vy, vw, vh] = scene.viewBox;
  const full = fit({x: vx, y: vy, w: vw, h: vh}, aspect);
  const nodeIds = Object.keys(scene.nodes);
  const edgeIds = Object.keys(scene.edges);
  // Sequence messages are the story itself, so they only appear when a beat names them.
  const edgesFollowNodes = scene.diagramType !== 'sequence';
  const seenNodes = new Set<string>(scene.build ? [] : nodeIds);
  const seenEdges = new Set<string>(scene.build ? [] : edgeIds);

  return scene.beats.map((beat) => {
    const focus = beat.focus;
    let litNodes: Set<string>;
    let litEdges: Set<string>;
    let view = full;

    if (focus === 'all') {
      nodeIds.forEach((id) => seenNodes.add(id));
      edgeIds.forEach((id) => seenEdges.add(id));
      litNodes = new Set(nodeIds);
      litEdges = new Set(edgeIds);
    } else if (!focus || focus.length === 0) {
      litNodes = new Set(seenNodes);
      litEdges = new Set(seenEdges);
    } else {
      litEdges = new Set(focus.filter((id) => scene.edges[id]));
      litNodes = new Set(focus.filter((id) => scene.nodes[id]));
      for (const id of litEdges) {
        litNodes.add(scene.edges[id].from);
        litNodes.add(scene.edges[id].to);
      }
      litNodes.forEach((id) => seenNodes.add(id));
      litEdges.forEach((id) => seenEdges.add(id));
      if (edgesFollowNodes) {
        for (const id of edgeIds) {
          const edge = scene.edges[id];
          if (seenNodes.has(edge.from) && seenNodes.has(edge.to)) seenEdges.add(id);
          if (litNodes.has(edge.from) && litNodes.has(edge.to)) litEdges.add(id);
        }
      }
      if (scene.camera === 'follow') {
        const target = union([
          ...[...litNodes].map((id) => scene.nodes[id]).filter(Boolean),
          ...focus.filter((id) => scene.edges[id]).map((id) => scene.edges[id]),
        ]);
        if (target) {
          const pad = Math.max(70, Math.max(target.w, target.h) * 0.22);
          const framed = fit({x: target.x - pad, y: target.y - pad, w: target.w + pad * 2, h: target.h + pad * 2}, aspect);
          const w = Math.max(full.w / MAX_ZOOM, Math.min(full.w, lerp(full.w, framed.w, FOLLOW)));
          const h = w / aspect;
          const cx = lerp(full.x + full.w / 2, framed.x + framed.w / 2, FOLLOW);
          const cy = lerp(full.y + full.h / 2, framed.y + framed.h / 2, FOLLOW);
          view = {
            x: Math.min(Math.max(cx - w / 2, full.x), full.x + full.w - w),
            y: Math.min(Math.max(cy - h / 2, full.y), full.y + full.h - h),
            w,
            h,
          };
        }
      }
    }

    const level = (seen: Set<string>, lit: Set<string>) => (id: string) => ({vis: seen.has(id) ? 1 : 0, lit: lit.has(id) ? 1 : 0});
    return {
      nodes: Object.fromEntries(nodeIds.map((id) => [id, level(seenNodes, litNodes)(id)])),
      edges: Object.fromEntries(edgeIds.map((id) => [id, level(seenEdges, litEdges)(id)])),
      view,
    };
  });
};

type Handles = {
  svg: SVGSVGElement;
  nodes: Record<string, SVGElement[]>;
  edges: Record<string, {elements: SVGElement[]; strokes: {path: SVGGeometryElement; length: number}[]}>;
};

/** Find each node's and edge's elements in the baked SVG once, so per-frame updates are just style writes. */
const collect = (root: HTMLDivElement, scene: DiagramScene): Handles | null => {
  const svg = root.querySelector('svg');
  if (!svg) return null;
  const nodes: Handles['nodes'] = {};
  for (const id of Object.keys(scene.nodes)) {
    nodes[id] = [...svg.querySelectorAll<SVGElement>(`[data-node-id="${CSS.escape(id)}"]`)];
  }
  const edges: Handles['edges'] = {};
  for (const id of Object.keys(scene.edges)) {
    const matched = [...svg.querySelectorAll<SVGElement>(`[data-edge-id="${CSS.escape(id)}"]`)];
    // An edge drawn over a crossing lives in a wrapper with its halo; fade the pair together.
    const elements = matched.map((element) => {
      const parent = element.parentElement as SVGElement | null;
      return parent?.getAttribute('data-graph-role') === 'automatic-crossover' ? parent : element;
    });
    const strokes: Handles['edges'][string]['strokes'] = [];
    for (const element of matched) {
      const paths = element instanceof SVGGeometryElement ? [element] : [...element.querySelectorAll<SVGGeometryElement>('path, line')];
      for (const path of paths) {
        const drawable = path.hasAttribute('marker-end') && !path.style.strokeDasharray;
        if (drawable) strokes.push({path, length: path.getTotalLength()});
      }
    }
    edges[id] = {elements, strokes};
  }
  return {svg, nodes, edges};
};

export const DiagramView: React.FC<{scene: DiagramScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const root = useRef<HTMLDivElement>(null);
  const handles = useRef<Handles | null>(null);
  const states = useMemo(() => planStates(scene), [scene]);
  const markup = useMemo(() => ({__html: scene.svg}), [scene.svg]);

  useLayoutEffect(() => {
    if (!root.current) return;
    handles.current ??= collect(root.current, scene);
    const found = handles.current;
    if (!found || states.length === 0) return;

    const index = beatAt(scene.beats, frame);
    const to = states[index];
    // Before the first beat nothing has been introduced yet; the scene builds from empty.
    const from: State =
      index > 0
        ? states[index - 1]
        : {
            view: to.view,
            nodes: Object.fromEntries(Object.keys(to.nodes).map((id) => [id, {vis: 0, lit: to.nodes[id].lit}])),
            edges: Object.fromEntries(Object.keys(to.edges).map((id) => [id, {vis: 0, lit: to.edges[id].lit}])),
          };
    const start = scene.beats[index].cue;
    const p = ramp(frame, start, 18);
    const camera = ramp(frame, start, 26);
    const opacityOf = (a: Level, b: Level) => lerp(a.vis, b.vis, p) * lerp(DIM, 1, lerp(a.lit, b.lit, p));

    const view = to.view;
    const prior = from.view;
    found.svg.setAttribute(
      'viewBox',
      [lerp(prior.x, view.x, camera), lerp(prior.y, view.y, camera), lerp(prior.w, view.w, camera), lerp(prior.h, view.h, camera)]
        .map((n) => n.toFixed(2))
        .join(' '),
    );

    for (const [id, elements] of Object.entries(found.nodes)) {
      const opacity = String(opacityOf(from.nodes[id], to.nodes[id]));
      for (const element of elements) element.style.opacity = opacity;
    }
    for (const [id, edge] of Object.entries(found.edges)) {
      const a = from.edges[id];
      const b = to.edges[id];
      const opacity = String(opacityOf(a, b));
      for (const element of edge.elements) element.style.opacity = opacity;
      // A newly introduced solid edge draws itself from source to target.
      const drawing = a.vis === 0 && b.vis === 1 && p < 1;
      const draw = ramp(frame, start + 4, 22);
      for (const {path, length} of edge.strokes) {
        if (drawing && draw < 1) {
          path.style.strokeDasharray = String(length);
          path.style.strokeDashoffset = String(length * (1 - draw));
        } else {
          path.style.removeProperty('stroke-dasharray');
          path.style.removeProperty('stroke-dashoffset');
        }
      }
    }
  }, [frame, scene, states]);

  return (
    <div
      ref={root}
      style={{position: 'absolute', left: AREA.x, top: AREA.y, width: AREA.w, height: AREA.h, overflow: 'hidden'}}
      dangerouslySetInnerHTML={markup}
    />
  );
};
