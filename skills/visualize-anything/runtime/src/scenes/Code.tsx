import type React from 'react';
import {useCurrentFrame} from 'remotion';
import {MONO, SANS, beatAt, lerp, ramp, theme} from '../theme';
import type {CodeScene, Step, TraceScene} from '../types';

type Region = {x: number; y: number; w: number; h: number};

// The region a code scene may occupy; the panel shrinks to its content and centres inside it.
const REGION = {x: 150, y: 112, w: 1620, h: 790};
const NOTE_ROW = 104; // space kept under the panel when any beat carries a note
const HEADER = 58;
const PAD_X = 34;
const PAD_Y = 26;
const CHAR = 0.6; // JetBrains Mono advance width, in em
const DIM = 0.32;

const inRanges = (line: number, ranges: [number, number][]) => ranges.some(([a, b]) => line >= a && line <= b);

/** Where a beat wants the code scrolled, or null when it has no opinion. */
const scrollFor = (beat: Step | undefined, startLine: number, lineHeight: number, viewHeight: number, contentHeight: number) => {
  if (!beat?.lines?.length || contentHeight <= viewHeight) return null;
  const first = Math.min(...beat.lines.map(([a]) => a)) - startLine;
  const last = Math.max(...beat.lines.map(([, b]) => b)) - startLine;
  const centre = ((first + last + 1) / 2) * lineHeight;
  return Math.min(Math.max(0, centre - viewHeight / 2), contentHeight - viewHeight);
};

export const CodeView: React.FC<{scene: CodeScene}> = ({scene}) => <CodePanel scene={scene} region={REGION} />;

/** A code panel that fits itself into `region`: as large as the code allows, centred, never wider than needed. */
export const CodePanel: React.FC<{scene: CodeScene | TraceScene; region: Region; minWidth?: number; minFont?: number}> = ({
  scene,
  region: REGION,
  minWidth = 1100,
  minFont = 24,
}) => {
  const frame = useCurrentFrame();
  const lineCount = scene.code.length;
  const widest = Math.max(1, ...scene.code.map((line) => line.reduce((n, token) => n + token.text.length, 0)));
  const gutterChars = String(scene.startLine + lineCount - 1).length + 3;
  const hasNotes = scene.steps.some((candidate) => candidate.note);
  const maxPanelHeight = REGION.h - (hasNotes ? NOTE_ROW : 0);
  const maxViewHeight = maxPanelHeight - HEADER - PAD_Y * 2;
  const fitWidth = (REGION.w - PAD_X * 2) / ((widest + gutterChars) * CHAR);
  const fitHeight = maxViewHeight / (lineCount * 1.6);
  const fontSize = Math.min(40, Math.max(minFont, Math.min(fitWidth, fitHeight)));
  const lineHeight = fontSize * 1.6;
  const contentHeight = lineCount * lineHeight;
  const viewHeight = Math.min(maxViewHeight, contentHeight);
  const PANEL = {
    w: Math.min(REGION.w, Math.max(minWidth, (widest + gutterChars) * CHAR * fontSize + PAD_X * 2 + 40)),
    h: viewHeight + HEADER + PAD_Y * 2,
    x: 0,
    y: 0,
  };
  PANEL.x = REGION.x + (REGION.w - PANEL.w) / 2;
  PANEL.y = REGION.y + (maxPanelHeight - PANEL.h) / 2;

  const current = beatAt(scene.steps, frame);
  const beat = scene.steps[current];
  const previous = current > 0 ? scene.steps[current - 1] : undefined;
  const p = beat ? ramp(frame, beat.cue, 14) : 1;

  // Scroll carries over from the last beat that asked for one.
  const scrollTargets: number[] = [];
  scene.steps.forEach((candidate, index) => {
    scrollTargets[index] = scrollFor(candidate, scene.startLine, lineHeight, viewHeight, contentHeight) ?? scrollTargets[index - 1] ?? 0;
  });
  const scroll = lerp(scrollTargets[current - 1] ?? scrollTargets[0] ?? 0, scrollTargets[current] ?? 0, p);

  const weight = (target: Step | undefined, line: number) => {
    if (!target?.lines) return {opacity: 1, bar: 0};
    return inRanges(line, target.lines) ? {opacity: 1, bar: 1} : {opacity: DIM, bar: 0};
  };
  const enter = ramp(frame, 0, 20);
  // Where the animation beside it carries on into the next scene, the code leaves on a fade, not a cut.
  const leave = scene.fadeOut === false ? 1 - ramp(frame, scene.frames - 10, 9) : 1;

  return (
    <>
    <div
      data-va-box="code"
      style={{
        position: 'absolute',
        left: PANEL.x,
        top: PANEL.y,
        width: PANEL.w,
        height: PANEL.h,
        borderRadius: 22,
        backgroundColor: theme.panel,
        border: `1px solid ${theme.panelBorder}`,
        boxShadow: '0 40px 120px rgba(0,0,0,0.55)',
        overflow: 'hidden',
        opacity: enter * leave,
        translate: `0 ${(1 - enter) * 30}px`,
      }}
    >
      <div
        style={{
          height: HEADER,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 26px',
          borderBottom: `1px solid ${theme.panelBorder}`,
          backgroundColor: '#0e172a',
        }}
      >
        {[theme.rose, theme.amber, theme.accent].map((color) => (
          <span key={color} style={{width: 14, height: 14, borderRadius: 7, backgroundColor: color, opacity: 0.85}} />
        ))}
        <span style={{marginLeft: 18, fontFamily: MONO, fontSize: 22, fontWeight: 500, color: theme.muted}}>{scene.title}</span>
        <span style={{marginLeft: 'auto', fontFamily: MONO, fontSize: 18, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.dim}}>
          {scene.lang}
        </span>
      </div>
      <div data-va-clip="code" style={{position: 'absolute', left: 0, right: 0, top: HEADER + PAD_Y, height: viewHeight, overflow: 'hidden'}}>
        <div data-va-text="code" style={{translate: `0 ${-scroll}px`, fontFamily: MONO, fontSize, lineHeight: `${lineHeight}px`}}>
          {scene.code.map((tokens, index) => {
            const line = scene.startLine + index;
            const from = weight(previous, line);
            const to = weight(beat, line);
            const opacity = lerp(from.opacity, to.opacity, p);
            const bar = lerp(from.bar, to.bar, p);
            return (
              <div key={line} style={{position: 'relative', height: lineHeight, whiteSpace: 'pre', paddingLeft: PAD_X}}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: bar,
                    backgroundColor: `${theme.accent}1f`,
                    borderLeft: `5px solid ${theme.accent}`,
                  }}
                />
                <span style={{position: 'relative', display: 'inline-block', width: `${gutterChars}ch`, color: bar > 0.5 ? theme.muted : theme.dim, opacity: Math.max(opacity, 0.6)}}>
                  {String(line).padStart(gutterChars - 3, ' ')}
                </span>
                <span style={{position: 'relative', opacity}}>
                  {tokens.map((token, tokenIndex) => (
                    <span key={tokenIndex} style={{color: token.color}}>
                      {token.text}
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
      {beat?.note ? (
        <div
          data-va-text="note"
          data-va-box="note"
          style={{
            position: 'absolute',
            right: 1920 - PANEL.x - PANEL.w,
            top: PANEL.y + PANEL.h + 24,
            maxWidth: Math.min(900, PANEL.w),
            padding: '16px 24px',
            borderRadius: 14,
            backgroundColor: '#0f1d33',
            border: `1px solid ${theme.accent}66`,
            borderLeft: `6px solid ${theme.accent}`,
            fontFamily: SANS,
            fontSize: 30,
            fontWeight: 600,
            lineHeight: 1.3,
            color: theme.text,
            opacity: p * enter * leave,
            translate: `0 ${(1 - p) * -14}px`,
            boxShadow: '0 16px 50px rgba(0,0,0,0.5)',
          }}
        >
          {beat.note}
        </div>
      ) : null}
    </>
  );
};
