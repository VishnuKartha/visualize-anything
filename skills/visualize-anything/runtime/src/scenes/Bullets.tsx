import type React from 'react';
import {useContext} from 'react';
import {AbsoluteFill, Freeze, useCurrentFrame} from 'remotion';
import {StageContext} from '../StageContext';
import {MONO, SANS, STAGE, beatAt, glide, ramp, theme} from '../theme';
import type {BulletsScene, Scene, Shot} from '../types';

// A recap is not a slide of text. Each takeaway arrives beside the moment that proved it: the
// earlier scene itself, frozen at that frame. The list is the voice's outline; the picture is the proof.

const PANEL_WIDTH = 880;

/** The part of a scene worth showing small: a trace's animation panel, otherwise the content area. */
export const cropOf = (scene: Scene) =>
  scene.kind === 'trace' ? scene.clip : {x: 60, y: 104, width: STAGE.width - 120, height: 800};

export const Picture: React.FC<{shot: Shot; opacity: number; width?: number}> = ({shot, opacity, width = PANEL_WIDTH}) => {
  const {scenes, render} = useContext(StageContext);
  const target = scenes.find((scene) => scene.id === shot.scene);
  if (!target) return null;
  const crop = cropOf(target);
  const scale = width / crop.width;
  return (
    <div
      data-va-ignore
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        borderRadius: 20,
        overflow: 'hidden',
        border: `1px solid ${theme.panelBorder}`,
        backgroundColor: theme.bg,
        boxShadow: '0 30px 90px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{position: 'absolute', width: STAGE.width, height: STAGE.height, transformOrigin: '0 0', scale: String(scale), translate: `${-crop.x * scale}px ${-crop.y * scale}px`}}>
        <Freeze frame={shot.frame}>{render(target)}</Freeze>
      </div>
    </div>
  );
};

/** How many items are on screen during each step (resolved when the video is assembled). */
const visibleCounts = (scene: BulletsScene) => scene.steps.map((step) => Math.min(scene.items.length, Math.max(0, step.show ?? 0)));

export const BulletsView: React.FC<{scene: BulletsScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {scenes} = useContext(StageContext);
  const counts = visibleCounts(scene);
  const current = beatAt(scene.steps, frame);
  const previousCount = current > 0 ? counts[current - 1] : 0;
  const dense = scene.items.length > 4;

  // The picture belongs to the newest takeaway on screen.
  const shotAt = (step: number): Shot | null => {
    const newest = Math.max(0, (counts[step] ?? 1) - 1);
    return scene.shots[newest] ?? scene.shots.find(Boolean) ?? null;
  };
  const shot = shotAt(current);
  const before = current > 0 ? shotAt(current - 1) : null;
  const pictured = Boolean(shot) && scenes.length > 0;
  // Two whole pictures cross-fade, so the fade eases in as well as out: an ease-out starts with most of
  // the change in its first frame, which reads as a cut.
  const swap = glide(frame, scene.steps[current]?.cue ?? 0, 18);
  const same = before && shot && before.scene === shot.scene && before.frame === shot.frame;
  // Each picture sits in a panel of its own shape. Two of different shapes cross-fade; neither is resized.
  const panel = (of: Shot): React.CSSProperties => {
    const target = scenes.find((entry) => entry.id === of.scene);
    const crop = target ? cropOf(target) : {width: 16, height: 9};
    const height = PANEL_WIDTH * (crop.height / crop.width);
    return {position: 'absolute', left: 80, top: 104 + (800 - height) / 2, width: PANEL_WIDTH, height};
  };
  const size = pictured ? (dense ? 34 : 40) : dense ? 42 : 50;

  const list = (
    <div style={{display: 'flex', flexDirection: 'column', gap: pictured ? (dense ? 22 : 30) : dense ? 26 : 38}}>
      {scene.items.map((item, index) => {
        // An item enters at the cue of the first step that includes it.
        const firstStep = counts.findIndex((count) => count > index);
        const enter = firstStep < 0 ? 0 : ramp(frame, scene.steps[firstStep]?.cue ?? 0, 16);
        const isNew = index >= previousCount && index < counts[current];
        const settled = counts[current] === previousCount;
        const emphasis = isNew || settled ? 1 : 0.5;
        return (
          <div key={item} style={{display: 'flex', alignItems: 'baseline', gap: 24, opacity: enter * emphasis, translate: `${(1 - enter) * 40}px 0`}}>
            <span style={{fontFamily: MONO, fontSize: size * 0.7, fontWeight: 600, color: theme.accent, minWidth: 48}}>{String(index + 1).padStart(2, '0')}</span>
            <span data-va-text="takeaway" style={{fontFamily: SANS, fontSize: size, fontWeight: 500, lineHeight: 1.25, color: theme.text}}>
              {item}
            </span>
          </div>
        );
      })}
    </div>
  );
  const title = scene.title ? (
    <div data-va-box="bullets-title" style={{fontFamily: SANS, fontSize: pictured ? 54 : 68, fontWeight: 800, letterSpacing: '-0.03em', color: theme.text, marginBottom: pictured ? 40 : 54}}>
      {scene.title}
    </div>
  ) : null;

  if (!pictured) {
    return (
      <AbsoluteFill style={{justifyContent: 'center', padding: '60px 190px 150px'}}>
        {title}
        <div data-va-box="bullets">{list}</div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      {before && !same && swap < 1 ? (
        <div key={`out-${current}`} style={panel(before)}>
          <Picture shot={before} opacity={1 - swap} />
        </div>
      ) : null}
      {shot ? (
        <div key={`in-${current}`} style={panel(shot)}>
          <Picture shot={shot} opacity={same || current === 0 ? ramp(frame, 0, 14) : swap} />
        </div>
      ) : null}
      <div data-va-box="bullets" style={{position: 'absolute', left: 80 + PANEL_WIDTH + 70, top: 104, width: STAGE.width - (80 + PANEL_WIDTH + 70) - 80, height: 800, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        {title}
        {list}
      </div>
    </AbsoluteFill>
  );
};
