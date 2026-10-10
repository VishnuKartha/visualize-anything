import type React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {MONO, SANS, ramp, theme} from '../theme';
import type {TitleScene} from '../types';

export const TitleView: React.FC<{scene: TitleScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const rise = (delay: number) => {
    const p = ramp(frame, delay, 22);
    return {opacity: p, translate: `0 ${(1 - p) * 36}px`};
  };
  return (
    <AbsoluteFill style={{justifyContent: 'center', padding: '0 170px 80px'}}>
      {scene.kicker ? (
        <div
          style={{
            ...rise(2),
            fontFamily: MONO,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: theme.accent,
            marginBottom: 30,
          }}
        >
          {scene.kicker}
        </div>
      ) : null}
      <div
        style={{
          ...rise(6),
          fontFamily: SANS,
          fontSize: scene.title.length > 34 ? 92 : 116,
          fontWeight: 800,
          lineHeight: 1.04,
          letterSpacing: '-0.035em',
          color: theme.text,
          maxWidth: 1500,
          textWrap: 'balance',
        }}
      >
        {scene.title}
      </div>
      <div style={{width: ramp(frame, 12, 30) * 180, height: 6, borderRadius: 3, backgroundColor: theme.accent, margin: '44px 0 36px'}} />
      {scene.subtitle ? (
        <div
          style={{
            ...rise(14),
            fontFamily: SANS,
            fontSize: 40,
            fontWeight: 400,
            lineHeight: 1.35,
            color: theme.muted,
            maxWidth: 1250,
            textWrap: 'balance',
          }}
        >
          {scene.subtitle}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
