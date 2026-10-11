import type React from 'react';
import {AbsoluteFill} from 'remotion';
import {MONO, SANS, beatAt, glide, ramp, theme} from '../theme';
import type {Step, Tone} from '../types';
import {parseStatement} from './Title';

// Evidence scenes (a number, a contrast, a chart, a quote, a figure) share one frame: an optional
// line of title, the picture under it, and an optional callout under that, all clear of the heading
// above and the captions below. Their parts arrive by a step's `show`, so the picture changes with
// the sentence and never sits finished while the voice is still getting to it.

export const AREA = {x: 110, y: 124, w: 1700, h: 770};
const TITLE_ROW = 104;
const NOTE_ROW = 104;

export type Region = {x: number; y: number; w: number; h: number};

export const TONE: Record<Tone, string> = {positive: theme.accent, negative: theme.rose, caution: theme.amber, neutral: theme.cyan};

/** Where the picture goes, once the title row and the callout row have taken what they need. */
export const bodyOf = (scene: {steps: Step[]}, title: string | null): Region => {
  const top = AREA.y + (title ? TITLE_ROW : 0);
  const bottom = AREA.y + AREA.h - (scene.steps.some((step) => step.note) ? NOTE_ROW : 0);
  return {x: AREA.x, y: top, w: AREA.w, h: bottom - top};
};

export const LEAVE = {from: 30, over: 22}; // frames before the scene's end the picture starts to go, and how long it takes

/**
 * The frame every evidence scene sits in. Bright things (a number a third of the frame high, a
 * figure on white) are let go slowly and before the cut: the short fade between scenes is sized
 * for dark panels, and taking a white page out in six frames reads as a flash.
 */
export const Evidence: React.FC<{scene: {steps: Step[]; frames: number; fadeOut?: boolean}; frame: number; title?: string | null; children: React.ReactNode}> = ({scene, frame, title, children}) => (
  <AbsoluteFill style={{opacity: scene.fadeOut === false ? 1 : 1 - glide(frame, scene.frames - LEAVE.from, LEAVE.over)}}>
    {title ? <SceneTitle text={title} frame={frame} /> : null}
    {children}
    <Note steps={scene.steps} frame={frame} />
  </AbsoluteFill>
);

/** A number on its way to its value, never changing width: 36 counts up from 10, 25,000,000 from 10,000,000. */
export const climbing = (text: string, progress: number) => {
  const match = text.match(/^(\D*)(\d[\d,]*)((?:\.\d+)?\D*)$/);
  if (!match || progress >= 1) return text;
  const digits = match[2].replace(/,/g, '');
  if (digits.length < 2) return text;
  const from = 10 ** (digits.length - 1);
  const shown = Math.round(from + (Number(digits) - from) * progress);
  return `${match[1]}${match[2].includes(',') ? shown.toLocaleString('en-US') : String(shown)}${match[3]}`;
};

/** The step on screen, the one before it, and how far the change from one to the other has come. */
export const stepAt = (steps: Step[], frame: number, length = 14) => {
  const current = beatAt(steps, frame);
  const step = steps[current];
  return {current, step, previous: current > 0 ? steps[current - 1] : undefined, p: step ? ramp(frame, step.cue, length) : 1};
};

/**
 * When the part at `index` arrives: the cue of the first step whose `show` reaches it. Parts that
 * arrive in one step follow each other a few frames apart, so they are read in order.
 */
export const arrival = (steps: Step[], index: number, stagger = 7) => {
  const at = steps.findIndex((step) => (step.show ?? 0) > index);
  if (at < 0) return null;
  const before = at > 0 ? (steps[at - 1].show ?? 0) : 0;
  return steps[at].cue + (at === 0 ? 6 : 0) + (index - before) * stagger;
};

/**
 * How long a number takes to count up to its value: nearly half the time the step that brings it
 * has to itself. A long sentence that builds to its number is then said over a number still on
 * its way, not over a card that finished in the first second.
 */
export const countFrames = (steps: Step[], index: number) => {
  const step = steps.find((entry) => (entry.show ?? 0) > index);
  return Math.round(Math.min(110, Math.max(28, (step?.cueFrames ?? 0) * 0.45)));
};

/** 0→1 as the part at `index` comes in; 0 for a part no step shows. */
export const entered = (steps: Step[], index: number, frame: number, length = 18, stagger = 7) => {
  const start = arrival(steps, index, stagger);
  return start === null ? 0 : ramp(frame, start, length);
};

/** Roughly how wide a string sets in extra-bold Inter, in ems. Enough to size a number to its box. */
export const emWidth = (text: string) =>
  [...text].reduce((sum, char) => sum + (/[0-9]/.test(char) ? 0.63 : /[.,:;'’ ]/.test(char) ? 0.3 : /[A-Z%~+−–-]/.test(char) ? 0.7 : 0.57), 0);

/** A number as it was written (its decimals, its thousands separators), part of the way there and no narrower. */
export const partWay = (value: number, progress: number) => {
  const places = (String(value).split('.')[1] || '').length;
  const from = value >= 10 ? 10 ** Math.floor(Math.log10(value)) : 0;
  return (from + (value - from) * Math.min(1, progress)).toLocaleString('en-US', {minimumFractionDigits: places, maximumFractionDigits: places});
};

export const SceneTitle: React.FC<{text: string; frame: number}> = ({text, frame}) => {
  const p = ramp(frame, 4, 18);
  return (
    <div
      data-va-box="card-title"
      data-va-text="title"
      style={{
        position: 'absolute',
        left: AREA.x,
        top: AREA.y,
        maxWidth: AREA.w,
        fontFamily: SANS,
        fontSize: 50,
        fontWeight: 800,
        lineHeight: 1.15,
        letterSpacing: '-0.025em',
        color: theme.text,
        opacity: p,
        translate: `0 ${(1 - p) * 24}px`,
        whiteSpace: 'nowrap',
      }}
    >
      {parseStatement(text.replace(/\n/g, ' ')).map((word, index) => (
        <span key={index} style={{color: word.strong ? theme.accent : theme.text}}>
          {word.text}{' '}
        </span>
      ))}
    </div>
  );
};

/** The callout of the step on screen, under the picture. A note that carries over from the last step stays put. */
export const Note: React.FC<{steps: Step[]; frame: number}> = ({steps, frame}) => {
  const {step, previous, p} = stepAt(steps, frame);
  const leaving = !step?.note && previous?.note ? previous.note : null;
  const text = step?.note || leaving;
  if (!text) return null;
  const opacity = leaving ? 1 - p : previous?.note === step?.note ? 1 : p;
  if (opacity <= 0) return null;
  return (
    <div style={{position: 'absolute', left: AREA.x, width: AREA.w, top: AREA.y + AREA.h - 76, display: 'flex', justifyContent: 'center'}}>
      <div
        data-va-text="note"
        data-va-box="note"
        style={{
          maxWidth: 1300,
          padding: '16px 26px',
          borderRadius: 14,
          backgroundColor: '#0f1d33',
          border: `1px solid ${theme.amber}66`,
          borderLeft: `6px solid ${theme.amber}`,
          fontFamily: SANS,
          fontSize: 32,
          fontWeight: 600,
          lineHeight: 1.25,
          color: theme.text,
          opacity,
          translate: `0 ${(1 - opacity) * 14}px`,
          boxShadow: '0 16px 50px rgba(0,0,0,0.5)',
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** A tick, a cross, a warning, or a dash, drawn on as it arrives. */
export const Mark: React.FC<{tone: Tone; progress: number; size?: number}> = ({tone, progress, size = 44}) => {
  const color = TONE[tone];
  const path = tone === 'positive' ? 'M7 12.5l3.2 3.2L17 9' : tone === 'negative' ? 'M8 8l8 8M16 8l-8 8' : tone === 'caution' ? 'M12 7v6M12 16.6v0.4' : 'M9 12h6';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{flex: 'none', opacity: Math.min(1, progress * 2)}}>
      <circle cx="12" cy="12" r="11" fill={`${color}26`} stroke={`${color}99`} strokeWidth="1" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - progress} />
    </svg>
  );
};

export const kicker = (size = 26): React.CSSProperties => ({fontFamily: MONO, fontSize: size, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase'});
