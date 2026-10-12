import type React from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {MONO, SANS, glide, ramp, theme} from '../theme';
import type {Metric, StatScene} from '../types';
import {Evidence, TONE, arrival, bodyOf, climbing, countFrames, emWidth, kicker, stepAt} from './parts';

// The number the claim rests on. One metric is set as large as the frame allows, inside rings that
// draw themselves around it; two to four sit side by side as cards. Either way the number counts up
// to its value as the voice reaches it, so it is watched arriving, not found already there.

const Delta: React.FC<{metric: Metric; size: number; progress: number}> = ({metric, size, progress}) => {
  if (!metric.delta) return null;
  const color = TONE[metric.tone];
  const arrow = /^\+/.test(metric.delta) ? '▲' : /^[-−–]/.test(metric.delta) ? '▼' : '';
  return (
    <span
      data-va-text="delta"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: `${size * 0.22}px ${size * 0.6}px`,
        borderRadius: 999,
        backgroundColor: `${color}22`,
        border: `1px solid ${color}66`,
        fontFamily: MONO,
        fontSize: size,
        fontWeight: 600,
        color,
        opacity: progress,
      }}
    >
      {arrow ? <span style={{fontSize: size * 0.62}}>{arrow}</span> : null}
      {metric.delta}
    </span>
  );
};

const Value: React.FC<{metric: Metric; size: number; start: number; length: number; frame: number; stacked?: boolean}> = ({metric, size, start, length, frame, stacked = false}) => {
  // Quick at first and slowing as it gets there, so the last digits are read as they settle.
  const count = interpolate(frame, [start, start + length], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad)});
  return (
    <div style={{display: 'flex', flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'flex-start' : 'baseline', gap: stacked ? 10 : size * 0.14, whiteSpace: 'nowrap'}}>
      <span data-va-text="value" style={{fontFamily: SANS, fontSize: size, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.035em', color: TONE[metric.tone], fontVariantNumeric: 'tabular-nums'}}>
        {climbing(metric.value, count)}
      </span>
      {metric.unit ? (
        <span data-va-text="unit" style={{fontFamily: SANS, fontSize: stacked ? 38 : Math.max(28, size * 0.3), fontWeight: 600, color: theme.muted}}>
          {metric.unit}
        </span>
      ) : null}
    </div>
  );
};

/** A word of a unit ("episodes") goes under its number in a card; a sign ("%", "×", "ms") stays beside it. */
const stacks = (metric: Metric) => (metric.unit || '').length > 3;

/** How large a value can be set in `width`: with its unit beside it, or under it when `stacked`. */
const fit = (metric: Metric, width: number, most: number, stacked = false) => {
  const ems = emWidth(metric.value) + (metric.unit && !stacked ? 0.14 + emWidth(metric.unit) * 0.3 * 0.92 : 0);
  return Math.max(48, Math.min(most, width / ems));
};

const Hero: React.FC<{scene: StatScene; frame: number}> = ({scene, frame}) => {
  const metric = scene.metrics[0];
  const body = bodyOf(scene, scene.title);
  const start = arrival(scene.steps, 0) ?? 6;
  const length = countFrames(scene.steps, 0);
  const p = ramp(frame, start, 20);
  const size = fit(metric, body.w * 0.78, 300);
  const cx = body.x + body.w / 2;
  const cy = body.y + body.h / 2;
  return (
    <>
      <svg data-va-ignore width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        {[290, 380, 470].map((radius, index) => {
          const drawn = ramp(frame, start + index * 6, 40);
          const around = 2 * Math.PI * radius;
          return (
            <circle
              key={radius}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={TONE[metric.tone]}
              strokeOpacity={[0.3, 0.18, 0.1][index]}
              strokeWidth={2}
              strokeDasharray={`${around * drawn} ${around}`}
              transform={`rotate(${-90 + index * 70} ${cx} ${cy})`}
            />
          );
        })}
      </svg>
      <div data-va-box="card" style={{position: 'absolute', left: body.x, top: body.y, width: body.w, height: body.h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26}}>
        <div data-va-text="label" style={{...kicker(30), color: theme.muted, opacity: p, translate: `0 ${(1 - p) * 20}px`}}>
          {metric.label}
        </div>
        <div style={{opacity: glide(frame, start, 16), scale: String(0.92 + 0.08 * p)}}>
          <Value metric={metric} size={size} start={start} length={length} frame={frame} />
        </div>
        {metric.detail ? (
          <div data-va-text="detail" style={{fontFamily: SANS, fontSize: 40, fontWeight: 500, color: theme.text, maxWidth: 1200, textAlign: 'center', textWrap: 'balance', opacity: ramp(frame, start + length - 8, 20)}}>
            {metric.detail}
          </div>
        ) : null}
        <Delta metric={metric} size={30} progress={ramp(frame, start + length + 4, 18)} />
      </div>
    </>
  );
};

const Cards: React.FC<{scene: StatScene; frame: number}> = ({scene, frame}) => {
  const body = bodyOf(scene, scene.title);
  const count = scene.metrics.length;
  const gap = 40;
  const width = (body.w - gap * (count - 1)) / count;
  const height = Math.min(body.h, 520);
  const pad = count > 3 ? 32 : 44;
  // One size for every card, set by the longest value, so the numbers can be compared at a glance.
  const size = Math.min(...scene.metrics.map((metric) => fit(metric, width - pad * 2, [0, 0, 190, 150, 116][count], stacks(metric))));
  const {step} = stepAt(scene.steps, frame);
  const newest = (step?.show ?? 0) - 1;
  return (
    <div data-va-box="card" style={{position: 'absolute', left: body.x, top: body.y + (body.h - height) / 2, width: body.w, height, display: 'flex', gap}}>
      {scene.metrics.map((metric, index) => {
        const start = arrival(scene.steps, index);
        if (start === null) return <div key={index} style={{width}} />;
        const p = ramp(frame, start, 20);
        const length = countFrames(scene.steps, index);
        const lit = index === newest ? ramp(frame, start, 16) : 0;
        const color = TONE[metric.tone];
        return (
          <div
            key={index}
            style={{
              position: 'relative',
              width,
              height,
              boxSizing: 'border-box',
              padding: `${pad}px`,
              borderRadius: 24,
              backgroundColor: theme.panel,
              border: `1px solid ${lit > 0.5 ? `${color}88` : theme.panelBorder}`,
              boxShadow: `0 40px 120px rgba(0,0,0,0.55), 0 0 ${60 * lit}px ${color}22`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 22,
              opacity: p,
              translate: `0 ${(1 - p) * 40}px`,
            }}
          >
            <div style={{position: 'absolute', left: 0, top: 0, height: 6, width: `${ramp(frame, start + 4, 30) * 100}%`, backgroundColor: color}} />
            <div data-va-text="label" style={{...kicker(count > 3 ? 24 : 26), color: theme.muted}}>
              {metric.label}
            </div>
            <Value metric={metric} size={size} start={start + 4} length={length} frame={frame} stacked={stacks(metric)} />
            {metric.detail ? (
              <div data-va-text="detail" style={{fontFamily: SANS, fontSize: count > 3 ? 28 : 32, fontWeight: 500, lineHeight: 1.3, color: theme.text, textWrap: 'balance', opacity: ramp(frame, start + length - 4, 18)}}>
                {metric.detail}
              </div>
            ) : null}
            {metric.delta ? (
              <div>
                <Delta metric={metric} size={count > 3 ? 24 : 26} progress={ramp(frame, start + length + 8, 18)} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export const StatView: React.FC<{scene: StatScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  return (
    <Evidence scene={scene} frame={frame} title={scene.title}>
      {scene.metrics.length === 1 ? <Hero scene={scene} frame={frame} /> : <Cards scene={scene} frame={frame} />}
    </Evidence>
  );
};
