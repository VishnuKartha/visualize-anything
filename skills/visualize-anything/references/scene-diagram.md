# Diagram scenes (Archify)

Archify changes typed JSON into a validated diagram. `va diagram` runs the quality gates of Archify on your candidate. Then it makes an SVG that the video can show, dim, and frame beat by beat.

Use a diagram scene when the subject is a system of separate parts: services, modules, stores, queues, pipeline stages, actors. Do not use one for the control flow of one function or algorithm. That goes in a Manim scene, on the data that the viewer watches (see [routing.md](routing.md)).

## Authoring the candidate

Archify has its own authoring skill. Obey it. Do not guess the schema. `va doctor` prints its path. The usual path is:

```
~/.visualize-anything/vendor/archify/archify/SKILL.md
```

1. Read the "Fast authoring path" and the "Type router" in that file.
2. Read the schema and the example that it names for your diagram type. The paths are relative to that `archify/` directory.
3. Write the candidate to `diagrams/<scene-id>.json` in the project.

Do not run the `finalize` of Archify yourself. `va diagram` runs it and keeps the evidence in `.cache/`.

A diagram that reads well on an interactive page is too dense for a video frame that a viewer sees for twenty seconds. Write for the screen:

- **Use seven nodes or fewer.** Above that, the text is too small to read at 1080p. Divide a larger system into two scenes: an overview, then one region.
- **Labels are identifiers, or two or three words.** Sublabels are a short phrase. Omit `tag`, `cards`, and long descriptions. The narration gives the detail.
- **Make it wide, not tall.** The diagram area is approximately 2.2:1. Five columns by two rows fill it. A tall stack leaves empty sides.
- **Do not set `meta.animation`.** The video controls all motion. The tool ignores the trace animation of Archify.
- **Do not set `meta.visual_preset`.** The diagram then has the palette of the video.
- **Give an edge an `id`** when a beat must point at it. This is most important in sequence diagrams.
- The schema requires `meta.output`. A relative `.html` name works (`"<scene-id>.html"`).

Select the `type` values of nodes for meaning, because they set the colour. The viewer reads two orange boxes as the same kind of thing.

## Running it

```bash
VA diagram <project> [scene-id...]
```

When it passes, it prints the ids that you can focus:

```
diagram request-path: ok (sequence, 1044×470 units)
  nodes: web, api, redis, db
  edges: dashboard-request, cache-read, cache-miss, profile-query, profile-rows, cache-write
```

When it fails, it prints the diagnostics of Archify. Repair the candidate as the skill of Archify tells you. Its references on failed gates and layout repair apply without change. Then run the command again. A focus id that does not exist is also an error. The tool lists it with the valid ids.

## Directing it from the storyboard

Scene fields:

| Field | Default | Meaning |
|---|---|---|
| `type` | from `need` | `architecture`, `workflow`, `sequence`, `dataflow`, or `lifecycle`. The `need` of the scene supplies it (`structure`, `process`, `conversation`, `pipeline`, `states`). It must agree with the candidate. |
| `build` | `false` | Start empty and add parts when beats focus them. Use it when the narration goes through the diagram one part at a time. |
| `camera` | `"follow"` | Move to the focused region in each beat. `"static"` keeps the full diagram in the frame. |
| `legend` | `false` | Keep the legend of Archify. The narration usually makes it unnecessary. |

The `focus` of each beat is a list of node ids and edge ids:

- Focused nodes are lit. All other parts dim. The camera frames the lit region.
- The focus on an edge also lights its two nodes.
- In `architecture`, `workflow`, `dataflow`, and `lifecycle` diagrams, an edge between two lit nodes lights automatically. With `build`, an edge comes on screen after its two ends.
- In `sequence` diagrams, the messages are the story. A message comes on screen only when a beat focuses it by id. Go through the conversation one or two messages in each beat.
- `"focus": "all"` lights all parts and moves back to the full view. End a `build` scene on it, so that the viewer sees the full picture one time.
- A beat with no `focus` lights the parts that are visible.

A new solid edge draws from its source to its target. Dashed edges fade in.

A beat with no `focus` follows the narration. Each node lights when the voice says its label. Nodes named later in the same sentence join it. If you name nodes by their exact labels, most beats need no `focus`. `va stills` prints the derived focus.

To set the focus by hand while the voice speaks a sentence, add `cues` to the beat (`{"at": "then the database", "focus": ["db"]}`). See [storyboard.md](storyboard.md).

Pace: `va tts` prints the window of each beat. A focus change needs approximately one second. Thus a beat shorter than 2.5 seconds must not add more than one or two new parts.

## Example

```json
{
  "id": "request-path",
  "need": "conversation",
  "why": "Ordered calls between four participants, including the cache miss.",
  "build": true,
  "beats": [
    {"say": "The browser asks the API for the dashboard.", "focus": ["dashboard-request"]},
    {"say": "The API checks Redis first, and misses.", "focus": ["cache-read", "cache-miss"]},
    {"say": "So it queries Postgres, and writes the result back to the cache.", "focus": ["profile-query", "profile-rows", "cache-write"]},
    {"say": "Next time, that read is a hit.", "focus": "all"}
  ]
}
```
