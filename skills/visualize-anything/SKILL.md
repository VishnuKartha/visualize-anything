---
name: visualize-anything
description: Turn code, a paper, or any technical topic into a narrated explainer video. Writes a narration, synthesizes it with edge-tts, routes each part of the story to the visualization that explains it best — real syntax-highlighted code, a Manim animation for algorithms and data structures, an Archify diagram for how a system's components relate, or the source's own numbers, charts, quotes, and figures — and stitches the scenes into one MP4 with Remotion. Use when the user asks for a code explainer, code walkthrough video, a paper explainer, "explain this repo/file/function/paper as a video", an animated explanation of an algorithm or system, or a narrated technical video.
---

# visualize-anything

You are the director of a short narrated explainer video. Write the narration first. Then give each part of the story the picture that explains it best. Remotion assembles the result.

## How this guide is written

This guide and its references use Simplified Technical English (ASD-STE100). The rules are:

- One instruction in each sentence. An instruction has 20 words or fewer. A description has 25 words or fewer.
- Verbs are active and in a simple tense.
- One word has one meaning. One idea has one word.
- A condition comes before its instruction.

**The narration does not use these rules.** The narration is for the ear. Write it as a person speaks: warm, clear, and with rhythm. All `say` lines in the examples are narration. See "The voice explains" in [references/taste.md](references/taste.md).

## The renderers

Three renderers make pictures. Remotion sets the timing, puts the layers together, and renders the video.

| Renderer | Scene kind | The question it answers |
|---|---|---|
| Remotion (native) | `title`, `bullets`, `credit` | What is the name of this, now that I know its purpose? What must I remember? Where do I find it? |
| Remotion (native) | `stat`, `compare`, `chart`, `quote`, `figure` | What did the source measure, claim, and draw? |
| Manim | `manim` | How does the algorithm or data structure behave, step by step? What does the math say? |
| Remotion + Manim | `trace` | What does the code say, and what does it do? |
| HyperFrames | `hyperframes` | What changed between two versions of the code? How do these numbers compare? |
| Archify | `diagram` | How do the separate components of a system relate? In what order do they call each other? |

## The house rules

The house rules are in [references/taste.md](references/taste.md). Read them before you write a storyboard. These rules have the most effect:

- **Do not show code alone.** When code is on screen, put a picture of its effect next to it. This is a `trace` scene. The router rejects a scene that shows only code.
- **Do not show code in a paper video.** A paper is explained with its idea and its evidence. See [references/paper.md](references/paper.md), "Its pictures".
- **Animate an algorithm. Do not draw a flowchart of it.** Keep one picture of the data for the full behaviour. Use Archify only when the subject is a system of separate parts.
- **Open on an animation. Give the context first, then the hook.** The first scene is always a Manim scene. The router rejects all other openings. Start from a thing the viewer knows. Use one or two sentences and a picture the viewer recognises. Then show the hook on that picture. The hook is the core of the problem, or the most interesting fact about the answer. Agree the context and the hook with the user before you write. Do not say the hook to a viewer who does not know the subject. This is the most frequent cause of a bad opening. Do not start with a title card, a lecture, or a link.
- **Then name the work.** Immediately after the opening, say in one line that this is the aim of the work. Show a title card with its name (`"need": "name"`). A paper video always has a title card.
- **Each scene continues from the scene before it.** Do not start a scene with "now let's look at".
- **End on the picture.** Do not end on a slide of bullets. The recap shows each takeaway next to the moment that proved it. The last line of the recap returns to the hook. A short `credit` scene then gives the name of the work.
- **Keep one picture through the video.** Mark scenes that share a picture with `continues`. These scenes do not fade between each other.
- **The voice explains.** It does not read code aloud. It does not use filler. It is quiet for a moment after the main point (`land`).
- **Write for a listener.** The viewer hears each sentence one time and cannot look back. Name the subject, and do not make the viewer resolve "it". Give each term before you use it. Say the point of a comparison. Say few numbers.
- **Do not type a number.** Each number that is said or shown is a row in the `facts` of the storyboard. A script runs the real code and calculates each number again. Before you say "always" or "never", test the limits of the claim. See [references/facts.md](references/facts.md).
- **Vale reads the script.** `va route` runs Vale on `script.md` with two rule packages: `proselint` (the advice of editors) and `ai-tells` (the phrases that mark machine-written text). Rewrite each sentence that it finds, or leave the sentence when the rule does not fit a line for the ear.
- **Three viewers read the plan and judge the video.** A newcomer, a practitioner, and an expert read the plan before you build. The same three viewers judge the video.

You do not select renderers directly. You declare the `need` of each scene: the thing its viewer must see. The router changes the `need` into a renderer and examines your decisions. See [references/routing.md](references/routing.md).

## Contract

- Continue until `out/video.mp4` exists and you have looked at its frames. If a blocker stops you, report the exact blocker.
- The narration in the storyboard is the clock. Do not write a visual before `va tts` gives you the duration of each beat.
- Each claim in the narration must come from a source that you read: the code, or for a paper video, the paper. When code is on screen, quote real lines with `file` and `range`. Do not type code from memory.
- A paper video does not show code. Explain each mechanism of a paper as a full-frame animation, and show the evidence of the paper. The router gives an error for a code scene in a paper video.
- Each number comes from a run of that code. `va facts` must pass before you build. If a fact is different, the code is correct. Change the sentence.
- Agree the context and the hook with the user before you write the storyboard. The video opens on a Manim animation. The animation gives the context and then shows the hook. Do not start with a title card. Do not point to the source at the start. Do not say the hook before the viewer knows the subject.
- Show the name of the work on a title card immediately after the opening. Show it again in the last scene.
- You write the `thumbnail`. It is a hook frame. Read [references/opening.md](references/opening.md) before you write the brief.
- Report accurately. Say which checks you ran. Say which stills you looked at.

## Setup

In this guide, `VA` is `node <the directory of this skill>/runtime/va.mjs`. Run it from the working directory of the user.

```bash
node <skill>/runtime/va.mjs doctor
```

If an item shows `MISS`, run `va setup` one time. It installs:

- the Remotion runtime
- a pinned copy of Archify in `~/.visualize-anything/`
- a pinned Manim with Typst, through `uv`
- a pinned Vale, with the `proselint` and `ai-tells` rule packages, for the prose check

Vale is a necessary dependency. `va doctor` shows `MISS` without it, and `va route`, `va check`, and `va build` stop.

Typst typesets the formulas in Manim scenes. LaTeX is not necessary. Write `Math("O(log n)")`. Do not write `MathTex`.

## Workflow: Brief → Understand → Facts → Storyboard → Plan review → TTS → Visuals → Review → Render → Independent review

Each arrow is a gate. `va facts` errors, routing errors, and a missing Vale stop the build. The two reviews stop the build until each finding has a disposition.

### 0. Agree the brief

A full build renders for some minutes. Agree the content before you start. From the request, find these items and give them to the user in one short message:

- the subject: the file, function, paper, or system
- the audience: the things they know
- the length: the default is 60 to 120 seconds
- the focus: the one question that the video answers
- the context
- the hook

The context and the hook control the opening. Do not assume them. Read the source until you can answer the questions in [references/opening.md](references/opening.md).

For the context, answer these questions:

1. What does this viewer use or know that the subject is built on?
2. What is the one step from there to the subject?
3. What must the viewer expect, so that the hook is a surprise?

For the hook, answer these questions:

1. What goes wrong without this?
2. What does a person try first?
3. What is the most surprising fact about the answer?
4. For a paper: what did it make possible?

Then do these steps:

1. Write the context.
2. Write two or three candidate hooks of different kinds.
3. Test each candidate as that file tells you.
4. Give the candidates to the user. Put your recommendation first.
5. Show the recommended opening as the viewer will hear it: the context, the hook, and the first line of the next scene.

If the user told you to go straight through, select the strongest candidate. Tell the user which candidate you selected and why.

For the other items: if the request leaves a decision open and the decision changes the video, ask. If not, tell the user your assumption and continue. Record the result as `brief` in the storyboard. Record the context as `brief.context` and the hook as `brief.hook`.

### 1. Understand

**For a paper**, read it into the project first:

```bash
VA init <slug>
VA paper <project> <arXiv id, address, or PDF>
```

This writes `paper/paper.md`. Read that file. The abstract is first, with one numbered claim on each line. The abstract has priority over the body. Take the focus and the hook from its claims. Account for each claim in the `claims` of the storyboard. Read [references/paper.md](references/paper.md) before you write the brief.

Read the code that the video explains, from its real location. Decide the one question that the video answers. Decide the three to five ideas that answer it. A good length is 60 to 150 seconds, which is approximately 150 to 380 spoken words.

Then decide the shape of the story from [references/story.md](references/story.md):

- the obvious approach that this code replaces, and its cost
- the number that the screen will count
- the limit that you must name

A video that only describes the code does not tell the viewer why the code is written that way.

### 2. Facts

```bash
VA init <slug>          # prints the project directory, .visualize/<slug>/
```

Before you write a sentence, calculate the numbers that the story uses:

- the cost of the obvious approach on the example
- the cost of the real approach
- how the cost changes with size
- the number of lines

Write `facts.py` in the project. Obey [references/facts.md](references/facts.md). The script runs the real code on the example of the video and prints each number. Record the numbers as `facts` in the storyboard. Then run:

```bash
VA facts <project>      # compares each fact with the result of the oracle. A difference stops the build.
```

If a number surprises you here, it is possibly a better hook. Test the limits of each "always" or "never" claim here also.

### 3. Storyboard

**Write the full script first.** `script.md` in the project is the full narration as one continuous text. It has no scene labels and no stage directions. It opens on the context and gets to the hook in its first sentences.

1. Write the script from the first word to the last word without a stop. Write it as the viewer will hear it.
2. Read it. Correct each sentence that does not continue from the sentence before it.
3. Read it again as a listener, with the rules in [references/taste.md](references/taste.md), "Write for a listener":
   - Each pronoun has one possible referent. If not, name the subject.
   - The script gives each term to the viewer before the argument uses it. It explains each idea that a mechanism depends on.
   - The script says the point of each comparison, and why the viewer cares.
   - The script says three or four numbers. The pictures show the others.
   - Each general claim is true for all cases that the source measured, or it names the one case.
4. If the script is too long, remove an idea. Do not remove subjects and joining words.
5. Then divide it. A paragraph becomes a scene. One or two sentences become a beat.

Do not write a line into the storyboard that is not in the script. Narration that you write one scene at a time becomes a list of separate explanations. Narration that you write as one text and then divide does not.

Then write `storyboard.json`. It is the one source for all data other than the words. It has a `subject` and an ordered list of scenes. Each scene has a `need` and a list of `beats`. A beat is one spoken line of the script and the visual cue that goes with it. `va route` makes sure that the beats, in order, are the words of the script and no other words.

- Set `subject`. Give each scene a `need` from the list in [references/routing.md](references/routing.md). Record the reason in the `"why"` of the scene.
- For the format of each field and a full example, see [references/storyboard.md](references/storyboard.md).
- After the opening, add a title card (`"need": "name"`) for a paper. Add one for code if its name is important before the explanation. The title card has one line: this is the aim of the work.
- Write the `thumbnail`: five words or fewer, and the scene that supplies the picture. End on a `credit` scene that names the work. See [references/opening.md](references/opening.md) and [references/taste.md](references/taste.md).
- Write the narration for the ear: sentences of 8 to 25 words, with one idea in each beat. Write identifiers and notation as they are (`move_to_end`, `O(log n)`). The voice gets a spoken form automatically. The captions keep your text.
- Use only numbers from `facts`. Use one word for each idea. List the words of the video as `vocabulary`. For each word, give the words that it must not also be, and the scene that explains it.
- Leave one question open. If the viewer can find the answer, end the beat on the question and mark it `"predict": true`. The next beat answers. See [references/taste.md](references/taste.md).
- Use names. When a sentence says an identifier or the label of a diagram node, the highlight or the focus moves to it on that word. No cue is necessary. "It refreshes the entry" moves nothing. "`move_to_end` refreshes the entry" moves the highlight.
- For more control, keep the sentence as one beat and add `cues` on spoken words (`{"at": "check the size", "lines": 21}`).

```bash
VA route <project>      # the decision of the router on each scene and on the sequence, with reasons. Then the prose check
VA check <project>      # the same, with structure, line ranges, and file paths. No network.
VA prose <project>      # only the prose check: script.md against proselint and ai-tells
```

Read the routing report before you continue. An `ERROR` stops all subsequent steps. Correct the scene. If the route is correct, add an `override` with the reason. A `REVIEW` is advice. Obey it or ignore it, but read it. Run `va route` again each time the narration or the scene order changes.

Then read the prose report. It lists each finding of Vale with its rule, its line in `script.md`, and its beat. For each finding, do one of these:

- Rewrite the sentence in `script.md`, and then in the storyboard.
- Leave the sentence, if the rule does not fit a line that is written for the ear. A literal statement, the title of a paper, and a name are the usual cases. To stop the report of that finding, put a Vale comment around the line in `script.md`, with the reason. See "Vale reads the script" in [references/taste.md](references/taste.md).

A finding does not stop the build. The check must run.

### 4. Plan review

Three new agents read the plan before you record. Each agent is one viewer: the newcomer, the practitioner, or the expert.

```bash
VA review <project> --plan     # writes out/review/plan-1-<viewer>.md, one brief for each viewer
```

1. Give each brief to its own new subagent. Start the three subagents at the same time. See [references/review.md](references/review.md).
2. Each subagent says each scene back in one sentence. It lists the things that confused it, bored it, or gave it a wrong idea.
3. Give each finding a disposition: fixed, answered, or deferred.
4. Correct the blockers in `script.md`. Then correct the storyboard.
5. Run `va route` and `va facts` again.

If you cannot start subagents, tell the user that the plan was not reviewed.

**Approval gate.** Before you synthesize or render, show these items to the user and wait for approval or changes:

- the full script
- the routing table, with the place in the script where each scene starts
- the facts table
- the findings of the three viewers, and your disposition for each

A change to a sentence costs nothing now. After the render, it costs a render. Skip the gate only if the user told you to go straight through.

### 5. TTS

```bash
VA tts <project>
```

This synthesizes one clip for each beat with edge-tts and writes `timeline.json`. It prints the time budget: the number of seconds in the visual window of each beat. Build the diagram focus and the Manim animations to these numbers. The tool keeps a cache of lines that did not change, so a second run after a text change is fast.

### 6. Visuals

`title`, `bullets`, and `credit` scenes render from the storyboard. No other work is necessary.

**Evidence scenes** (`number`, `contrast`, `chart`, `quote`, `figure`) also render from the storyboard. Read [references/scene-evidence.md](references/scene-evidence.md) for their fields. A `figure` must have its image in the project. For a paper, use these scenes for the results of the paper. Keep the animation for the idea. [references/routing.md](references/routing.md) tells you where each scene goes.

**HyperFrames scenes.** Read [references/scene-hyperframes.md](references/scene-hyperframes.md). A `change` scene needs only its `versions` in the storyboard. A `data` scene needs a composition at `html/<scene-id>.html`. Then run:

```bash
VA hyperframes <project> [scene-id...]
```

**Diagram scenes.** Read [references/scene-diagram.md](references/scene-diagram.md). Write the Archify candidate at `diagrams/<scene-id>.json`. Then run:

```bash
VA diagram <project> [scene-id...]
```

This runs the `finalize` gates of Archify. Then it prepares the result for video. It prints the node ids and the edge ids. Use them in the `focus` of each beat. An exit code that is not zero is a failure. Repair the candidate from the diagnostics and run the command again.

**Manim and trace scenes.** A `trace` scene is only for a video about code. Read [references/scene-manim.md](references/scene-manim.md). Start with "What to draw" and "Start from the kit". Make the scene from the pictures in `va_manim` (`Cells`, `Tally`, `Flow`, `Track`, `Net`, and the others). Use the shapes of Manim only for the one object that the kit does not have. Write `manim/<scene-id>.py`. Then run:

```bash
VA manim <project> [scene-id...]
```

It renders the scene. It reports each beat whose animation was longer than its narration window. To correct such a beat, decrease the `run_time` values. Do not ignore it. It also reports a drawing that fills only a small part of its panel or its frame for four seconds or more. Correct the layout.

### 7. Review

```bash
VA stills <project>                  # contact sheets: each visual state, nine in each image
VA stills <project> <scene-id...>    # the same for the named scenes, four in each image
VA stills <project> --at 42.5        # one moment, full size
```

The contact sheets are in `out/stills/sheet-NN.png`. Each frame has a label with its scene, beat, and time. Read each sheet. A full video is two or three images. Look for these defects:

- a highlight on the incorrect lines
- a diagram with the focus on the incorrect nodes
- text that is too small to read
- a Manim object in the incorrect position

The same command measures the layout of title, code, and bullets scenes in the browser. It prints each item that goes off the frame, touches the captions or the heading, or is cut. It shows these frames with a red outline on the sheet. Correct each layout defect that it reports. `va manim` does the equivalent for animations. It gives a warning when a clip draws in the area of the captions or the heading.

### 8. Render

```bash
VA render <project>            # → .visualize/<slug>/out/video.mp4
```

The tool renders the scenes one at a time and joins them. It uses a scene again if the inputs of the scene did not change. After a correction, it renders only the scenes that you changed.

With the video you get:

- `video.srt` and `video.vtt`: the captions as subtitle files
- `thumbnail.png`: the hook frame
- `thumbnail-small.png`: the same image at the size that a viewer sees in a feed

Look at the small thumbnail. Remove words until you can read each word. `--draft` renders at half resolution, which is faster. `--force` ignores the cache.

The render ends with a quality check. `VA qc <project>` runs the same check. It makes sure that:

- the file is complete and has audio
- the audio and the picture have the same length
- the picture does not stay still for more than six seconds while the voice continues
- there are no seams

A seam is one of these: a cut of one frame, a jump at a join marked `continues`, a voice that stops where the picture continues, dead air, or a line at a different level. Correct each seam in the list. Each seam has its time and its cause. [references/taste.md](references/taste.md) has the table.

A still picture is the most frequent defect in an explainer. Correct each still picture in the list. Add a cue on a word so that the highlight or the focus moves in the middle of the sentence. In a Manim scene, hold each move with `beat.until("<phrase>")` so that the animation fills the sentence.

### 9. Independent review

You built the video, so you cannot judge it. Run `VA review <project>`. Give the brief to a new subagent. See [references/review.md](references/review.md). Correct the defects that the reviewer puts highest. Render again. Run one verification round. If you cannot start a subagent, tell the user that the video was not independently reviewed.

Then give the user:

- the absolute path
- the duration
- the scene list, with the need, the renderer, and the reason for each scene
- the decision of the reviewer, and the changes that you made because of it

`VA studio <project>` opens Remotion Studio for an interactive preview.

`VA build <project>` runs facts → prose → tts → diagram → manim → hyperframes → render in one command. Use it when all source files exist.

To put music below the voice, set `"music": "<file>"` in the storyboard. The tool decreases the level of the music before each sentence. `va render` measures the result. See [references/taste.md](references/taste.md). The skill does not supply music.

## Iterating on feedback

Each step has a cache that uses the content as its key. Change the source and run again only the steps that the change affects:

| Changed | Run again |
|---|---|
| Narration text | Change `script.md` first and read the lines before and after. Then change the storyboard. Run `route` (it includes the prose check), then `tts`, then `manim` (the budgets moved), then `render`. |
| A number, or the code that the video explains | `facts`. Then the sentence and the picture that show it, as above. |
| The claims of a paper abstract that the video shows | `claims` in the storyboard, then `route` |
| The `music` file or its levels | `render` (only the sound is made again) |
| The `range`, `lines`, `note`, or `cues` of a trace scene. The `text` of a title. A field of an evidence scene. | `render` (only that scene is rendered again) |
| The `thumbnail` | `render` (only the thumbnail is made again) |
| A diagram candidate, or the `focus` of a beat | `diagram <id>`, `render` |
| A Manim script | `manim <id>`, `render` |
| The versions or `version` cues of a change scene, or a composition that you wrote | `hyperframes <id>`, `render` |
| An item after an independent review | the rows above, then `review --verify <report>` |
| The scene order, or the `need` of a scene | `route`, `tts` (the timeline is made again), then the visuals that changed, then `render` |

When feedback names a moment ("at 0:42 the label overlaps"), run `VA stills <project> --at 42`. Look at that frame before you change the source.

## Project layout

```
.visualize/<slug>/
├── script.md              # authored: the full narration, written as one text before you divide it
├── storyboard.json        # authored: scenes, beats, routing, facts, vocabulary
├── facts.py               # authored: the oracle that runs the real code and calculates each fact
├── diagrams/<id>.json     # authored: Archify candidates
├── manim/<id>.py          # authored: Manim scenes
├── html/<id>.html         # authored: HyperFrames compositions (only for scenes that need one)
├── figures/<name>.png     # authored: the figures of the source, for figure scenes
├── paper/                 # generated by `va paper`: paper.md, paper.json, figures/ (ignored by git)
├── timeline.json          # generated by tts: the beat windows, exact to the frame
├── public/                # generated: audio/, assets/ (Remotion reads these)
├── .cache/                # generated: TTS clips, Archify HTML, Manim media
└── out/                   # generated: video.mp4, video.srt, video.vtt, thumbnail.png, thumbnail-small.png, stills/, review/
```

Keep only the authored files. The `.gitignore` of the project excludes the others.
