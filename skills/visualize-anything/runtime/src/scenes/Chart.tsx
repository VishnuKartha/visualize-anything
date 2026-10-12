import type React from 'react';
import {useCurrentFrame} from 'remotion';
import {MONO, SANS, glide, lerp, ramp, theme} from '../theme';
import type {ChartScene, Step} from '../types';
import {Evidence, arrival, bodyOf, partWay, stepAt} from './parts';

// Measured values against each other. Bars grow and a line draws only as far as `show` has reached,
// each value counting up as its mark arrives, so the comparison is made in front of the viewer.
// `focus` names the labels or series the sentence is about; the rest step back.

const COLORS = [theme.accent, theme.cyan, theme.violet, theme.amber];
const PAD = {left: 150, right: 70, top: 96, bottom: 108};
const DIM = 0.3;

/** A round number at or above `value` that divides into four clean steps. */
const niceTop = (value: number) => {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const lead = value / power;
  return (lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 4 ? 4 : lead <= 5 ? 5 : lead <= 8 ? 8 : 10) * power;
};

/** A round step at or above `value`: 1, 2, 2.5, or 5 times a power of ten. */
const niceStep = (value: number) => {
  const power = 10 ** Math.floor(Math.log10(value));
  const lead = value / power;
  return (lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 2.5 ? 2.5 : lead <= 5 ? 5 : 10) * power;
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

const tick = (value: number) => (Math.abs(value) >= 1000 ? value.toLocaleString('en-US') : String(Number(value.toFixed(4))));

/** How lit a label or series is under a step's focus: everything, when nothing is singled out. */
const lit = (step: Step | undefined, label: string, series: string | null) =>
  !Array.isArray(step?.focus) || step.focus.includes(label) || (series !== null && step.focus.includes(series)) ? 1 : 0;

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
  const plot = {x: PAD.left, y: PAD.top, w: body.w - PAD.left - PAD.right, h: body.h - PAD.top - PAD.bottom};
  // A scatter places each point by two measurements; its points are counted across the series in order.
  const scatter = scene.chart === 'scatter';
  const dots = scene.series.flatMap((entry, seriesIndex) => (entry.points || []).map((point) => ({...point, seriesIndex, series: entry.label})));
  const ys = scatter ? fit(dots.map((dot) => dot.y)) : {from: 0, to: niceTop(Math.max(...scene.series.flatMap((entry) => entry.values)))};
  const xs = scatter ? fit(dots.map((dot) => dot.x)) : {from: 0, to: 1};
  const top = ys.to;
  const xOf = (value: number) => plot.x + (plot.w * (value - xs.from)) / (xs.to - xs.from);
  const yOf = (value: number) => plot.y + plot.h * (1 - (value - ys.from) / (top - ys.from));
  const slot = plot.w / count;
  const focus = (label: string, series: string | null) => lerp(previous ? lit(previous, label, series) : lit(step, label, series), lit(step, label, series), p);
  const singled = Array.isArray(step?.focus);
  const enter = ramp(frame, 0, 20);
  // A value is written above its mark when there is room for all of them, or when it is the one in focus.
  const roomy = count * scene.series.length <= 8;
  const size = slot / scene.series.length < 130 ? 28 : 34;

  const marks = scatter ? (
    dots.map((dot, index) => {
      const arrived = entered(index, 18, 6);
      if (arrived <= 0) return null;
      const color = many ? COLORS[dot.seriesIndex % COLORS.length] : theme.accent;
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
      const group = Math.min(slot * 0.64, 190 * scene.series.length);
      const width = group / scene.series.length;
      return scene.series.map((entry, seriesIndex) => {
        const value = entry.values[index];
        const on = focus(label, entry.label);
        const x = plot.x + slot * index + (slot - group) / 2 + width * seriesIndex;
        const height = (plot.h * value * grown) / top;
        const color = many ? COLORS[seriesIndex % COLORS.length] : singled || previous?.focus ? fallBack(on) : theme.accent;
        const counting = start === null ? 0 : ramp(frame, start, 26);
        return (
          <g key={`${index}-${seriesIndex}`} opacity={many ? lerp(DIM, 1, on) : 1}>
            <rect x={x + 3} y={plot.y + plot.h - height} width={width - 6} height={height} rx={Math.min(10, width / 6)} fill={color} />
            {(roomy || on > 0.5) && grown > 0 ? (
              <text
                data-va-text="value"
                x={x + width / 2}
                y={plot.y + plot.h - height - 16}
                textAnchor="middle"
                fontFamily={SANS}
                fontSize={size}
                fontWeight={700}
                fill={theme.text}
                opacity={Math.min(1, grown * 1.6) * lerp(0.55, 1, on)}
                style={{fontVariantNumeric: 'tabular-nums'}}
              >
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
      const color = COLORS[seriesIndex % COLORS.length];
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
          {[0, 1, 2, 3, 4].map((line) => {
            const value = ys.from + ((top - ys.from) * line) / 4;
            return (
              <g key={line}>
                <line x1={plot.x} x2={plot.x + plot.w} y1={yOf(value)} y2={yOf(value)} stroke={line ? theme.panelBorder : theme.dim} strokeWidth={line ? 1 : 2} />
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
              y={plot.y + plot.h + 52}
              textAnchor="middle"
              fontFamily={SANS}
              fontSize={count > 8 ? 24 : 30}
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
                <span style={{width: 18, height: 18, borderRadius: 5, backgroundColor: COLORS[index % COLORS.length]}} />
                {entry.label}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Evidence>
  );
};
