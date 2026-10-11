import type React from 'react';
import {useCurrentFrame} from 'remotion';
import {SANS, ramp, theme} from '../theme';
import type {QuoteScene} from '../types';
import {AREA, Evidence, arrival, bodyOf, kicker} from './parts';

// The source in its own words, for when the wording is the evidence. The sentence is set large and
// arrives a word at a time; the phrases that matter are marked as the voice reaches them, the way
// a reader runs a highlighter over the line they will come back to.

const PER_WORD = 2;

export const QuoteView: React.FC<{scene: QuoteScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const body = bodyOf(scene, null);
  const words = scene.quote.split(/\s+/).filter(Boolean);
  const size = words.length > 34 ? 46 : words.length > 22 ? 54 : words.length > 12 ? 64 : 76;
  const start = 10;
  const marked = (index: number) => scene.highlights.findIndex(([first, last]) => index >= first && index <= last);
  const rule = ramp(frame, start + words.length * PER_WORD, 26);
  return (
    <Evidence scene={scene} frame={frame}>
      <div data-va-box="card" style={{position: 'absolute', left: AREA.x + 60, top: body.y, width: AREA.w - 120, height: body.h, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{fontFamily: 'Georgia, serif', fontSize: 260, lineHeight: 0.7, height: 120, color: theme.accent, opacity: ramp(frame, 2, 18) * 0.9}}>“</div>
        <div data-va-text="quote" style={{fontFamily: SANS, fontSize: size, fontWeight: 600, lineHeight: 1.36, letterSpacing: '-0.02em', color: theme.text, maxWidth: 1520}}>
          {words.map((word, index) => {
            const p = ramp(frame, start + index * PER_WORD, 14);
            const phrase = marked(index);
            // A phrase is marked from its first word to its last, each word a beat after the one before.
            const at = phrase < 0 ? null : arrival(scene.steps, phrase, 0);
            const swept = at === null ? 0 : ramp(frame, at + (index - scene.highlights[phrase][0]) * 3, 14);
            const joins = phrase >= 0 && index < scene.highlights[phrase][1];
            const first = phrase >= 0 && index === scene.highlights[phrase][0];
            return (
              <span key={index}>
                <span
                  style={{
                    display: 'inline-block',
                    opacity: p,
                    translate: `0 ${(1 - p) * 18}px`,
                    whiteSpace: 'pre',
                    // One mark from the phrase's first word to its last: each word's piece butts against the next.
                    borderRadius: phrase < 0 ? 0 : `${first ? '8px' : 0} ${joins ? 0 : '8px'} ${joins ? 0 : '8px'} ${first ? '8px' : 0}`,
                    color: swept > 0.5 ? theme.accent : theme.text,
                    backgroundImage: `linear-gradient(${theme.accent}30, ${theme.accent}30)`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: `${swept * 100}% 100%`,
                  }}
                >
                  {word}
                  {joins ? ' ' : ''}
                </span>
                {joins ? '' : ' '}
              </span>
            );
          })}
        </div>
        <div style={{width: rule * 160, height: 6, borderRadius: 3, backgroundColor: theme.accent, margin: '44px 0 26px'}} />
        {scene.attribution ? (
          <div data-va-text="attribution" style={{...kicker(28), color: theme.muted, opacity: rule}}>
            {scene.attribution}
          </div>
        ) : null}
      </div>
    </Evidence>
  );
};
