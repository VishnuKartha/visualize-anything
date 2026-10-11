import type React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {SANS, beatAt, glide, lerp, ramp, theme} from '../theme';
import type {FigureScene} from '../types';
import {Evidence, arrival, bodyOf} from './parts';

// The source's own figure. A paper's authors already drew the picture they wanted you to see, and
// redrawing it loses what they measured. So it is shown as it is, on its own white ground, and the
// parts worth seeing are pointed out one at a time while the frame leans in toward each.

const CAPTION = 84;
const PAD = 22;
const LEAN = 1.07;

export const FigureView: React.FC<{scene: FigureScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const body = bodyOf(scene, null);
  const room = {w: body.w, h: body.h - (scene.caption ? CAPTION : 0)};
  // The image as large as its panel allows, at its own shape.
  const width = Math.min(room.w - PAD * 2, (room.h - PAD * 2) * scene.aspect);
  const height = width / scene.aspect;
  const left = body.x + (body.w - width) / 2 - PAD;
  const top = body.y + (room.h - height) / 2 - PAD;
  // A white page is the brightest thing a video can put up: it comes in slowly.
  const enter = glide(frame, 0, 30);

  // The frame leans toward the newest callout, and back out when a step shows none.
  const current = beatAt(scene.steps, frame);
  const step = scene.steps[current];
  const previous = current > 0 ? scene.steps[current - 1] : undefined;
  const p = step ? glide(frame, step.cue, 34) : 1;
  const aim = (shown: number) => {
    const target = shown > 0 ? scene.callouts[Math.min(shown, scene.callouts.length) - 1] : null;
    return target ? {x: target.x, y: target.y, scale: LEAN} : {x: 50, y: 50, scale: 1};
  };
  const from = aim(previous?.show ?? 0);
  const to = aim(step?.show ?? 0);
  const view = {x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p), scale: lerp(from.scale, to.scale, p)};
  const newest = (step?.show ?? 0) - 1;

  return (
    <Evidence scene={scene} frame={frame}>
      <div
        data-va-box="card"
        style={{
          position: 'absolute',
          left,
          top,
          width: width + PAD * 2,
          height: height + PAD * 2,
          borderRadius: 22,
          backgroundColor: '#ffffff',
          border: `1px solid ${theme.panelBorder}`,
          boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          opacity: enter,
        }}
      >
        <div style={{position: 'absolute', left: PAD, top: PAD, width, height, transformOrigin: `${view.x}% ${view.y}%`, scale: String(view.scale)}}>
          <Img src={staticFile(scene.image)} style={{width, height, objectFit: 'contain'}} />
          {scene.callouts.map((callout, index) => {
            const start = arrival(scene.steps, index);
            if (start === null) return null;
            const arrived = ramp(frame, start, 18);
            const ring = ramp(frame, start, 36);
            // The label stands off from its point on the side it was given, joined to it by a short lead.
            const across = callout.side === 'left' || callout.side === 'right';
            const sign = callout.side === 'left' || callout.side === 'above' ? -1 : 1;
            const lead = 44 * arrived;
            return (
              <div key={index} style={{position: 'absolute', left: `${callout.x}%`, top: `${callout.y}%`, opacity: arrived}}>
                <div style={{position: 'absolute', left: -60, top: -60, width: 120, height: 120, borderRadius: 60, boxSizing: 'border-box', border: `4px solid ${theme.accent}`, opacity: 1 - ring, scale: String(0.3 + ring)}} />
                <div style={{position: 'absolute', left: across ? (sign > 0 ? 13 : -13 - lead) : -2, top: across ? -2 : sign > 0 ? 13 : -13 - lead, width: across ? lead : 4, height: across ? 4 : lead, backgroundColor: theme.bg}} />
                <div style={{position: 'absolute', left: -13, top: -13, width: 26, height: 26, borderRadius: 13, boxSizing: 'border-box', backgroundColor: theme.accent, border: `4px solid ${theme.bg}`, scale: String(arrived)}} />
                <div
                  data-va-text="callout"
                  style={{
                    position: 'absolute',
                    left: across ? sign * 56 : 0,
                    top: across ? 0 : sign * 86,
                    translate: `${across ? (sign > 0 ? '0' : '-100%') : '-50%'} -50%`,
                    height: 60,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 22px',
                    borderRadius: 12,
                    backgroundColor: theme.bg,
                    // The label being spoken about is lit; the ones before it stay, and step back.
                    border: `2px solid ${index === newest ? theme.accent : theme.dim}`,
                    fontFamily: SANS,
                    fontSize: 28,
                    fontWeight: 600,
                    color: index === newest ? theme.text : theme.muted,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
                  }}
                >
                  {callout.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {scene.caption ? (
        <div
          data-va-text="caption"
          data-va-box="card-title"
          style={{position: 'absolute', left: body.x, width: body.w, top: body.y + room.h + 18, textAlign: 'center', fontFamily: SANS, fontSize: 30, fontWeight: 500, lineHeight: 1.3, color: theme.muted, opacity: ramp(frame, 12, 20), textWrap: 'balance'}}
        >
          {scene.caption}
        </div>
      ) : null}
    </Evidence>
  );
};
