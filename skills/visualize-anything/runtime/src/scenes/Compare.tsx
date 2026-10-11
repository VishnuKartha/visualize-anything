import type React from 'react';
import {useCurrentFrame} from 'remotion';
import {MONO, SANS, glide, lerp, ramp, theme} from '../theme';
import type {CompareScene} from '../types';
import {Evidence, Mark, TONE, arrival, bodyOf, entered, stepAt} from './parts';

// Two or three alternatives, side by side, each with what it gets right and what it costs. The
// panels stand from the start, so the viewer knows what is being weighed; the points arrive as the
// voice makes them, and the panel being spoken about is the one that is lit.

const DIM = 0.5;

export const CompareView: React.FC<{scene: CompareScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const body = bodyOf(scene, scene.title);
  const count = scene.panels.length;
  const gap = scene.versus ? 110 : 44;
  const width = (body.w - gap * (count - 1)) / count;
  const most = Math.max(...scene.panels.map((panel) => panel.points.length));
  const size = count > 2 || most > 3 ? 32 : 38;
  const row = size * 1.3 * 2 + 30; // room for a point that wraps to two lines
  const height = Math.min(body.h, 128 + most * row + 36);
  const top = body.y + (body.h - height) / 2;

  // Points are counted across the panels in reading order; `show` is how many have arrived.
  const firsts = scene.panels.map((_, index) => scene.panels.slice(0, index).reduce((sum, panel) => sum + panel.points.length, 0));
  const total = firsts[count - 1] + scene.panels[count - 1].points.length;
  const panelOf = (shown: number) => firsts.reduce((found, first, index) => (first < shown ? index : found), -1);
  const {step, previous} = stepAt(scene.steps, frame);
  // A whole panel stepping back is a large change: it starts gently.
  const p = step ? glide(frame, step.cue, 18) : 1;
  const shown = step?.show ?? 0;
  const rest = (arrived: number, index: number) => (arrived === 0 || panelOf(arrived) === index ? 1 : DIM);
  // Once everything is on screen, the last panel has had its moment and all are weighed together.
  const settled = shown >= total ? glide(frame, (step?.cue ?? 0) + 34, 22) : 0;

  return (
    <Evidence scene={scene} frame={frame} title={scene.title}>
      <div data-va-box="card" style={{position: 'absolute', left: body.x, top, width: body.w, height, display: 'flex', gap}}>
        {scene.panels.map((panel, index) => {
          const enter = ramp(frame, 4 + index * 6, 20);
          const before = !previous || (previous.show ?? 0) >= total ? 1 : rest(previous.show ?? 0, index);
          const now = lerp(lerp(before, rest(shown, index), p), 1, settled);
          const color = TONE[panel.tone];
          return (
            <div
              key={index}
              style={{
                position: 'relative',
                width,
                height,
                boxSizing: 'border-box',
                padding: '0 44px 36px',
                borderRadius: 24,
                backgroundColor: theme.panel,
                border: `1px solid ${color}55`,
                boxShadow: '0 40px 120px rgba(0,0,0,0.55)',
                overflow: 'hidden',
                opacity: enter * now,
                translate: `0 ${(1 - enter) * 40}px`,
              }}
            >
              <div style={{position: 'absolute', left: 0, top: 0, height: 6, width: `${ramp(frame, 8 + index * 6, 30) * 100}%`, backgroundColor: color}} />
              <div data-va-text="label" style={{height: 128, display: 'flex', alignItems: 'center', fontFamily: SANS, fontSize: count > 2 ? 42 : 50, fontWeight: 800, letterSpacing: '-0.025em', color: theme.text, whiteSpace: 'nowrap'}}>
                {panel.label}
              </div>
              {panel.points.map((point, pointIndex) => {
                const arrived = entered(scene.steps, firsts[index] + pointIndex, frame);
                const start = arrival(scene.steps, firsts[index] + pointIndex);
                return (
                  <div key={pointIndex} style={{position: 'relative', height: row, display: 'flex', alignItems: 'center', gap: 22, borderTop: `1px solid ${theme.panelBorder}`}}>
                    {/* Until a point arrives its place is held, so an empty panel reads as a list about to be filled. */}
                    <div style={{position: 'absolute', left: 0, top: (row - size * 1.25) / 2, width: size * 1.25, height: size * 1.25, borderRadius: size, boxSizing: 'border-box', border: `2px dashed ${theme.dim}`, opacity: (1 - arrived) * 0.7}} />
                    <div style={{display: 'flex', alignItems: 'center', gap: 22, opacity: arrived, translate: `${(1 - arrived) * 30}px 0`}}>
                      <Mark tone={point.tone} progress={start === null ? 0 : ramp(frame, start + 8, 16)} size={size * 1.25} />
                      <span data-va-text="point" style={{fontFamily: SANS, fontSize: size, fontWeight: 500, lineHeight: 1.3, color: theme.text, textWrap: 'balance'}}>
                        {point.text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {scene.versus && count === 2 ? (
        <div
          style={{
            position: 'absolute',
            left: body.x + body.w / 2 - 42,
            top: top + height / 2 - 42,
            width: 84,
            height: 84,
            borderRadius: 42,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.bg,
            border: `2px solid ${theme.accent}`,
            fontFamily: MONO,
            fontSize: 28,
            fontWeight: 700,
            color: theme.accent,
            opacity: ramp(frame, 16, 16),
            scale: String(0.6 + 0.4 * ramp(frame, 16, 18)),
          }}
        >
          vs
        </div>
      ) : null}
    </Evidence>
  );
};
