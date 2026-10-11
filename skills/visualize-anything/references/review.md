# Independent review

The agent that built a video is the worst judge of it: it knows what every frame was meant to show, so it sees that instead of what is there. A review only counts when it comes from an agent that did not build the video and was told nothing about the intent.

There are two reviews. The first reads the plan, before anything is recorded or drawn, when a finding costs a sentence to fix. The second watches the result.

## The three viewers

Every video makes a contract with three people. They are specific on purpose: "a general audience" notices nothing.

| Viewer | Who | The contract |
|---|---|---|
| The newcomer | Can program; has never seen this code, algorithm, or system; does not know its words; closes the tab when lost | After every scene they can say in one sentence what happened and why it mattered |
| The practitioner | Writes code daily and has to use or change this next week; dislikes unexplained jargon and unearned confidence | They could explain it to a colleague and write a small version; nothing turns out to have been simplified in a way that matters |
| The expert | Knows the code and the ideas behind it thoroughly; notices every claim that is only nearly true | Nothing is incorrect or misleading; they would send it to someone joining the team |

Where the three pull apart: the expert decides what is true, and that is not traded away. The newcomer decides pacing and vocabulary. The practitioner decides which mechanisms and costs make the cut. A better example usually satisfies all three.

## The plan review

Run it after `va route` is clean and `va facts` passes, before `va tts`.

```bash
VA review <project> --plan
```

This writes three briefs to `out/review/`: `plan-1-newcomer.md`, `plan-1-practitioner.md`, `plan-1-expert.md`. Each holds the whole script as it will be heard, the plan scene by scene (what is heard beside what is on screen), the facts ledger with what the oracle found, the vocabulary, the router's report, and one viewer's description of themselves. The practitioner and the expert are also given the paths of the source.

1. **Start three fresh subagents, one per brief,** each with only this instruction: *"Read `<path to its brief>` and do what it says."* Run them at the same time. Do not tell any of them what the others are, or what you think is weak.
2. **Read the three reports** (`plan-1-<viewer>-report.md`). Each starts by saying every scene back in one sentence. A scene a viewer could not say back, or said back wrongly, is a blocker for that scene whoever is right: the plan as written did not carry it.
3. **Give every finding a disposition,** written under it in the report:
   - *fixed*: what changed, in the script and the storyboard;
   - *answered*: why not, in one sentence a stranger would accept;
   - *deferred*: to what, and why it can wait.

   The plan goes on to `va tts` when no finding lacks one and no blocker is open.
4. **Rerun `va route` and `va facts`** after the fixes. If the script changed in substance, run the plan review again; it is three short reads.

The plan review catches what no check can: a word used before the newcomer has it, a step the practitioner could not reproduce, a sentence the expert knows is only usually true. It is the cheapest moment to hear all three.

## The video review

1. **Render first.** `VA render <project>` must have succeeded and its QC report read.
2. **Write the brief.**

   ```bash
   VA review <project>
   ```

   This refreshes the contact sheets, reruns the checks, and writes `out/review/brief-1.md`: what the video is for, the scene plan with each scene's need and reason, the narration with times, the paths to the sheets, what the automated checks found, what to judge, and the report format.
3. **Hand it to a fresh agent.** Start a new subagent and give it only this instruction: *"Read `<path to brief-1.md>` and do what it says."* Do not summarise the video, list what you fixed, or say what you are worried about. It will read the sheets itself and write `out/review/report-1.md`.
4. **Act on the report.** Fix the defects it ranks highest, most serious first. Do not argue with a finding because you know what was intended; if a reviewer misread the frame, a viewer will too. Rerender.
5. **Verify with another fresh agent.**

   ```bash
   VA review <project> --verify <project>/out/review/report-1.md
   ```

   This writes `brief-2.md`, which asks a new reviewer to mark each earlier item FIXED, PARTLY, or STILL PRESENT and to look for anything the fixes broke. It ends its report with SHIP or ONE MORE PASS.
6. **Stop** at SHIP, or after the verification round if what remains is cosmetic. Two rounds is the norm; more only if the user asks.

The video brief names the three viewers and their contracts, and asks its reviewer to say each scene back as the newcomer would. Give its findings dispositions the same way; the verification round judges those too.

Tell the user the verdict and what was changed because of the review. If no subagent is available, say plainly that the video was not independently reviewed rather than reviewing it yourself and calling it a review.

## Where this came from

Three named viewers, a review of the plan before the build as well as of the result after it, the one-sentence summary as the test of a scene, and a recorded disposition for every finding are the review method of [jeffs_math_explainer_videos](https://github.com/Dicklesworthstone/jeffs_math_explainer_videos), adapted from maths videos to code. The viewers here are this skill's own.

## What a reviewer catches that the checks do not

The automated checks find a frozen picture, text off the frame, a collision with the captions. They cannot tell that the highlighted line is not the one being talked about, that a colour means "current" in one scene and "found" in the next, that a label is technically on screen but too small to read, or that the narration asserts something the picture never shows. Those are what the reviewer is for.
