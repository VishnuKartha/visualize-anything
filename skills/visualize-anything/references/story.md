# The shape of the story

The house rules in [taste.md](taste.md) came from watching videos this skill produced. These came from the other direction: looking at how the channels people learn from build theirs (3Blue1Brown, Reducible, Polylog, Fireship, ByteByteGo, Spanning Tree, Primer, Welch Labs) and keeping what fits a 60 to 150 second code explainer.

Decide these in step 1, before the storyboard exists. `va route` checks none of them; the independent reviewer is asked about them.

| Move | Why | Where it goes |
|---|---|---|
| The obvious way goes first, and is shown costing something | The clever version means nothing until the viewer has seen what it replaces | Scene 2, a `motion` scene |
| The cost is a number on screen, counted as it happens | A claim the viewer watched add up is believed; one that is only said is not | Every scene that claims a cost |
| The opening starts from something the viewer already has | A stranger's problem is easy to click away from | The hook; see [opening.md](opening.md) |
| The example is small; one beat says how it scales | Seven items can be followed. A million cannot, but it is the reason to care | The `math` scene or the last trace |
| A question is asked before it is answered | The viewer who has the question in mind is waiting for the answer | The first beat of a scene |
| The first code on screen is the smallest piece that shows the idea | Code is the slowest thing on screen to read | The first `trace` scene |
| The limit is named | Saying what it cannot do is what makes the rest credible | One beat before the recap |
| Nothing moves without a reason | Motion pulls the eye; if it means nothing, it pulls the eye from what does | Every Manim script |

## The obvious way first

Five of the ten videos looked at spend their first minute on an approach that is about to lose. An error-correcting code is introduced by first sending redundant copies, under a bar showing about half the file given up to redundancy; the next bar shows 96.5% of the file kept. Consistent hashing starts with `hash(key) % n`, then crosses a server out in red and lets the keys reshuffle. A* is introduced by Dijkstra's search flooding a large red disc across the map, with A*'s small one under it. Recursion is introduced by a function with no base case, whose call stack grows and turns red.

The pattern has three parts: the approach anyone would try, the same data, and what it costs as something visible.

| Subject | The obvious way | What it costs, on screen |
|---|---|---|
| Binary search | Check every item in turn | Six looks against two |
| LRU cache | Drop whatever was added first | It evicts the key that was read a moment ago |
| Consistent hashing | `hash(key) % n` | One server leaves and nearly every key moves |
| Bloom filter | Keep every key in a set | Memory grows with each key, beside a row of bits that stays one size |

Give it the second scene, as `motion`: both approaches run on the same data, in the same colours, with a count beside each (routing.md, "`change` or `motion`?"). `race` in `examples/binary-search/video/storyboard.json` is the model. Ten to fifteen seconds is enough.

When the subject has no rival approach (a data layout, a protocol), show the failure the design prevents instead: the request that would be lost, the write that would be overwritten.

## A count on screen

Where these videos claim a cost, the measure is in the frame with the mechanism, updating as it runs: a histogram of the population's speed above the simulation that produces it; a bar of original against redundant bits above the block of bits; the area a search has explored, shaded as it grows; a network's weights added up term by term until the total, 13,002, stands under the sum.

So when the narration says "six looks", "four comparisons", or "nothing is evicted", a counter next to the data reaches that number at that word. If the hook stars a number, some scene should end with that number standing on screen, earned. How to draw it is in [scene-manim.md](scene-manim.md), "What to draw".

## Small, then scaled

The explanations run on something small enough to follow: sixteen bits standing in for a 256-bit block, one creature before a population, a handful of road junctions cut out of a whole map. The large case appears before or after, never during.

This skill already holds one small dataset for the whole video and returns to the hook at the end. The piece to add is one explicit beat that connects the two: "Seven items took two passes. A million take twenty, because each pass halves what is left." Without it, the hook's number and the worked example are two separate facts.

## Ask it before answering it

Chapter titles in these videos are often the viewer's question at that point: why layers, what makes a good potential, what a neuron is. 3Blue1Brown draws the audience as characters who say what the viewer is thinking, including the objection (that recognising a loop is as hard as recognising the digit). The narration raises the question, leaves a breath, then answers.

In a storyboard this is the first beat of a scene: "But how does it know which key is oldest?" and then the picture that answers. One or two in a video. A question the viewer does not actually have at that moment is filler.

## The first code is the smallest piece

The long videos hold the code back until the idea is understood: the implementation chapter starts 65%, 90%, and 96% of the way through the three algorithm videos that have one. The 100 second video is the closer model for this skill, and it does the opposite with a condition: code is on screen by the eighth second, but it is three lines, typed in as it is spoken, and its consequence is drawn beside it straight away. The real function arrives in the second half. The 38 minute coding video works the same way throughout: a short excerpt on an otherwise empty frame, then what that excerpt renders.

For a video under three minutes: the first `trace` scene shows the fewest lines that carry the idea (a field, a loop header, one call), and the full function comes later. For a longer one, put a `motion` scene before the first `trace` (routing.md, "Concept, then code").

## Name the limit

Two of these videos end the explanation on a limit: the Bloom filter video's last chapter is what it cannot do (delete), and the neural network lesson closes on a caveat about the function it just taught. One beat before the recap: "It costs a second dictionary entry per key", "The list has to stay sorted". It belongs in the recap as a takeaway when it changes how the viewer would use the thing.

## Nothing moves without a reason

3Blue1Brown's advice to people starting out names this as the common abuse of animation software: equations and text that move because they can. Each movement should make the same point the voice is making at that moment.

In a Manim script: an object moves when the data it stands for moves, changes colour when its state changes, and otherwise stays where it is. Do not animate a label in from the side, bounce a box on arrival, or re-lay-out the row between beats. `va qc` asks that the picture not sit still for six seconds; answer that by spreading real steps across the sentence with `beat.until(...)`, not by adding drift.

## Left out on purpose

- **Characters and stories.** Two of the channels carry the explanation with characters (a bookshop robot, a crowd of pi creatures). It works, and it needs an illustrator's judgement this skill does not have.
- **A roadmap card between sections.** The 19 minute video returns to a card of chapter thumbnails between sections. Under three minutes there is nothing to navigate.
- **Music and sound.** All of them have it. taste.md leaves sound undecided.

## Where this came from

Ten videos, looked at on 2026-10-10 through their chapter lists and through preview frames sampled every one to ten seconds (the opening and two or three stretches of each, not every frame), plus 3Blue1Brown's written advice for new explainers and the judging criteria of its Summer of Math Exposition (clarity, motivation within the first thirty seconds, novelty, memorability). The narration was not heard and transcripts were not available, so everything here about wording is inferred from chapter titles and one written lesson, not measured.

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

Rules this skill already had that the same videos follow: a hook before any title, a concrete example before the general statement, one colour per meaning for the whole video (red is reserved for the error or the cost in four of them), the same object kept on screen while its state changes, and code shown beside what it does.
