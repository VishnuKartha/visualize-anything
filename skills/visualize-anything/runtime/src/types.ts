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

// Evidence scenes: what the source itself reports, drawn from the storyboard with nothing to build.
// Each reveals its parts by a step's `show`, lights some of them by `focus`, and may carry a `note`.
export type Tone = 'positive' | 'negative' | 'caution' | 'neutral';
export type Metric = {value: string; unit: string | null; label: string; detail: string | null; delta: string | null; tone: Tone};
/** One number the claim rests on, or up to four side by side. */
export type StatScene = Base & {kind: 'stat'; title: string | null; metrics: Metric[]};
export type Panel = {label: string; tone: Tone; points: {text: string; tone: Tone}[]};
/** Two or three alternatives side by side, each with what it gets right and what it costs. */
export type CompareScene = Base & {kind: 'compare'; title: string | null; versus: boolean; panels: Panel[]};
/** Measured values against each other: bars, or a line across an ordered axis. */
export type ChartScene = Base & {
  kind: 'chart';
  chart: 'bar' | 'line' | 'scatter';
  title: string | null;
  unit: string | null;
  axis: string | null;
  /** A scatter chart's horizontal measure; null for bars and lines. */
  across: string | null;
  labels: string[];
  series: {label: string | null; values: number[]; points?: {x: number; y: number; label: string | null}[]}[];
};
/** The rows of a results table the sentence compares. The first column names each row; `best` is the source's own. */
export type TableScene = Base & {kind: 'table'; title: string | null; columns: string[]; rows: string[][]; best: string | null; highlight: string[]; caption: string | null};
/** A grid of values coloured by size: attention weights, a confusion matrix. `scale` is [low, high] of the colour ramp. */
export type MatrixScene = Base & {kind: 'matrix'; title: string | null; rows: string[]; columns: string[]; values: number[][]; scale: [number, number]; numbers: boolean; axis: string | null};
/** The source's own words. `highlights` are [first, last] word indexes of the phrases to mark. */
export type QuoteScene = Base & {kind: 'quote'; quote: string; highlights: [number, number][]; attribution: string | null};
/** The source's own figure, with the parts worth seeing pointed out. Callout positions are percentages of the image. */
export type FigureScene = Base & {kind: 'figure'; image: string; aspect: number; crop: {x: number; y: number; width: number; height: number}; caption: string | null; callouts: {label: string; x: number; y: number; side: 'left' | 'right' | 'above' | 'below'}[]};

export type Scene =
  | TitleScene | CreditScene | BulletsScene | CodeScene | TraceScene | DiagramScene | ManimScene | HyperframesScene
  | StatScene | CompareScene | ChartScene | TableScene | MatrixScene | QuoteScene | FigureScene;

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
