import type React from 'react';
import {type CalculateMetadataFunction, Composition} from 'remotion';
import './fonts';
import type {ExplainerProps} from './types';
import {Video} from './Video';

// Real videos arrive through --props (written by `va render`); this is only the Studio placeholder.
const placeholder: ExplainerProps = {
  title: 'visualize-anything',
  fps: 30,
  width: 1920,
  height: 1080,
  captions: true,
  totalFrames: 90,
  scenes: [
    {
      id: 'placeholder',
      kind: 'title',
      heading: null,
      from: 0,
      frames: 90,
      beats: [],
      kicker: 'visualize-anything',
      title: 'No storyboard loaded',
      subtitle: 'Run `va studio <project>` or `va render <project>`.',
    },
  ],
};

const calculateMetadata: CalculateMetadataFunction<ExplainerProps> = ({props}) => ({
  durationInFrames: Math.max(1, props.totalFrames),
  fps: props.fps,
  width: props.width,
  height: props.height,
});

export const Root: React.FC = () => (
  <Composition
    id="Explainer"
    component={Video}
    durationInFrames={90}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={placeholder}
    calculateMetadata={calculateMetadata}
  />
);
