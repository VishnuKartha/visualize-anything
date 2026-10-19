# The opening

The first seconds control whether the viewer stays. A good opening has no title at the start and no announcement. The subject is on screen immediately. It starts from a thing the viewer knows. In a few sentences it gets to the most interesting fact about the subject.

Before you write, select two items. Do not ask the user to select them:

- the context: where this viewer is now
- the hook: the surprise from there

The opening then does these steps in order:

1. It says the context, in a short time.
2. It shows the hook on the same picture.
3. It names the work on a title card, because the viewer now knows its purpose.
4. It continues into the explanation without a stop.

A hook without context is the most frequent cause of a bad opening. "The published router made ninety tokens a second and the big model alone made a hundred and forty-five" is a surprise only to a person who knows what a router is. That person must also know why the router was expected to be faster. Without that, the sentence is two numbers. The viewer must stand on some ground before the ground can move.

## Start where the viewer is

The context is the first thing that the opening says. It tells where the viewer in the brief is now, and the one step from there to the subject. Select it with the hook, before the storyboard. Record it in the brief as `context`.

Write the answers to these questions:

1. **What does this viewer use, do, or know that the subject is built on?** Do not answer with a definition of the subject. Answer with a thing they know: a cache that they used, a chat service that selects a model for each question, a word that they found in a dictionary.
2. **What is the one step from there to the subject?** "A service selects a model for each question" to "a newer router selects one for each token" is one step. If you need three steps, the audience in the brief is incorrect, or the video is two videos.
3. **What must the viewer believe before the hook can surprise them?** Set the expectation that the hook breaks. Say or show "sending only the hard tokens to the big model should be faster" before "it was slower".

| Subject | Context: where they are, and the step | Then the hook |
|---|---|---|
| Binary search | Nobody looks a word up by starting at page one. | A million sorted items take twenty looks. |
| LRU cache | A cache keeps what you asked for lately, and it has limited room. | When it is full it has to forget a key, and the obvious choice is wrong. |
| A paper on serving token-level routing | Services like ChatGPT already pick a small or a big model for each question. A newer router, R2R, picks one for each token, and the big model sees one token in twenty. | That should be faster. Served with its published code, it was slower than the big model alone. |

Context is not an introduction. To know the difference, ask if the hook needs it:

- **It has one or two sentences and takes ten to twenty seconds.** That is sufficient ground, and the hook is still in the opening.
- **It is concrete, and it belongs to the viewer.** "Chat services already choose a model for each question" starts from a thing they used. "Large language model routing distributes inference work across models" is the first sentence of an abstract. It is a definition.
- **The picture shows it.** The picture of the context (ten questions that go to two models) is the picture that the hook then changes. Do not draw a picture for the context and then discard it.
- **The hook needs each sentence.** Remove history, a definition of the field, the names of the authors, and general importance. If the hook works without a sentence, remove the sentence.
- **It sets the expectation that the hook breaks.** The last sentence of the context usually tells the viewer what to expect.
- **It names the earlier work.** If the context uses an earlier system, product, or paper, say its name. "A newer router, R2R" is better than "a newer router". "Services like ChatGPT" is better than "chat services". A name lets the viewer connect the context to a thing that they know or can find. Put the name on screen also. The name of the work that the video explains comes later, on the title card.

## Find the hook

The hook is the core of the problem that the subject solves, or the most interesting fact about its solution. Select it before the storyboard. Record it in the brief.

Write the answers to these questions from the source before you select:

1. **What goes wrong without this?** Give the problem as a concrete thing: the item that breaks, the item that is slow, the task that was not possible.
2. **What does a person try first, and where does that fail?** Give the obvious approach and its cost.
3. **What is the most surprising true fact about the answer?** A number, a reversal, or a small thing with a large effect.
4. **For a paper: what was not possible before it, and which one idea made it possible?** Answer from the abstract. `va paper` divides the abstract into numbered claims ([paper.md](paper.md)). The hook is one of those claims, or the evidence for one.

A hook is one sentence made from the strongest answer. Write it for a viewer who heard the context and nothing more.

| Kind | The hook | Open on |
|---|---|---|
| A surprising number | "A sorted list of a million items can be searched in twenty looks." | Both ways of searching, run on the same list, each with its count |
| A problem with no obvious answer | "A full cache has to forget a key, and the obvious choice is wrong." | The full row, the new key arriving, the obvious victim marked |
| A failure | "This function is right on every input you will try, and wrong on one you won't." | The input that breaks it, running |
| A contrast | "The same query takes four seconds, or four milliseconds." | Both, side by side, with a clock |
| Something the viewer relies on | "The second time you load a page, something has remembered it." | The request going out twice, and the second one stopping short |
| What a paper made possible | "Before this, a model read a sentence one word at a time. After it, all at once." | The old way crawling along the sentence, then the new way lighting every word |

Test each candidate. First, make sure that it is correct:

- **It is true, and it comes from the source.** A hook that says too much is worse than no hook.
- **It is one sentence.** A person can say it in one breath.
- **A picture can show it.** If no picture can be on screen while the voice says it, it is a claim about the subject. It is not the subject.
- **It is about the problem or the idea.** It is not about the video ("In this video..."). It is not the name of the subject. It is not a definition.
- **It says its own point.** Do not give two numbers and let the listener find the surprise. "It made 90 tokens a second. The big model alone made 145" makes the listener compare. "It came out slower than the big model alone" says the point. Then give the numbers.

Then test it as the viewer in the brief. A hook fails in one of four ways:

| It fails by | The test |
|---|---|
| Delay | Does the viewer know the subject in the first two seconds of the video? The context does this. "This is surprising..." says nothing. "A sorted list of a million items..." says the subject. |
| Confusion | Does the viewer know each word, from before the video or from the context? Do not put a term in the hook that the opening did not give. |
| Irrelevance | Does the viewer recognise it as their own: a problem they met, a thing they use, a question they asked? |
| Indifference | Does it have a turn: the thing they expect, and then the true thing? |

A hook can pass these tests and be weak, because its content is weak. Do two more checks on its content:

- **It is specific.** "Binary search is efficient" has the shape of a claim and no content. "A million items, twenty looks" is the same claim with a picture. Use the number, the named failure, or the specific case.
- **The turn is real.** The word "but" between two things that do not conflict is not a turn. A real turn is one of these: the expected result against the real result, the visible cause against the real cause, or the obvious approach against the approach that works.

If a candidate fails two or more of these tests, write it again before you select.

Write two or three candidates of different kinds. Select the strongest. Read it as the viewer will hear it: the context before it, the hook, and the first line of the next scene. Tell the user the hook that you selected, in one line, and continue. Record the context. Record the hook with a star on the word or number that it turns on:

```json
"brief": {
  "audience": "programmers meeting the algorithm for the first time",
  "length": 70,
  "focus": "why halving makes it fast",
  "context": "Nobody looks a word up in a dictionary by starting at page one: you open it in the middle and throw half away.",
  "hook": "A *million* sorted items, searched in *twenty* looks."
}
```

`va route` makes sure of three things:

- The brief has a context.
- The opening says a starred word of the hook.
- The closing scene returns to a starred word.

The opening is the first scene and each scene that continues its picture (`"continues": true`). A long context can thus have its own scene, and the hook the next scene. The picture must not start again between them.

## Open on the picture

The first scene is always an animation in Manim (`motion`, `branching`, or `math`). Its first sentence is the context. The hook follows on the same picture. The picture starts as the thing that the viewer knows. Then it becomes the hook: the thing that goes wrong, the two approaches in a race, or the number that counts next to the thing it measures.

A card, a chart, a panel, or code with its animation can come second. None of them shows the hook as it occurs. `va route` gives an error if one of them is the first scene. Build the opening from the primitives of Manim. [scene-manim.md](scene-manim.md) lists them.

```json
{
  "id": "race",
  "need": "motion",
  "why": "Opening: the claim, then both ways of searching run on the same list with a count.",
  "class": "Race",
  "script": "manim/search.py",
  "beats": [
    {"say": "Nobody looks a word up in a dictionary by starting at page one."},
    {"say": "Search any sorted list the same way, and a million items take twenty looks. Here is how, on a list of seven."},
    {"say": "The obvious way is to check every item in turn. Finding 57 takes six looks."},
    {"say": "Binary search checks the middle, throws half the list away, and gets there in two."}
  ]
}
```

The first twenty seconds have four jobs, in this order:

| Job | What the viewer gets | Binary search | LRU cache |
|---|---|---|---|
| Context | Where they are now, and the subject | "Nobody looks a word up by starting at page one." | "A cache keeps what you asked for lately. This one holds three keys, and it is full." |
| Recognition | Why it is theirs | "A million sorted items, searched in twenty looks." | "To store a fourth, it has to forget one." |
| The turn | What they expected, against what is true | Six looks by scanning, two by halving | "The obvious one to drop is whichever went in first. But A was read a moment ago." |
| The promise | What they get if they stay | "Here is how, on a list of seven." | "The key to forget is the one used longest ago." |

The first line of the next scene continues from the promise. An opening without a promise ends, and the video must start again.

- **The context comes first. The hook comes immediately after.** Use one or two sentences from where the viewer is ("Start where the viewer is"). Then say the hook. A definition, a history, or "what is a cache" for a person who used one is not context. It is an introduction, and this opening does not have one.
- **Do not open on the hook without context.** Examine the first sentence of the video. If it has a word, a number, or an expectation that the viewer did not get, the viewer cannot picture the surprise.
- **Put a picture on screen in the first two seconds. Make it move in the first five seconds.** The voice must not speak over an empty frame.
- **Put the number or the word of the hook in the picture** when the voice says it. Use a label or a count.
- **Use the picture of the video.** Use the same data, the same drawing helpers, and the same colours as the subsequent scenes. Do not discard a drawing after the opening. The list for the race is the list for the code trace.
- **The opening has fifteen to thirty-five seconds.** The context has ten to twenty seconds. The hook is complete at the end. The opening makes the claim and shows why it needs an explanation. The explanation starts in the next scene.
- **Do not announce the video.** "In this video we will look at...", "Today we are going to...", and "Let's explore..." give the viewer nothing. The router flags these.

The obvious approach that fails (see [story.md](story.md)) is frequently the correct opening picture. It shows the problem.

## Then name it

The opening does not start with a title. It also does not end without one. After the context and the hook give the purpose of the work, one line says that this is the aim of the work. A title card names it:

```json
{
  "id": "title",
  "need": "name",
  "why": "The viewer now knows the problem; this is the work that takes it on, by name.",
  "kicker": "The paper",
  "title": "TokenRouter",
  "subtitle": "Efficient Serving System for Token-Level LLM Routing · Fu et al., 2026",
  "beats": [{"say": "Why, and how to fix it, is what the paper TokenRouter sets out to show."}]
}
```

- **Put it immediately after the opening. Do not put it before.** The order is context, hook, name. A title card as the first picture names a thing that the viewer has no reason to want. The same card twenty seconds later answers "so what is this?" when the viewer asks it.
- **Use one line that points back.** "That is what ... sets out to show" or "Fixing that is what ... is for". The sentence uses the hook, says the name, and stops. It takes five to eight seconds.
- **`title` is the name as people say it and search for it.** Put the long form in `subtitle`: the full title of a paper with its authors and year, or a file path. `kicker` gives the kind of thing.
- **The explanation continues from the hook, not from the card.** The next scene starts to answer the question that the opening left open.
- **A paper video always has one.** For code, use it when the thing has a name that the viewer must know first: a library or a named algorithm. A function of twenty lines can wait for the credit.

The closing `credit` is still last, and it tells where to find the work ([taste.md](taste.md)). The two scenes use the same card. `va route` makes sure that the title card is immediately after the opening and that there is only one.

## Make it flow

A strong hook before a video that starts again is two videos. The opening must continue into the explanation. Each scene must continue into the next.

- **The opening leaves one question open. The first scene of the explanation starts to answer it.** If there is a title card, this is the scene after the card. Write the question down. After "a million items in twenty looks", the question is "how does it know which half to throw away?". The next scene starts there. It does not start with "Binary search is an algorithm that...".
- **The first sentence of each scene uses the last sentence of the scene before it.** Find the word that joins them. "But" and "so" show that one follows from the other. If only "next" or "also" fits, a reason is missing or a scene is in the incorrect position.
- **A scene does not start again.** "Now let's look at...", "Next, ...", "Moving on", and "First, let's..." tell the viewer that a new section starts. The viewer then thinks that the last section went nowhere. The router flags these.
- **A term arrives with the thing that it names.** Say "lo and hi" when the two markers come on screen, not one sentence before. Do not define a thing before the viewer has a reason to want the word.
- **The picture continues.** If two scenes show the same thing, mark the second scene `continues`. It starts on the last frame of the first scene ([taste.md](taste.md)).
- **Write the narration as one text. Then divide it.** `script.md` is the full narration as one continuous text. Write it before a scene exists. Scenes and beats are cuts that you make afterwards. A line that you wrote as the next sentence of a paragraph continues. A line that you wrote to fill a scene does not. `va route` makes sure that the storyboard says the words of the script, in order, and no other words.
- **Read it aloud from the start to the end** before you divide it. If you must stop and say "anyway", the join is incorrect.

| Last line of a scene | A first line that starts again | A first line that continues |
|---|---|---|
| "...and gets there in two." | "Now let's look at the code." | "Here is how it knows which half to throw away." |
| "...and the next request for A misses." | "An LRU cache is a data structure that..." | "So the key to forget is the one used longest ago." |
| "...moves a key to the newest end." | "Next, the put method." | "Writing does the same, and then has one more thing to check." |

## When there is no picture: a statement

Some subjects have nothing to show in their first seconds: a naming convention, a configuration format, a policy. For these, the hook goes on screen as words. Use a `question` scene with an `override` that says why the video does not open on an animation. Without the override, this is a routing error. This case is rare.

```json
{
  "id": "intro",
  "need": "question",
  "why": "Opening: the failure, as a statement.",
  "override": "The subject is a retry policy: there is nothing to draw until the first request has failed.",
  "beats": [
    {
      "say": "Retry a failed request at once, and you can take down the service you were waiting for.",
      "text": "Retry at once.",
      "cues": [{"at": "take down", "text": "Retry at once.\nTake down the *service*."}]
    }
  ]
}
```

- Give the beat a `text`: the hook as a headline. Use eight words or fewer in a line. Put a star on the one thing to remember. Starred numbers count up.
- A cue adds a second line on the words that give the turn. A beat without `text` keeps the statement on screen.
- Use one or two beats, approximately ten seconds. A `question` scene with no `text` shows nothing on screen. The router gives an error for this.

Without the `override`, the router asks why the video opens on words.

## The thumbnail

The thumbnail is the hook frame: a few very large words above one picture from the video. A viewer sees it approximately 120 pixels wide, next to the title of the video. It must show a thing that the title does not.

```json
"thumbnail": {"text": "*1,000,000* items.\n*20* looks.", "from": "race", "beat": 2}
```

- **Use five words or fewer**, on one or two lines (`\n` between them). The tool sets the words as large as the frame permits. Each word that you add makes all the words smaller. Keep the number or the word that makes the claim. Remove the others.
- **Put a star on the one thing to remember.** It gets the accent colour.
- **`from` names the scene with the most interesting picture.** `beat` gives the moment: the two approaches side by side with their counts, or the row with one entry too many. The moment of tension is better than the final result. Without `beat`, the tool uses the last frame of the scene.
- **Do not repeat the title.** The title is always next to the thumbnail.
- **The frame has two things**: the words and the picture. Do not add a kicker, a subtitle, or a logo.

If you omit `thumbnail`, the router tells you. Without it, the thumbnail only repeats the title.

`va render` writes `out/thumbnail.png` and `out/thumbnail-small.png`. Look at the small file. It is the size that viewers see. If you cannot read a word there, remove words until you can.

## The title

The top-level `title` is the name of the video where it is published. The video does not show it. It promises a specific result in a few words.

| Weak | Why | Strong |
|---|---|---|
| Introduction to binary search | Names a genre, not a result | Why binary search needs so few steps |
| How an LRU cache works | Fits all videos about it | How an LRU cache decides what to forget |
| Rate limiting | Only the name of the subject | Why a token bucket lets bursts through |
| Understanding the event loop | Names a genre | Why one slow callback freezes everything |

- Start with *why*, *how*, or the claim. Name the surprising part.
- Use nine words or fewer.

The name of the thing that the video explains (the function, the file, the paper) is different from the title of the video. The title card shows it after the opening. The `credit` scene shows it at the end. See [taste.md](taste.md).

`va route` examines all of this:

- a brief with no context, or a context that is too long
- a hook that the opening does not say
- a title that names a genre, a title that is only the subject, a title that is too long
- a `question` scene with nothing on screen (an error)
- hook lines that are too long or have no star
- narration that opens with an announcement
- a thumbnail with too many words, no star, no picture, or the title repeated
