import type React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {MONO, SANS, ramp, theme} from '../theme';
import type {CreditScene} from '../types';
import {parseStatement} from './Title';

// The name of what is explained. It is shown twice at most: as a title card straight after the
// opening ("need": "name"), once the viewer knows what the work is for, and as the last thing in
// the video, with where to find it. Never first: a name means nothing before its reason.

export const CreditView: React.FC<{scene: CreditScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const start = 8;
  const rise = (delay: number) => {
    const p = ramp(frame, start + delay, 22);
    return {opacity: p, translate: `0 ${(1 - p) * 36}px`};
  };
  const words = parseStatement(scene.title.replace(/\n/g, ' '));
  const plain = scene.title.replace(/\*/g, '');
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(700px 520px at 30% 45%, ${theme.accent}1c, transparent 70%)`}} />
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 170px 80px'}}>
        {scene.kicker ? (
          <div
            data-va-box="kicker"
            style={{...rise(0), fontFamily: MONO, fontSize: 26, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: theme.accent, marginBottom: 30}}
          >
            {scene.kicker}
          </div>
        ) : null}
        <div
          data-va-box="title"
          style={{
            textWrap: 'balance',
            fontFamily: SANS,
            fontSize: plain.length > 34 ? 92 : 116,
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: '-0.035em',
            color: theme.text,
            maxWidth: 1500,
          }}
        >
          {words.map((word, index) => {
            const p = ramp(frame, start + 4 + index * 3, 18);
            return (
              <span key={index}>
                <span style={{display: 'inline-block', opacity: p, translate: `0 ${(1 - p) * 42}px`, color: word.strong ? theme.accent : theme.text}}>{word.text}</span>{' '}
              </span>
            );
          })}
        </div>
        <div style={{width: ramp(frame, start + 10 + words.length * 3, 30) * 180, height: 6, borderRadius: 3, backgroundColor: theme.accent, margin: '44px 0 36px'}} />
        {scene.subtitle ? (
          <div
            data-va-text="subtitle"
            data-va-box="subtitle"
            style={{...rise(14 + words.length * 3), fontFamily: SANS, fontSize: 40, fontWeight: 400, lineHeight: 1.35, color: theme.muted, maxWidth: 1250, textWrap: 'balance'}}
          >
            {scene.subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
