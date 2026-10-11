import {Audio} from '@remotion/media';
import type React from 'react';
import {useContext, useMemo} from 'react';
import {AbsoluteFill, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions} from './Captions';
import {BulletsView} from './scenes/Bullets';
import {CreditView} from './scenes/Credit';
import {CodeView} from './scenes/Code';
import {DiagramView} from './scenes/Diagram';
import {HyperframesView, ManimView} from './scenes/Manim';
import {TitleView} from './scenes/Title';
import {TraceView} from './scenes/Trace';
import {FadeContext, StageContext} from './StageContext';
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

export const View: React.FC<{scene: Scene}> = ({scene}) => {
  switch (scene.kind) {
    case 'title':
      return <TitleView scene={scene} />;
    case 'credit':
      return <CreditView scene={scene} />;
    case 'bullets':
      return <BulletsView scene={scene} />;
    case 'code':
      return <CodeView scene={scene} />;
    case 'trace':
      return <TraceView scene={scene} />;
    case 'diagram':
      return <DiagramView scene={scene} />;
    case 'manim':
      return <ManimView scene={scene} />;
    case 'hyperframes':
      return <HyperframesView scene={scene} />;
  }
};

/** Everything a scene needs besides its picture: the cut in and out, its heading, voice, and captions. */
const SceneShell: React.FC<{scene: Scene; captions: boolean}> = ({scene, captions}) => {
  const frame = useCurrentFrame();
  // Fade through the backdrop between scenes, except where the next scene carries the same picture on.
  const fadeIn = scene.fadeIn === false ? 1 : interpolate(frame, [0, 9], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fadeOut = scene.fadeOut === false ? 1 : interpolate(frame, [scene.frames - 7, scene.frames - 1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const opacity = fadeIn * fadeOut;
  // A heading that changes at a carried-on join is faded across it, not swapped. One that stays the same stays put.
  const {scenes} = useContext(StageContext);
  const at = scenes.findIndex((entry) => entry.id === scene.id);
  const changesIn = scene.fadeIn === false && scenes[at - 1]?.heading !== scene.heading;
  const changesOut = scene.fadeOut === false && scenes[at + 1]?.heading !== scene.heading;
  const carry =
    (changesIn ? interpolate(frame, [0, 9], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1) *
    (changesOut ? interpolate(frame, [scene.frames - 10, scene.frames - 1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 1);
  // Scenes that blend a clip into the backdrop fade their own parts; the rest fade as a whole.
  const blended = scene.kind === 'manim' || scene.kind === 'trace';
  return (
    <AbsoluteFill style={{opacity: blended ? 1 : opacity}}>
      <FadeContext.Provider value={blended ? opacity : 1}>
        <View scene={scene} />
      </FadeContext.Provider>
      {scene.heading ? (
        <div
          data-va-text="heading"
          data-va-box="heading"
          style={{
            position: 'absolute',
            left: 80,
            top: 46,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontFamily: MONO,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: '0.04em',
            color: theme.muted,
            opacity: carry * (blended ? opacity : 1),
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

/** The whole video on its 1920×1080 stage, unscaled. `chrome` adds what belongs to playback, not the picture. */
export const Stage: React.FC<{scenes: Scene[]; captions: boolean; totalFrames: number; chrome?: boolean}> = ({
  scenes,
  captions,
  totalFrames,
  chrome = true,
}) => {
  const {fps} = useVideoConfig();
  const shared = useMemo(() => ({scenes, render: (scene: Scene) => <View scene={scene} />}), [scenes]);
  return (
    <StageContext.Provider value={shared}>
    <div style={{position: 'absolute', left: 0, top: 0, width: STAGE.width, height: STAGE.height, overflow: 'hidden'}}>
      <Backdrop />
      {scenes.map((scene) => (
        <Sequence key={scene.id} name={`${scene.kind}: ${scene.id}`} from={scene.from} durationInFrames={scene.frames} premountFor={fps}>
          <SceneShell scene={scene} captions={captions} />
        </Sequence>
      ))}
      {chrome ? <Progress total={totalFrames} /> : null}
    </div>
    </StageContext.Provider>
  );
};

export const Video: React.FC<ExplainerProps> = ({scenes, captions, totalFrames}) => {
  const {width} = useVideoConfig();
  return (
    <AbsoluteFill style={{backgroundColor: theme.bg}}>
      <div style={{position: 'absolute', transformOrigin: '0 0', scale: String(width / STAGE.width)}}>
        <Stage scenes={scenes} captions={captions} totalFrames={totalFrames} />
      </div>
    </AbsoluteFill>
  );
};
