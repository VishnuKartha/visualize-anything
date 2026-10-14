# Independent review

The agent that built a video is the worst judge of it. It knows the purpose of each frame, so it sees the purpose and not the frame. A review is valid only when it comes from an agent that did not build the video and did not get the intent.

There are three reviews. The first review reads the plan, before you record or draw. A finding then costs one sentence to correct. The second review watches the result. The third review runs once at the end, and asks only whether each graphic could be better.

## The three viewers

Each video makes a contract with three people. They are specific on purpose. "A general audience" notices nothing.

| Viewer | Who | The contract |
|---|---|---|
| The newcomer | Can program. Did not see this code, algorithm, or system before. Does not know its words. Closes the tab when lost | After each scene they can say in one sentence what occurred and why it was important |
| The practitioner | Writes code each day and must use or change this next week. Does not like jargon without explanation or confidence without evidence | They can explain it to a colleague and write a small version. Nothing was made simple in a way that is important in practice |
| The expert | Knows the code and its ideas fully. Notices each claim that is only almost true | Nothing is incorrect or gives a wrong idea. They would send it to a new team member |

Where the three disagree:

- The expert decides what is true. Do not trade that away.
- The newcomer decides the pace and the vocabulary.
- The practitioner decides which mechanisms and costs are in the video.

A better example usually satisfies all three.

## The plan review

Run it after `va route` is clean and `va facts` passes, before `va tts`.

```bash
VA review <project> --plan
```

This writes three briefs to `out/review/`: `plan-1-newcomer.md`, `plan-1-practitioner.md`, `plan-1-expert.md`. Each brief has:

- the full script, as the viewer will hear it
- the plan for each scene: the words next to the picture
- the facts ledger, with the results of the oracle
- the vocabulary
- the report of the router
- the description of one viewer

The practitioner and the expert also get the paths of the source.

1. **Start three new subagents, one for each brief.** Give each only this instruction: *"Read `<path to its brief>` and do what it says."* Start them at the same time. Do not tell a subagent about the others. Do not tell it what you think is weak.
2. **Read the three reports** (`plan-1-<viewer>-report.md`). Each report starts with each scene said back in one sentence. If a viewer cannot say a scene back, or says it back incorrectly, that scene has a blocker. This is true if the viewer is wrong also: the plan as written did not carry the scene.
3. **Give each finding a disposition.** Write it below the finding in the report:
   - *fixed*: the change, in the script and the storyboard
   - *answered*: the reason not to change, in one sentence that a stranger accepts
   - *deferred*: to what, and why it can wait

   The plan continues to `va tts` when each finding has a disposition and no blocker is open.
4. **Run `va route` and `va facts` again** after the corrections. If the content of the script changed, run the plan review again. It is three short reads.

The plan review finds the things that no check can find: a word that the newcomer does not have, a step that the practitioner cannot reproduce, a sentence that the expert knows is only usually true. It costs the least at this moment.

## The video review

1. **Render first.** `VA render <project>` must pass, and you must read its QC report.
2. **Write the brief.**

   ```bash
   VA review <project>
   ```

   This makes the contact sheets again and runs the checks again. It writes `out/review/brief-1.md`, which has:
   - the purpose of the video
   - the scene plan, with the need and the reason of each scene
   - the narration with times
   - the paths to the sheets
   - the findings of the automatic checks
   - the things to judge
   - the report format
3. **Give it to a new agent.** Start a new subagent and give it only this instruction: *"Read `<path to brief-1.md>` and do what it says."* Do not summarise the video. Do not list your corrections. Do not say what worries you. The agent reads the sheets and writes `out/review/report-1.md`.
4. **Act on the report.** Correct the defects that it puts highest, the most serious first. Do not argue with a finding because you know the intent. If a reviewer read the frame incorrectly, a viewer will also. Render again.
5. **Verify with one more new agent.**

   ```bash
   VA review <project> --verify <project>/out/review/report-1.md
   ```

   This writes `brief-2.md`. It asks a new reviewer to mark each earlier item FIXED, PARTLY, or STILL PRESENT, and to look for defects that the corrections caused. The report ends with SHIP or ONE MORE PASS.
6. **Stop** at SHIP, or after the verification round if the remaining defects are cosmetic. Two rounds is the norm. Do more only if the user asks.

The video brief names the three viewers and their contracts. It asks its reviewer to say each scene back as the newcomer. Give its findings dispositions the same way. The verification round judges those also.

Tell the user the decision of the reviewer and the changes that you made because of the review. If no subagent is available, say that the video was not independently reviewed. Do not review it yourself and call that a review.

## The graphics review

Run it once, after the video review ends at SHIP.

```bash
VA review <project> --graphics
```

The other reviews read contact sheets that Remotion draws again. This review cuts its frames from `out/video.mp4`, the file that the viewer gets. The frames have the encoding, the captions, and the real timing. There is one frame for each visual state, at full size, in `out/review/graphics/`. The brief gives each scene its need, its reason, its `ref`, the narration, and its frames. It also gives the length and the focus of the brief, and how long each scene is on screen, so the reviewer can judge whether the picture carries enough for this video in the time it has. The reviewer suggests the best use of the time there is, not more time. One rich result in a ten-minute video about experiments needs more than one number. In a sixty-second video, one number can be correct.

The reviewer judges for the person the video is for:

- **The brief states an audience.** There is one reviewer, who is that audience and came for the focus of the brief. The tool writes `graphics-audience.md`.
- **The brief states no audience.** There are three reviewers, the three viewers above, as in the plan review. The tool writes `graphics-newcomer.md`, `graphics-practitioner.md`, and `graphics-expert.md`.

1. **Give each brief to its own new subagent**, and start them at the same time. Give each only this instruction: *"Read `<path to its brief>` and do what it says."* Each writes `graphics-<viewer>-report.md`.
2. **Read the reports.** Each scene is KEEP or IMPROVE. Then come the top improvements, at most five, and the missing capabilities. Where the viewers disagree, use the rules above: the expert decides what is true, the newcomer the pace, the practitioner the mechanisms and costs.
3. **Make the improvements that you agree with**, and render again. Do not run this review again. The tool refuses a second run while a report exists, unless the user asks for one (`--force`).
4. **Tell the user the missing capabilities.** They are the things that the skill cannot draw yet. They are the way that the skill becomes more powerful.

## Where this came from

These come from the review method of [jeffs_math_explainer_videos](https://github.com/Dicklesworthstone/jeffs_math_explainer_videos), changed from maths videos to code:

- three named viewers
- a review of the plan before the build, and of the result after it
- the summary in one sentence as the test of a scene
- a recorded disposition for each finding

The viewers here belong to this skill.

## What a reviewer catches that the checks do not

The automatic checks find a still picture, text off the frame, and a collision with the captions. They cannot find these defects:

- the highlighted line is not the line that the voice speaks about
- a colour means "current" in one scene and "found" in the next
- a label is on screen but too small to read
- the narration says a thing that the picture does not show

The reviewer finds those.
