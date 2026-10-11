import {Easing, interpolate} from 'remotion';
import themeJson from '../theme.json';

export const theme = themeJson;
export const SANS = "Inter, 'Helvetica Neue', Arial, sans-serif";
export const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

// Every scene is laid out on a 1920×1080 stage; Video scales the stage to the output size.
export const STAGE = {width: 1920, height: 1080};

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/** 0→1 over `length` frames starting at `start`, eased and clamped. */
export const ramp = (frame: number, start: number, length: number) =>
  interpolate(frame, [start, start + length], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });

const SOFT = Easing.inOut(Easing.quad);

/**
 * 0→1 like `ramp`, but easing in as well as out. For something large or bright: a sharp start
 * moves so much of the picture in its first frame that it reads, and measures, as a cut.
 */
export const glide = (frame: number, start: number, length: number) =>
  interpolate(frame, [start, start + length], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: SOFT});

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Index of the beat whose visual window contains `frame`. */
export const beatAt = (beats: {cue: number}[], frame: number) => {
  let index = 0;
  for (let i = 0; i < beats.length; i += 1) {
    if (frame >= beats[i].cue) index = i;
  }
  return index;
};
