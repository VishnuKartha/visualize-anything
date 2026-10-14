# visualize-anything

## Purpose

This skill is a foundation. People use it to make videos as detailed as they choose. Our job is to give the skill the power to go to whatever depth a video calls for. It is not our job to fix that depth in advance.

- **Capture everything; select by the brief.** The tools read in as much as they can: the paper's text, tables, figures and claims. The brief then decides what reaches the screen. The brief covers how long the video is, what the user is most interested in, and who is watching. A two-minute video picks out one headline result. A twenty-minute video on the experiments shows the setup, the baselines and every ablation.
- **Empower, don't cap.** If the brief asks for depth, the skill must have the scene kinds, the guidance and the checks to deliver it. Where the skill can only flatten rich material, for example a 14-dataset ablation shown as a single "13 of 14", that is a missing capability to fix. It is not a rule to keep.
- **Defaults can be concise. Limits should not be hard.** A short default length is fine. Guidance written only for short videos needs a counterpart for long ones.
- **Generate from first principles, within the length.** The video starts from what the audience already knows and builds each idea on the ones before it. Each picture is chosen for the idea it has to explain, not because a scene kind happens to exist. The length in the brief decides how far back toward fundamentals the video starts and how deep into the evidence it goes.
