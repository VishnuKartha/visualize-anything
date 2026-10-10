# storyboard.json

One file describes the whole video. Scenes play in order. Each scene has beats; each beat is one spoken line and the visual cue that goes with it. `va tts` measures every line, so a scene lasts exactly as long as its narration plus short breaths (0.5s in, 0.3s between beats, 0.7s out).

## Top level

| Field | Default | Meaning |
|---|---|---|
| `title` | `"Untitled"` | Video title (metadata; a `title` scene shows its own text). |
| `subject` | guessed | `algorithm`, `system`, or `mixed`. Decides which renderers belong in the video; see [routing.md](routing.md). |
| `voice` | `"en-US-AndrewNeural"` | Any edge-tts voice. List them with `uv run --with edge-tts edge-tts --list-voices`. |
| `rate`, `pitch` | `"+0%"`, `"+0Hz"` | edge-tts prosody, e.g. `"+8%"` for a brisker read. |
| `sourceRoot` | `"."` | Base for code `file` paths, relative to the project directory. `va init` sets it to the directory you ran it from. |
| `captions` | `true` | Word-timed captions at the bottom of the frame. |
| `fps`, `width`, `height` | `30`, `1920`, `1080` | Output format. Layouts are designed for 16:9. |
| `scenes` | required | Ordered list of scenes. |

## Every scene

| Field | Meaning |
|---|---|
| `id` | Unique kebab-case name. Diagram and Manim sources are found by it. |
| `need` | What the viewer must see: `question`, `source`, `motion`, `branching`, `math`, `structure`, `conversation`, `pipeline`, `process`, `states`, or `recap`. The router turns it into a renderer; see [routing.md](routing.md). |
| `kind` | Optional. The renderer (`title`, `code`, `diagram`, `manim`, `bullets`), normally supplied by `need`. If you set both, they must agree. |
| `why` | One sentence on why this need was chosen. Not rendered; it keeps routing reviewable. |
| `override` | Only when you disagree with the router: the reason, as a full phrase. Turns a routing error into a recorded note. |
| `heading` | Optional small label shown top-left for the whole scene, e.g. `"auth.ts · verify()"`. |
| `beats` | One or more beats. |
| `hold` | Optional extra seconds to hold after the last word. |

## Every beat

| Field | Meaning |
|---|---|
| `say` | The spoken line. Write it for the ear; spell out what TTS would mangle. |
| `caption` | Optional on-screen text when it should differ from `say` (identifiers, symbols). |
| `pause` | Optional seconds of silence after this beat (default 0.3). |

Plus one cue, depending on the scene kind:

The sections below are grouped by renderer. The scene's `need` decides which one applies.

### `title`

Scene fields: `title` (required), `kicker`, `subtitle`. Beats carry no cue.

### `code`

Scene fields: either `file` (relative to `sourceRoot`) with an optional `range: [first, last]`, or inline `code` with optional `lang` and `startLine`. Optional `title` overrides the filename in the panel header.

The panel shows real file line numbers, and beat cues use the same numbers.

| Beat cue | Meaning |
|---|---|
| `lines` | Lines to highlight; everything else dims. A number (`14`), a range (`[12, 13]`), or several ranges (`[[3, 3], [7, 9]]`). Omit to show all lines evenly. |
| `note` | Optional short callout shown beside the panel during this beat (under ~40 characters). |

Keep a code scene to about 25 lines and 100 columns. Past that, narrow the `range` or split the scene; longer excerpts scroll to follow the highlighted lines.

### `diagram`

Scene fields: `type` (`architecture`, `workflow`, `sequence`, `dataflow`, `lifecycle`; supplied by `need`, so usually omitted), optional `candidate` (default `diagrams/<id>.json`), `build`, `camera`, `legend`. Details in [scene-diagram.md](scene-diagram.md).

| Beat cue | Meaning |
|---|---|
| `focus` | Node and edge ids to spotlight. Everything else dims and the camera moves toward them. `"all"` lights everything. Omit to light whatever is visible. |

### `manim`

Scene fields: `class` (required, the `VAScene` subclass to render), optional `script` (default `manim/<id>.py`; several scenes may share one script). Beats carry no cue; the script addresses beats by index. Details in [scene-manim.md](scene-manim.md).

### `bullets`

Scene fields: `items` (required, at most 6 short lines), optional `title`.

| Beat cue | Meaning |
|---|---|
| `show` | How many items are visible during this beat. Default: one more per beat, and all of them on the last beat. |

## Example

```json
{
  "title": "How an LRU cache decides what to forget",
  "subject": "algorithm",
  "voice": "en-US-AndrewNeural",
  "sourceRoot": "..",
  "scenes": [
    {
      "id": "intro",
      "need": "question",
      "why": "Opening: state the question before showing any code.",
      "kicker": "Code explainer",
      "title": "How an LRU cache decides what to forget",
      "subtitle": "Twenty lines of Python and one ordered dictionary.",
      "beats": [
        {"say": "A cache has limited room, so when it fills up, something has to go."}
      ]
    },
    {
      "id": "get",
      "need": "source",
      "why": "Tie the animation back to the exact line that causes the jump.",
      "heading": "lru_cache.py · get",
      "file": "src/lru_cache.py",
      "range": [11, 15],
      "beats": [
        {"say": "A missing key just returns nothing.", "lines": [12, 13]},
        {
          "say": "A hit calls move to end. That one line is the jump you just saw.",
          "caption": "A hit calls move_to_end. That one line is the jump you just saw.",
          "lines": 14,
          "note": "the jump to the newest end"
        }
      ]
    },
    {
      "id": "order",
      "need": "motion",
      "why": "Entries change position over time; motion shows reordering better than a still.",
      "class": "Reorder",
      "beats": [
        {"say": "Picture that dictionary as a row of slots, oldest on the left."},
        {"say": "Reading a key moves it to the newest end, and the others shift down."}
      ]
    },
    {
      "id": "write",
      "need": "branching",
      "why": "put() is still the algorithm at work: the same row of slots, now driven by two decisions.",
      "script": "manim/lru.py",
      "class": "WritePath",
      "beats": [
        {"say": "Writing has two decisions in it. First, is this key already cached?"},
        {"say": "Second decision. Did that push us over capacity?"}
      ]
    }
  ]
}
```

A complete project in this shape lives in `examples/lru-cache/video/` at the root of this repository. That video is about an algorithm, so it has no diagram scene. A system-level video would add one:

```json
{
  "id": "request-path",
  "need": "conversation",
  "why": "Ordered calls between four separate components, including the cache miss.",
  "build": true,
  "beats": [
    {"say": "The browser asks the API for the dashboard.", "focus": ["dashboard-request"]},
    {"say": "The API checks Redis first, and misses.", "focus": ["cache-read", "cache-miss"]},
    {"say": "That is the whole request.", "focus": "all"}
  ]
}
```
