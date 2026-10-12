# The shape of the story

The house rules in [taste.md](taste.md) came from videos that this skill made. The rules here came from the other direction. We looked at how the channels that people learn from build their videos: 3Blue1Brown, Reducible, Polylog, Fireship, ByteByteGo, Spanning Tree, Primer, and Welch Labs. We kept the things that fit a code explainer of 60 to 150 seconds.

Decide these in step 1, before the storyboard exists. `va route` does not examine them. The reviewers get questions about them. Calculate the numbers of the story next, in [facts.md](facts.md), before you write a sentence around them.

| Move | Why | Where it goes |
|---|---|---|
| The obvious way goes first, and the video shows its cost | The clever version means nothing until the viewer sees the thing that it replaces | Scene 2, a `motion` scene |
| The cost is a number on screen, counted as it occurs | The viewer believes a claim that they saw add up. They do not believe a claim that is only said | Each scene that claims a cost |
| The opening starts from a thing that the viewer has | A stranger's problem is easy to leave, and a surprise needs an expectation to break | The context, said before the hook. See [opening.md](opening.md) |
| The example is small. One beat says how it scales | The viewer can follow seven items. They cannot follow a million, but a million is the reason to care | The `math` scene or the last trace |
| Ask a question before you answer it | The viewer who has the question in mind waits for the answer | The first beat of a scene |
| The first code on screen is the smallest piece that shows the idea | Code is the slowest thing on screen to read | The first `trace` scene |
| Say why it is important | A viewer who does not know what is at stake has no reason to follow the mechanism | One sentence in the opening, before the hook |
| Use one concrete example, and return to it | A thing that the viewer can picture holds each abstract statement that follows | The opening, and each scene that needs it |
| Explain the idea that the mechanism depends on | The clever part means nothing to a viewer who does not have the idea below it | One sentence and a picture, before the mechanism |
| Name the limit | The statement of what it cannot do makes the other statements credible | One beat before the recap |
| Nothing moves without a reason | Motion pulls the eye. If the motion means nothing, it pulls the eye from the thing that has meaning | Each Manim script |

## The obvious way first

Five of the ten videos use their first minute for an approach that will lose:

- An error-correcting code starts with redundant copies, below a bar that shows half the file lost to redundancy. The next bar shows 96.5% of the file kept.
- Consistent hashing starts with `hash(key) % n`. Then a server gets a red cross and the keys move.
- A* starts with the search of Dijkstra, which fills a large red disc across the map. The small disc of A* is below it.
- Recursion starts with a function that has no base case. Its call stack grows and turns red.

The pattern has three parts: the approach that all people try, the same data, and the cost as a visible thing.

| Subject | The obvious way | Its cost, on screen |
|---|---|---|
| Binary search | Check every item in turn | Six looks against two |
| LRU cache | Drop whatever was added first | It evicts the key that was read a moment ago |
| Consistent hashing | `hash(key) % n` | One server leaves and nearly every key moves |
| Bloom filter | Keep every key in a set | Memory grows with each key, beside a row of bits that stays one size |

Give it the second scene, as `motion`. Run the two approaches on the same data, in the same colours, with a count next to each (routing.md, "`change` or `motion`?"). `race` in `examples/binary-search/video/storyboard.json` is the model. Ten to fifteen seconds is sufficient.

When the subject has no competing approach (a data layout, a protocol), show the failure that the design prevents: the request that would be lost, or the write that would be overwritten.

## A count on screen

When these videos claim a cost, the measure is in the frame with the mechanism, and it changes as the mechanism runs:

- a histogram of the speed of the population, above the simulation that makes it
- a bar of original bits against redundant bits, above the block of bits
- the area that a search explored, shaded as it grows
- the weights of a network, added term by term until the total, 13,002, stands below the sum

Thus, when the narration says "six looks", "four comparisons", or "nothing is evicted", a counter next to the data gets to that number on that word. If the hook has a star on a number, one scene must end with that number on screen. [scene-manim.md](scene-manim.md), "What to draw", tells you how to draw it.

## Small, then scaled

The explanations run on a thing small enough to follow: sixteen bits for a block of 256 bits, one creature before a population, a small number of road junctions from a full map. The large case comes before or after, not during.

This skill holds one small dataset for the full video and returns to the hook at the end. Add one beat that connects the two: "Seven items took two passes. A million take twenty, because each pass halves what is left." Without it, the number of the hook and the worked example are two separate facts.

## Ask it before answering it

The chapter titles in these videos are frequently the question of the viewer at that point: why layers, what makes a good potential, what a neuron is. 3Blue1Brown draws the audience as characters who say the thoughts of the viewer, including the objection. The narration asks the question, waits a breath, and then answers.

In a storyboard this is the first beat of a scene: "But how does it know which key is oldest?" and then the picture that answers. Use one or two in a video. A question that the viewer does not have at that moment is filler.

When the viewer can answer the question, give them the time. Mark the beat `"predict": true`. The voice waits before the next beat answers (taste.md, "Ask, then wait").

## The first code is the smallest piece

The long videos hold the code back until the viewer understands the idea. In the three algorithm videos that have an implementation chapter, it starts 65%, 90%, and 96% of the way through.

The video of 100 seconds is the nearer model for this skill. It does the opposite, with a condition. Code is on screen at the eighth second. But it has three lines, it is typed as the voice speaks it, and its effect is drawn next to it immediately. The real function arrives in the second half. The coding video of 38 minutes works the same way: a short excerpt on an empty frame, then the thing that the excerpt renders.

- For a video shorter than three minutes: the first `trace` scene shows the smallest number of lines that hold the idea (a field, a loop header, one call). The full function comes later.
- For a longer video: put a `motion` scene before the first `trace` (routing.md, "Concept, then code").

## Name the limit

Two of these videos end the explanation on a limit. The last chapter of the Bloom filter video is the thing that it cannot do (delete). The neural network lesson closes on a caveat about the function that it taught.

Use one beat before the recap: "It costs a second dictionary entry per key", "The list has to stay sorted". Put the limit in the recap as a takeaway when it changes how the viewer uses the thing.

## Nothing moves without a reason

The advice of 3Blue1Brown to new makers names the usual misuse of animation software: equations and text that move because they can. Each movement must make the same point that the voice makes at that moment.

In a Manim script:

- An object moves when the data that it stands for moves.
- An object changes colour when its state changes.
- If neither occurs, the object stays in its position.

Do not animate a label in from the side. Do not make a box bounce when it arrives. Do not arrange the row again between beats. `va qc` asks that the picture not stay still for six seconds. To obey it, put real steps across the sentence with `beat.until(...)`. Do not add drift.

## Left out on purpose

- **Characters and stories.** Two of the channels use characters to hold the explanation (a bookshop robot, a crowd of pi creatures). It works, but it needs the judgement of an illustrator, which this skill does not have.
- **A roadmap card between sections.** The video of 19 minutes returns to a card of chapter thumbnails between sections. A video shorter than three minutes has nothing to navigate.
- **Composed music.** All of them have it. This skill puts music that you supply below the voice and holds it to a measured level (taste.md, "Music stays under the voice"). It does not write music.

## Where this came from

We looked at ten videos on 2026-10-10. We used their chapter lists and preview frames sampled each one to ten seconds: the opening and two or three parts of each video, not each frame. We also used the written advice of 3Blue1Brown for new explainers, and the judging criteria of its Summer of Math Exposition: clarity, motivation in the first thirty seconds, novelty, and memorability.

We did not hear the narration, and transcripts were not available. Thus all statements here about wording are inferred from chapter titles and one written lesson. They are not measured.

| Channel | Video | Length |
|---|---|---|
| 3Blue1Brown | But what are Hamming codes? | 20:05 |
| 3Blue1Brown | But what is a neural network? | 18:40 |
| Reducible | Huffman Codes: An Information Theory Perspective | 29:10 |
| Polylog | The hidden beauty of the A* algorithm | 19:22 |
| Spanning Tree | What Are Bloom Filters? | 6:03 |
| Fireship | Recursion in 100 Seconds | 1:40 |
| ByteByteGo | Consistent Hashing | 8:04 |
| Primer | Simulating Natural Selection | 10:00 |
| Welch Labs | The moment we stopped understanding AI | 17:38 |
| Sebastian Lague | Coding Adventure: Ray Tracing | 37:57 |

The same videos obey these rules, which this skill had before:

- a hook before a title
- a concrete example before the general statement
- one colour for each meaning in the full video (four of them keep red for the error or the cost)
- the same object on screen while its state changes
- code next to its effect
