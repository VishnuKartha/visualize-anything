# visualize-anything

A router skill for coding agents that turns code into a narrated explainer video. It writes the narration first, then gives each part of the story the kind of picture that explains it best, and stitches the scenes together with Remotion.

| The story is saying... | Routed to | Rendered by |
|---|---|---|
| "Watch what happens to the data", "first it checks..., and if so..." | animation of the algorithm, including its branches and formulas | [Manim](https://www.manim.community/) |
| "This line does X", "each time around the loop..." | the code with a moving highlight, beside the data it changes | Remotion + Manim |
| "The fix is one line" / "a million against twenty" | an animated diff of the code; a chart or comparison | [HyperFrames](https://github.com/heygen-com/hyperframes) |
| "Thirty-six frames a second", "a simulator remembers, a video model looks real", "seventy-one seconds, then forty-one" | what the source itself reports: its number counted up, its alternatives side by side, its results as bars or a line, its own words, its own figure | Remotion |
| "The API asks the cache, then the database" | architecture, sequence, dataflow, workflow, or lifecycle diagram of a system's separate parts | [Archify](https://github.com/tt-a1i/archify) |
| Opening hook, recap, end card | statement, bullets, credit | Remotion |

Two rules hold throughout. Code is never shown alone: whenever lines are on screen, a picture of what they do is beside them. And algorithms are animated end to end; Archify is reserved for how the components of a system relate.

Every video opens on an animation, drawn in Manim. It starts from where the viewer already is, in a sentence or two, and then lands the hook on the same picture: the core of the problem, or the most interesting thing about the answer. Both are agreed before anything is written. No lecture, no link, and no hook said to a viewer who has not been told what it is about. The title card comes after that opening, not before it: one line says this is what the work sets out to show, and the card names it. It ends on the picture, not a list: each takeaway is shown beside the moment that proved it. Then a short end card names what was explained and where to find it. The thumbnail is a hook frame: five words at most above one picture from the video.

These and the other decisions about taste (no reciting code, no filler, a pause after the main point, a minimum text size, one palette, pictures carried across scenes) are written down in [taste.md](skills/visualize-anything/references/taste.md), and most are checked automatically.

## The method

The router decides what each scene looks like. What makes the video worth trusting is the method around it, which follows the one in Jeffrey Emanuel's [jeffs_math_explainer_videos](https://github.com/Dicklesworthstone/jeffs_math_explainer_videos): a chain of gates that fail closed, each one there because of a way an explainer goes wrong.

| Gate | What it holds | How |
|---|---|---|
| Facts | No number is typed. Every number said or shown is a row in the storyboard's `facts`, computed again by an oracle (`facts.py`) that runs the real code | `va facts` (a difference stops the build); `va route` lists numbers with no row |
| Edges | A sentence that says always or never names the fact that tried its edge cases | `va route` |
| Abstract | For a paper: every claim of its abstract is shown by a scene or set aside with a reason, every number it states is said, and every number credited to the paper is in the paper | `va paper`, then `va route` and `va facts` |
| Words | One word per idea, and no word before the scene that explains it | `va route`, against the storyboard's `vocabulary` |
| Plan review | The script and storyboard are read by three fresh agents before anything is recorded: a newcomer, a practitioner, an expert. Each says every scene back in one sentence; one they cannot is a blocker | `va review --plan` |
| Prediction | At least one question is left open long enough for the viewer to answer it | `"predict": true` on a beat; `va route` |
| Sound | A music bed, if you bring one, is ducked ahead of each sentence and measured afterwards: 18 LU under the voice, refused closer than 16 | `"music"`; `va render` |
| Video review | The rendered video is judged by an agent that did not build it, against the same three viewers; every finding gets a disposition | `va review` |

Those ideas are that project's; the code here is not. It renders maths videos in Rust on its author's own engine and voice stack, and its licence carries a rider that would attach to anything derived from it, so nothing from it is included or required. [facts.md](skills/visualize-anything/references/facts.md) and [review.md](skills/visualize-anything/references/review.md) describe this skill's versions.

## The router

The agent does not pick renderers directly. For each scene it declares what the viewer needs to see, from a closed vocabulary (`source`, `trace`, `change`, `data`, `number`, `contrast`, `chart`, `quote`, `figure`, `motion`, `branching`, `math`, `structure`, `conversation`, `pipeline`, `process`, `states`, `question`, `recap`, `credit`), and `va route` does the rest:

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
- **Prose check**: Vale reads each script with the proselint and ai-tells rule packages (`va prose`). Vale is a required dependency, installed by `va setup`.
- **Sequence rules**: open on a Manim animation that gives the agreed context and then the agreed hook, no scene starts over, no three same-kind scenes in a row, an identifier named on screen has its code nearby, every beat changes the picture.
- **Explainable and overridable**: every verdict states its reason, and a scene can disagree by recording an `override` with its own reason. Routing errors block the build.

The design borrows from two projects: the style director in [html-explainer](https://github.com/OneMoh/html-explainer) (roles from position and text cues, diversity constraints, a `why` per decision) and the semantic annotation and card matching in [video-talkcraft](https://github.com/Vincentwei1021/video-talkcraft) (declare what each sentence needs, check coverage, write a deviation line to disagree). The trace scene, the algorithm drawing patterns, and the list of Manim pitfalls draw on [3brown1blue](https://github.com/AmitSubhash/3brown1blue) and [manim_skill](https://github.com/adithya-s-k/manim_skill); narration that drives the highlight by naming things on [diagram-tour](https://github.com/centraltowerlabs/diagram-tour); spoken-form conversion on [paperview](https://github.com/ssrajadh/paperview); the independent review loop on [motion-video-kit](https://github.com/echris6/motion-video-kit). The evidence scenes (a number counted up, panels set against each other, bars and lines, a marked quote, a figure with its parts pointed out) take their catalogue from the scene templates of [paper-video](https://github.com/nikhilanand03/paper-video), which turns a PDF into a narrated deck; here each is redrawn in this skill's palette and is driven beat by beat by the narration. The review tooling follows the same two projects: narration-anchored cues and in-browser layout measurement from html-explainer; contact sheets, per-shot rendering, and static-frame detection from video-talkcraft. No code from any of these is included.

Narration is synthesized with [edge-tts](https://github.com/rany2/edge-tts) (no API key). [Remotion](https://www.remotion.dev/) is the glue: it times every scene to the measured audio, layers voice and word-timed captions, and renders the MP4.

## How it works

```
read the code
     │
     ▼
va facts ───────── facts.py runs the real code; every number the video will use is computed first
     │
     ▼
script.md ──────── the whole narration, written as one piece
     │
     ▼
storyboard.json ── scenes, each with a need and narrated beats; facts; vocabulary
     │
     ▼
va review --plan ─ three viewers read the plan before anything is recorded
     │
     ▼
va tts ─────────── one edge-tts clip per beat → timeline.json (frame-exact time budget)
     │
     ├─ title / bullets / number / contrast / chart / quote / figure ── nothing to build; rendered from the storyboard
     ├─ manim ──── VAScene script, each beat held to its narration window → clip
     ├─ hyperframes ─ a diff between versions of code (or your own HTML composition), timed to the beats → clip
     └─ diagram ── Archify candidate → finalize gates → baked SVG, revealed and framed per beat
     │
     ▼
va stills ──────── contact sheets of every visual state, with layout measured in the browser
     │
     ▼
va render ──────── Remotion renders each scene (unchanged ones are reused), ffmpeg joins them
                   and lays the narration under → video.mp4, .srt, .vtt, thumbnail.png, QC report
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

## Try the examples

[examples/lru-cache](examples/lru-cache) explains a 20-line LRU cache in ninety seconds: an opening hook, then three trace scenes that share one evolving picture of the cache, each showing a few lines of the class beside what they do to it, and a recap. It is an algorithm, so it has no Archify scene.

```bash
node skills/visualize-anything/runtime/va.mjs build examples/lru-cache/video
```

[examples/binary-search](examples/binary-search) is a one-minute video: a scan and a binary search race on the same list, a trace scene steps through eleven lines of code beside the narrowing search range, and a Manim scene makes the halving argument with typeset formulas.

```bash
node skills/visualize-anything/runtime/va.mjs build examples/binary-search/video
```

Results are written to each project's `out/video.mp4`. Its [storyboard.json](examples/lru-cache/video/storyboard.json) is a good template, including a `why` for each routing choice, and its [facts.py](examples/lru-cache/video/facts.py) shows an oracle that watches the real class run.

## CLI

```
va setup | doctor
va init <slug>                 create .visualize/<slug>/ with a starter storyboard
va route <project>             review every routing decision: need → renderer, with reasons
va check <project>             validate the storyboard and its routing
va paper <project> <source>    read a paper into the project (arXiv id, address, or PDF): abstract first
va facts <project>             run the oracle (facts.py); hold every number in the video to it
va tts <project>               narration → timeline.json
va diagram <project> [ids]     Archify candidates → baked diagrams
va manim <project> [ids]       Manim scripts → clips at narration length
va hyperframes <project> [ids] code diffs and authored HTML compositions → clips
va stills <project> [ids]      contact sheets + layout check   (--at <seconds> for one frame)
va render <project>            → out/video.mp4, .srt, .vtt, thumbnail.png   (--draft, --force)
va qc <project>                check the rendered video: complete, audible, picture not frozen
va review <project>            write the brief for an independent reviewer   (--verify <report>)
va review <project> --plan     before building: one brief each for the newcomer, practitioner, expert
va build <project>             facts → tts → diagram → manim → hyperframes → render
va studio <project>            interactive preview in Remotion Studio
```

Every step is cached by content. Changing one scene reruns one scene, including at render time.

## Review and quality tooling

- **Written-form narration.** Narration is written the way it reads on screen (`move_to_end`, `O(log n)`); the voice is given the spoken form and the captions keep the original.
- **The picture follows what is named.** Say an identifier and its line is highlighted at that word; say a diagram node's label and it lights up. No cue needed.
- **Mixed renderers.** Remotion, Manim, Archify, and HyperFrames scenes share one backdrop, palette, heading, and caption style, so a video can cut between them without the seam showing.
- **Evidence scenes.** A paper's number, its comparison with prior work, its results, its words, and its own figure each have a scene that draws them from the storyboard, with every part arriving on the word that names it and every number held to the facts ledger.
- **A kit of ready-made pictures.** Manim scenes are composed, not drawn from scratch: `va_manim` ships a row of cells with pointers, a number that counts with its unit, a pipeline with something travelling along it, steps along a line, trees and graphs, braces, labels, and layout helpers, all built on [Manim Community](https://github.com/ManimCommunity/manim)'s own mobjects and checked against a pinned release. `runtime/python/va_gallery.py` draws all of them, and `va manim` warns when a script ignores the kit or reaches for a Manim class that needs LaTeX.
- **Papers are read in.** `va paper` fetches an arXiv paper (or reads a PDF) into the project: the abstract split into numbered claims, the sections, the tables as tables, the figures as images, and the licence. The plan is then held to the abstract claim by claim. The reading follows the extract stage of [paper-video](https://github.com/nikhilanand03/paper-video), without its paid parser.
- **Trace scenes.** Code on the left with a highlight stepping through it, the data it changes animated on the right, both driven by the same sentence.
- **Facts ledger.** Numbers are computed, not typed. `facts.py` runs the code being explained on the video's own example; `va facts` compares it with the storyboard, at the precision the storyboard writes, and a Manim script reads the same values with `fact("<id>")`.
- **Three viewers.** `va review --plan` writes one brief per viewer before anything is built; the video review holds the result to the same three contracts.
- **Independent review.** `va review` writes a brief for a fresh agent that did not build the video: the plan, the narration, the frames, and what the checks found. A second round verifies the fixes.
- **Prediction pauses.** A beat marked `predict` ends on a question; the voice waits and the picture holds before the next beat answers.
- **Music under the voice.** A bed you supply is ducked from the narration's own timeline, shaped to stay out of the voice's band, and measured: the render fails if it sits closer than 16 LU or the mix peaks over -1 dBTP. No music is supplied or generated.
- **Word-anchored cues.** A beat can change the picture mid-sentence: `{"at": "check the size", "lines": 21}` moves the highlight when those words are spoken, using the speech engine's word timestamps. Manim scenes get the same with `beat.until("<phrase>")`.
- **Contact sheets.** `va stills` puts every visual state of the video on a few labelled images, so a reviewer reads three images instead of twenty.
- **Script check.** The narration is written whole in `script.md` and then split; the router checks that the storyboard says those words, in that order, and nothing else.
- **Seam check.** The rendered file is measured for places it stops being continuous: a single-frame cut, a jump at a join meant to carry on, the voice stopping where the picture does not, dead air, a line at a different level. Same file, same answer.
- **Layout check.** While making the sheets, every scene Remotion draws (title, code, bullets, and the evidence scenes) is measured in the browser: anything off the frame, colliding with captions or heading, or cut off is reported and outlined in red. Manim clips are checked for drawing under the captions or heading.
- **Static-picture detection.** `va qc` finds stretches where the picture holds still for more than six seconds under a moving voice, and says which beat to fix.
- **Deliverables.** Every render also writes `.srt` and `.vtt` subtitles and a thumbnail.

## Layout

```
skills/visualize-anything/
├── SKILL.md                 the router: workflow and contract
├── references/              routing rules, storyboard format, diagram and Manim scene guides
└── runtime/
    ├── va.mjs, lib/         CLI: router, facts ledger, viewers, validation, timeline, Archify bake, Manim render, Remotion render, sound, QC
    ├── test/                router, facts, cue timing, duck envelope, seam, and subtitle tests (npm test)
    ├── python/              tts.py (edge-tts), va_manim.py (beat timing, theme, and the kit of ready-made pictures for Manim), va_gallery.py (every one of them, drawn)
    ├── hyperframes/         the code-change composition and a starter for authored ones
    ├── src/                 Remotion composition and scene components
    └── theme.json           one palette shared by Remotion, Manim, and the Archify dark theme
examples/lru-cache/          a complete project
```

## Third-party terms

This project calls other tools rather than bundling them; each keeps its own terms. Remotion is free for individuals and small teams and requires a [company license](https://www.remotion.dev/docs/license) above that. Archify and Manim are MIT licensed; Typst and HyperFrames are Apache-2.0; Shiki Magic Move is MIT; GSAP is under its own no-charge [standard license](https://gsap.com/standard-license). HyperFrames is fetched with `npx` at a pinned version and only its `render` command is used, with telemetry off. edge-tts uses Microsoft Edge's online read-aloud service, which has no published terms for this use; check before relying on it commercially, and swap `runtime/python/tts.py` for another engine if needed (it only has to produce one audio file and a duration per beat).
