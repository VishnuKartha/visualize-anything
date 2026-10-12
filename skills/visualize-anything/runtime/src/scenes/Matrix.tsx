import type React from 'react';
import {useCurrentFrame} from 'remotion';
import {MONO, SANS, glide, lerp, ramp, theme} from '../theme';
import type {MatrixScene, Step} from '../types';
import {Evidence, arrival, bodyOf, partWay, stepAt} from './parts';

// A grid of values coloured by size: attention weights, a confusion matrix, a correlation table.
// The labels stand from the start; each row fills in as the voice reaches it, its cells warming
// to their value from left to right. `focus` names the rows or columns the sentence is about.

const LABEL_W = 220;
const HEADER_H = 76;
const DIM = 0.22;

/** How lit a label, or a cell in a row and column, is under a step's focus: a cell is lit when its row or its column is named. */
const lit = (step: Step | undefined, ...names: string[]) => (!Array.isArray(step?.focus) || names.some((name) => step.focus!.includes(name)) ? 1 : 0);

/** The accent mixed into the panel by `t`, as an rgb() string: the colour of a cell at that share of the scale. */
const warm = (t: number) => {
  const [a, b] = [theme.panel, theme.accent].map((hex) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)));
  return `rgb(${a.map((channel, index) => Math.round(lerp(channel, b[index], 0.08 + 0.92 * t))).join(',')})`;
};

export const MatrixView: React.FC<{scene: MatrixScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const body = bodyOf(scene, scene.title);
  const [low, high] = scene.scale;
  const rows = scene.rows.length;
  const cols = scene.columns.length;
  const cell = Math.min(160, (body.w - LABEL_W - 40) / cols, (body.h - HEADER_H - (scene.axis ? 50 : 0)) / rows);
  const grid = {w: LABEL_W + cell * cols, h: HEADER_H + cell * rows};
  const left = body.x + (body.w - grid.w) / 2;
  const top = body.y + (body.h - grid.h - (scene.axis ? 50 : 0)) / 2;
  const places = Math.min(2, Math.max(0, ...scene.values.flat().map((value) => (String(value).split('.')[1] || '').length)));
  const size = cell >= 130 ? 34 : cell >= 100 ? 28 : 24;

  const {step, previous} = stepAt(scene.steps, frame);
  const p = step ? glide(frame, step.cue, 16) : 1;
  const focus = (...names: string[]) => lerp(previous ? lit(previous, ...names) : lit(step, ...names), lit(step, ...names), p);
  const enter = ramp(frame, 0, 20);

  return (
    <Evidence scene={scene} frame={frame} title={scene.title}>
      <div data-va-box="card" style={{position: 'absolute', left, top, width: grid.w, height: grid.h, opacity: enter}}>
        {scene.columns.map((column, index) => (
          <div
            key={`c${index}`}
            data-va-text="axis"
            style={{position: 'absolute', left: LABEL_W + cell * index, top: 0, width: cell, height: HEADER_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS, fontSize: Math.min(30, size), fontWeight: 600, color: theme.text, opacity: lerp(0.4, 1, focus(column)), whiteSpace: 'nowrap'}}
          >
            {column}
          </div>
        ))}
        {scene.rows.map((name, rowIndex) => {
          const start = arrival(scene.steps, rowIndex, 6);
          const rowOn = focus(name);
          return (
            <div key={`r${rowIndex}`}>
              <div
                data-va-text="axis"
                style={{position: 'absolute', left: 0, top: HEADER_H + cell * rowIndex, width: LABEL_W - 24, height: cell, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontFamily: SANS, fontSize: Math.min(30, size), fontWeight: 600, color: theme.text, opacity: lerp(0.4, 1, rowOn), whiteSpace: 'nowrap'}}
              >
                {name}
              </div>
              {scene.columns.map((column, colIndex) => {
                const value = scene.values[rowIndex][colIndex];
                const t = Math.max(0, Math.min(1, (value - low) / (high - low || 1)));
                // Cells warm from left to right as their row arrives.
                const filled = start === null ? 0 : glide(frame, start + colIndex * 4, 22);
                const shade = lerp(DIM, 1, focus(name, column));
                return (
                  <div
                    key={colIndex}
                    style={{
                      position: 'absolute',
                      left: LABEL_W + cell * colIndex + 3,
                      top: HEADER_H + cell * rowIndex + 3,
                      width: cell - 6,
                      height: cell - 6,
                      borderRadius: 10,
                      boxSizing: 'border-box',
                      border: `1px solid ${theme.panelBorder}`,
                      backgroundColor: filled > 0 ? warm(t * filled) : theme.panel,
                      opacity: shade,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {scene.numbers && filled > 0 ? (
                      <span data-va-text="value" style={{fontFamily: MONO, fontSize: size, fontWeight: 700, color: t * filled > 0.55 ? theme.bg : theme.text, opacity: Math.min(1, filled * 1.5), fontVariantNumeric: 'tabular-nums'}}>
                        {partWay(Number(value.toFixed(places)), filled)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {scene.axis ? (
        <div data-va-text="axis" style={{position: 'absolute', left: body.x, width: body.w, top: top + grid.h + 18, textAlign: 'center', fontFamily: MONO, fontSize: 24, fontWeight: 500, letterSpacing: '0.06em', color: theme.muted, opacity: ramp(frame, 12, 20)}}>
          {scene.axis}
        </div>
      ) : null}
    </Evidence>
  );
};
