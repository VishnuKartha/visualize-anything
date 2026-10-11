import type React from 'react';
import {type CalculateMetadataFunction, Composition} from 'remotion';
import './fonts';
import {Cover, LABEL_HEIGHT, Sheet} from './Sheet';
import {STAGE} from './theme';
import type {CoverProps, ExplainerProps, SheetProps} from './types';
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
      kind: 'credit',
      heading: null,
      from: 0,
      frames: 90,
      beats: [],
      steps: [],
      kicker: 'visualize-anything',
      title: 'No storyboard loaded',
      subtitle: 'Run `va studio <project>` or `va render <project>`.',
    },
  ],
};

const videoMetadata: CalculateMetadataFunction<ExplainerProps> = ({props}) => ({
  durationInFrames: Math.max(1, props.totalFrames),
  fps: props.fps,
  width: props.width,
  height: props.height,
});

const sheetMetadata: CalculateMetadataFunction<SheetProps> = ({props}) => {
  const {cols, cellWidth, shots} = props.sheet;
  const rows = Math.max(1, Math.ceil(shots.length / cols));
  return {
    // The full timeline, not one frame: a Sequence only mounts inside its composition's duration.
    durationInFrames: Math.max(1, props.totalFrames),
    fps: props.fps,
    width: cols * cellWidth,
    height: Math.round(rows * (cellWidth * (STAGE.height / STAGE.width) + LABEL_HEIGHT)),
  };
};

const coverMetadata: CalculateMetadataFunction<CoverProps> = ({props}) => ({
  durationInFrames: Math.max(1, props.totalFrames),
  fps: props.fps,
  width: STAGE.width,
  height: STAGE.height,
});

export const Root: React.FC = () => (
  <>
    <Composition id="Explainer" component={Video} durationInFrames={90} fps={30} width={1920} height={1080} defaultProps={placeholder} calculateMetadata={videoMetadata} />
    <Composition
      id="Sheet"
      component={Sheet}
      durationInFrames={1}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{...placeholder, sheet: {cols: 1, cellWidth: 1920, audit: false, shots: [{frame: 30, label: 'placeholder'}]}}}
      calculateMetadata={sheetMetadata}
    />
    <Composition
      id="Cover"
      component={Cover}
      durationInFrames={1}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{...placeholder, cover: {text: 'No *storyboard* loaded', shot: null}}}
      calculateMetadata={coverMetadata}
    />
  </>
);
