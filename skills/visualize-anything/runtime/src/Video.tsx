import {Audio} from '@remotion/media';
import type React from 'react';
import {AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions} from './Captions';
import {BulletsView} from './scenes/Bullets';
import {CodeView} from './scenes/Code';
import {DiagramView} from './scenes/Diagram';
import {ManimView} from './scenes/Manim';
import {TitleView} from './scenes/Title';
import {MONO, STAGE, theme} from './theme';
import type {ExplainerProps, Scene} from './types';

const GRID = 64;

const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: theme.bg,
      backgroundImage: [
        `radial-gradient(1200px 700px at 12% -10%, ${theme.accent}14, transparent 70%)`,
        `radial-gradient(1000px 700px at 100% 110%, ${theme.violet}12, transparent 70%)`,
        `linear-gradient(${theme.grid} 1px, transparent 1px)`,
        `linear-gradient(90deg, ${theme.grid} 1px, transparent 1px)`,
      ].join(','),
      backgroundSize: `100% 100%, 100% 100%, ${GRID}px ${GRID}px, ${GRID}px ${GRID}px`,
    }}
  />
);

const View: React.FC<{scene: Scene}> = ({scene}) => {
  switch (scene.kind) {
    case 'title':
      return <TitleView scene={scene} />;
    case 'bullets':
      return <BulletsView scene={scene} />;
    case 'code':
      return <CodeView scene={scene} />;
    case 'diagram':
      return <DiagramView scene={scene} />;
    case 'manim':
      return <ManimView scene={scene} />;
  }
};

/** Everything a scene needs besides its picture: the cut in and out, its heading, voice, and captions. */
const SceneShell: React.FC<{scene: Scene; captions: boolean}> = ({scene, captions}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 9, scene.frames - 7, scene.frames - 1], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{opacity}}>
      <View scene={scene} />
      {scene.heading ? (
        <div
          style={{
            position: 'absolute',
            left: 80,
            top: 46,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontFamily: MONO,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: theme.muted,
          }}
        >
          <span style={{width: 10, height: 10, borderRadius: 3, backgroundColor: theme.accent}} />
          {scene.heading}
        </div>
      ) : null}
      {scene.beats.map((beat) => (
        <Sequence key={beat.audio} from={beat.from} durationInFrames={beat.audioFrames + 2} layout="none">
          <Audio src={staticFile(beat.audio)} />
        </Sequence>
      ))}
      {captions ? <Captions beats={scene.beats} /> : null}
    </AbsoluteFill>
  );
};

const Progress: React.FC<{total: number}> = ({total}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', left: 0, bottom: 0, width: STAGE.width, height: 5, backgroundColor: `${theme.panelBorder}99`}}>
      <div style={{width: `${(100 * (frame + 1)) / total}%`, height: '100%', backgroundColor: theme.accent}} />
    </div>
  );
};

export const Video: React.FC<ExplainerProps> = ({scenes, captions, totalFrames}) => {
  const {fps, width} = useVideoConfig();
  return (
    <AbsoluteFill style={{backgroundColor: theme.bg}}>
      <div
        style={{
          position: 'absolute',
          width: STAGE.width,
          height: STAGE.height,
          transformOrigin: '0 0',
          scale: String(width / STAGE.width),
        }}
      >
        <Backdrop />
        {scenes.map((scene) => (
          <Sequence key={scene.id} name={`${scene.kind}: ${scene.id}`} from={scene.from} durationInFrames={scene.frames} premountFor={fps}>
            <SceneShell scene={scene} captions={captions} />
          </Sequence>
        ))}
        <Progress total={totalFrames} />
      </div>
    </AbsoluteFill>
  );
};
