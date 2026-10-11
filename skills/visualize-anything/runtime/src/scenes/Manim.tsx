import {Video} from '@remotion/media';
import type React from 'react';
import {useContext} from 'react';
import {AbsoluteFill, staticFile} from 'remotion';
import {FadeContext} from '../StageContext';
import {STAGE} from '../theme';
import type {HyperframesScene, ManimScene} from '../types';

// The clip was rendered to this scene's exact frame count, so it plays straight through.
// Manim paints an opaque frame in the theme background, the darkest colour on screen, so a
// lighten blend lets the shared backdrop show through and the scene matches its neighbours.
export const ManimView: React.FC<{scene: ManimScene}> = ({scene}) => {
  const fade = useContext(FadeContext);
  return (
    <AbsoluteFill>
      <Video src={staticFile(scene.video)} muted style={{width: STAGE.width, height: STAGE.height, objectFit: 'contain', mixBlendMode: 'lighten', opacity: fade}} />
    </AbsoluteFill>
  );
};

// A HyperFrames clip paints the shared backdrop itself and has solid panels, so it is shown as is.
export const HyperframesView: React.FC<{scene: HyperframesScene}> = ({scene}) => (
  <AbsoluteFill>
    <Video src={staticFile(scene.video)} muted style={{width: STAGE.width, height: STAGE.height, objectFit: 'contain'}} />
  </AbsoluteFill>
);
