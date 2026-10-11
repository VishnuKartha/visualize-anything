---
name: visualize-anything
description: Turn code (or any technical topic) into a narrated explainer video. Writes a narration, synthesizes it with edge-tts, routes each part of the story to the visualization that explains it best — real syntax-highlighted code, a Manim animation for algorithms and data structures, or an Archify diagram for how a system's components relate — and stitches the scenes into one MP4 with Remotion. Use when the user asks for a code explainer, code walkthrough video, "explain this repo/file/function as a video", an animated explanation of an algorithm or system, or a narrated technical video.
---

# visualize-anything

You are the director of a short narrated explainer. The story decides the pictures: write what is said first, then give each part of the story the kind of picture that explains it best, and let Remotion assemble the result.

Three renderers produce pictures. Remotion is the glue that times, layers, and renders them.

| Renderer | Scene kind | It answers |
|---|---|---|
| Remotion (native) | `title`, `bullets`, `credit` | Why should I watch this? What should I remember? What was this, and where do I find it? |
| Manim | `manim` | How does the algorithm or data structure behave? What happens to the data, step by step and branch by branch? What does the math say? |
| Remotion + Manim | `trace` | What does the code say, and what does it do? The lines with a moving highlight, beside the data they change. |
| HyperFrames | `hyperframes` | What changed between two versions of the code? How do these numbers compare? |
| Archify | `diagram` | How do the separate components of a system relate? Who calls whom, in what order? |

The house rules, in [references/taste.md](references/taste.md), shape every video. Read them before writing a storyboard. The ones that decide the most:

- **Code is never shown alone.** Whenever code is on screen, a picture of what it does is beside it (a `trace` scene). The router rejects a scene that is only a code block.
- **An algorithm is animated, not flowcharted.** Keep one evolving picture of the data for the whole behaviour. Reach for Archify only when the subject is a system made of separate parts.
- **Open on the picture, with the hook said over it.** The hook is the core of the problem, or the most interesting thing about the answer, and it is agreed before anything is written. No title card, no introduction, no link at the start.
- **Every scene follows on from the one before.** None starts over with "now let's look at".
- **End on the picture.** No slide of bullets. The recap shows each takeaway beside the moment that proved it, and its last line returns to the hook. The name of what was explained comes after that, in a short `credit` scene.
- **One picture, carried through.** Scenes that share a picture are marked `continues` and do not fade between each other.
- **The voice explains.** It does not recite code or pad with filler, and it leaves a moment of quiet after the main point (`land`).

You do not pick renderers directly. You declare what each scene's viewer needs to see (`need`), and the router maps that to a renderer and reviews your choices. See [references/routing.md](references/routing.md).

## Contract

- Continue until `out/video.mp4` exists and you have looked at its frames. If blocked, report the exact blocker.
- The storyboard's narration is the clock. Never write a visual before `va tts` has told you how long each beat lasts.
- Every factual claim in the narration must come from code you actually read. Quote real lines with `file` + `range`; do not retype code from memory.
- The hook is settled with the user before the storyboard, and the video opens on the picture that shows it: no title card, no introduction, no pointer to the source. The thumbnail is a hook frame you write (`thumbnail`), and the source is named in the last scene. Read [references/opening.md](references/opening.md) before the brief.
- Report honestly: say which checks you ran and which stills you looked at.

## Setup

`VA` below means `node <this skill's directory>/runtime/va.mjs`. Run it from the user's working directory.

```bash
node <skill>/runtime/va.mjs doctor
```

If anything is marked `MISS`, run `va setup` once. It installs the Remotion runtime, a pinned copy of Archify under `~/.visualize-anything/`, and Manim with Typst through `uv`. Typst typesets formulas in Manim scenes, so no LaTeX installation is needed: write `Math("O(log n)")` instead of `MathTex`.

## Workflow: Brief → Understand → Storyboard → TTS → Visuals → Review → Render → Independent review

### 0. Agree the brief

A full build takes several minutes of rendering, so settle what is being made before starting. From the request, work out and state back in one short message: the subject (which file, function, paper, or system), the audience (what they already know), the length (default 60 to 120 seconds), the focus (the one question the video answers), and the hook.

The hook decides the opening, so it gets more than an assumption. Read enough of the source to answer the four questions in [references/opening.md](references/opening.md) (what goes wrong without this, what someone would try first, what is most surprising about the answer, and for a paper what it made possible), write two or three candidate hooks of different kinds, test each as that file describes, and put them to the user with your recommendation first. Show the recommended one as the opening will be heard: its lines, and the first line of the scene that follows. If the user has said to go straight through, pick the strongest and say which you picked and why.

For the rest: if the request leaves something open in a way that changes the video, ask; otherwise state your assumption and go on. Record the result as `brief` in the storyboard, with the chosen hook as `brief.hook`.

### 1. Understand

Read the code the video is about, from its real location. Decide the one question the video answers and the three to five ideas that answer it. A good length is 60 to 150 seconds, about 150 to 380 spoken words.

Then decide the shape of the story, from [references/story.md](references/story.md): the obvious approach this code replaces and what that approach costs, the number that will be counted on screen, and the limit worth naming. A video that only walks through what the code does has skipped why it is written that way.

### 2. Storyboard

```bash
VA init <slug>          # prints the project directory, .visualize/<slug>/
```

Write `storyboard.json` there. It is the single source of truth: a `subject`, then an ordered list of scenes, each with a `need` and a list of `beats`. A beat is one spoken line plus the visual cue that accompanies it.

- Set `subject` and give every scene a `need` from the vocabulary in [references/routing.md](references/routing.md). Record the reason in the scene's `"why"`.
- Field-by-field format and a complete example: [references/storyboard.md](references/storyboard.md).
- Write the `thumbnail` (five words at most and the scene whose picture goes under them) and end on a `credit` scene that names what was explained. Both are in [references/opening.md](references/opening.md) and [references/taste.md](references/taste.md).
- Write narration for the ear: short sentences, one idea per beat, 8 to 25 words. Write identifiers and notation as they are (`move_to_end`, `O(log n)`): the voice gets a spoken form automatically and the captions keep what you wrote.
- Name things. When a sentence says an identifier or a diagram node's label, the highlight or focus follows it to that word without any cue from you. "It refreshes the entry" moves nothing; "`move_to_end` refreshes the entry" moves the highlight.
- When you need more control, keep the sentence as one beat and add `cues` that land on spoken words (`{"at": "check the size", "lines": 21}`).

```bash
VA route <project>      # the router's verdict on every scene and on the sequence, with reasons
VA check <project>      # the same, plus structure, line ranges, and file paths. No network.
```

Read the routing report before going further. An `ERROR` blocks every later step: fix the scene, or add an `override` with the reason if the route really is right. A `REVIEW` is advice: act on it or leave it, but do not skip reading it. Rerun `va route` whenever narration or scene order changes.

**Approval gate.** Before synthesizing or rendering anything, read the whole narration through as one piece and fix every join where a scene starts over instead of following on. Then show the user the routing table and the narration, scene by scene, and wait for a go-ahead or changes. Changing a sentence now costs nothing; changing it after the render costs the render. Skip the gate only if the user has said to go straight through.

### 3. TTS

```bash
VA tts <project>
```

Synthesizes one clip per beat with edge-tts and writes `timeline.json`. It prints the time budget: how many seconds each beat's visual window lasts. Those numbers are what you build the diagram focus and Manim animations against. Unchanged lines are cached, so rerunning after a wording edit is cheap.

### 4. Visuals

`title`, `bullets`, and `credit` scenes need nothing more: they render from the storyboard.

**HyperFrames scenes** — read [references/scene-hyperframes.md](references/scene-hyperframes.md). A `change` scene needs only its `versions` in the storyboard; a `data` scene needs a composition at `html/<scene-id>.html`. Then:

```bash
VA hyperframes <project> [scene-id...]
```

**Diagram scenes** — read [references/scene-diagram.md](references/scene-diagram.md), write the Archify candidate at `diagrams/<scene-id>.json`, then:

```bash
VA diagram <project> [scene-id...]
```

This runs Archify's `finalize` gates, then bakes the result for video. It prints the node and edge ids; use them in each beat's `focus`. A non-zero exit is never success: repair the candidate from the printed diagnostics and rerun.

**Manim and trace scenes** — read [references/scene-manim.md](references/scene-manim.md), starting with "What to draw", write `manim/<scene-id>.py`, then:

```bash
VA manim <project> [scene-id...]
```

It renders the scene and reports any beat whose animation ran past its narration window. Fix those by shortening `run_time` values, not by ignoring them.

### 5. Review

```bash
VA stills <project>                  # contact sheets: every visual state, nine to an image
VA stills <project> <scene-id...>    # the same for named scenes, at four to an image
VA stills <project> --at 42.5        # one moment, full size
```

Contact sheets land in `out/stills/sheet-NN.png`, each frame labelled with its scene, beat, and time. Read every sheet: a whole video is two or three images. Look for a highlight on the wrong lines, a diagram focused on the wrong nodes, text too small to read, a Manim object out of place.

The same pass measures layout in the browser for title, code, and bullets scenes and prints anything that runs off the frame, collides with the captions or heading, or is cut off; those frames are outlined in red on the sheet. Fix every layout issue it reports. `va manim` does the equivalent for animations, warning when a clip draws where the captions or heading sit.

### 6. Render

```bash
VA render <project>            # → .visualize/<slug>/out/video.mp4
```

Scenes are rendered one at a time and joined, and a scene whose inputs have not changed is reused, so after a fix only the scenes you touched are rendered again. Alongside the video you get `video.srt` and `video.vtt` (the captions as subtitle files) and `thumbnail.png` with `thumbnail-small.png` (the hook frame, and the same image at the size it is seen in a feed; look at the small one and cut words until every one can be read). `--draft` renders at half resolution for a faster look; `--force` ignores the cache.

Rendering ends with a quality check, also available as `VA qc <project>`: the file is complete, has audio, audio and picture agree in length, and the picture never sits still for more than six seconds while the voice carries on. A still stretch is the most common weakness in an explainer. Fix each one it lists: add a word-anchored cue so the highlight or focus moves mid-sentence, or in a Manim scene hold each move with `beat.until("<phrase>")` so the animation is spread across the sentence.

### 7. Independent review

You built the video, so you are the wrong one to judge it. Run `VA review <project>` and hand the brief it writes to a fresh subagent, as described in [references/review.md](references/review.md). Fix what the reviewer ranks highest, rerender, and run one verification round. If you cannot start a subagent, tell the user the video was not independently reviewed.

Then give the user the absolute path, the duration, the scene list with each scene's need, renderer, and why, and the reviewer's verdict with what changed because of it. `VA studio <project>` opens Remotion Studio for an interactive preview if the user wants to scrub.

`VA build <project>` runs tts → diagram → manim → hyperframes → render in one go once every source file exists.

## Iterating on feedback

Every step is cached by content, so change the source and rerun only what it affects:

| Changed | Rerun |
|---|---|
| Narration wording | `tts`, then `manim` (budgets moved), then `render` |
| A trace scene's `range`, `lines`, `note`, or `cues`; a title's `text` | `render` (only that scene is rendered again) |
| The `thumbnail` | `render` (no scene is rendered again; only the thumbnail) |
| A diagram candidate, or a beat's `focus` | `diagram <id>`, `render` |
| A Manim script | `manim <id>`, `render` |
| A change scene's versions or `version` cues, or an authored composition | `hyperframes <id>`, `render` |
| Anything after an independent review | the rows above, then `review --verify <report>` |
| Scene order, or a scene's `need` | `route`, `tts` (timeline is rebuilt), then the affected visuals, then `render` |

When feedback names a moment ("at 0:42 the label overlaps"), run `VA stills <project> --at 42` and look at that frame before changing anything.

## Project layout

```
.visualize/<slug>/
├── storyboard.json        # authored: scenes, beats, routing
├── diagrams/<id>.json     # authored: Archify candidates
├── manim/<id>.py          # authored: Manim scenes
├── html/<id>.html         # authored: HyperFrames compositions (only for scenes that need one)
├── timeline.json          # generated by tts: frame-exact beat windows
├── public/                # generated: audio/, assets/ (what Remotion reads)
├── .cache/                # generated: TTS clips, Archify HTML, Manim media
└── out/                   # generated: video.mp4, video.srt, video.vtt, thumbnail.png, thumbnail-small.png, stills/, review/
```

Only the authored files need to be kept; the project's `.gitignore` already excludes the rest.
