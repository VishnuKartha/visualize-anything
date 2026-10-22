# Explaining a paper

Do not read a paper from a screen and paraphrase it. Read it into the project. Then you write the script from its text, the tool checks its numbers against its tables, and the plan answers to its abstract.

```bash
VA init <slug>
VA paper <project> 2610.12374                    # an arXiv id
VA paper <project> https://arxiv.org/abs/1706.03762
VA paper <project> ~/papers/attention.pdf        # or a PDF on disk
VA paper <project> ~/Downloads/1706.03762v7.html # or an arXiv HTML page, saved from a browser
```

The command writes `paper/` in the project:

| File | What it is |
|---|---|
| `paper.md` | The paper, for you to read. The abstract is first, with one claim on each line. Then each section follows, with the figures that it cites and its tables as tables. **Read this file, not the PDF.** |
| `paper.json` | The same data, for the checks: `abstract`, `claims`, `sections`, `figures`, `tables`, `licence`. |
| `figures/` | Each figure as an image. |

For an arXiv paper, the tool reads the HTML edition of arXiv if there is one. That edition marks the sections, captions, and tables. If arxiv.org cannot be reached from your machine, save its HTML page in a browser and give the tool that file. The tool reads it as it reads the online edition. It gets the figures and the licence from arXiv only if arXiv can be reached. If there is no HTML edition, and for a local PDF, the tool reads the PDF:

- The abstract and the sections are reliable.
- The tool crops each figure from above its caption. Look at each figure before you use it.
- The tool finds only tables that have ruled lines.

If a table is missing, copy the necessary rows by hand. Give the table in the `given` of each fact.

Git ignores `paper/`. It contains the text and the figures of other people. The tool gets it again when necessary. Do not publish it from your repository.

## The abstract comes first

The abstract is the statement of the authors about the purpose of the paper and its important results. They had two hundred words and selected these. Thus the abstract has priority over the body when you decide the subject of the video:

- **The focus is a claim of the abstract.** The abstract must be able to answer the one question of the video. If your focus is not in the abstract, you explain a detail of the paper and not the paper.
- **The context comes from the introduction, not from the abstract.** An abstract is for people in the field. Its first sentence defines the area in the words of the field. A viewer from outside has nothing to hold. The introduction tells what people do now, frequently with a system that the viewer used ("commercial systems direct each query to a different model"). Start there, in plain words. Then take the one step to the subject of the paper. If the introduction gives a number that makes the idea attractive (forty percent of questions against five percent of tokens), put it in the context. It sets the expectation that the hook breaks. Name the earlier work that the introduction names: the products, the systems, and the papers that this paper builds on or compares against. Do not say "an earlier method" when the paper gives its name. See [opening.md](opening.md), "Start where the viewer is".
- **The hook comes from the abstract, or from the evidence for one of its claims.** A number in the abstract is the first candidate. The comparison that makes the number surprising is usually in the body: the table that the abstract summarises, or the earlier result that it compares against. Go there for the picture, but start from the claim.
- **Account for each claim.** `va paper` gives a number to each sentence of the abstract. For each sentence, the `claims` of the storyboard names the scene that shows it, or gives the reason that the video omits it:

```json
"claims": [
  {"abstract": 2, "scene": "jobs"},
  {"abstract": 4, "scene": "split"},
  {"abstract": 7, "omit": "How the renderer is trained is its own video; this one is about why the world is split in two."},
  {"abstract": 9, "scene": "open"}
]
```

A video of two minutes cannot show ten claims. Do not try. You can omit a claim, but you must do it on purpose. `va route` lists each claim that has no scene and no reason. It also lists each number in the abstract that the video does not say, unless you omitted that claim. The three plan reviewers get the abstract with the decision of the plan for each claim. They judge the plan against it.

The abstract cannot give you the context or the story. It lists results. It does not tell where a newcomer must start, what a person tries first, or why that fails. Get the story from [story.md](story.md). Get it also from the introduction and the related-work section, where a paper tells what was wrong before it.

## Its numbers

Each number that the video says or shows is a row in `facts` ([facts.md](facts.md)). For a paper:

- A number from the paper is `"given"`, with its location: `"given": "the paper's Table 4, one-lane bridge"`.
- A number from the code of the paper comes from `facts.py`, which reads or runs that code.
- `va facts` and `va route` make sure that each `given` number is in the paper: in its abstract, sections, captions, or tables. Citation markers and the page numbers of the reference list are not included. Write a number as the paper writes it. If the table says 36.5, say "over thirty-six" or 36.5, not 36.

## A claim is as wide as its evidence

A paper measures specific cases. The narration must not say more than those cases show.

- **Name the case.** If the result is for one algorithm in one table, say that algorithm. "Routing is now faster than the big model" is a claim about all routers. If the table shows it for two routers of four, say "R2R is now faster".
- **Examine the other rows.** Before you write a general sentence, read each row of the table. If one row disagrees, the sentence is incorrect.
- **Do not put numbers from different setups side by side** as if they are one measurement. If two numbers come from different models, loads, or tables, say so, or use numbers from one setup.
- **A cause needs evidence.** "It was slow because of X" is a claim that the paper must show. If the paper shows only that the thing was slow and that X exists, say the two facts and do not join them with "because".

The expert reviewer examines each of these. No tool can.

That check finds a number that is not in the paper. It cannot find a number that is in the paper but measures a different thing. The expert reviewer does that, with `paper.md` and each `given`.

## Its pictures

Send the results of the paper to the evidence scenes ([scene-evidence.md](scene-evidence.md)). Keep animation for the idea ([routing.md](routing.md), "A paper is explained with its own evidence"). The opening is still a Manim scene.

**A paper video does not show code.** The viewer came to understand the idea and to see the evidence. The code is how the authors built the thing. A panel of code next to a small animation is the weakest picture that a paper video can have:

- The code takes half of the frame, and the animation of the idea gets a small panel.
- The names in the code (`state`, `ticks`, `B[i]`) are not the words of the narration. The viewer must translate.
- The line that fits the panel is frequently not the line that matters. Do not select code because it fits.

Thus, explain each mechanism of a paper as a full-frame animation (`motion`, `branching`, or `math`). `va route` gives an error for a `trace`, `code`, or `change` scene in a paper project.

You can still read and run the code of the paper. Use it for `facts.py`, to calculate numbers. That code is not on screen.

Show code in a paper video only when the code is the thing that the viewer asked to see: for example, "show me the three functions that a developer writes". Then give the reason in the `override` of the scene.

- **A table becomes a `chart` or a `number` scene.** Take the few values that the sentence compares from the table in `paper.md`. Each value is a `given` fact.
- **Read the figures first.** `paper/figures/` lets you see the drawings of the authors. The `licence` in `paper.json` controls whether you can show a figure in the video. `va paper` prints it. A Creative Commons licence permits it with credit. Use a `figure` scene and give the source in the caption. The default licence of arXiv does not permit it. `va route` tells you this on each `figure` scene. In that case, draw the idea yourself.
- **Name the paper after the opening**, on a title card (`"need": "name"`). The context and the hook tell the problem of the paper. Then one line says that this is the aim of the paper. The card shows its name, with the full title, the authors, and the year below. `va route` asks for a title card in each paper video. See [opening.md](opening.md), "Then name it".
- **The credit names the paper again, last**: the title, the authors and the year, the arXiv id, and the location of its code.
