import type React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {MONO, SANS, STAGE, beatAt, ramp, theme} from '../theme';
import type {CodeToken, Step, TitleScene} from '../types';

// An opening has one job: make the viewer want the answer. While the narration delivers its hook,
// the screen carries that hook as a large statement whose words land as they are spoken, and the
// statement stands until the scene ends. There is no title card here: what the video explained is
// named at the end, by a credit scene. Behind the statement, the code the video is about drifts
// past, so the frame is never still.

export type Word = {text: string; strong: boolean; line: number};

/** "*1,000,000* items" → words, with the starred ones marked for emphasis. Newlines start a new line. */
export const parseStatement = (text: string): Word[] => {
  const words: Word[] = [];
  text.split('\n').forEach((line, lineIndex) => {
    let strong = false;
    for (const part of line.split(/(\*)/)) {
      if (part === '*') {
        strong = !strong;
        continue;
      }
      const pieces = part.split(/\s+/).filter(Boolean);
      // Punctuation straight after a starred word belongs to it: "*20*." is "20.", not "20 .".
      if (pieces.length && words.length && !/^\s/.test(part) && /^[.,;:!?)]+$/.test(pieces[0]) && words[words.length - 1].line === lineIndex) {
        words[words.length - 1].text += pieces.shift();
      }
      for (const word of pieces) words.push({text: word, strong, line: lineIndex});
    }
  });
  return words;
};

/** A number that counts up to its value as it arrives: "1,000,000" passes through "437,912". */
const counted = (text: string, progress: number) => {
  const match = text.match(/^(\D*)(\d[\d,]*)(\D*)$/);
  if (!match || progress >= 1) return text;
  const value = Number(match[2].replace(/,/g, ''));
  if (!Number.isFinite(value) || value < 10) return text;
  const shown = Math.round(value * progress);
  return `${match[1]}${match[2].includes(',') ? shown.toLocaleString('en-US') : String(shown)}${match[3]}`;
};

const Statement: React.FC<{words: Word[]; enters: number[]; frame: number; leaving: number; size: number}> = ({words, enters, frame, leaving, size}) => {
  const lines = [...new Set(words.map((word) => word.line))];
  return (
    <div
      data-va-box="title"
      style={{
        fontFamily: SANS,
        fontSize: size,
        fontWeight: 800,
        lineHeight: 1.08,
        letterSpacing: '-0.035em',
        color: theme.text,
        maxWidth: 1560,
        opacity: 1 - leaving,
        translate: `0 ${-leaving * 40}px`,
      }}
    >
      {lines.map((line) => (
        <div key={line} style={{textWrap: 'balance'}}>
          {words.map((word, index) => {
            if (word.line !== line) return null;
            const p = ramp(frame, enters[index], 16);
            const count = interpolate(frame, [enters[index], enters[index] + 26], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
            return (
              <span key={index}>
                <span
                  style={{
                    display: 'inline-block',
                    opacity: p,
                    translate: `0 ${(1 - p) * 46}px`,
                    color: word.strong ? theme.accent : theme.text,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {word.strong ? counted(word.text, count) : word.text}
                </span>{' '}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** The code under discussion, faint and slowly rising, on the side the text does not use. */
const Ambient: React.FC<{code: CodeToken[][]; frame: number}> = ({code, frame}) => {
  const lineHeight = 46;
  const loop = code.length * lineHeight;
  const offset = (frame * 0.55) % loop;
  const fade = 'linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)';
  const side = 'linear-gradient(to right, transparent 0%, #000 55%)';
  return (
    <div
      style={{
        position: 'absolute',
        left: 1000,
        top: 0,
        width: STAGE.width - 1000,
        height: STAGE.height,
        overflow: 'hidden',
        opacity: 0.13,
        maskImage: `${fade}, ${side}`,
        maskComposite: 'intersect',
        WebkitMaskImage: `${fade}, ${side}`,
        WebkitMaskComposite: 'source-in',
      }}
    >
      <div style={{translate: `150px ${-offset}px`, fontFamily: MONO, fontSize: 28, lineHeight: `${lineHeight}px`, whiteSpace: 'pre'}}>
        {/* Twice over, so the drift can loop without a seam. */}
        {[0, 1, 2].flatMap((copy) =>
          code.map((tokens, index) => (
            <div key={`${copy}-${index}`} style={{height: lineHeight}}>
              {tokens.map((token, tokenIndex) => (
                <span key={tokenIndex} style={{color: token.color}}>
                  {token.text}
                </span>
              ))}
            </div>
          )),
        )}
      </div>
    </div>
  );
};

/**
 * When each word of a statement first appeared. A statement that extends the one before it
 * ("1,000,000 items" → "1,000,000 items / 20 comparisons") keeps its earlier words where they are.
 */
const entrances = (steps: Step[], index: number, words: Word[]) => {
  // Walk back to where this statement began.
  let first = index;
  while (first > 0 && steps[first - 1].text && steps[first].text?.startsWith(steps[first - 1].text as string)) first -= 1;
  const enters: number[] = [];
  let have = 0;
  for (let at = first; at <= index; at += 1) {
    const count = Math.min(words.length, parseStatement(steps[at].text as string).length);
    // A fresh statement waits a moment for the one before it to clear.
    const base = steps[at].cue + (at === first && at > 0 ? 7 : 0);
    for (let i = have; i < count; i += 1) enters[i] = base + (i - have) * 3;
    have = Math.max(have, count);
  }
  return enters;
};

export const TitleView: React.FC<{scene: TitleScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  // Only the moments that put a statement on screen. A beat without one leaves the last standing.
  const steps = scene.steps.filter((entry) => entry.text);
  const current = steps.length ? beatAt(steps, frame) : -1;
  // One size for the whole scene, set by its longest statement, so a line that gains a second does not shrink and reflow.
  const size = Math.max(0, ...steps.map((entry) => parseStatement(entry.text as string).length)) > 9 ? 92 : 118;
  const step = current >= 0 ? steps[current] : null;
  const previous = current > 0 ? steps[current - 1] : null;
  const changed = step ? ramp(frame, step.cue, 9) : 1;
  // A statement that grows out of the previous one is the same statement; nothing leaves.
  const continues = Boolean(step?.text && previous?.text && step.text.startsWith(previous.text));

  // A slow push-in over the whole scene, and a glow that wanders: the opening is never a still.
  const push = interpolate(frame, [0, scene.frames], [1, 1.035]);
  const glowX = 30 + Math.sin(frame / 70) * 8;
  const glowY = 45 + Math.cos(frame / 90) * 10;

  const layer = (target: Step | null, key: string, leaving: number) => {
    if (!target) return null;
    const index = steps.indexOf(target);
    return (
      <div key={key} style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 170px 80px'}}>
        <Statement words={parseStatement(target.text as string)} enters={entrances(steps, index, parseStatement(target.text as string))} frame={frame} leaving={leaving} size={size} />
      </div>
    );
  };

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(700px 520px at ${glowX}% ${glowY}%, ${theme.accent}1c, transparent 70%)`,
        }}
      />
      {scene.ambient ? <Ambient code={scene.ambient} frame={frame} /> : null}
      <div style={{position: 'absolute', inset: 0, scale: String(push), transformOrigin: '18% 50%'}}>
        {previous && !continues && changed < 1 ? layer(previous, `out-${current}`, changed) : null}
        {step ? layer(step, `in-${current}`, 0) : null}
      </div>
    </AbsoluteFill>
  );
};
