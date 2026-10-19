# storyboard.json

One file describes the full video. A second file has its narration: `script.md`, the full narration written as one text first. Each `say` below is a cut from that script, in order.

Scenes play in order. Each scene has beats. Each beat is one spoken line and the visual cue that goes with it. `va tts` measures each line. Thus a scene has the exact length of its narration and its short breaths:

- 0.5s in
- 0.3s between beats
- 0.7s out
- longer after a beat marked `land` or `predict`

Where a scene `continues` the scene before it, the breath at that join is as short as the pause between two beats. One picture thus gets one voice without a break.

## Top level

| Field | Default | Meaning |
|---|---|---|
| `title` | `"Untitled"` | The name of the video where it is published. The video does not show it. See [opening.md](opening.md). |
| `thumbnail` | the hook | `{"text": "...", "from": "<scene id>", "beat": n}`: five words at most, one with a star, above the named scene stopped at the end of that beat. See [opening.md](opening.md). |
| `subject` | guessed | `algorithm`, `system`, or `mixed`. It controls which renderers can be in the video. See [routing.md](routing.md). |
| `sources` | none | The material that the video is made from, which you identify at the brief: `[{"id", "kind", "title", "path", "url"}]`. `kind` is `code`, `paper`, `design-doc`, `docs`, or `topic`. The part of a scene that comes from a document obeys the rules of a document. In a paper project with no `sources`, the paper is the one source. See [sources.md](sources.md). |
| `brief` | none | The brief: `{"audience": "...", "length": 90, "focus": "...", "context": "...", "hook": "..."}`. `length` is in seconds. The router compares the video with it. `context` is the first thing that the opening says: where the viewer is now, and the one step from there to the subject. `hook` is the one sentence that follows it, with a star on the word or number that it turns on. The router makes sure that the brief has the two, that the opening says the hook, and that the ending returns to it. See [opening.md](opening.md). |
| `facts` | none | The ledger: each number that the video says or shows, as `{"id", "value", "what"}`. The `facts.py` of the project calculates each one again. See [facts.md](facts.md). |
| `claims` | none | For a paper: the decision of the video for each claim of its abstract, as `{"abstract": n, "scene": "<scene id>"}` or `{"abstract": n, "omit": "<why>"}`. `va paper` gives the claims their numbers. `va route` lists each claim with no decision. See [paper.md](paper.md). |
| `vocabulary` | none | The words that the video uses for its ideas: `{"word": "look", "not": ["comparison"], "defined": "<scene id>"}`. The router holds the narration to them. See [taste.md](taste.md). |
| `music` | none | Music to put below the voice: a path in the project, or `{"file": "bed.mp3", "under": 18, "gap": 10}`. The numbers are loudness units below the voice while it speaks, and in a silence. See [taste.md](taste.md). |
| `voice` | `"en-US-AndrewNeural"` | An edge-tts voice. To list them, run `uv run --with edge-tts edge-tts --list-voices`. With the local engine (`VA_TTS_ENGINE=kokoro`), a Kokoro voice such as `"am_michael"`. See SKILL.md, "TTS". |
| `rate`, `pitch` | `"+0%"`, `"+0Hz"` | The prosody of edge-tts. For example, `"+8%"` gives a faster voice. |
| `sourceRoot` | `"."` | The base for code `file` paths, relative to the project directory. `va init` sets it to the directory where you ran it. |
| `captions` | `true` | Captions with word timing at the bottom of the frame. |
| `fps`, `width`, `height` | `30`, `1920`, `1080` | The output format. The layouts are for 16:9. |
| `scenes` | required | The ordered list of scenes. |

## Every scene

| Field | Meaning |
|---|---|
| `id` | A unique kebab-case name. The tool finds diagram and Manim sources by it. |
| `need` | The thing that the viewer must see: `question`, `source`, `trace`, `change`, `data`, `number`, `contrast`, `chart`, `table`, `matrix`, `quote`, `figure`, `motion`, `branching`, `math`, `structure`, `conversation`, `pipeline`, `process`, `states`, `name`, `recap`, or `credit`. The router changes it into a renderer. See [routing.md](routing.md). |
| `kind` | Optional. The renderer (`title`, `code`, `trace`, `hyperframes`, `diagram`, `manim`, `bullets`, `credit`, `stat`, `compare`, `chart`, `table`, `matrix`, `quote`, `figure`). The `need` usually supplies it. If you set the two, they must agree. |
| `source` | The sources that the scene uses: one source id, a list of ids (`["rfc", "svc"]`: the decision of a doc next to the code that does it), or `null` for a picture of the video's own. With more than one source, give it on each scene. With one source, or a `file` in a source, the tool can find it. See [sources.md](sources.md). |
| `ref` | The location in a document (`"Table 2"`, `"Figure 4"`, `"Section 3.1"`). Give it on evidence from a document, and on a scene that puts a claim of a document next to code. |
| `after` | Evidence from a document: the id of the earlier scene that prepares it. |
| `why` | One sentence that gives the reason for this need. The tool does not render it. It lets a person review the routing. |
| `override` | Only when you disagree with the router: the reason, as a full phrase. It changes a routing error into a recorded note. |
| `continues` | `true` when this scene starts on the picture where the scene before it ended. The tool removes the fade between them. `false` says that two scenes from one script do not share a picture. See [taste.md](taste.md). |
| `heading` | Optional. A small label at the top left for the full scene, for example `"auth.ts · verify()"`. |
| `beats` | One or more beats. |
| `hold` | Optional. More seconds to hold after the last word. |

## Every beat

| Field | Meaning |
|---|---|
| `say` | The line, written as it must read on screen. Keep identifiers and notation as they are (`move_to_end`, `O(log n)`, `lo <= hi`). The voice gets a spoken form automatically ("move to end", "O of log n", "lo less than or equal to hi"). The captions keep your text. |
| `caption` | Optional. Use it only when the automatic spoken form is incorrect. Put the words to speak in `say` and the text to show here. |
| `pause` | Optional. Seconds of silence after this beat. The default is 0.3. |
| `land` | `true` on the beat where the main point is complete. The voice waits 0.7 seconds longer after it. Use it one or two times in a video. |
| `predict` | `true` on a beat that ends on a question that the viewer can answer. The voice waits 1.5 seconds longer and the picture holds. Then the next beat of the same scene answers. See [taste.md](taste.md). |
| `holds` | On a beat that says always, never, at most, or at least: the id of the fact, with the value `true`, that tested the claim at its limits. See [facts.md](facts.md). |
| `cues` | Optional. Changes in the beat, each on a spoken phrase. See below. |

Each beat also has one cue. The scene kind controls which cue.

The sections below are in groups by renderer. The `need` of the scene controls which one applies.

### Changing the picture mid-sentence: `cues`

The cue of a beat starts when the beat starts. To change the picture again while the voice speaks the sentence, add `cues`. Each cue names a phrase from the `say` of the beat and the fields that change when the voice gets to it.

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

- `at` must be words that the voice speaks, in order. List the cues in the order of the speech. The match ignores case and punctuation. The timing comes from the word timestamps of the speech engine.
- A cue changes only the fields that it names (`lines`, `note`, `focus`, `show`, `version`, `text`). The other fields continue from earlier in the same beat.
- Use a cue. Do not divide a sentence into short beats. The voice stays natural and the picture keeps the same speed. `va qc` shows the beats that hold one picture too long.
- Manim scenes do the same thing in code with `beat.until("<phrase>")`. See [scene-manim.md](scene-manim.md).

### Cues you do not have to write

When a beat has no cue, the picture follows the names in the narration:

- In a `code` or `trace` scene, an identifier that is on only one displayed line highlights that line on that word. "A hit calls move_to_end" highlights the `move_to_end` line.
- In a `diagram` scene, the label of a node lights that node on that word. Each subsequent node in the sentence joins it, so the connections between them also light.

Thus, write narration that names things. Say `triage.ts`, not "the orchestration code". Say "the API", not "it". The tool ignores ordinary words that are also identifiers (`value`, `items`, `count`), and names shorter than five letters. `va stills` prints each cue that it derived. An authored `lines`, `focus`, or `cues` always has priority. `"auto": false` on a scene turns this function off.

### `title`

A statement on screen. A video does not open on one, because the opening is a Manim scene, unless the `override` of the scene gives the reason. It has no scene fields. It shows no title card. See [opening.md](opening.md).

| Beat cue | Meaning |
|---|---|
| `text` | The hook, shown large while the voice speaks this beat: one or two short lines (`\n` between them), with a star on the important word or number. A beat without `text` keeps the last statement on screen. A scene with no `text` shows nothing on screen. The router gives an error for this. |

### `code`

Code with nothing next to it. The router rejects this unless the scene has an `override`. Show code in a `trace` scene, next to its effect. `trace` uses the same fields.

Scene fields: `file` (relative to `sourceRoot`) with an optional `range: [first, last]`, or inline `code` with optional `lang` and `startLine`. An optional `title` replaces the file name in the panel header.

The panel shows the real line numbers of the file. Beat cues use the same numbers.

| Beat cue | Meaning |
|---|---|
| `lines` | The lines to highlight. All other lines dim. Give a number (`14`), a range (`[12, 13]`), or some ranges (`[[3, 3], [7, 9]]`). Omit it to show all lines equally. |
| `note` | Optional. A short callout next to the panel during this beat (fewer than approximately 40 characters). |

Keep a code scene to approximately 25 lines and 100 columns. Above that, make the `range` smaller or divide the scene. Longer excerpts scroll to follow the highlighted lines.

### `trace`

Code on the left and its animation on the right. The two follow the same narration.

Scene fields: the code fields of a `code` scene (`file` and `range`, or `code`), and the fields of a `manim` scene (`class`, optional `script`). Beats use `lines` and `cues` for the code side. The script uses `self.beat(i)` and `beat.until(...)` for the animation side. Keep the code to approximately 16 lines of 50 columns at most, so that it fits at a readable size. The tool renders the animation into a 4:3 panel. See [scene-manim.md](scene-manim.md).

### `hyperframes`

A clip that HyperFrames renders. It is one of these:

- Code that changes. It has `versions` (a list of excerpts, each `{"file", "range"}` or `{"code", "lang"}`) and an optional `title`. The tool shows it as a diff. `"effect": "morph"` exists, but it is rarely the correct picture.
- A composition that you wrote. It has `composition` (its path in the project).

See [scene-hyperframes.md](scene-hyperframes.md).

| Beat cue | Meaning |
|---|---|
| `version` | For code that changes: the index into `versions` that shows from this beat. If you omit it in all beats, each beat shows the next version. |

### `diagram`

Scene fields: `type` (`architecture`, `workflow`, `sequence`, `dataflow`, `lifecycle`. The `need` supplies it, so you usually omit it), optional `candidate` (the default is `diagrams/<id>.json`), `build`, `camera`, `legend`. See [scene-diagram.md](scene-diagram.md).

| Beat cue | Meaning |
|---|---|
| `focus` | The node ids and edge ids to light. All other parts dim and the camera moves to the lit parts. `"all"` lights all parts. Omit it to light the parts that are visible. |

### `manim`

Scene fields: `class` (required, the `VAScene` subclass to render), optional `script` (the default is `manim/<id>.py`. Some scenes can share one script). Beats have no cue. The script addresses beats by index. See [scene-manim.md](scene-manim.md).

### `stat`, `compare`, `chart`, `table`, `matrix`, `quote`, `figure`

The evidence scenes show the things that the source reports. The tool draws them from the storyboard, and you build nothing. [scene-evidence.md](scene-evidence.md) has the fields, the defaults, and an example of each.

| Kind | Scene fields | `show` counts |
|---|---|---|
| `stat` | `metrics`: one to four of `{"value", "unit", "label", "detail", "delta", "tone"}` | metrics on screen |
| `compare` | `left` and `right`, or `panels` (two or three): each `{"label", "tone", "points"}`. `versus` | points on screen, counted across the panels in reading order |
| `chart` | `labels` with `values`, or with `series` (one to four of `{"label", "values"}`). `chart` (`"bar"`, `"line"`, or `"scatter"`), `unit`, `axis`. A scatter takes `points` (or `series` of `{"label", "points"}`), each `{"x", "y", "label"}`, and `across` | labels drawn until now (for a scatter: points) |
| `table` | `columns` (two to five), `rows` (one to six, one cell for each column), `best`, `highlight`, `caption` | rows on screen |
| `matrix` | `rows`, `columns` (two to eight each), `values`, `scale`, `numbers`, `axis` | rows filled |
| `quote` | `quote`, `highlight` (a phrase of it, or some phrases), `attribution` | phrases marked |
| `figure` | `image` (a PNG, JPEG, or WebP in the project), `caption`, `crop` (`{"x", "y", "width", "height"}` in percent), `callouts`: five at most of `{"label", "x", "y", "side"}` | callouts shown |

All kinds but `quote` and `figure` take an optional `title`: a line above the picture with stars on its important words.

| Beat cue | Meaning |
|---|---|
| `show` | The number of parts of the scene that are on screen from this beat. The default is one more for each beat (the points of one panel, in a `compare`), and all parts on the last beat. |
| `focus` | In a `chart`: the labels, points, or series that this sentence is about. In a `table`: rows (by their first cell) or columns. In a `matrix`: rows or columns. The others step back. |
| `note` | A short callout below the picture during this beat: the qualification that the number needs. |

### `credit`

The end card: the name of the work, animated in, and where to find it. It is always the last scene, after the recap.

The same card is the title card when the need of the scene is `name`. A title card goes immediately after the opening, with one line that says this is the aim of the work. It has the same fields. See [opening.md](opening.md), "Then name it".

Scene fields:

- `title` (required): the name of the function, file, project, or paper, as a person searches for it
- `subtitle`: where it is: a path, the authors and the year, a short address
- `kicker`: a label for the kind of thing: `"The code"`, `"The paper"`

It has one beat: one short line that says the name aloud. It has no cues.

### `bullets`

The recap. Scene fields: `items` (required, three or four), optional `title`, optional `over` (the scene whose last frame shows by default).

Each item is a line of text, or `{"text": "...", "from": "<scene id>", "beat": n}`. The second form shows the takeaway next to the moment that proved it: the named scene, stopped at the end of that beat. The default is its last beat. With pictures, one takeaway is on screen at a time, and the picture has most of the frame. Keep a takeaway to 48 characters or fewer. See [taste.md](taste.md).

| Beat cue | Meaning |
|---|---|
| `show` | The number of items that are visible during this beat. The default is one more for each beat, and all items on the last beat. |

## Example

Two full projects are at the root of this repository:

- `examples/lru-cache/video/`: an opening with a hook, three trace scenes, a recap
- `examples/binary-search/video/`: a comparison animation, a trace scene, a formula scene

Start from the one that is nearer to your subject.

```json
{
  "title": "How an LRU cache decides what to forget",
  "subject": "algorithm",
  "brief": {
    "audience": "programmers who have used a cache but not built one",
    "length": 95,
    "context": "A cache keeps what you asked for lately, and it has limited room.",
    "hook": "A full cache has to *forget* a key, and the obvious choice is *wrong*."
  },
  "voice": "en-US-AndrewNeural",
  "sourceRoot": "..",
  "thumbnail": {"text": "Cache full.\nWhat gets *forgotten*?", "from": "read"},
  "scenes": [
    {
      "id": "forget",
      "need": "motion",
      "why": "Opening: the cache the viewer knows, full, and the obvious key to drop turning out to be the wrong one.",
      "class": "Forget",
      "script": "manim/lru.py",
      "beats": [
        {"say": "A cache keeps what you asked for lately, and it has limited room. This one holds three keys, and it is full."},
        {"say": "To store a fourth, it has to forget one, and the obvious choice is wrong."}
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
        {"say": "And every read and every write moves a key to the newest end. That is how it decides what to forget."}
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

The second beat of `read` has no cue. The word `move_to_end` highlights the one line that contains it.
