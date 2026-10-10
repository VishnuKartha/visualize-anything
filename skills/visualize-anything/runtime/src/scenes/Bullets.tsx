import type React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {MONO, SANS, beatAt, ramp, theme} from '../theme';
import type {BulletsScene} from '../types';

/** How many items are on screen during each beat: an explicit `show`, else one more per beat. */
const visibleCounts = (scene: BulletsScene) =>
  scene.beats.map((beat, index) => {
    if (beat.show !== null) return Math.min(scene.items.length, Math.max(0, beat.show));
    const isLast = index === scene.beats.length - 1;
    return isLast ? scene.items.length : Math.min(scene.items.length, index + 1);
  });

export const BulletsView: React.FC<{scene: BulletsScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const counts = visibleCounts(scene);
  const current = beatAt(scene.beats, frame);
  const previousCount = current > 0 ? counts[current - 1] : 0;
  const dense = scene.items.length > 4;
  return (
    <AbsoluteFill style={{justifyContent: 'center', padding: '60px 190px 150px'}}>
      {scene.title ? (
        <div style={{fontFamily: SANS, fontSize: 68, fontWeight: 800, letterSpacing: '-0.03em', color: theme.text, marginBottom: 54}}>
          {scene.title}
        </div>
      ) : null}
      <div style={{display: 'flex', flexDirection: 'column', gap: dense ? 26 : 38}}>
        {scene.items.map((item, index) => {
          // An item enters at the cue of the first beat that includes it.
          const firstBeat = counts.findIndex((count) => count > index);
          const enter = firstBeat < 0 ? 0 : ramp(frame, scene.beats[firstBeat]?.cue ?? 0, 16);
          const isNew = index >= previousCount && index < counts[current];
          const settled = counts[current] === previousCount;
          const emphasis = isNew || settled ? 1 : 0.5;
          return (
            <div
              key={item}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 30,
                opacity: enter * emphasis,
                translate: `${(1 - enter) * 40}px 0`,
              }}
            >
              <span style={{fontFamily: MONO, fontSize: dense ? 30 : 34, fontWeight: 600, color: theme.accent, minWidth: 56}}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span style={{fontFamily: SANS, fontSize: dense ? 42 : 50, fontWeight: 500, lineHeight: 1.25, color: theme.text}}>
                {item}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
