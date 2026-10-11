# storyboard.json

One file describes the whole video, and its narration comes from another: `script.md`, the whole narration written as one piece first. Every `say` below is a cut from that script, in order. Scenes play in order. Each scene has beats; each beat is one spoken line and the visual cue that goes with it. `va tts` measures every line, so a scene lasts exactly as long as its narration plus short breaths (0.5s in, 0.3s between beats, 0.7s out; longer after a beat marked `land` or `predict`). Where a scene `continues` the one before, the breath at that join shrinks to the pause between two beats, so one picture gets one unbroken voice.

## Top level

| Field | Default | Meaning |
|---|---|---|
| `title` | `"Untitled"` | The video's name where it is posted. Not shown in the video. See [opening.md](opening.md). |
| `thumbnail` | the hook | `{"text": "...", "from": "<scene id>", "beat": n}`: five words at most, one starred, above the named scene frozen at the end of that beat. See [opening.md](opening.md). |
| `subject` | guessed | `algorithm`, `system`, or `mixed`. Decides which renderers belong in the video; see [routing.md](routing.md). |
| `brief` | none | What was agreed with the user: `{"audience": "...", "length": 90, "focus": "...", "hook": "..."}`. `length` is in seconds; the router compares the video against it. `hook` is the one sentence the video opens on, with the word or number it turns on starred; the router checks that the opening says it and the ending returns to it. See [opening.md](opening.md). |
| `facts` | none | The ledger: every number the video says or shows, as `{"id", "value", "what"}`, each computed again by the project's `facts.py`. See [facts.md](facts.md). |
| `vocabulary` | none | The words the video uses for its ideas: `{"word": "look", "not": ["comparison"], "defined": "<scene id>"}`. The router holds the narration to them. See [taste.md](taste.md). |
| `music` | none | A bed to lay under the voice: a path in the project, or `{"file": "bed.mp3", "under": 18, "gap": 10}` (loudness units below the voice while it speaks, and in a silence). See [taste.md](taste.md). |
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
| `need` | What the viewer must see: `question`, `source`, `trace`, `change`, `data`, `motion`, `branching`, `math`, `structure`, `conversation`, `pipeline`, `process`, `states`, `recap`, or `credit`. The router turns it into a renderer; see [routing.md](routing.md). |
| `kind` | Optional. The renderer (`title`, `code`, `trace`, `hyperframes`, `diagram`, `manim`, `bullets`, `credit`), normally supplied by `need`. If you set both, they must agree. |
| `why` | One sentence on why this need was chosen. Not rendered; it keeps routing reviewable. |
| `override` | Only when you disagree with the router: the reason, as a full phrase. Turns a routing error into a recorded note. |
| `continues` | `true` when this scene starts on the picture the previous scene ended on: the fade between them is dropped. `false` to say two scenes from one script do not share a picture. See [taste.md](taste.md). |
| `heading` | Optional small label shown top-left for the whole scene, e.g. `"auth.ts · verify()"`. |
| `beats` | One or more beats. |
| `hold` | Optional extra seconds to hold after the last word. |

## Every beat

| Field | Meaning |
|---|---|
| `say` | The line, written the way it should read on screen. Identifiers and notation stay as they are (`move_to_end`, `O(log n)`, `lo <= hi`): the voice is given a spoken form automatically ("move to end", "O of log n", "lo less than or equal to hi") and captions keep what you wrote. |
| `caption` | Optional. Only when the automatic spoken form is wrong: put the words to speak in `say` and the text to show here. |
| `pause` | Optional seconds of silence after this beat (default 0.3). |
| `land` | `true` on the beat where the main point resolves: the voice waits 0.7 seconds longer after it. Use once or twice a video. |
| `predict` | `true` on a beat that ends on a question the viewer can answer: the voice waits 1.5 seconds longer and the picture holds, then the next beat of the same scene answers. See [taste.md](taste.md). |
| `holds` | On a beat that says always, never, at most, or at least: the id of the fact, with value `true`, that tested the claim at its edges. See [facts.md](facts.md). |
| `cues` | Optional changes inside the beat, each landing on a spoken phrase. See below. |

Plus one cue, depending on the scene kind:

The sections below are grouped by renderer. The scene's `need` decides which one applies.

### Changing the picture mid-sentence: `cues`

A beat's own cue takes effect when the beat starts. To change the picture again while the sentence is still being spoken, add `cues`: each names a phrase from the beat's `say` and the fields that change when the voice reaches it.

```json
{
  "say": "Then store, check the size, and evict from the front.",
  "lines": 20,
  "cues": [
    {"at": "check the size", "lines": 21},
    {"at": "evict from the front", "lines": 22, "note": "last=False means the oldest end"}
  ]
}
```

- `at` must be words that are actually spoken, in order, and cues are listed in the order they are said. Matching ignores case and punctuation. Timing comes from the speech engine's word timestamps.
- A cue changes only the fields it names (`lines`, `note`, `focus`, `show`, `version`, `text`); the rest carry over from earlier in the same beat.
- Use this instead of splitting a sentence into several short beats: the voice stays natural and the picture still keeps pace. `va qc` points out beats that hold one picture for too long.
- Manim scenes do the same thing in code with `beat.until("<phrase>")`; see [scene-manim.md](scene-manim.md).

### Cues you do not have to write

When a beat has no cue of its own, the picture follows what the narration names:

- In a `code` or `trace` scene, saying an identifier that appears on exactly one displayed line highlights that line at that word. "A hit calls move_to_end" highlights the `move_to_end` line.
- In a `diagram` scene, saying a node's label lights that node at that word, and each further node named in the sentence joins it, so the connections between them light up too.

So write narration that names things: say `triage.ts`, not "the orchestration code"; say "the API", not "it". Ordinary words that happen to be identifiers (`value`, `items`, `count`) are ignored, as are names shorter than five letters. `va stills` prints every cue it derived. An authored `lines`, `focus`, or `cues` always wins, and `"auto": false` on a scene turns this off.

### `title`

The opening statement. No scene fields of its own: it shows no title card. See [opening.md](opening.md).

| Beat cue | Meaning |
|---|---|
| `text` | The hook, shown large while this beat is spoken: one or two short lines (`\n` between them), with the key word or number starred. A beat without `text` leaves the last statement standing. A scene with no `text` anywhere puts nothing on screen, which the router treats as an error. |

### `code`

Code with nothing beside it. The router rejects this unless the scene carries an `override`: code is shown in a `trace` scene, next to what it does. The fields below are shared with `trace`.

Scene fields: either `file` (relative to `sourceRoot`) with an optional `range: [first, last]`, or inline `code` with optional `lang` and `startLine`. Optional `title` overrides the filename in the panel header.

The panel shows real file line numbers, and beat cues use the same numbers.

| Beat cue | Meaning |
|---|---|
| `lines` | Lines to highlight; everything else dims. A number (`14`), a range (`[12, 13]`), or several ranges (`[[3, 3], [7, 9]]`). Omit to show all lines evenly. |
| `note` | Optional short callout shown beside the panel during this beat (under ~40 characters). |

Keep a code scene to about 25 lines and 100 columns. Past that, narrow the `range` or split the scene; longer excerpts scroll to follow the highlighted lines.

### `trace`

Code on the left, its animation on the right, both following the same narration.

Scene fields: the code fields of a `code` scene (`file` + `range`, or `code`), plus the fields of a `manim` scene (`class`, optional `script`). Beats use `lines` and `cues` for the code side; the script uses `self.beat(i)` and `beat.until(...)` for the animation side. Keep the code to about 16 lines of at most 50 columns, so it fits at a readable size. The animation is rendered into a 4:3 panel; see [scene-manim.md](scene-manim.md).

### `hyperframes`

A clip rendered by HyperFrames. Either code that changes, with `versions` (a list of excerpts, each `{"file", "range"}` or `{"code", "lang"}`) and an optional `title` (it is shown as a diff; `"effect": "morph"` exists but is rarely the right picture); or a composition you wrote, with `composition` (its path in the project). Details in [scene-hyperframes.md](scene-hyperframes.md).

| Beat cue | Meaning |
|---|---|
| `version` | For code that changes: the index into `versions` shown from this beat. Omit it everywhere and each beat brings the next version. |

### `diagram`

Scene fields: `type` (`architecture`, `workflow`, `sequence`, `dataflow`, `lifecycle`; supplied by `need`, so usually omitted), optional `candidate` (default `diagrams/<id>.json`), `build`, `camera`, `legend`. Details in [scene-diagram.md](scene-diagram.md).

| Beat cue | Meaning |
|---|---|
| `focus` | Node and edge ids to spotlight. Everything else dims and the camera moves toward them. `"all"` lights everything. Omit to light whatever is visible. |

### `manim`

Scene fields: `class` (required, the `VAScene` subclass to render), optional `script` (default `manim/<id>.py`; several scenes may share one script). Beats carry no cue; the script addresses beats by index. Details in [scene-manim.md](scene-manim.md).

### `credit`

The end card: the name of what was explained, animated in, and where to find it. Always the last scene, after the recap.

Scene fields: `title` (required: the name of the function, file, project, or paper, as someone would search for it), `subtitle` (where it is: a path, the authors and year, a short address), `kicker` (a label for what kind of thing it is: `"The code"`, `"The paper"`).

One beat, one short line that says the name aloud. No cues.

### `bullets`

The recap. Scene fields: `items` (required, three or four), optional `title`, optional `over` (the scene whose final frame to show by default).

Each item is a line of text, or `{"text": "...", "from": "<scene id>", "beat": n}` to show that takeaway beside the moment that proved it: the named scene, frozen at the end of that beat (default: its last). See [taste.md](taste.md).

| Beat cue | Meaning |
|---|---|
| `show` | How many items are visible during this beat. Default: one more per beat, and all of them on the last beat. |

## Example

Two complete projects live at the root of this repository: `examples/lru-cache/video/` (an opening with a hook, three trace scenes, a recap) and `examples/binary-search/video/` (a comparison animation, a trace scene, a formula scene). Start from whichever is closer.

```json
{
  "title": "How an LRU cache decides what to forget",
  "subject": "algorithm",
  "brief": {"audience": "programmers who have used a cache but not built one", "length": 95},
  "voice": "en-US-AndrewNeural",
  "sourceRoot": "..",
  "thumbnail": {"text": "Cache full.\nWhat gets *forgotten*?", "from": "read"},
  "scenes": [
    {
      "id": "intro",
      "need": "question",
      "why": "Opening: the problem every cache has, then the promise to show one answer.",
      "beats": [
        {"say": "A cache has limited room, so when it fills up, something has to go.", "text": "A full cache has to *forget* something."},
        {"say": "A least recently used cache drops whatever you touched longest ago."}
      ]
    },
    {
      "id": "read",
      "need": "trace",
      "why": "One line of get() reorders the row; showing the line and the jump together makes the link.",
      "heading": "lru_cache.py · get",
      "file": "src/lru_cache.py",
      "range": [11, 15],
      "class": "Get",
      "script": "manim/lru.py",
      "beats": [
        {"say": "Reading a key counts as a use. Say we ask for A.", "lines": 11},
        {"say": "A is cached, so move_to_end sends it to the newest end, and the others shift down."},
        {"say": "Then its value is returned.", "lines": 15}
      ]
    },
    {
      "id": "recap",
      "need": "recap",
      "why": "Recap: the claims the viewer should leave with.",
      "title": "What to remember",
      "items": ["Order of use lives in one ordered dictionary", "Every read and write moves a key to the newest end"],
      "beats": [
        {"say": "Two things to remember. The order of use lives in a single ordered dictionary."},
        {"say": "And every read and every write moves a key to the newest end."}
      ]
    },
    {
      "id": "credit",
      "need": "credit",
      "why": "Close: name the class and the file, for anyone who wants to read it.",
      "kicker": "The code",
      "title": "LRUCache",
      "subtitle": "lru_cache.py · twenty lines of Python",
      "beats": [{"say": "That is LRUCache: twenty lines, in lru_cache.py."}]
    }
  ]
}
```

The second beat of `read` has no cue: saying `move_to_end` highlights the one line that contains it.
