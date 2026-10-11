# HyperFrames scenes

[HyperFrames](https://github.com/heygen-com/hyperframes) renders an HTML page with a GSAP timeline to video. Here it is a second scene renderer beside Remotion: a HyperFrames scene is rendered to a clip of the scene's exact narration length, and Remotion places that clip on the timeline with the usual heading, voice, and captions over it. One video can cut freely between Remotion, Manim, and HyperFrames scenes.

Use it for two things Remotion scenes here do not do:

- **Code that changes** (`need: "change"`): a diff, with removed lines closing up and added lines opening in their place. This is built in; you supply the versions.
- **A designed one-off** (`need: "data"`, or any picture no other scene kind covers): a chart, a count, a comparison. You write the composition.

```bash
VA hyperframes <project> [scene-id...]
```

Only HyperFrames' `render` command is ever run, pinned to one version, with its telemetry off. Do not run `npx hyperframes init` or `add` yourself: `init` installs HyperFrames' own agent skills into the user's global skill directories.

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
| `versions` | Two or more versions of the code, each `{"file", "range"}` or `{"code", "lang"}`, exactly like a code scene's excerpt. Use real source wherever it exists. |
| `effect` | `"diff"` (default): removed lines are marked red and close up, added lines open in green. `"morph"`: tokens that survive glide to their new place and the rest fade; see the caution below. |
| `title` | Shown in the panel header. Defaults to the first version's file name. |
| `lang` | Language for all versions when given inline. |

Which version is on screen:

- With nothing said about it, each beat brings the next version: beat 1 shows version 0, beat 2 changes to version 1, and so on.
- To choose, put `"version": n` on a beat, or land a change on a spoken phrase with a cue: `{"at": "replaces the scan", "version": 1}`. A version stays until another is named.

Use the diff. It carries meaning: red is what went, green is what arrived, and everything else holds still so it can be read.

Morph is available but rarely explains anything. Code cannot be read while it is moving, and where a token ends up is not the information the viewer needs. It is tolerable only for a small edit in place, where nearly every token stays put (a rename, one added argument). Never use it between two pieces of code that merely do the same job: most of the screen will scramble.

A change scene is for a change to the code. To compare how two approaches behave (a scan against a binary search), run both on the same data in a Manim scene instead; that is `motion`, not `change`.

Keep every version to about 20 lines and 90 columns; the panel is sized once, for the largest version. Give each version at least three seconds on screen, and no more than about six without something else changing: `va qc` reports a version that just sits there.

## A composition you write

When no scene kind draws what is needed, write the HTML yourself. Start from the starter, which is a working two-bar comparison:

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

`va hyperframes` copies your file into a build directory, sets the root's `data-duration` to the scene's length, and puts these beside it:

| File | Gives you |
|---|---|
| `gsap.min.js` | GSAP, loaded locally. |
| `va.css` | The palette as CSS variables (`--va-bg`, `--va-text`, `--va-muted`, `--va-accent`, `--va-cyan`, `--va-amber`, `--va-rose`, `--va-violet`, `--va-panel`, `--va-panel-border`), `--va-sans` and `--va-mono` with both typefaces bundled, and `.va-backdrop`, the backdrop every other scene sits on. |
| `va.js` | `VA`, the narration timing for this scene, and two helpers. |

`VA` holds `duration`, `fps`, `theme`, and `beats`, each beat with `text`, `start` (its window opens), `speech` (its first word), `end`, and `words` (each with `text` and `at`). All times are seconds from the start of the scene.

- `VA.at("a spoken phrase")` returns when that phrase is said. Use it so each element arrives on the words that name it.
- `VA.register(timeline)` hands your timeline to the renderer.

The rules the renderer depends on:

1. One root element with `data-composition-id`, `data-start="0"`, `data-width="1920"`, `data-height="1080"`.
2. One GSAP timeline, created with `{paused: true}`, passed to `VA.register`. The renderer seeks it frame by frame.
3. Nothing else may move. No CSS `transition` or `animation`, no `setTimeout`, `setInterval`, or `requestAnimationFrame`, no `Math.random`, nothing loaded from the network.
4. Keep content between y = 110 and y = 900. The scene heading sits above that and captions below; `va hyperframes` warns if the clip draws in the caption strip.
5. Put `<div class="va-backdrop"></div>` first inside the root, and use the `--va-*` variables, so the scene matches its neighbours.

The HyperFrames registry has several hundred ready blocks (charts, maps, terminal windows, cursors) that can be read for technique: each is one HTML file at `registry/blocks/<name>/<name>.html` in the HyperFrames repository. Restyle anything you borrow to the `--va-*` palette, or the video will look stitched together.

## What does not carry over

A HyperFrames scene arrives as finished video, so the things that work by reaching into a live scene do not apply to it: narration-derived cues, `lines` and `focus`, and the in-browser layout measurement. Its timing is fixed when it renders, from the storyboard's versions and cues or from `VA` in your own composition. Check its frames on the contact sheets like a Manim scene.

A cut between a HyperFrames scene and any other scene is the same short fade as everywhere else. HyperFrames' own shader transitions only work between two HyperFrames compositions and are not used here.
