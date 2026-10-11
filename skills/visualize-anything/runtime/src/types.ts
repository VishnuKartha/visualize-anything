export type Word = {text: string; start: number; end: number};
export type Phrase = {start: number; end: number; words: Word[]};

/** One narrated line: its audio and captions. All frame values are scene-relative. */
export type Beat = {
  audio: string;
  from: number; // frame the voice starts
  audioFrames: number;
  phrases: Phrase[];
};

/**
 * One visual state. A beat opens with a step, and may add more that land on a spoken word,
 * so the picture can change mid-sentence.
 */
export type Step = {
  cue: number; // frame this state takes over
  cueFrames: number; // how long it lasts
  beat: number; // the beat it belongs to
  lines: [number, number][] | null;
  note: string | null;
  focus: string[] | 'all' | null;
  show: number | null;
  version: number | null;
  text: string | null;
};

type Base = {id: string; heading: string | null; from: number; frames: number; beats: Beat[]; steps: Step[]; fadeIn?: boolean; fadeOut?: boolean};

export type TitleScene = Base & {kind: 'title'; ambient: CodeToken[][] | null};
export type CreditScene = Base & {kind: 'credit'; title: string; kicker: string | null; subtitle: string | null};
/** A moment of another scene, shown beside a takeaway: that scene, frozen at one of its frames. */
export type Shot = {scene: string; frame: number};
export type BulletsScene = Base & {kind: 'bullets'; title: string | null; items: string[]; shots: (Shot | null)[]};
export type CodeToken = {text: string; color: string};
type CodeFields = {title: string; lang: string; startLine: number; code: CodeToken[][]};
export type CodeScene = Base & CodeFields & {kind: 'code'};
/** Code on the left with a moving highlight; the animation it drives on the right. */
export type TraceScene = Base & CodeFields & {kind: 'trace'; video: string; clip: {x: number; y: number; width: number; height: number}};
export type Box = {x: number; y: number; w: number; h: number};
export type DiagramScene = Base & {
  kind: 'diagram';
  diagramType: string;
  build: boolean;
  camera: 'follow' | 'static';
  viewBox: [number, number, number, number];
  svg: string;
  nodes: Record<string, Box & {label: string}>;
  edges: Record<string, Box & {from: string; to: string; label: string}>;
};
export type ManimScene = Base & {kind: 'manim'; video: string};
/** A clip rendered by HyperFrames from an HTML composition. It carries its own backdrop. */
export type HyperframesScene = Base & {kind: 'hyperframes'; video: string};

export type Scene = TitleScene | CreditScene | BulletsScene | CodeScene | TraceScene | DiagramScene | ManimScene | HyperframesScene;

export type ExplainerProps = {
  title: string;
  fps: number;
  width: number;
  height: number;
  captions: boolean;
  totalFrames: number;
  scenes: Scene[];
};

/** A contact sheet: many moments of the video in one image, for review. */
export type SheetProps = ExplainerProps & {
  sheet: {cols: number; cellWidth: number; audit: boolean; shots: {frame: number; label: string}[]};
};

/** The thumbnail: the hook in a few very large words, above one picture from the video. */
export type CoverProps = ExplainerProps & {cover: {text: string; shot: Shot | null}};
