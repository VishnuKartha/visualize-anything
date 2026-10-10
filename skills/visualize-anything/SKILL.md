---
name: visualize-anything
description: Turn code (or any technical topic) into a narrated explainer video. Writes a narration, synthesizes it with edge-tts, routes each part of the story to the visualization that explains it best — real syntax-highlighted code, a Manim animation for algorithms and data structures, or an Archify diagram for how a system's components relate — and stitches the scenes into one MP4 with Remotion. Use when the user asks for a code explainer, code walkthrough video, "explain this repo/file/function as a video", an animated explanation of an algorithm or system, or a narrated technical video.
---

# visualize-anything

You are the director of a short narrated explainer. The story decides the pictures: write what is said first, then give each part of the story the kind of picture that explains it best, and let Remotion assemble the result.

Three renderers produce pictures. Remotion is the glue that times, layers, and renders them.

| Renderer | Scene kind | It answers |
|---|---|---|
| Remotion (native) | `title`, `code`, `bullets` | What does the code literally say? What is this section? What should I remember? |
| Manim | `manim` | How does the algorithm or data structure behave? What happens to the data, step by step and branch by branch? What does the math say? |
| Archify | `diagram` | How do the separate components of a system relate? Who calls whom, in what order? |

An algorithm explainer is `code` and `manim` only: keep one evolving animation for the whole behaviour and do not flowchart a function's branches. Reach for Archify when the subject is a system made of separate parts.

You do not pick renderers directly. You declare what each scene's viewer needs to see (`need`), and the router maps that to a renderer and reviews your choices. See [references/routing.md](references/routing.md).

## Contract

- Continue until `out/video.mp4` exists and you have looked at its frames. If blocked, report the exact blocker.
- The storyboard's narration is the clock. Never write a visual before `va tts` has told you how long each beat lasts.
- Every factual claim in the narration must come from code you actually read. Quote real lines with `file` + `range`; do not retype code from memory.
- Report honestly: say which checks you ran and which stills you looked at.

## Setup

`VA` below means `node <this skill's directory>/runtime/va.mjs`. Run it from the user's working directory.

```bash
node <skill>/runtime/va.mjs doctor
```

If anything is marked `MISS`, run `va setup` once. It installs the Remotion runtime, a pinned copy of Archify under `~/.visualize-anything/`, and Manim with Typst through `uv`. Typst typesets formulas in Manim scenes, so no LaTeX installation is needed: write `Math("O(log n)")` instead of `MathTex`.

## Workflow: Understand → Storyboard → TTS → Visuals → Review → Render

### 1. Understand

Read the code the video is about, from its real location. Decide the one question the video answers and the three to five ideas that answer it. A good length is 60 to 150 seconds, about 150 to 380 spoken words.

### 2. Storyboard

```bash
VA init <slug>          # prints the project directory, .visualize/<slug>/
```

Write `storyboard.json` there. It is the single source of truth: a `subject`, then an ordered list of scenes, each with a `need` and a list of `beats`. A beat is one spoken line plus the visual cue that accompanies it.

- Set `subject` and give every scene a `need` from the vocabulary in [references/routing.md](references/routing.md). Record the reason in the scene's `"why"`.
- Field-by-field format and a complete example: [references/storyboard.md](references/storyboard.md).
- Write narration for the ear: short sentences, one idea per beat, 8 to 25 words. Spell out what TTS would mangle and put the on-screen form in `caption` (say "move to end", caption `move_to_end`).

```bash
VA route <project>      # the router's verdict on every scene and on the sequence, with reasons
VA check <project>      # the same, plus structure, line ranges, and file paths. No network.
```

Read the routing report before going further. An `ERROR` blocks every later step: fix the scene, or add an `override` with the reason if the route really is right. A `REVIEW` is advice: act on it or leave it, but do not skip reading it. Rerun `va route` whenever narration or scene order changes.

### 3. TTS

```bash
VA tts <project>
```

Synthesizes one clip per beat with edge-tts and writes `timeline.json`. It prints the time budget: how many seconds each beat's visual window lasts. Those numbers are what you build the diagram focus and Manim animations against. Unchanged lines are cached, so rerunning after a wording edit is cheap.

### 4. Visuals

`title`, `code`, and `bullets` scenes need nothing more: they render from the storyboard.

**Diagram scenes** — read [references/scene-diagram.md](references/scene-diagram.md), write the Archify candidate at `diagrams/<scene-id>.json`, then:

```bash
VA diagram <project> [scene-id...]
```

This runs Archify's `finalize` gates, then bakes the result for video. It prints the node and edge ids; use them in each beat's `focus`. A non-zero exit is never success: repair the candidate from the printed diagnostics and rerun.

**Manim scenes** — read [references/scene-manim.md](references/scene-manim.md), write `manim/<scene-id>.py`, then:

```bash
VA manim <project> [scene-id...]
```

It renders the scene and reports any beat whose animation ran past its narration window. Fix those by shortening `run_time` values, not by ignoring them.

### 5. Review

```bash
VA stills <project> [scene-id...]
```

Writes one PNG per beat to `out/stills/`. Read them. Check for: text too small to read, anything overlapping the caption strip or the heading, a highlight on the wrong lines, a diagram beat that focuses the wrong nodes, a Manim object off screen. Fix and recapture only the affected scenes.

### 6. Render

```bash
VA render <project>            # → .visualize/<slug>/out/video.mp4
```

`--draft` renders at half resolution for a faster look. Verify the output with `ffprobe`, then give the user the absolute path, the duration, and the scene list with each scene's renderer and why you chose it. `VA studio <project>` opens Remotion Studio for an interactive preview if the user wants to scrub.

`VA build <project>` runs tts → diagram → manim → render in one go once every source file exists.

## Iterating on feedback

Every step is cached by content, so change the source and rerun only what it affects:

| Changed | Rerun |
|---|---|
| Narration wording | `tts`, then `manim` (budgets moved), then `render` |
| A code scene's `range`, `lines`, or `note` | `render` |
| A diagram candidate, or a beat's `focus` | `diagram <id>`, `render` |
| A Manim script | `manim <id>`, `render` |
| Scene order, or a scene's `need` | `route`, `tts` (timeline is rebuilt), then the affected visuals, then `render` |

When feedback names a moment ("at 0:42 the label overlaps"), extract that frame from `out/video.mp4` with ffmpeg and look at it before changing anything.

## Project layout

```
.visualize/<slug>/
├── storyboard.json        # authored: scenes, beats, routing
├── diagrams/<id>.json     # authored: Archify candidates
├── manim/<id>.py          # authored: Manim scenes
├── timeline.json          # generated by tts: frame-exact beat windows
├── public/                # generated: audio/, assets/ (what Remotion reads)
├── .cache/                # generated: TTS clips, Archify HTML, Manim media
└── out/                   # generated: video.mp4, stills/
```

Only the authored files need to be kept; the project's `.gitignore` already excludes the rest.
