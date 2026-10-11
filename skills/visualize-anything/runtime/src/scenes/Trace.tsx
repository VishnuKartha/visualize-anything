import {Video} from '@remotion/media';
import type React from 'react';
import {staticFile} from 'remotion';
import type {TraceScene} from '../types';
import {CodePanel} from './Code';

const GAP = 40;

/**
 * The code and what it does, at once: the highlight steps through the lines on the left while the
 * animation on the right shows each line's effect on the data. Both follow the same narration.
 */
export const TraceView: React.FC<{scene: TraceScene}> = ({scene}) => {
  const {clip} = scene;
  const code = {x: 60, y: clip.y, w: clip.x - GAP - 60, h: clip.height};
  return (
    <>
      <CodePanel scene={scene} region={code} minWidth={code.w} minFont={24} />
      <div style={{position: 'absolute', left: clip.x, top: clip.y, width: clip.width, height: clip.height}}>
        <Video src={staticFile(scene.video)} muted style={{width: clip.width, height: clip.height, objectFit: 'contain', mixBlendMode: 'lighten'}} />
      </div>
    </>
  );
};
