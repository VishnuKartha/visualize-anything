# visualize-anything

A router skill for coding agents that turns code into a narrated explainer video. It writes the narration first, then gives each part of the story the kind of picture that explains it best, and stitches the scenes together with Remotion.

| The story is saying... | Routed to | Rendered by |
|---|---|---|
| "This line does X" | syntax-highlighted source with line focus | Remotion |
| "Watch what happens to the data", "first it checks..., and if so..." | animation of the algorithm, including its branches and formulas | [Manim](https://www.manim.community/) |
| "The API asks the cache, then the database" | architecture, sequence, dataflow, workflow, or lifecycle diagram of a system's separate parts | [Archify](https://github.com/tt-a1i/archify) |
| Opening question, recap | title card, bullets | Remotion |

Algorithms and data structures are animated end to end in Manim; Archify is reserved for how the components of a system relate.

## The router

The agent does not pick renderers directly. For each scene it declares what the viewer needs to see, from a closed vocabulary (`source`, `motion`, `branching`, `math`, `structure`, `conversation`, `pipeline`, `process`, `states`, `question`, `recap`), and `va route` does the rest:

```
Routing: 7 scenes, subject "algorithm", about 124s.
   ok     intro     question     → title                   15s
   ok     state     source       → code                    18s
   ok     order     motion       → manim                   36s
  ERROR   put-flow  process      → diagram · workflow      12s
            error: This is an algorithm video, so a diagram scene is out of place: show the behaviour
                   in Manim, on the data the viewer is already watching. ...
   ok     put       source       → code                    12s
   ok     recap     recap        → bullets                 19s
```

- **Need to renderer** is a fixed table, so the same intent always gets the same kind of picture.
- **Cross-check**: cue words in the narration question a declared need they do not support. They never choose the route.
- **Sequence rules**: open on a title, no three same-kind scenes in a row, an identifier named on screen has its code nearby, every beat changes the picture.
- **Explainable and overridable**: every verdict states its reason, and a scene can disagree by recording an `override` with its own reason. Routing errors block the build.

The design borrows from two projects: the style director in [html-explainer](https://github.com/OneMoh/html-explainer) (roles from position and text cues, diversity constraints, a `why` per decision) and the semantic annotation and card matching in [video-talkcraft](https://github.com/Vincentwei1021/video-talkcraft) (declare what each sentence needs, check coverage, write a deviation line to disagree). No code from either is included.

Narration is synthesized with [edge-tts](https://github.com/rany2/edge-tts) (no API key). [Remotion](https://www.remotion.dev/) is the glue: it times every scene to the measured audio, layers voice and word-timed captions, and renders the MP4.

## How it works

```
read the code
     │
     ▼
storyboard.json ── scenes, each with a kind and narrated beats
     │
     ▼
va tts ─────────── one edge-tts clip per beat → timeline.json (frame-exact time budget)
     │
     ├─ code / title / bullets ── nothing to build; rendered from the storyboard
     ├─ manim ──── VAScene script, each beat held to its narration window → clip
     └─ diagram ── Archify candidate → finalize gates → baked SVG, revealed and framed per beat
     │
     ▼
va render ──────── Remotion composes scenes + voice + captions → out/video.mp4
```

The idea borrowed from [manim-skill](https://github.com/Yusuke710/manim-skill) is that narration is the clock: every line becomes one audio clip with a measured duration, and visuals are built to fit those durations rather than the other way round. Here that budget is shared by three renderers instead of one.

## Requirements

- Node 20+, [uv](https://docs.astral.sh/uv/), ffmpeg
- Google Chrome (or set `VA_CHROME`) for diagram scenes
- Network access for edge-tts
- No LaTeX: formulas in Manim scenes are typeset by [Typst](https://typst.app/), a self-contained alternative that `setup` downloads as a Python wheel

```bash
node skills/visualize-anything/runtime/va.mjs setup
```

`setup` installs the Remotion runtime into `skills/visualize-anything/runtime/node_modules`, a pinned copy of Archify into `~/.visualize-anything/vendor/archify`, and Manim with Typst into uv's cache. edge-tts is run through `uv` on demand.

## Use it as a skill

Point your agent at `skills/visualize-anything/`. For Claude Code, either add this repository as a plugin marketplace, or link the skill directly:

```bash
ln -s "$(pwd)/skills/visualize-anything" ~/.claude/skills/visualize-anything
```

Then ask for a video: "make an explainer video for `src/auth/session.ts`". The skill's instructions are in [SKILL.md](skills/visualize-anything/SKILL.md); routing rules are in [references/routing.md](skills/visualize-anything/references/routing.md).

## Try the example

[examples/lru-cache](examples/lru-cache) explains a 20-line LRU cache in two minutes: three code scenes, two Manim animations that share one evolving picture of the cache (with a Typst-typeset capacity check), a title, and a recap. It is an algorithm, so it has no Archify scene.

```bash
node skills/visualize-anything/runtime/va.mjs build examples/lru-cache/video
```

The result is written to `examples/lru-cache/video/out/video.mp4`. Its [storyboard.json](examples/lru-cache/video/storyboard.json) is a good template, including a `why` for each routing choice.

## CLI

```
va setup | doctor
va init <slug>                 create .visualize/<slug>/ with a starter storyboard
va route <project>             review every routing decision: need → renderer, with reasons
va check <project>             validate the storyboard and its routing
va tts <project>               narration → timeline.json
va diagram <project> [ids]     Archify candidates → baked diagrams
va manim <project> [ids]       Manim scripts → clips at narration length
va stills <project> [ids]      one PNG per beat for review
va render <project>            → out/video.mp4      (--draft for half resolution)
va build <project>             all of the above
va studio <project>            interactive preview in Remotion Studio
```

Every step is cached by content. Changing one scene reruns one scene.

## Layout

```
skills/visualize-anything/
├── SKILL.md                 the router: workflow and contract
├── references/              routing rules, storyboard format, diagram and Manim scene guides
└── runtime/
    ├── va.mjs, lib/         CLI: router, validation, timeline, Archify bake, Manim render, Remotion render
    ├── test/                router tests (npm test)
    ├── python/              tts.py (edge-tts), va_manim.py (beat timing + theme for Manim)
    ├── src/                 Remotion composition and scene components
    └── theme.json           one palette shared by Remotion, Manim, and the Archify dark theme
examples/lru-cache/          a complete project
```

## Third-party terms

This project calls other tools rather than bundling them; each keeps its own terms. Remotion is free for individuals and small teams and requires a [company license](https://www.remotion.dev/docs/license) above that. Archify and Manim are MIT licensed; Typst is Apache-2.0. edge-tts uses Microsoft Edge's online read-aloud service, which has no published terms for this use; check before relying on it commercially, and swap `runtime/python/tts.py` for another engine if needed (it only has to produce one audio file and a duration per beat).
