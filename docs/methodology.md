# Dataset and calculation policy

This is a manually curated launch calendar for **OpenAI and Anthropic**, observed from 2023-01-01 through **2026-10-02**, inclusive. The snapshot was researched on 2026-10-02. It is not a live feed, an exhaustive industry inventory, or a benchmark-based definition of the frontier. Other labs are outside this edition's scope.

## Unit and inclusion

One event is a selected, publicly announced launch or rollout from one lab on one calendar date. Same-day model variants from that lab are grouped, rather than counted as separate points. Events from different labs on the same date remain separate. Dates use the publisher's stated calendar date and are represented internally at UTC midnight; exact launch times and regional rollouts are not inferred.

The sample follows general-purpose GPT / o-series and Claude main model releases and explicitly announced major revisions. Public previews are included and marked. It includes Sonnet, Opus and publicly available Fable releases, alongside the relevant general-purpose OpenAI families. It does not assert that every included model was the top-scoring frontier model at its launch.

Excluded categories: standalone mini/nano/Haiku/Instant-small variants, coding-specific Codex variants, open-weight GPT-oss, image/audio/video models, product and tool launches, pricing or prompt-only updates, compute-only pro modes, routine same-name API snapshots, and later availability on additional platforms. “GPT-5.3 Instant” is a newly named general-purpose release and is included; the older lightweight Claude Instant line is excluded. Closed partner evaluations and restricted Mythos releases are excluded. Announced but unreleased models are excluded.

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
| GPT-6 Astra / Sol / 6.1 Sol | September 3, 22 and 29 rollout dates, corroborated by the dated related-article listings and update notices on the official posts. [Astra](https://openai.com/index/gpt-6-astra/), [Sol/Luna](https://openai.com/index/introducing-gpt-6-sol-and-luna/), [6.1 Sol](https://openai.com/index/introducing-gpt-6-1-sol/) |

All 39 records carry primary evidence in [the source JSON](../data/releases.json). The generated [CSV ledger](../preview/sources.csv) preserves every URL and note. Titles and short notes are editorial summaries; publisher articles are not copied into this repository. Source pages may change after verification.

## Metrics

For each year, intersect the calendar year with the dataset's observation window:

```text
observed_days = inclusive_end_day - inclusive_start_day + 1
days_per_launch = observed_days / selected_launch_count
mean_adjacent_gap = (last_event_day - first_event_day) / (event_count - 1)
```

The film presents **days per launch**, a density measure. It is not the mean adjacent gap, the duration of training, or a prediction of the next release. Leap years use 366 days. A zero-event year has no density estimate; zero- and one-event years have no mean-gap estimate. Same-day events contribute a zero-day adjacent gap.

| Observation | Days | Events | Days / event |
| --- | ---: | ---: | ---: |
| 2023 | 365 | 5 | 73.0 |
| 2024 | 366 | 6 | 61.0 |
| 2025 | 365 | 11 | 33.2 |
| 2026-01-01–2026-10-02 | 275 | 17 | 16.2 |

The 2026 result is year-to-date, so it is not directly interchangeable with a completed year's cadence. The original post's “18 days” is not treated as verified evidence and is not hard-coded. The rendering and generated statistics always recompute values from the JSON.

## Visual time

The main chart preserves a full Jan–Dec horizontal scale every year. Dates after the observation cutoff are hatched. Stem heights distinguish labs and stagger nearby endpoints only; they encode no performance score. Public previews have hollow endpoints. Each lab's current model stays in a persistent card until that lab's next included launch within the year.

The playback clock has 16 seconds of calendar travel plus 0.85 seconds of hold at each distinct launch date, a 3-second introduction, a 0.9-second final hold, and a 6-second conclusion. These presentation pauses make closely spaced labels readable; the film's elapsed seconds are not a measure of real-world release rate.

## Updating and verification

Open each proposed primary source and check the model name, stated date, launch/preview status, and access distinction. Keep a note when sources disagree. Add events chronologically, group simultaneous variants, and move `endDate` / `verifiedOn` only after reviewing that window. Rebuild both formats and inspect the opening, each year, busy clusters, and ending.

CI validates structure, real calendar dates, ordering, supported official domains, duplicate IDs and lab/date events, source presence, leap-year arithmetic, partial windows, onset visibility, deterministic frames, and text bounds. It encodes and fully decodes smoke films. It does not verify current web contents or prove that the editorial sample is exhaustive.
