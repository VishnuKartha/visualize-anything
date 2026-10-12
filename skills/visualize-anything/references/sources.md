# Sources: what the video is made from

The first thing to settle about a request is what kind of material it hands you, because each kind is explained differently. A function is explained by what it does: run it, animate it, show its lines. A paper is explained by what it claims and the evidence it gives: its numbers, its tables, its figures, its algorithm. Material often comes in more than one kind at once, such as a paper with its released code, or a design doc and the service it describes.

So the kinds are settled twice:

1. **At the brief, for the video.** Pick every kind the request hands you; more than one is normal. Record them as `sources`.
2. **At each scene, for that scene.** Before choosing what the viewer needs to see, decide what the scene rests on: one source, several (the design doc's decision beside the code that carries it out), or none (a picture of the video's own). The rules that apply to the scene follow from that choice.

The router applies a document's rules to what a scene takes from a document, and code's rules to what it takes from code.

## 1. Recognise it

| `kind` | What it is | Its evidence is | Rules it brings |
|---|---|---|---|
| `code` | A repository, a file, or a function | What the code does when it runs | Code is shown beside what it does (`trace`); every number is computed by running it ([facts.md](facts.md)) |
| `paper` | A research paper: arXiv, a conference, a journal | Its tables, figures, algorithms, and stated results | The document rules below |
| `design-doc` | A design document, RFC, ADR, or specification | Its decisions, the alternatives it weighed, its diagrams | The document rules below |
| `docs` | Documentation, a README, or a technical article | What it states, its examples, its diagrams | The document rules below |
| `topic` | General knowledge with no single source ("how does TLS work") | Nothing to quote: every claim comes from code you run or a source you add | Code's rules, for any code you write to show it |

Ask what the request names and what comes with it:

- An arXiv link, a PDF, "this paper": `paper`. If the paper links its code, add that as a second, `code` source. Real code reads better on screen than an algorithm typeset in LaTeX.
- "Our RFC", a Google Doc, an ADR, a spec: `design-doc`. The system it describes, if it is in the repository, is a second `code` source.
- A README, a docs page, a blog post: `docs`.
- A file, function, repository, or pull request: `code`.
- A subject with nothing attached: `topic`. Say so in the brief: every claim then has to be shown by code you write and run, or by a source you find and add.

This is a multiple choice, not a single label. A design review video is often `design-doc` + `code`, a paper explainer `paper` + `code`, and an onboarding video `docs` + `code`. Say what you recognised when you state the brief back ("a design doc, and the service it describes"), so a wrong guess is caught before anything is written. When the request leaves it open (a repository that also holds an RFC, say), ask the user which of the kinds the video should draw on, as a question with several answers allowed.

## 2. Record it

```json
"sources": [
  {"id": "hnsw", "kind": "paper", "title": "Efficient and robust approximate nearest neighbor search using HNSW graphs", "path": "papers/hnsw", "url": "https://arxiv.org/abs/1603.09320"},
  {"id": "hnswlib", "kind": "code", "path": "repos/hnswlib"}
]
```

| Field | Meaning |
|---|---|
| `id` | Kebab-case name that scenes use to point at it. |
| `kind` | One of the five above. |
| `title` | Optional. The source's own name; reviewers are told the video is made from it. |
| `path` | Where it is on disk, relative to `sourceRoot`: a folder (a paper's LaTeX source, a repository) or a file. |
| `url` | Where it can be read. A source needs `path` or `url`; `topic` needs neither. |

### Each scene's sources

A scene draws on the sources it names in `source`, together with the ones its quoted files sit in:

| `source` | The scene rests on |
|---|---|
| `"rfc"` | One source. |
| `["rfc", "svc"]` | Several at once: the RFC's decision and the code that carries it out, side by side or one after the other in the same picture. |
| `null` | No source: a toy example, an animation of the idea, a matrix you computed. Not held to any source's rules. |
| left out | Inferred: the sources its files sit in, or the only source when there is just one. |

With two or more sources in the video, every scene except an opening statement, a recap, and the credit says which it draws on, even when its file would let it be inferred. The router flags a scene that does not, because the decision is what this step is for: "is this scene the code alone, or the doc's claim and the code together?" A scene that names some sources but quotes a file from another is flagged too; list everything it rests on.

`va route` prints the sources at the top of its report and, with more than one, each scene's sources beside it (`from rfc + svc`). The reviewers' briefs say, for every scene, what it is drawn from. The plan and video reviewers are told what the video is made from and given the whole source to read, not only the lines it quotes.

## 3. Read what it holds

```bash
VA sources <project>              # each source: sections, figures, tables, algorithms, code shipped with it
VA sources <project> --figures    # also export every figure to figures/<source>-<name>.png
```

For a document, `va sources` lists what a scene might show and where each part is. Use it before writing the script, and quote the references it prints in `ref` and in captions.

- **Sections**, in the order the paper prints them. It follows `\input` and `\include` from the main file, and a file the paper never includes is left out.
- **Figures**, numbered as the paper numbers them, with each figure's caption, its LaTeX label, and the image files behind it. With `--figures`, each one becomes a PNG in the project: a raster image is copied, and a PDF or EPS figure is rendered at 300 dpi with whichever of pdftoppm, mutool, magick, gs, or sips is installed.
- **Tables**, numbered, with caption and line range.
- **Algorithms and listings**: the only parts of a document that may be shown as code.
- **Code shipped with it**: arXiv sources often contain the real thing (a proof of concept, a `.mlir` file, a training script). Quote that rather than the typeset algorithm.

Commented-out LaTeX (`%` and `\iffalse`) is ignored: papers keep old figures and tables in comments, and these are not what the paper says.

**A paper is read in with `va paper`, not `va sources`.** `va paper <project> <arXiv id or PDF>` writes `paper/`: the abstract as numbered claims, the sections, the tables, the figures, and the licence. See [paper.md](paper.md). `va sources` lists design docs, documentation, and folders of LaTeX.

## 4. The document rules

These apply to what a scene takes from a `paper`, `design-doc`, or `docs` source. A scene that draws on a document and on code gets both sets: each quoted file is held to the rules of the source it sits in, so the code half is code and the document half is a document. The router checks each one, and its report says which rule fired and why.

**A claim set beside its code says where the claim is.** When a scene draws on a document and on code (the RFC says writes go through the leader; here is the line that does it), give the document's place in `ref` ("Section 3.2"). The claim and the code that carries it out can then both be checked. Where the code does something the document does not say, or the opposite, the narration says so: that gap is often the most useful thing in a design review video.

**A paragraph is not code.** A trace or code scene whose lines are mostly prose is an error when they come from a document. A paragraph on screen is read, not explained, and a long LaTeX line is cut off at the panel's edge. Put the sentence that carries the claim in a `quote` (under about 45 words, with the phrase that matters marked) and animate the idea. Show code only from an algorithm, a listing, or the released code. The same excerpt from a code source's own docs is flagged for review rather than refused. When the excerpt is a LaTeX algorithm, the router warns that `\State` and `\gets` will appear as typed, not as printed.

**Its evidence is shown.** A video made from a document shows at least one thing it reports: a `number`, `table`, `chart`, `quote`, or `figure`. Without one, the viewer takes every claim on trust. Past half the running time, though, the video is a slide deck of the source, and the idea itself still needs an animation or a diagram.

**Each piece of evidence says where it is.** A `stat`, `chart`, `table`, `matrix`, `quote`, or `figure` drawn from a document gives `"ref": "Table 2"` (or "Figure 4", "Section 3.1", "Abstract", "Algorithm 1"), or a caption or attribution that starts with one. The viewer can then find it, and a reviewer can check it. A number from a document is still a row in `facts`, with `"given"` naming the same place.

**Evidence follows what it is evidence for.** A `stat`, `chart`, `table`, `matrix`, or `figure` from a document names the earlier scene that sets it up, in `"after": "<scene id>"`. A figure that arrives before its explanation is a picture of unknown things. It is an error for `after` to name a scene that comes later. Evidence that puts a `vocabulary` word on screen before the scene that defines it is flagged too.

**The source's own row is marked.** A `table` from a document marks the row the source is about with `"best"`, so the eye lands on it first. Keep the rows the sentence compares, six at most; a table of forty rows is read, not watched.

**Its own picture is shown, not redrawn.** When the document drew the figure, use a `figure` scene and point at its parts. Crop the panel the sentence is about with `crop`, rather than redrawing it as a diagram. Draw your own picture only when there is none, or when theirs cannot be read at video size. A diagram scene drawn from a document that has figures of its own is flagged until its `ref` says which figure it redraws.

## 5. What carries forward

| Step | What the sources change |
|---|---|
| Brief | You say what kinds you recognised; the user can correct it before anything is written. |
| Understand | `va sources` lists what a document holds and where; `--figures` puts its figures in the project. |
| Facts | A number from a document is `"given": "Table 2, EN-DE column"`. A number from code is computed by `facts.py`. |
| Storyboard | Each scene decides what it rests on (one source, several, or none) and says so in `source`. Evidence from a document carries `ref` and `after`; a scene setting a document's claim beside code carries `ref`. |
| Route | Each part of a scene is held to the rules of the source it comes from. A video made only from documents is not asked to show code. |
| Plan and video review | Reviewers are told what the video is made from, given the whole source to read, and told what each scene is drawn from. |
