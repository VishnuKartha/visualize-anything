# Diagram scenes (Archify)

Archify turns typed JSON into a validated diagram. `va diagram` runs Archify's own quality gates on your candidate, then bakes the result into a self-contained SVG that the video can reveal, dim, and frame beat by beat.

Use a diagram scene when the subject is a system of separate parts: services, modules, stores, queues, pipeline stages, actors. Do not use one for the control flow of a single function or algorithm; that belongs in a Manim scene, acting on the data the viewer is already watching (see [routing.md](routing.md)).

## Authoring the candidate

Archify has its own authoring skill; follow it rather than guessing the schema. `va doctor` prints its path, normally:

```
~/.visualize-anything/vendor/archify/archify/SKILL.md
```

Read that file's "Fast authoring path" and "Type router", then the schema and example it names for your diagram type (paths are relative to that `archify/` directory). Write the candidate to `diagrams/<scene-id>.json` in the project. Do not run Archify's `finalize` yourself; `va diagram` does it and keeps the evidence in `.cache/`.

A diagram that reads well on an interactive page is too dense for a video frame someone sees for twenty seconds. Author for the screen:

- **Seven nodes or fewer.** Past that, text drops below a readable size at 1080p. Split a bigger system into two scenes (overview, then one region).
- **Labels are identifiers or two or three words.** Sublabels are a short phrase. Skip `tag`, `cards`, and long descriptions; the narration carries the detail.
- **Wide, not tall.** The diagram area is roughly 2.2:1. Five columns by two rows fills it; a tall stack leaves empty sides.
- **Leave `meta.animation` unset.** The video drives all motion. Archify's own trace animation is ignored.
- **Leave `meta.visual_preset` unset** so the diagram matches the rest of the video's palette.
- **Give edges an `id`** when a beat needs to point at one, especially in sequence diagrams.
- `meta.output` is required by the schema; any relative `.html` name works (`"<scene-id>.html"`).

Choose node `type` values for meaning, since they set colour: the viewer will read two orange boxes as the same kind of thing.

## Running it

```bash
VA diagram <project> [scene-id...]
```

On success it prints the ids you can focus:

```
diagram request-path: ok (sequence, 1044×470 units)
  nodes: web, api, redis, db
  edges: dashboard-request, cache-read, cache-miss, profile-query, profile-rows, cache-write
```

On failure it prints Archify's diagnostics. Repair the candidate as Archify's skill describes (its references on failed gates and layout repair apply unchanged) and rerun. A focus id that does not exist is also an error, listed with the valid ids.

## Directing it from the storyboard

Scene fields:

| Field | Default | Meaning |
|---|---|---|
| `type` | from `need` | `architecture`, `workflow`, `sequence`, `dataflow`, or `lifecycle`. Supplied by the scene's `need` (`structure`, `process`, `conversation`, `pipeline`, `states`); must match the candidate. |
| `build` | `false` | Start empty and introduce parts as beats focus them. Use it when the narration walks the diagram one part at a time. |
| `camera` | `"follow"` | Ease toward the focused region each beat. `"static"` keeps the whole diagram in frame. |
| `legend` | `false` | Keep Archify's legend. Usually the narration makes it redundant. |

Each beat's `focus` is a list of node ids and edge ids:

- Focused nodes are lit; everything else dims. The camera frames the lit region.
- Focusing an edge also lights the two nodes it connects.
- In `architecture`, `workflow`, `dataflow`, and `lifecycle` diagrams, an edge between two lit nodes is lit automatically, and (with `build`) an edge appears once both its ends have appeared.
- In `sequence` diagrams, messages are the story, so a message appears only when a beat focuses it by id. Walk the conversation one or two messages per beat.
- `"focus": "all"` lights everything and pulls back to the full view. End a `build` scene on it so the viewer sees the whole picture once.
- A beat with no `focus` lights whatever is already visible.

A newly introduced solid edge draws itself from source to target. Dashed edges fade in.

Pacing: each beat's window is printed by `va tts`. A focus change needs about a second to settle, so a beat shorter than 2.5 seconds should not introduce more than one or two new parts.

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
