# Independent review

The agent that built a video is the worst judge of it: it knows what every frame was meant to show, so it sees that instead of what is there. A review only counts when it comes from an agent that did not build the video and was told nothing about the intent.

## The loop

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

Tell the user the verdict and what was changed because of the review. If no subagent is available, say plainly that the video was not independently reviewed rather than reviewing it yourself and calling it a review.

## What a reviewer catches that the checks do not

The automated checks find a frozen picture, text off the frame, a collision with the captions. They cannot tell that the highlighted line is not the one being talked about, that a colour means "current" in one scene and "found" in the next, that a label is technically on screen but too small to read, or that the narration asserts something the picture never shows. Those are what the reviewer is for.
