import type React from 'react';
import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {AbsoluteFill, Freeze, continueRender, delayRender} from 'remotion';
import {Picture, cropOf} from './scenes/Bullets';
import {parseStatement} from './scenes/Title';
import {StageContext} from './StageContext';
import {MONO, SANS, STAGE, theme} from './theme';
import type {CoverProps, Scene, SheetProps} from './types';
import {Stage, View} from './Video';

export const LABEL_HEIGHT = 34;
const EDGE = {x: 24, y: 14}; // how close to the frame edge content may sit
const SLACK = 4; // px of overlap or overflow that is not worth reporting
const MIN_TEXT = 24; // px on the 1080p stage; smaller than this is not read, it is squinted at

type Rect = {x: number; y: number; w: number; h: number};
type Issue = {kind: 'bounds' | 'overlap' | 'clip' | 'small'; text: string; rect: Rect};

// Pairs that must never touch: the fixed furniture of the frame against a scene's own content.
const MUST_NOT_OVERLAP: [string, string[]][] = [
  ['captions', ['code', 'note', 'bullets', 'bullets-title', 'title', 'subtitle', 'kicker']],
  ['heading', ['code', 'note', 'bullets', 'bullets-title', 'title', 'kicker']],
  ['note', ['code']],
];

const visible = (element: Element, stop: Element) => {
  // A scene shown small inside another (a recap's picture) is not laid out for reading; skip it.
  if (element.closest('[data-va-ignore]')) return false;
  let opacity = 1;
  for (let node: Element | null = element; node && node !== stop; node = node.parentElement) {
    opacity *= Number.parseFloat(getComputedStyle(node).opacity || '1');
  }
  return opacity > 0.15;
};

/** Measure the tagged elements of one frozen frame and report what runs off, collides, or is cut off. */
const audit = (stage: HTMLElement): Issue[] => {
  const origin = stage.getBoundingClientRect();
  const scale = origin.width / STAGE.width;
  const toStage = (element: Element): Rect => {
    const rect = element.getBoundingClientRect();
    return {x: (rect.left - origin.left) / scale, y: (rect.top - origin.top) / scale, w: rect.width / scale, h: rect.height / scale};
  };
  const boxes = [...stage.querySelectorAll('[data-va-box]')]
    .filter((element) => visible(element, stage))
    .map((element) => ({name: element.getAttribute('data-va-box') as string, rect: toStage(element)}))
    .filter((box) => box.rect.w > 0 && box.rect.h > 0);
  const issues: Issue[] = [];

  for (const {name, rect} of boxes) {
    const over = [
      ['left', EDGE.x - rect.x],
      ['top', EDGE.y - rect.y],
      ['right', rect.x + rect.w - (STAGE.width - EDGE.x)],
      ['bottom', rect.y + rect.h - (STAGE.height - EDGE.y)],
    ].filter(([, amount]) => (amount as number) > SLACK) as [string, number][];
    for (const [side, amount] of over) {
      issues.push({kind: 'bounds', text: `${name} runs past the ${side} edge by ${Math.round(amount)}px`, rect});
    }
  }
  for (const [fixed, others] of MUST_NOT_OVERLAP) {
    for (const a of boxes.filter((box) => box.name === fixed)) {
      for (const b of boxes.filter((box) => others.includes(box.name))) {
        const w = Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w) - Math.max(a.rect.x, b.rect.x);
        const h = Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h) - Math.max(a.rect.y, b.rect.y);
        if (w > SLACK && h > SLACK) {
          issues.push({
            kind: 'overlap',
            text: `${b.name} overlaps ${a.name} by ${Math.round(w)}×${Math.round(h)}px`,
            rect: {x: Math.max(a.rect.x, b.rect.x), y: Math.max(a.rect.y, b.rect.y), w, h},
          });
        }
      }
    }
  }
  for (const element of stage.querySelectorAll<HTMLElement>('[data-va-clip]')) {
    if (!visible(element, stage)) continue;
    const extra = element.scrollWidth - element.clientWidth;
    if (extra > SLACK) {
      issues.push({kind: 'clip', text: `${element.getAttribute('data-va-clip')} is cut off: its content is ${extra}px wider than its box`, rect: toStage(element)});
    }
  }
  const reported = new Set<string>();
  for (const element of stage.querySelectorAll<HTMLElement>('[data-va-text]')) {
    if (!visible(element, stage)) continue;
    const name = element.getAttribute('data-va-text') as string;
    const size = Number.parseFloat(getComputedStyle(element).fontSize);
    if (size < MIN_TEXT - 0.5 && !reported.has(name)) {
      reported.add(name);
      issues.push({kind: 'small', text: `${name} text is ${Math.round(size)}px; the minimum is ${MIN_TEXT}px`, rect: toStage(element)});
    }
  }
  return issues;
};

const Cell: React.FC<{props: SheetProps; shot: SheetProps['sheet']['shots'][number]; width: number}> = ({props, shot, width}) => {
  const stage = useRef<HTMLDivElement>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [handle] = useState(() => (props.sheet.audit ? delayRender(`Measuring layout: ${shot.label}`) : null));
  const scale = width / STAGE.width;

  useLayoutEffect(() => {
    if (handle === null) return;
    let cancelled = false;
    // Measure once fonts are in and the scene has laid out with them.
    document.fonts.ready.then(() =>
      requestAnimationFrame(() => {
        if (cancelled || !stage.current) return;
        const found = audit(stage.current);
        setIssues(found);
        // The CLI reads these lines back out of the render log.
        console.debug(`VA_LAYOUT ${JSON.stringify({label: shot.label, frame: shot.frame, issues: found.map((issue) => issue.text)})}`);
        continueRender(handle);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [handle, shot.frame, shot.label]);

  return (
    <div style={{width, height: width * (STAGE.height / STAGE.width) + LABEL_HEIGHT}}>
      <div
        style={{
          height: LABEL_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          fontFamily: MONO,
          fontSize: 17,
          fontWeight: 600,
          color: issues.length ? theme.rose : theme.muted,
          backgroundColor: '#000',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {shot.label}
        {issues.length ? `   ⚠ ${issues.length} layout issue${issues.length > 1 ? 's' : ''}` : ''}
      </div>
      <div style={{position: 'relative', width, height: width * (STAGE.height / STAGE.width), overflow: 'hidden'}}>
        <div ref={stage} style={{position: 'absolute', width: STAGE.width, height: STAGE.height, transformOrigin: '0 0', scale: String(scale)}}>
          <Freeze frame={shot.frame}>
            <Stage scenes={props.scenes} captions={props.captions} totalFrames={props.totalFrames} />
          </Freeze>
          {issues.map((issue, index) => (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: issue.rect.x,
                top: issue.rect.y,
                width: issue.rect.w,
                height: issue.rect.h,
                border: `6px solid ${theme.rose}`,
                backgroundColor: `${theme.rose}33`,
                boxSizing: 'border-box',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/** Many moments of the video in one image, each labelled, with layout problems outlined in red. */
export const Sheet: React.FC<SheetProps> = (props) => (
  <AbsoluteFill style={{backgroundColor: '#000', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start'}}>
    {props.sheet.shots.map((shot) => (
      <Cell key={`${shot.frame}-${shot.label}`} props={props} shot={shot} width={props.sheet.cellWidth} />
    ))}
  </AbsoluteFill>
);

const COVER = {x: 96, y: 76, gap: 52, minPicture: 400, maxText: 340};
const CHAR = 0.56; // width of an average character of extra-bold Inter at this tracking, in ems

/**
 * The thumbnail. It is seen about 120 pixels wide, next to the video's title, so it carries what the
 * title does not: the hook in a few very large words, above one picture from the video. Two things
 * in the frame and nothing else: no kicker, no subtitle, no code drifting behind.
 */
export const Cover: React.FC<CoverProps> = ({cover, scenes}) => {
  const shared = useMemo(() => ({scenes, render: (scene: Scene) => <View scene={scene} />}), [scenes]);
  const words = parseStatement(cover.text);
  const lines = [...new Set(words.map((word) => word.line))];
  const lineOf = (line: number) => words.filter((word) => word.line === line);
  const longest = Math.max(1, ...lines.map((line) => lineOf(line).map((word) => word.text).join(' ').length));
  const target = cover.shot ? scenes.find((scene) => scene.id === cover.shot?.scene) : null;

  // The words are as large as the frame allows; the picture takes the height they leave.
  const width = STAGE.width - 2 * COVER.x;
  const height = STAGE.height - 2 * COVER.y;
  const leading = 1.02;
  const size = Math.min(width / (longest * CHAR), (height - (target ? COVER.minPicture + COVER.gap : 0)) / (lines.length * leading), COVER.maxText);
  const crop = target ? cropOf(target) : null;
  const pictureWidth = crop ? Math.min(width, (height - lines.length * size * leading - COVER.gap) * (crop.width / crop.height)) : 0;

  return (
    <StageContext.Provider value={shared}>
      <AbsoluteFill style={{backgroundColor: theme.bg, backgroundImage: `radial-gradient(1100px 760px at 22% 30%, ${theme.accent}26, transparent 70%)`}}>
        <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: COVER.gap, padding: `${COVER.y}px ${COVER.x}px`}}>
          <div style={{fontFamily: SANS, fontSize: size, fontWeight: 800, lineHeight: leading, letterSpacing: '-0.035em', color: theme.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'}}>
            {lines.map((line) => (
              <div key={line}>
                {lineOf(line).map((word, index) => (
                  <span key={index} style={{color: word.strong ? theme.accent : theme.text}}>
                    {word.text}{' '}
                  </span>
                ))}
              </div>
            ))}
          </div>
          {cover.shot && crop ? (
            <div style={{position: 'relative', flex: 'none', width: pictureWidth, height: pictureWidth * (crop.height / crop.width)}}>
              <Picture shot={cover.shot} opacity={1} width={pictureWidth} />
            </div>
          ) : null}
        </div>
      </AbsoluteFill>
    </StageContext.Provider>
  );
};
