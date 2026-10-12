# HyperFrames scenes

[HyperFrames](https://github.com/heygen-com/hyperframes) renders an HTML page with a GSAP timeline to video. In this skill it is a second scene renderer, with Remotion. The tool renders a HyperFrames scene to a clip with the exact length of the narration of the scene. Remotion puts that clip on the timeline, with the usual heading, voice, and captions over it. One video can cut between Remotion, Manim, and HyperFrames scenes.

Use it for two things that the Remotion scenes do not do:

- **Code that changes** (`need: "change"`): a diff. Removed lines close and added lines open in their place. This is built in. You supply the versions.
- **A designed picture for one use** (`need: "data"`, or a picture that no other scene kind draws): a chart, a count, a comparison. You write the composition.

```bash
VA hyperframes <project> [scene-id...]
```

The tool runs only the `render` command of HyperFrames. It uses one pinned version, with telemetry off. Do not run `npx hyperframes init` or `add` yourself. `init` installs the agent skills of HyperFrames into the global skill directories of the user.

## Code that changes

```json
{
  "id": "the-fix",
  "need": "change",
  "why": "The bug is one comparison. A diff shows exactly which line was wrong and what replaced it.",
  "heading": "search.py · the off-by-one",
  "title": "search.py",
  "versions": [{"file": "src/search_buggy.py", "range": [1, 11]}, {"file": "src/search.py", "range": [1, 11]}],
  "beats": [
    {"say": "This version stops while one candidate is still unchecked."},
    {"say": "The fix is a single character: the loop has to run while lo is less than or equal to hi."}
  ]
}
```

| Field | Meaning |
|---|---|
| `versions` | Two or more versions of the code. Each is `{"file", "range"}` or `{"code", "lang"}`, the same as the excerpt of a code scene. Use real source where it exists. |
| `effect` | `"diff"` (the default): removed lines get a red mark and close, and added lines open in green. `"morph"`: tokens that stay move to their new position and the others fade. See the caution below. |
| `title` | Shown in the panel header. The default is the file name of the first version. |
| `lang` | The language for all versions, when you give them inline. |

Which version is on screen:

- If you say nothing, each beat shows the next version. Beat 1 shows version 0, beat 2 changes to version 1, and so on.
- To select, put `"version": n` on a beat. Or put a change on a spoken phrase with a cue: `{"at": "replaces the scan", "version": 1}`. A version stays until you name a different one.

Use the diff. It has meaning: red is the code that went, green is the code that arrived, and all other code stays still so that the viewer can read it.

Morph is available but rarely explains a thing. A viewer cannot read code while it moves. The final position of a token is not the information that the viewer needs. Use it only for a small edit in place, where almost all tokens stay: a new name, or one added argument. Do not use it between two pieces of code that only do the same job. Most of the screen will mix.

A change scene is for a change to the code. To compare the behaviour of two approaches (a scan against a binary search), run the two on the same data in a Manim scene. That is `motion`, not `change`.

Keep each version to approximately 20 lines and 90 columns. The tool sets the panel size one time, for the largest version. Give each version three seconds or more on screen. Do not give it more than approximately six seconds unless a different thing changes. `va qc` reports a version that stays still.

## A composition you write

When no scene kind draws the necessary picture, write the HTML yourself. Start from the starter, which is a comparison of two bars that works:

```bash
cp <skill>/runtime/hyperframes/starter.html <project>/html/<scene-id>.html
```

```json
{
  "id": "speed",
  "need": "data",
  "why": "The claim is a comparison of two numbers; show them as bars.",
  "heading": "worst case, one million items",
  "composition": "html/speed.html",
  "beats": [
    {"say": "A linear scan may need a million comparisons."},
    {"say": "Binary search needs twenty."}
  ]
}
```

`va hyperframes` copies your file into a build directory. It sets the `data-duration` of the root to the length of the scene. It puts these files next to yours:

| File | Gives you |
|---|---|
| `gsap.min.js` | GSAP, loaded locally. |
| `va.css` | The palette as CSS variables (`--va-bg`, `--va-text`, `--va-muted`, `--va-accent`, `--va-cyan`, `--va-amber`, `--va-rose`, `--va-violet`, `--va-panel`, `--va-panel-border`). `--va-sans` and `--va-mono`, with the two typefaces included. `.va-backdrop`, the backdrop of all other scenes. |
| `va.js` | `VA`, the narration timing for this scene, and two helpers. |

`VA` has `duration`, `fps`, `theme`, and `beats`. Each beat has `text`, `start` (its window opens), `speech` (its first word), `end`, and `words` (each with `text` and `at`). All times are seconds from the start of the scene.

- `VA.at("a spoken phrase")` gives the time when the voice says that phrase. Use it so that each element arrives on the words that name it.
- `VA.register(timeline)` gives your timeline to the renderer.

The renderer depends on these rules:

1. Use one root element with `data-composition-id`, `data-start="0"`, `data-width="1920"`, `data-height="1080"`.
2. Use one GSAP timeline. Make it with `{paused: true}` and give it to `VA.register`. The renderer moves through it frame by frame.
3. Nothing else can move. Do not use CSS `transition` or `animation`. Do not use `setTimeout`, `setInterval`, or `requestAnimationFrame`. Do not use `Math.random`. Do not load a thing from the network.
4. Keep the content between y = 110 and y = 900. The scene heading is above that and the captions are below. `va hyperframes` gives a warning if the clip draws in the caption strip.
5. Put `<div class="va-backdrop"></div>` first in the root, and use the `--va-*` variables. The scene then agrees with the adjacent scenes.

The HyperFrames registry has some hundred ready blocks (charts, maps, terminal windows, cursors) that you can read for technique. Each block is one HTML file at `registry/blocks/<name>/<name>.html` in the HyperFrames repository. Change the style of each thing that you take to the `--va-*` palette. If not, the video looks stitched together.

## What does not carry over

A HyperFrames scene arrives as complete video. Thus the functions that reach into a live scene do not apply to it: cues derived from the narration, `lines` and `focus`, and the layout measurement in the browser. Its timing is fixed when it renders, from the versions and cues of the storyboard, or from `VA` in your composition. Examine its frames on the contact sheets, as for a Manim scene.

A cut between a HyperFrames scene and a different scene is the same short fade as all other cuts. The shader transitions of HyperFrames work only between two HyperFrames compositions. This skill does not use them.
