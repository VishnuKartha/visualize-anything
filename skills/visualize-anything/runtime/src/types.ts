export type Word = {text: string; start: number; end: number};
export type Phrase = {start: number; end: number; words: Word[]};

/** One narrated line and the visual cue that accompanies it. All frame values are scene-relative. */
export type Beat = {
  audio: string;
  from: number; // frame the voice starts
  cue: number; // frame the visual changes (slightly ahead of the voice)
  cueFrames: number; // how long this beat's visual state lasts
  audioFrames: number;
  phrases: Phrase[];
  lines: [number, number][] | null;
  note: string | null;
  focus: string[] | 'all' | null;
  show: number | null;
};

type Base = {id: string; heading: string | null; from: number; frames: number; beats: Beat[]};

export type TitleScene = Base & {kind: 'title'; title: string; kicker: string | null; subtitle: string | null};
export type BulletsScene = Base & {kind: 'bullets'; title: string | null; items: string[]};
export type CodeToken = {text: string; color: string};
export type CodeScene = Base & {kind: 'code'; title: string; lang: string; startLine: number; code: CodeToken[][]};
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

export type Scene = TitleScene | BulletsScene | CodeScene | DiagramScene | ManimScene;

export type ExplainerProps = {
  title: string;
  fps: number;
  width: number;
  height: number;
  captions: boolean;
  totalFrames: number;
  scenes: Scene[];
};
