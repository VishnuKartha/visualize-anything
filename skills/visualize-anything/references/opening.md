# The opening

The first ten seconds decide whether the rest is watched. The channels people learn from spend them the same way: no title, no introduction, the subject already on screen and the most interesting thing about it already being said. An opening here does that. It finds the hook before anything is written, says it over the picture that shows it, and runs straight on into the explanation.

## Find the hook

The hook is the core of the problem the subject solves, or the most interesting thing about how it solves it. It is settled before the storyboard, with the user, and recorded in the brief.

Answer these from the source, in writing, before choosing:

1. **What goes wrong without this?** The problem it exists to solve, as something concrete: what breaks, what is slow, what could not be done.
2. **What would someone try first, and where does that lose?** The obvious approach and its cost.
3. **What is the most surprising true thing about the answer?** A number, a reversal, something small doing something large.
4. **For a paper: what could nobody do before it, and what one idea made it possible?**

A hook is one sentence made from the strongest of those answers.

| Kind | The hook | Open on |
|---|---|---|
| A surprising number | "A sorted list of a million items can be searched in twenty looks." | Both ways of searching, run on the same list, each with its count |
| A problem with no obvious answer | "A full cache has to forget a key, and the obvious choice is wrong." | The full row, the new key arriving, the obvious victim marked |
| A failure | "This function is right on every input you will try, and wrong on one you won't." | The input that breaks it, running |
| A contrast | "The same query takes four seconds, or four milliseconds." | Both, side by side, with a clock |
| Something the viewer relies on | "The second time you load a page, something has remembered it." | The request going out twice, and the second one stopping short |
| What a paper made possible | "Before this, a model read a sentence one word at a time. After it, all at once." | The old way crawling along the sentence, then the new way lighting every word |

Test each candidate. First, that it is sound:

- **It is true, and it comes from the source.** A hook that overstates is worse than none.
- **It is one sentence, sayable in a breath.**
- **It can be shown.** If no picture could be on screen while it is said, it is a claim about the subject, not the subject.
- **It is about the problem or the idea.** Not the video ("In this video..."), not the subject's name, not a definition.

Then, from the seat of the viewer named in the brief. A hook fails in one of four ways:

| It fails by | The test |
|---|---|
| Delay | Do they know what this is about within two seconds? "This is surprising..." says nothing yet; "A sorted list of a million items..." does. |
| Confusion | Is every word one they already have? A term the video has not introduced cannot be in its first sentence. |
| Irrelevance | Would they recognise it as theirs: a problem they have met, a thing they use, a question they have had? |
| Indifference | Is there a turn in it: what they would expect, and then what is true instead? |

A hook can pass all of that and still be weak, because the shape is right and what it carries is not. Two last checks on what it carries:

- **It is specific.** "Binary search is efficient" has the shape of a claim and nothing in it. "A million items, twenty looks" is the same claim with something to picture. Prefer the number, the named failure, the particular case.
- **The turn is real.** Not the word "but" between two things that do not conflict. A real turn is one of these: what you would expect against what happens; the visible cause against the actual one; the obvious approach against the one that works.

A candidate that fails two or more of these is rewritten before it is offered.

Write two or three candidates of different kinds and put them to the user along with the brief, your recommendation first. Show the recommended one as it will be heard, not as a slogan: the opening scene's lines, and the first line of the scene after it. The hand-off into the explanation is part of what is being chosen. Record the one chosen, with the word or number it turns on starred:

```json
"brief": {
  "audience": "programmers meeting the algorithm for the first time",
  "length": 70,
  "focus": "why halving makes it fast",
  "hook": "A *million* sorted items, searched in *twenty* looks."
}
```

`va route` holds the video to it: the opening scene has to say a starred word, and the closing scene has to come back to one.

## Open on the picture

The first scene is a picture scene (`motion`, `trace`, `data`), and the hook is its first sentence.

```json
{
  "id": "race",
  "need": "motion",
  "why": "Opening: the claim, then both ways of searching run on the same list with a count.",
  "class": "Race",
  "script": "manim/search.py",
  "beats": [
    {"say": "A sorted list of a million items can be searched in twenty looks. Here is how, on a list of seven."},
    {"say": "The obvious way is to check every item in turn. Finding 57 takes six looks."},
    {"say": "Binary search checks the middle, throws half the list away, and gets there in two."}
  ]
}
```

The first twenty seconds have four jobs, in this order:

| Job | What the viewer gets | Binary search | LRU cache |
|---|---|---|---|
| Context | What this is about, at once | "A sorted list of a million items..." | "This cache holds three keys, and it is full." |
| Recognition | Why it is theirs | "...can be searched in twenty looks." | "To store a fourth, it has to forget one." |
| The turn | What they expected, against what is true | Six looks by scanning, two by halving | "The obvious one to drop is whichever went in first. But A was read a moment ago." |
| The promise | What staying will give them | "Here is how, on a list of seven." | "The key to forget is the one used longest ago." |

The promise is what the next scene's first line picks up. An opening with no promise ends, and the video has to start again.

- **The hook comes first.** If it needs setting up, the setup is one sentence, in the same beat. A definition, a history, or "what is a cache" is not setup; it is the introduction this opening does not have.
- **Something is on screen within two seconds and moving within five.** The voice does not talk over an empty frame.
- **The hook's number or word is in the picture**, as a label or a count, when it is said.
- **It is the video's own picture.** Same data, same drawing helpers, same colours as the scenes after it. Nothing drawn for the opening is thrown away: the list the race ran on is the list the code is traced on.
- **Ten to twenty seconds.** It makes the claim and shows why it is worth explaining. The explaining starts in the next scene.
- **No announcement.** "In this video we will look at...", "Today we are going to...", "Let's explore..." give the viewer nothing. The router flags these.

The obvious approach losing (see [story.md](story.md)) is very often the right opening picture: it is the problem, shown.

## Make it flow

A strong hook followed by a video that starts again from the beginning is two videos. The opening has to run on into the explanation, and every scene into the next.

- **The opening leaves one question open. The second scene's first sentence starts answering it.** Write the question down. After "a million items in twenty looks", it is "how does it know which half to throw away?", so the next scene begins there, not with "Binary search is an algorithm that...".
- **Each scene's first sentence leans on the last sentence of the scene before.** The test is the word that would join them. "But" and "so" mean one follows from the other. If the only word that fits is "next" or "also", a reason is missing or a scene is in the wrong place.
- **No scene starts over.** "Now let's look at...", "Next, ...", "Moving on", "First, let's..." tell the viewer a new section is beginning, which tells them the last one did not lead anywhere. The router flags these.
- **A term arrives with the thing it names.** Say "lo and hi" as the two markers appear, not a sentence earlier. Never define something before the viewer has a reason to want the word.
- **The picture carries over.** Where two scenes show the same thing, the second is marked `continues` and starts on the frame the first ended on ([taste.md](taste.md)).
- **Write the narration whole, then split it.** `script.md` is the entire narration as one continuous piece, written before any scene exists; scenes and beats are cuts made in it afterwards. A line that was written as the next sentence of a paragraph follows on; a line written to fill a scene does not. `va route` checks that the storyboard says the script's words, in order, and nothing else.
- **Read it aloud from top to bottom** before showing it to the user. Wherever you would have to pause and say "anyway", the join is wrong.

| Last line of a scene | A first line that starts over | A first line that follows on |
|---|---|---|
| "...and gets there in two." | "Now let's look at the code." | "Here is how it knows which half to throw away." |
| "...and the next request for A misses." | "An LRU cache is a data structure that..." | "So the key to forget is the one used longest ago." |
| "...moves a key to the newest end." | "Next, the put method." | "Writing does the same, and then has one more thing to check." |

## When there is no picture: a statement

Some subjects have nothing to show in their first seconds: a naming convention, a configuration format, a policy. Then the hook goes on screen as words: a `question` scene, with an `override` saying why the video does not open on a picture.

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

- Give the beat a `text`: the hook as a headline, eight words a line at most, with the one thing to remember starred. Starred numbers count up.
- A cue brings in a second line on the words that deliver the turn. A beat without `text` leaves the statement standing.
- One or two beats, about ten seconds. A `question` scene with no `text` puts nothing on screen, which the router treats as an error.

Without the `override`, the router asks why the video opens on words.

## The thumbnail

The thumbnail is the hook frame: a few very large words above one picture from the video. It is met about 120 pixels wide, beside the video's title, so it carries what the title does not.

```json
"thumbnail": {"text": "*1,000,000* items.\n*20* looks.", "from": "race", "beat": 2}
```

- **Five words at most**, on one or two lines (`\n` between them). The words are set as large as the frame allows, so every word you add makes all of them smaller. Keep the number or the word that makes the claim and drop the rest.
- **Star the one thing to remember.** It is set in the accent colour.
- **`from` names the scene with the most striking picture**, and `beat` the moment: the two approaches side by side with their counts, the row one entry over capacity. The moment of tension reads better than the settled result. Without `beat`, the scene's last frame is used.
- **Do not repeat the title.** Wherever the video is listed, the title is already next to the thumbnail.
- **Two things in the frame**: the words and the picture. There is no kicker, no subtitle, and no logo to add.

Leave `thumbnail` out and the router says so: with nothing else to go on, the thumbnail would only repeat the title.

`va render` writes `out/thumbnail.png` and `out/thumbnail-small.png`. Look at the small one: it is the size viewers see. If a word cannot be read there, cut words until it can.

## The title

The top-level `title` is the video's name where it is posted. It is not shown in the video. It promises a specific payoff in a few words.

| Weak | Why | Strong |
|---|---|---|
| Introduction to binary search | Names a genre, not a payoff | Why binary search needs so few steps |
| How an LRU cache works | Could sit on any video about it | How an LRU cache decides what to forget |
| Rate limiting | Only the subject's name | Why a token bucket lets bursts through |
| Understanding the event loop | Names a genre | Why one slow callback freezes everything |

- Lead with *why*, *how*, or the claim itself, and name the surprising part.
- Nine words at most.

The name of the thing explained (the function, the file, the paper) is a different thing from the video's title. It is shown at the very end, by a `credit` scene; see [taste.md](taste.md).

`va route` checks all of this: a genre title, a subject-only title, a title that is too long, a `question` scene with nothing on screen (an error), hook lines that are too long or have nothing starred, narration that opens with an announcement, and a thumbnail with too many words, nothing starred, no picture, or the title repeated.
