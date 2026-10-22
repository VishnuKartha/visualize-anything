import type React from 'react';
import {useCurrentFrame} from 'remotion';
import {MONO, SANS, glide, lerp, ramp, theme} from '../theme';
import type {ChartScene, Step} from '../types';
import {Evidence, arrival, bodyOf, partWay, stepAt} from './parts';

// Measured values against each other. Bars grow and a line draws only as far as `show` has reached,
// each value counting up as its mark arrives, so the comparison is made in front of the viewer.
// `focus` names the labels or series the sentence is about; the rest step back.

const COLORS = [theme.accent, theme.cyan, theme.violet, theme.amber];
// A series can name its colour, so one meaning keeps one colour across the video; otherwise it takes its turn.
const TONES: Record<string, string> = {accent: theme.accent, cyan: theme.cyan, violet: theme.violet, amber: theme.amber, muted: theme.muted};
const PAD = {left: 150, right: 70, top: 96, bottom: 108};
const DIM = 0.3;

/** A round step at or above `value`: 1, 1.5, 2, 2.5, 3, 4, 5, 6, or 8 times a power of ten, so the axis ends near the data. */
const niceStep = (value: number) => {
  const power = 10 ** Math.floor(Math.log10(value));
  const lead = value / power;
  return ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 8].find((step) => lead <= step + 1e-9) ?? 10) * power;
};

/**
 * Four round steps that hold every value with a little room either side. A scatter places points by
 * position, not by length, so its axes fit the data: a trade-off between 24 and 28 is not flattened
 * against a zero nobody measured near.
 */
const fit = (values: number[]) => {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || Math.abs(high) || 1;
  for (let step = niceStep(span / 4); ; step = niceStep(step * 1.01)) {
    const from = Math.max(low >= 0 ? 0 : -Infinity, Math.floor((low - span * 0.08) / step) * step);
    if (from + step * 4 >= high + span * 0.08) return {from, to: from + step * 4};
  }
};

/**
 * The value axis of a bar or line chart. It always holds zero, so a bar's length is its value. With
 * only positive values it runs from zero to a round top in four steps, as before; when a value goes
 * below zero (a loss against a control), it runs from a round floor to a round top in round steps.
 */
const valueAxis = (low: number, high: number): {from: number; to: number; ticks: number[]} => {
  if (low >= 0) {
    // Four round steps from zero, the top as near the largest value as a round step allows.
    const to = 4 * niceStep(high / 4);
    return {from: 0, to, ticks: [0, 1, 2, 3, 4].map((line) => Number(((to * line) / 4).toFixed(6)))};
  }
  const step = niceStep((Math.max(high, 0) - low) / 5);
  const from = Math.floor(low / step) * step;
  const to = Math.max(step, Math.ceil(high / step) * step);
  const ticks: number[] = [];
  for (let value = from; value <= to + step / 1000; value += step) ticks.push(Number(value.toFixed(6)));
  return {from, to, ticks};
};

const tick = (value: number) => (Math.abs(value) >= 1000 ? value.toLocaleString('en-US') : String(Number(value.toFixed(4))));

/** How lit a label or series is under a step's focus: everything, when nothing is singled out. */
const lit = (step: Step | undefined, label: string, series: string | null) =>
  !Array.isArray(step?.focus) || step.focus.includes(label) || (series !== null && step.focus.includes(series)) ? 1 : 0;

const seriesColor = (scene: {series: {tone?: string | null}[]}, index: number) => TONES[scene.series[index]?.tone ?? ''] ?? COLORS[index % COLORS.length];

/** A single series: the bars in focus keep the accent, and the others fall back to slate. */
const fallBack = (on: number) => {
  const [a, b] = [theme.dim, theme.accent].map((hex) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)));
  return `rgb(${a.map((channel, index) => Math.round(lerp(channel, b[index], on))).join(',')})`;
};

export const ChartView: React.FC<{scene: ChartScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const body = bodyOf(scene, scene.title);
  const {step, previous} = stepAt(scene.steps, frame);
  // Bars and lines are the brightest things on screen, so they start moving gently.
  const p = step ? glide(frame, step.cue, 16) : 1;
  const entered = (index: number, length: number, stagger: number) => {
    const start = arrival(scene.steps, index, stagger);
    return start === null ? 0 : glide(frame, start, length);
  };
  const count = scene.labels.length;
  const many = scene.series.length > 1;
  // Labels that do not fit under their slot are set at an angle, and the plot leaves room below for them.
  const labelSize = count > 8 ? 24 : 30;
  const slotWidth = (body.w - PAD.left - PAD.right) / Math.max(1, count);
  const longest = Math.max(0, ...scene.labels.map((label) => label.length));
  const tilted = !(scene.chart === 'scatter') && longest * labelSize * 0.56 > slotWidth * 0.94;
  const bottom = tilted ? Math.min(260, 40 + longest * labelSize * 0.56 * 0.64) : PAD.bottom;
  const plot = {x: PAD.left, y: PAD.top, w: body.w - PAD.left - PAD.right, h: body.h - PAD.top - bottom};
  // A scatter places each point by two measurements; its points are counted across the series in order.
  const scatter = scene.chart === 'scatter';
  const dots = scene.series.flatMap((entry, seriesIndex) => (entry.points || []).map((point) => ({...point, seriesIndex, series: entry.label})));
  const spread = (entry: ChartScene['series'][number], index: number) => entry.errors?.[index] ?? 0;
  // Series that share a `stack` key are drawn one on top of the other in one bar (a cost and its parts);
  // every other series gets a bar of its own beside them.
  const columns: number[][] = [];
  const keys: string[] = [];
  scene.series.forEach((entry, seriesIndex) => {
    const key = scene.chart === 'bar' && entry.stack ? `stack:${entry.stack}` : `own:${seriesIndex}`;
    const at = keys.indexOf(key);
    if (at < 0) {
      keys.push(key);
      columns.push([seriesIndex]);
    } else columns[at].push(seriesIndex);
  });
  const columnOf = (seriesIndex: number) => columns.findIndex((members) => members.includes(seriesIndex));
  const baseOf = (seriesIndex: number, index: number) => {
    const members = columns[columnOf(seriesIndex)];
    return members.slice(0, members.indexOf(seriesIndex)).reduce((sum, member) => sum + scene.series[member].values[index], 0);
  };
  const stackTops = columns.filter((members) => members.length > 1).flatMap((members) => scene.labels.map((_, index) => members.reduce((sum, member) => sum + scene.series[member].values[index], 0)));
  const lows = scene.series.flatMap((entry) => entry.values.map((value, index) => value - spread(entry, index)));
  const highs = scene.series.flatMap((entry) => entry.values.map((value, index) => value + spread(entry, index)));
  const ys = scatter ? fit(dots.map((dot) => dot.y)) : valueAxis(Math.min(...lows), Math.max(...highs, ...stackTops));
  const ticks: number[] = 'ticks' in ys ? (ys.ticks as number[]) : [0, 1, 2, 3, 4].map((line) => ys.from + ((ys.to - ys.from) * line) / 4);
  // A chart of changes (some values below zero) writes each value with its sign.
  const signed = !scatter && lows.some((value) => value < 0) && scene.series.some((entry) => entry.values.some((value) => value < 0));
  const xs = scatter ? fit(dots.map((dot) => dot.x)) : {from: 0, to: 1};
  const top = ys.to;
  const xOf = (value: number) => plot.x + (plot.w * (value - xs.from)) / (xs.to - xs.from);
  const yOf = (value: number) => plot.y + plot.h * (1 - (value - ys.from) / (top - ys.from));
  const slot = plot.w / count;
  const focus = (label: string, series: string | null) => lerp(previous ? lit(previous, label, series) : lit(step, label, series), lit(step, label, series), p);
  const singled = Array.isArray(step?.focus);
  const enter = ramp(frame, 0, 20);
  // A value is written above its mark when there is room for all of them, or when it is the one in focus.
  const roomy = count * Math.max(1, columns.length) <= 8;
  const size = slot / scene.series.length < 130 ? 28 : 34;

  const marks = scatter ? (
    dots.map((dot, index) => {
      const arrived = entered(index, 18, 6);
      if (arrived <= 0) return null;
      const color = many ? seriesColor(scene, dot.seriesIndex) : theme.accent;
      const on = singled || previous?.focus ? focus(dot.label || '', dot.series) : 1;
      const x = xOf(dot.x);
      const y = yOf(dot.y);
      // A label goes on the side of the point with more room.
      const flip = x > plot.x + plot.w * 0.72;
      return (
        <g key={index} opacity={arrived * lerp(DIM, 1, on)}>
          <circle cx={x} cy={y} r={lerp(13, 18, singled ? on : 0) * (0.4 + 0.6 * arrived)} fill={color} stroke={theme.bg} strokeWidth={4} />
          {dot.label ? (
            <text data-va-text="value" x={x + (flip ? -26 : 26)} y={y + 10} textAnchor={flip ? 'end' : 'start'} fontFamily={SANS} fontSize={30} fontWeight={700} fill={theme.text}>
              {dot.label}
            </text>
          ) : null}
        </g>
      );
    })
  ) : scene.chart === 'bar' ? (
    scene.labels.map((label, index) => {
      const grown = entered(index, 26, 5);
      const start = arrival(scene.steps, index, 5);
      const group = Math.min(slot * 0.64, 190 * columns.length);
      const width = group / columns.length;
      return scene.series.map((entry, seriesIndex) => {
        const value = entry.values[index];
        const on = focus(label, entry.label);
        const column = columnOf(seriesIndex);
        const members = columns[column];
        const stacked = members.length > 1;
        const base = baseOf(seriesIndex, index);
        const x = plot.x + slot * index + (slot - group) / 2 + width * column;
        // Bars grow from the zero line: up for a value above it, down for one below. A stacked part grows from the top of the part below it.
        const zero = yOf(base * grown);
        const end = yOf((base + value) * grown);
        const below = value < 0;
        const color = many ? seriesColor(scene, seriesIndex) : below ? theme.rose : singled || previous?.focus ? fallBack(on) : theme.accent;
        const counting = start === null ? 0 : ramp(frame, start, 26);
        const whisker = spread(entry, index);
        return (
          <g key={`${index}-${seriesIndex}`} opacity={many ? lerp(DIM, 1, on) : below && (singled || previous?.focus) ? lerp(DIM + 0.25, 1, on) : 1}>
            <rect x={x + 3} y={Math.min(zero, end)} width={width - 6} height={Math.abs(zero - end)} rx={Math.min(10, width / 6, Math.abs(zero - end) / 2)} fill={color} />
            {whisker > 0 && grown > 0.98 ? (
              <g stroke={theme.text} strokeWidth={3} opacity={0.7 * Math.min(1, (grown - 0.98) * 50)}>
                <line x1={x + width / 2} x2={x + width / 2} y1={yOf(value - whisker)} y2={yOf(value + whisker)} />
                <line x1={x + width / 2 - 10} x2={x + width / 2 + 10} y1={yOf(value - whisker)} y2={yOf(value - whisker)} />
                <line x1={x + width / 2 - 10} x2={x + width / 2 + 10} y1={yOf(value + whisker)} y2={yOf(value + whisker)} />
              </g>
            ) : null}
            {stacked && grown > 0 && Math.abs(zero - end) > size + 10 && (roomy || on > 0.5) ? (
              // A part of a stack is labelled inside itself; the stack's total goes above it.
              <text data-va-text="value" x={x + width / 2} y={(zero + end) / 2 + size * 0.35} textAnchor="middle" fontFamily={SANS} fontSize={size * 0.85} fontWeight={700} fill={theme.bg} opacity={Math.min(1, grown * 1.6) * lerp(0.55, 1, on)} style={{fontVariantNumeric: 'tabular-nums'}}>
                {partWay(value, counting)}
              </text>
            ) : null}
            {stacked && seriesIndex === members[members.length - 1] && grown > 0 ? (
              <text data-va-text="value" x={x + width / 2} y={end - 16} textAnchor="middle" fontFamily={SANS} fontSize={size} fontWeight={700} fill={theme.text} opacity={Math.min(1, grown * 1.6)} style={{fontVariantNumeric: 'tabular-nums'}}>
                {partWay(Number((base + value).toFixed(6)), counting)}
              </text>
            ) : null}
            {!stacked && (roomy || on > 0.5) && grown > 0 ? (
              <text
                data-va-text="value"
                x={x + width / 2}
                y={below ? yOf(value * grown - whisker * grown) + size + 12 : yOf(value * grown + whisker * grown) - 16}
                textAnchor="middle"
                fontFamily={SANS}
                fontSize={size}
                fontWeight={700}
                fill={theme.text}
                opacity={Math.min(1, grown * 1.6) * lerp(0.55, 1, on)}
                style={{fontVariantNumeric: 'tabular-nums'}}
              >
                {signed && value > 0 ? '+' : ''}
                {partWay(value, counting)}
                {scene.unit && !many ? ` ${scene.unit}` : ''}
              </text>
            ) : null}
          </g>
        );
      });
    })
  ) : (
    scene.series.map((entry, seriesIndex) => {
      const color = seriesColor(scene, seriesIndex);
      const points = entry.values.map((value, index) => ({x: plot.x + slot * (index + 0.5), y: yOf(value), value}));
      const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
      // The line has reached as far as its points have arrived: each segment is drawn while its far point comes in.
      const drawn = lengths.reduce((sum, length, index) => sum + length * entered(index + 1, 22, 9), 0);
      const whole = lengths.reduce((sum, length) => sum + length, 0);
      const on = focus('', entry.label);
      return (
        <g key={seriesIndex} opacity={lerp(DIM, 1, many ? on : 1)}>
          <path d={points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ')} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${drawn} ${whole + 1}`} />
          {points.map((point, index) => {
            const arrived = entered(index, 14, 9);
            const start = arrival(scene.steps, index, 9);
            const named = focus(scene.labels[index], entry.label);
            if (arrived <= 0) return null;
            return (
              <g key={index} opacity={arrived}>
                <circle cx={point.x} cy={point.y} r={lerp(8, 13, singled ? named : 0) * arrived} fill={theme.bg} stroke={color} strokeWidth={5} />
                {roomy || (singled && named > 0.5) ? (
                  <text data-va-text="value" x={point.x} y={point.y - 28} textAnchor="middle" fontFamily={SANS} fontSize={size} fontWeight={700} fill={theme.text} opacity={lerp(0.55, 1, singled ? named : 1)} style={{fontVariantNumeric: 'tabular-nums'}}>
                    {partWay(point.value, start === null ? 0 : ramp(frame, start, 22))}
                    {scene.unit && !many ? ` ${scene.unit}` : ''}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      );
    })
  );

  return (
    <Evidence scene={scene} frame={frame} title={scene.title}>
      <div
        data-va-box="card"
        style={{
          position: 'absolute',
          left: body.x,
          top: body.y,
          width: body.w,
          height: body.h,
          boxSizing: 'border-box',
          borderRadius: 24,
          backgroundColor: theme.panel,
          border: `1px solid ${theme.panelBorder}`,
          boxShadow: '0 40px 120px rgba(0,0,0,0.55)',
          overflow: 'hidden',
          opacity: enter,
          translate: `0 ${(1 - enter) * 30}px`,
        }}
      >
        <svg width={body.w} height={body.h} style={{position: 'absolute', inset: 0}}>
          {ticks.map((value, line) => {
            // The zero line is the one the bars stand on; it is drawn firmer than the rest.
            const base = scatter ? line === 0 : Math.abs(value) < 1e-9;
            return (
              <g key={line}>
                <line x1={plot.x} x2={plot.x + plot.w} y1={yOf(value)} y2={yOf(value)} stroke={base ? theme.dim : theme.panelBorder} strokeWidth={base ? 2 : 1} />
                <text data-va-text="axis" x={plot.x - 20} y={yOf(value) + 9} textAnchor="end" fontFamily={MONO} fontSize={24} fill={theme.muted}>
                  {tick(value)}
                </text>
              </g>
            );
          })}
          {marks}
          {scatter
            ? [0, 1, 2, 3, 4].map((line) => (
                <text key={`x${line}`} data-va-text="axis" x={xOf(xs.from + ((xs.to - xs.from) * line) / 4)} y={plot.y + plot.h + 44} textAnchor="middle" fontFamily={MONO} fontSize={24} fill={theme.muted}>
                  {tick(xs.from + ((xs.to - xs.from) * line) / 4)}
                </text>
              ))
            : null}
          {scatter && scene.across ? (
            <text data-va-text="axis" x={plot.x + plot.w} y={plot.y + plot.h + 88} textAnchor="end" fontFamily={MONO} fontSize={24} fontWeight={500} letterSpacing="0.06em" fill={theme.muted}>
              {scene.across}
            </text>
          ) : null}
          {scene.labels.map((label, index) => (
            <text
              key={label}
              data-va-text="axis"
              x={plot.x + slot * (index + 0.5)}
              y={plot.y + plot.h + (tilted ? 34 : 52)}
              textAnchor={tilted ? 'end' : 'middle'}
              transform={tilted ? `rotate(-40 ${plot.x + slot * (index + 0.5)} ${plot.y + plot.h + 34})` : undefined}
              fontFamily={SANS}
              fontSize={labelSize}
              fontWeight={600}
              fill={theme.text}
              opacity={lerp(0.45, 1, entered(index, 14, 5)) * lerp(0.6, 1, focus(label, null))}
            >
              {label}
            </text>
          ))}
        </svg>
        {scene.axis || scene.unit ? (
          <div data-va-text="axis" style={{position: 'absolute', left: 44, top: 30, fontFamily: MONO, fontSize: 24, fontWeight: 500, letterSpacing: '0.06em', color: theme.muted}}>
            {scene.axis || scene.unit}
          </div>
        ) : null}
        {many ? (
          <div style={{position: 'absolute', right: 56, top: 26, display: 'flex', gap: 36}}>
            {scene.series.map((entry, index) => (
              <div key={index} data-va-text="legend" style={{display: 'flex', alignItems: 'center', gap: 12, fontFamily: SANS, fontSize: 28, fontWeight: 600, color: theme.text, opacity: lerp(0.45, 1, focus('', entry.label))}}>
                <span style={{width: 18, height: 18, borderRadius: 5, backgroundColor: seriesColor(scene, index)}} />
                {entry.label}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Evidence>
  );
};
