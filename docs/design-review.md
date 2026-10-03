# Design and audio review — 2026-10-03

The user requested a fireworks-like redesign with original BGM and a review in Claude.app. The initial planning review was sent in a normal Claude conversation; subsequent artifact review used a dedicated **Claude Code** session for this public repository after the user expressed that preference. The app UI showed **Opus 5.5** and effort **超高**. No account settings, credentials or payment plans were changed.

The initial review covered the existing public commit and the proposed direction. It led to a continuous calendar clock, bursts aligned to release dates, longer-lived readable names, a fixed music tempo, balanced mint/amber colors, and an 8.4-second conclusion. The reference X post had been inspected separately; the external reviewer did not view it and did not claim a visual match.

The [Code artifact review](reviews/2026-10-03-claude-code.md) examined the intermediate video, portrait frames, source code, loudness, frequency distribution, waveform timing and AAC synchronization. It identified six issues. The following fixes were applied afterward:

| Finding | Final implementation |
| --- | --- |
| Fireworks vanished abruptly at year changes | Active bursts now keep their full lifetime across year boundaries, using the event's own year for geometry. Regression test added. |
| Same-day launches merged into one bloom | Close-date groups fan out horizontally and use alternating decorative heights by chronological slot. Date markers remain exact; radius, ray count and lifetime remain uniform. Same-day separation is tested. |
| The score masked release accents | The music bed ducks around actual bursts, and the burst has a little more filtered high-frequency detail and body. Master level remains about −18 LUFS. |
| Typography dominated the sky and the ending lost visual continuity | The year is less bright; each release leaves a restrained ember. Embers continue behind the ending. |
| Portrait could turn “Claude 2.1” into “2.1” | Prefix removal applies only before alphabetic family names. Numeric family names are preserved and tested. |
| Small portrait text and a constrained stage | The extra miniature timeline was removed; the stage and bloom radius expanded, essential dates/months enlarged, and month labels simplified to quarters. |

The final renderer also tests text collisions as well as canvas bounds, two-second minimum name retention, exact date/cue mapping, deterministic audio, fade endpoints and unclipped samples. Full-resolution MP4s are remeasured and completely decoded after rendering; published manifests and audio reports contain the actual results.

## Scope and limits

Claude explicitly stated that it **did not listen to the audio or watch the video continuously**. Its review used extracted images, source and acoustic measurements, not subjective listening. The saved Code review is of the intermediate version; it is not a claim that Claude approved every final pixel or the final mix after fixes. A later UI connection failure prevented sending an additional final-pass request. The implementation fixes, regression tests and final media checks were completed locally.

A dedicated local browser successfully played the 9-second audio-enabled intermediate clip without a media error. Final visual inspection uses decoded frames from both formats, including the intro, simultaneous launches, year boundary, dense 2026 cluster and conclusion. Automated measurements are not a human listening-panel approval or a formal accessibility certification.
