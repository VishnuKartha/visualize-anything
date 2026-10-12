import type React from 'react';
import {useCurrentFrame} from 'remotion';
import {MONO, SANS, glide, lerp, ramp, theme} from '../theme';
import type {Step, TableScene} from '../types';
import {Evidence, arrival, bodyOf, climbing, entered, stepAt} from './parts';

// The rows of a results table the sentence compares. The header stands from the start, so the
// viewer knows what is being measured; rows arrive as the voice reaches them, their numbers counting
// up, and the source's own row is marked so the eye lands on it. `focus` names the rows or columns
// the sentence is about; the rest step back.

const CAPTION = 64;
const HEADER = 92;
const DIM = 0.38;

/** How lit a row or column is under a step's focus: everything, when nothing is singled out. */
const lit = (step: Step | undefined, name: string) => (!Array.isArray(step?.focus) || step.focus.includes(name) ? 1 : 0);

export const TableView: React.FC<{scene: TableScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const body = bodyOf(scene, scene.title);
  const {step, previous} = stepAt(scene.steps, frame);
  const p = step ? glide(frame, step.cue, 16) : 1;
  const focus = (name: string) => lerp(previous ? lit(previous, name) : lit(step, name), lit(step, name), p);
  const singled = Array.isArray(step?.focus) || Array.isArray(previous?.focus);

  const room = body.h - (scene.caption ? CAPTION : 0);
  const rowHeight = Math.min(112, (room - HEADER) / scene.rows.length);
  const height = HEADER + rowHeight * scene.rows.length;
  const top = body.y + (room - height) / 2;
  const size = rowHeight >= 100 ? 38 : 32;
  // The first column names each row and takes the room a name needs; the measurements share the rest.
  const first = scene.columns.length > 3 ? 0.34 : 0.4;
  const widths = scene.columns.map((_, index) => (index === 0 ? first : (1 - first) / (scene.columns.length - 1)));
  const enter = ramp(frame, 0, 20);

  return (
    <Evidence scene={scene} frame={frame} title={scene.title}>
      <div
        data-va-box="card"
        style={{
          position: 'absolute',
          left: body.x,
          top,
          width: body.w,
          height,
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
        <div style={{display: 'flex', height: HEADER, alignItems: 'center', borderBottom: `2px solid ${theme.dim}`}}>
          {scene.columns.map((column, index) => {
            const marked = scene.highlight.includes(column);
            return (
              <div
                key={column}
                data-va-text="column"
                style={{
                  width: `${widths[index] * 100}%`,
                  boxSizing: 'border-box',
                  padding: '0 40px',
                  textAlign: index === 0 ? 'left' : 'right',
                  fontFamily: MONO,
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: marked ? theme.accent : theme.muted,
                  opacity: lerp(0.5, 1, focus(column)),
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {column}
              </div>
            );
          })}
        </div>
        {scene.rows.map((cells, rowIndex) => {
          const name = cells[0];
          const best = scene.best === name;
          const arrived = entered(scene.steps, rowIndex, frame, 20, 6);
          const start = arrival(scene.steps, rowIndex, 6);
          const counting = start === null ? 0 : ramp(frame, start, 28);
          const on = Math.max(focus(name), singled ? 0 : 1);
          return (
            <div
              key={name}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                height: rowHeight,
                borderTop: rowIndex ? `1px solid ${theme.panelBorder}` : 'none',
                backgroundColor: best ? `${theme.accent}1f` : 'transparent',
                opacity: arrived * lerp(DIM, 1, on),
                translate: `${(1 - arrived) * 40}px 0`,
              }}
            >
              {best ? <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 8 * arrived, backgroundColor: theme.accent}} /> : null}
              {cells.map((cell, cellIndex) => {
                const column = scene.columns[cellIndex];
                const marked = scene.highlight.includes(column);
                const strong = best || marked;
                return (
                  <div
                    key={cellIndex}
                    data-va-text={cellIndex === 0 ? 'label' : 'value'}
                    style={{
                      width: `${widths[cellIndex] * 100}%`,
                      boxSizing: 'border-box',
                      padding: '0 40px',
                      textAlign: cellIndex === 0 ? 'left' : 'right',
                      fontFamily: SANS,
                      fontSize: size,
                      fontWeight: cellIndex === 0 ? 700 : strong ? 800 : 500,
                      color: best && (cellIndex === 0 || marked) ? theme.accent : theme.text,
                      opacity: cellIndex === 0 || singled ? 1 : lerp(0.75, 1, Math.max(focus(column), marked ? 1 : 0)),
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {cellIndex === 0 ? cell : climbing(cell, counting)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {scene.caption ? (
        <div
          data-va-text="caption"
          style={{position: 'absolute', left: body.x, width: body.w, top: top + height + 22, textAlign: 'center', fontFamily: SANS, fontSize: 28, fontWeight: 500, color: theme.muted, opacity: ramp(frame, 12, 20)}}
        >
          {scene.caption}
        </div>
      ) : null}
    </Evidence>
  );
};
