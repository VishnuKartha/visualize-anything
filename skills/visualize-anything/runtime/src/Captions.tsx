import type React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {SANS, STAGE, theme} from './theme';
import type {Beat} from './types';

/** The phrase being spoken, with words lighting up as they are said. */
export const Captions: React.FC<{beats: Beat[]}> = ({beats}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const beat = [...beats].reverse().find((candidate) => frame >= candidate.from);
  if (!beat) return null;
  const t = (frame - beat.from) / fps;
  const phrase = beat.phrases.find((candidate) => t >= candidate.start - 0.05 && t < candidate.end + 0.15);
  if (!phrase) return null;
  return (
    <div style={{position: 'absolute', left: 0, width: STAGE.width, bottom: 44, display: 'flex', justifyContent: 'center'}}>
      <div
        style={{
          maxWidth: 1500,
          padding: '14px 30px',
          borderRadius: 16,
          backgroundColor: `${theme.bg}d9`,
          border: `1px solid ${theme.panelBorder}`,
          fontFamily: SANS,
          fontSize: 36,
          fontWeight: 600,
          lineHeight: 1.25,
          whiteSpace: 'nowrap',
        }}
      >
        {phrase.words.map((word, index) => (
          <span key={`${word.start}-${index}`} style={{color: t >= word.start - 0.03 ? theme.text : theme.dim}}>
            {word.text}
            {index + 1 < phrase.words.length ? ' ' : ''}
          </span>
        ))}
      </div>
    </div>
  );
};
