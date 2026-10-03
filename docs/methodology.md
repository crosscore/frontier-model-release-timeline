# Dataset and calculation policy

This is a manually curated launch calendar for **OpenAI, Anthropic and Google (Gemini)**, observed from 2023-01-01 through **2026-10-02**, inclusive. The OpenAI and Anthropic records were researched on 2026-10-02; the Google records were researched for the same window on 2026-10-03. It is not a live feed, an exhaustive industry inventory, or a benchmark-based definition of the frontier. Other labs are outside this edition's scope.

## Unit and inclusion

One event is a selected, publicly announced launch or rollout from one lab on one calendar date. Same-day model variants from that lab are grouped, rather than counted as separate points. Events from different labs on the same date remain separate. Dates use the publisher's stated calendar date and are represented internally at UTC midnight; exact launch times and regional rollouts are not inferred.

The sample follows general-purpose GPT / o-series and Claude main model releases and explicitly announced major revisions. Public previews are included and marked. It includes Sonnet, Opus and publicly available Fable releases, alongside the relevant general-purpose OpenAI families. For Google, it follows the Gemini line: each new generation or version number (1.0, 1.5, 2.0, 2.5, 3, 3.1, 3.5–3.8) and the first public release of the Ultra tier. A Flash model counts only when it opens a new version number; Gemini 3.6, 3.7 and 3.8 Flash were Google's main general-purpose releases after 3.1 Pro and are included. It does not assert that every included model was the top-scoring frontier model at its launch.

Excluded categories: standalone mini/nano/Haiku/Instant-small variants, coding-specific Codex variants, open-weight GPT-oss, image/audio/video models, product and tool launches, pricing or prompt-only updates, compute-only pro modes, routine same-name API snapshots, and later availability on additional platforms. “GPT-5.3 Instant” is a newly named general-purpose release and is included; the older lightweight Claude Instant line is excluded. Closed partner evaluations and restricted Mythos releases are excluded. Announced but unreleased models are excluded. For Google this excludes Flash-Lite, Live and TTS audio models, image and video models (Nano Banana, Omni), open-weight Gemma, Deep Think modes, dated experimental snapshots, restricted Cyber / Fairwind Program releases (including Gemini 4 Argon, announced 2026-09-30), the announced but unreleased Gemini 3.5 Pro, and pre-Gemini Bard / PaLM models.

This is an editorial sample, not a rule that guarantees completeness. Its value is a traceable, editable visualization. A comparison of the entire market would require a broader, separately reviewed selection.

## Notable date and counting decisions

| Event | Decision and primary evidence |
| --- | --- |
| GPT-4 / Claude | Both were publicly introduced on 2023-03-14 and count separately. Claude's initial access was through partners and requests; the date is its public introduction, not universal availability. [OpenAI](https://openai.com/index/gpt-4-research/), [Anthropic](https://www.anthropic.com/news/introducing-claude) |
| Claude 3.5 Sonnet | Use 2024-06-20, when the [official API release log](https://platform.claude.com/docs/en/release-notes/overview#june-20th-2024) records availability. The [news article](https://www.anthropic.com/news/claude-3-5-sonnet) currently shows June 21; this discrepancy is preserved in the data note. |
| Claude 3.5 Sonnet v2 | “v2” is this dataset's label for the [explicitly announced October 22 upgrade](https://www.anthropic.com/news/3-5-models-and-computer-use), avoiding ambiguity with June. |
| o1-preview / o1 | Distinct public model names and releases, on September 12 and December 5, 2024. The pro compute mode is not counted separately. [Preview](https://openai.com/index/introducing-openai-o1-preview/), [production availability](https://openai.com/index/introducing-chatgpt-pro/) |
| Claude 3 / Claude 4 | Simultaneously announced Opus and Sonnet variants form one event per date. [Claude 3](https://www.anthropic.com/news/claude-3-family), [Claude 4](https://www.anthropic.com/news/claude-4) |
| GPT-5.5 | April 23 ChatGPT/Codex rollout is the event; April 24 API availability is not a second event. [Announcement](https://openai.com/index/introducing-gpt-5-5/) |
| GPT-5.6 | July 9 general release is the event; earlier closed evaluation is excluded. Sol/Terra/Luna are grouped. [Announcement](https://openai.com/index/gpt-5-6/) |
| Fable / Mythos | Only public Fable is included on June 9 and September 1, 2026; restricted Mythos access does not add events. [Official log](https://platform.claude.com/docs/en/release-notes/overview) |
| Gemini 1.0 | Use the 2023-12-06 announcement, when Pro reached Bard and Nano reached Pixel 8 Pro; API access on December 13 is in the note, not a second event. [Announcement](https://blog.google/innovation-and-ai/technology/ai/google-gemini-ai/) |
| Gemini Ultra 1.0 / 1.5 Pro | Ultra was announced on December 6 but first released on 2024-02-08. Gemini 1.5 Pro uses its 2024-02-15 limited-preview introduction, following the Claude precedent for request-based access; the April public preview and May GA are not counted again. [Ultra](https://blog.google/products-and-platforms/products/gemini/bard-gemini-advanced-app/), [1.5 Pro](https://blog.google/innovation-and-ai/products/google-gemini-next-generation-model-february-2024/) |
| Gemini 3 Pro | Marked preview: the developer post and API name it `gemini-3-pro-preview`, although the Gemini app rollout was broad. [Announcement](https://blog.google/products-and-platforms/products/gemini/gemini-3/) |
| GPT-6 Astra / Sol / 6.1 Sol | September 3, 22 and 29 rollout dates, corroborated by the dated related-article listings and update notices on the official posts. [Astra](https://openai.com/index/gpt-6-astra/), [Sol/Luna](https://openai.com/index/introducing-gpt-6-sol-and-luna/), [6.1 Sol](https://openai.com/index/introducing-gpt-6-1-sol/) |

All 51 records carry primary evidence in [the source JSON](../data/releases.json). The generated [CSV ledger](../preview/sources.csv) preserves every URL and note. Titles and short notes are editorial summaries; publisher articles are not copied into this repository. Source pages may change after verification.

## Capability scores

Burst heights use the [Epoch Capabilities Index (ECI)](https://epoch.ai/benchmarks/eci) published by Epoch AI under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Scores were copied from Epoch's [CSV export](https://epoch.ai/data/eci_scores.csv) on 2026-10-03 and are stored with each record as `capability: { model, score }`. ECI combines many benchmarks onto one scale, so models from 2023 and 2026 can be compared directly. Epoch publishes an uncertainty interval several points wide for each model; a gap of a few points is not a ranking.

Mapping rules:

- Use the ECI entry for the model version released in that event. Dated variants must match: GPT-4 → `GPT-4 (Mar 2023)`, GPT-4 Turbo → `GPT-4 Turbo (Nov 2023)`, GPT-4o → `GPT-4o (May 2024)`, Claude 3.5 Sonnet v2 → `Claude 3.5 Sonnet (October 2024)`, Gemini 2.0 Flash → `Gemini 2.0 Flash (Dec 2024)` (the experimental release), Gemini 2.5 Pro → `Gemini 2.5 Pro (Mar 2025)`.
- When an event groups several tiers, use its top tier: Claude 3 → Claude 3 Opus, Claude 4 → Claude Opus 4, GPT-5.6 → GPT-5.6 Sol. Gemini 1.0 uses Gemini 1.0 Pro, the tier that shipped that day. Separately sold compute tiers (GPT-5.x Pro, Deep Think) are not used, matching the event selection.
- o1 uses Epoch's `o1` entry, which was evaluated on the `o1-2024-12-17` API snapshot of the model launched on December 5.
- Never substitute a later snapshot. Gemini 1.5 Pro (February 2024 preview) has no score because Epoch only lists the May and September 2024 versions.

Unscored as of 2026-10-03: Claude (2023-03-14), Gemini Ultra 1.0 and Gemini 1.5 Pro have no matching ECI entry; GPT-5.3 Instant, GPT-6 Sol and GPT-6.1 Sol are mapped but not yet scored by Epoch. These launches still appear, as a low fountain on the date axis and “—” in the list. `npm run scores` re-downloads the CSV, refreshes every mapped score, records the retrieval date, and lists models that are still missing. Scores can change when Epoch re-estimates the index, so review the printed changes before committing.

## Metrics

For each year, intersect the calendar year with the dataset's observation window:

```text
observed_days = inclusive_end_day - inclusive_start_day + 1
days_per_launch = observed_days / selected_launch_count
mean_adjacent_gap = (last_event_day - first_event_day) / (event_count - 1)
```

The conclusion presents **days per launch**, a density measure. It is not the mean adjacent gap, the duration of training, or a prediction of the next release. Leap years use 366 days. A zero-event year has no density estimate; zero- and one-event years have no mean-gap estimate. Same-day events contribute a zero-day adjacent gap.

| Observation | Days | Events | Days / event |
| --- | ---: | ---: | ---: |
| 2023 | 365 | 6 | 60.8 |
| 2024 | 366 | 9 | 40.7 |
| 2025 | 365 | 14 | 26.1 |
| 2026-01-01–2026-10-02 | 275 | 22 | 12.5 |

The 2026 result is year-to-date, so it is not directly interchangeable with a completed year's cadence. The original post's “18 days” is not treated as verified evidence and is not hard-coded. The rendering and generated statistics always recompute values from the JSON.

### Launch pace (the lower panel)

During the calendar travel, a panel under the chart plots a smoothed launch rate, read like an indicator under a price chart:

```text
pace(t) = 30 / τ · Σ exp(−(t − d_i) / τ)   over selected launch dates d_i ≤ t,   τ = 60 days
```

The unit is launches per 30 days. Each launch adds 0.5 on its date, and its contribution falls to 37% after 60 days; a steady cadence of one launch every g days settles to an average of 30 / g. The pace only looks back. Same-day launches from different labs count separately, as in the density table. Launches before the observation window are not in the dataset, so the curve starts at zero and understates the pace in early 2023. It is a display smoothing of this curated sample, not a statistical estimate of industry activity or a forecast. The panel's vertical scale is 1.35 times the highest pace reached so far (at least 1.5), so it widens whenever the pace sets a new high; its gridlines are labelled in the same unit throughout.

## Visual time

The main stage is a two-dimensional chart. The horizontal axis is one continuous calendar from January 1 of the first year to December 31 of the last; dates after the observation cutoff are hatched. The vertical axis is the ECI score, with gridlines every 10 points and headroom above the highest score. Each rocket climbs straight up from its exact date and bursts at its score, then leaves a marker. A step line per lab follows that lab's highest score so far, rising when a launch sets a new high. Launches without a score spray a low fountain on the date axis instead of taking a height. Each burst has the same 68 rays, radius and 1.9-second lifetime. Each lab keeps its own burst shape (plain peony, long-tailed glitter, double ring) and marker (circle, diamond, square), so labs stay distinguishable without relying on color. Burst positions are never shifted for legibility; late 2026 launches overlap because they are close in date and score. Ground ticks on the axis still mark every launch, including unscored ones. Below the axis, the launch-pace panel shares the chart's calendar and camera: it pans and zooms horizontally with the chart, while its vertical scale follows the pace alone. Previews retain an asterisk and hollow marker. The large year counter sits in the plot's upper left, which early (low) scores leave empty.

The playback clock has 22.5 seconds of continuous, linear calendar travel, a 1.875-second introduction, a 1.875-second final hold, and a 3.75-second conclusion: 30 seconds, exactly 16 bars of the 128 BPM score. A calendar day always has the same film duration, including across leap years. The clock stops at the observation cutoff. There are no release-date pauses or late-film speedups. Active bursts retain their full lifetime across year transitions, using their own event year for geometry. Markers and step lines persist and remain faintly behind the conclusion; they are not additional launches. The conclusion also shows the highest ECI among selected launches in the first and last year. The burst and its sound occur at the date's onset; the upward trail and sound start 0.36 seconds earlier. Same-day labs burst simultaneously. Intro/outro are presentation sections outside the calendar clock.

Each lab's list is ordered newest first, with the ECI score rounded to an integer at the right (“—” when unscored), and retains the latest events across year transitions. A new arrival enters at the top and pushes the older names down one row over 0.28 seconds; the fifth name fades out. Close arrivals stack without overlapping mid-animation. Each record stays among its lab's four newest for at least 1.4 seconds; a test checks this against the dataset. The newest names stay on screen through the final hold. Dates remain on the cards. Portrait cards omit the repetitive Claude prefix before alphabetic family names (Opus/Sonnet/Fable), while numeric names such as Claude 2.1 remain intact; the source ledger and captions preserve full model names. Future denser datasets that break the 1.4-second minimum will fail the test, requiring a longer calendar travel duration or more rows.

Audio and video share the same logical clock. The renderer maps the last video frame to the logical ending; audio cue times use exactly the same `(frames - 1) / fps / logical_duration` scale. Intro/outro frame rounding does not accumulate drift. The 128 BPM score's sections (intro, travel, arrival, conclusion) start on bar lines; launch cues are not quantized to the beat. See [audio synthesis and mastering](audio.md).

## Updating and verification

Open each proposed primary source and check the model name, stated date, launch/preview status, and access distinction. Keep a note when sources disagree. Add events chronologically, group simultaneous variants, and move `endDate` / `verifiedOn` only after reviewing that window. Rebuild both formats and inspect the opening, each year, busy clusters, and ending.

CI validates structure, real calendar dates, ordering, supported official domains, duplicate IDs and lab/date events, source presence, leap-year arithmetic, partial windows, onset visibility, deterministic frames, and text bounds. It encodes and fully decodes smoke films. It does not verify current web contents or prove that the editorial sample is exhaustive.
