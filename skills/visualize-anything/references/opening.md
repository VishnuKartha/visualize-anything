# The opening

The first ten seconds decide whether the rest is watched. A title card that fades in and sits there while a voice talks is the weakest way to spend them, so the video has none. An opening here does two things: it gives the viewer a reason to care, and it puts that reason on screen in a few large words. The opening does not say what the video is called or link to what it explains: the thumbnail and the page it is posted on do the first, and the last scene does the second.

## The shape

A `question` scene is the hook, on screen as a large statement while the narration delivers it.

- Give the beat a `text`. A cue brings in a second line on the words that deliver the turn.
- A beat without `text` leaves the statement standing. Nothing replaces it: the scene ends and the first picture begins.
- Keep it to one or two beats, about ten seconds. The explanation starts in the next scene.

```json
{
  "id": "intro",
  "need": "question",
  "why": "Opening: a surprising number, then the promise to explain it.",
  "beats": [
    {
      "say": "Finding one value in a sorted list of a million items takes at most twenty comparisons.",
      "text": "*1,000,000* sorted items.",
      "cues": [{"at": "at most twenty", "text": "*1,000,000* sorted items.\nAt most *20* comparisons."}]
    },
    {"say": "Here is how eleven lines of Python manage that."}
  ]
}
```

What the scene does with that, without being asked: words rise in as they are spoken, starred numbers count up to their value, a statement that extends the previous one keeps its first line in place, the code the video is about drifts faintly behind, and the frame pushes in slowly so it is never still.

## Writing the hook

The hook is the first sentence of narration and the `text` that goes with it. Pick the kind that fits the subject:

| Kind | Narration | `text` |
|---|---|---|
| A surprising number | "Finding one value in a million takes at most twenty comparisons." | `*1,000,000* items. At most *20* comparisons.` |
| A problem with no obvious answer | "A cache has limited room, so when it fills up, something has to go." | `A full cache has to *forget* something.` |
| A failure | "This function is correct on every input you will try, and wrong on one you won't." | `Correct on every test. *Wrong* in production.` |
| A contrast | "The naive version takes four seconds. This one takes four milliseconds." | `4 seconds. Then *4 milliseconds*.` |
| A question the viewer has had | "Why does adding an index make the same query a thousand times faster?" | `Same query. *1,000×* faster. Why?` |
| Something the viewer already relies on | "A page that took two seconds to load takes twenty milliseconds the second time, because something remembered it." | `2 seconds. Then *20 milliseconds*.` |

Rules for the `text`:

- **Eight words a line at most.** It is read at a glance while the voice says the full sentence. It is a headline for the narration, not a transcript of it.
- **Star the one thing to remember**, usually the number: `*20* comparisons`. Starred words are set in the accent colour; starred numbers count up.
- **Use a second line for the turn**, brought in by a cue on the words that deliver it: the setup lands first, the payoff second.
- **Every number must be true and come from the code or its behaviour.** A hook that overstates is worse than none.

Do not open by announcing the video. "In this video we will look at...", "Today we are going to...", "Let's explore..." give the viewer nothing. The router flags these.

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

Leave `thumbnail` out and the hook statement is used as it stands at the end of the opening, with no picture. That is rarely short enough, and the router says so.

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

## Opening cold

When the most striking thing about the subject is a picture, show it first: open on one short scene (a `motion` or `trace` scene of ten seconds or so) whose first sentence is the hook. A `question` scene can follow as the statement that names what was just seen, or be left out altogether; give the storyboard a `thumbnail` either way.

Use this sparingly. It works when the picture is self-explanatory within a few seconds, such as two approaches racing on the same input. If the picture needs the narration to make sense, the hook statement is the better opening.
