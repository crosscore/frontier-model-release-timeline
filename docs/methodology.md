# Dataset and calculation policy

This is a manually curated launch calendar for **OpenAI, Anthropic, Google (PaLM 2 and Gemini), DeepSeek and Meta**, observed from 2023-01-01 through **2026-10-19**, inclusive. The expanded edition and the October 3–19 update window were researched on 2026-10-19. It is not a live feed, an exhaustive industry inventory, or a benchmark-based definition of the frontier. Other labs are outside this edition's scope; lab order is OpenAI, Anthropic, Google, DeepSeek, Meta.

## Unit and inclusion

One record is one differently named general-purpose language/reasoning model, and one model produces one burst. Same-lab/same-day models are an announcement for labels, but each counts separately and uses its own score. Dates use the publisher's first public calendar date, internally UTC midnight; later API/GA access is not counted again. When an announcement promises future availability (Claude 3 Haiku, Claude 3.5 Haiku, Gemini Ultra 1.0), use the actual public release.

Include each lab's main families, explicitly announced main revisions, and separately named small/fast tiers: mini, nano, Haiku, Instant, Flash, Flash-Lite, Lite, Scout, Terra, Luna and Glimmer. Google includes PaLM 2 as its main family before Gemini. DeepSeek V2-Lite is an explicitly named small general-purpose V2 tier with Chat and public weights. Public trials, experimental releases and previews are included as `stage: "preview"`. Parameter-count-only sizes (LLaMA 7B–65B, Llama 2/3/3.1/3.2/3.3, DeepSeek LLM 7B/67B) remain one record using the largest publicly released size.

Exclude these categories, as reconciled in the [selection audit, sections 2 and 7.3](reviews/2026-10-20-per-model.md):

- Same-name updates, routine dated snapshots and extra availability channels: GPT-3.5 Turbo adds API access to pre-window ChatGPT; GPT-4V/Turbo vision and 32k/16k extend input/context; Claude 1.1–1.3 and Instant 1.1 are unannounced API revisions. Gemini Pro Vision is an input endpoint; Flash-8B is a later parameter size. GPT-5.6 August, GPT-6 October and dated Gemini refreshes do not add named models.
- Hidden routing/fallback models: GPT-5 non-reasoning `gpt-5-main`, GPT-5 Instant Mini and GPT-5.3 Instant Mini were not announced as named choices. GPT-5.1/5.2 Instant were explicitly named, so they are included.
- Compute-only modes: o1/o3-pro, GPT-5 Pro, Deep Think, max, Ultrafast and V3.2-Speciale. Gemini 2.0 Flash Thinking is described by Google as Thinking Mode (要確認: mode-versus-model boundary).
- Specialists, media and safety: Codex, Coder, Math, Prover, VL/VL2, OCR, V4-Flash-Vision-Exp, Muse Code, image/audio/video, Code Llama and Llama Guard. General models that accept images still qualify.
- Other-model distillations, research prototypes and device-only models: R1-Distill, MoE 16B, Gemini Nano; Gemini Diffusion is an application-only research demo. Named general-purpose Lite tiers qualify under the revised rule.
- Auxiliary open-weight families of primarily closed-model labs: gpt-oss, Gemma. Muse Spark Open adds weights for existing Spark rather than a new model. Weight availability alone is neither required nor sufficient.
- Restricted or unreleased models: Mythos, Cyber, Rosalind, Fairwind, Behemoth, Gemini 3.5 Pro. Argon's later public rollout qualifies.

DeepSeek main revisions V3-0324, R1-0528, V4 Pro-0813 and V4.1 Flash-1017 retain the prior substantive-retraining boundary. V3.1-Terminus is officially an update; V4-Flash-0731 is API-only re-post-training with Pro and app unchanged. A date suffix alone is insufficient. This remains a curated, editable sample, rather than an industry-wide definition of frontier capability.

## Notable date and counting decisions

| Event | Decision and primary evidence |
| --- | --- |
| GPT-4 / Claude | Both were publicly introduced on 2023-03-14 and count separately. Claude's initial access was through partners and requests; the date is its public introduction, not universal availability. [OpenAI](https://openai.com/index/gpt-4-research/), [Anthropic](https://www.anthropic.com/news/introducing-claude) |
| Claude 3.5 Sonnet | Use 2024-06-20, when the [official API release log](https://platform.claude.com/docs/en/release-notes/overview#june-20th-2024) records availability. The [news article](https://www.anthropic.com/news/claude-3-5-sonnet) currently shows June 21; this discrepancy is preserved in the data note. |
| Claude 3.5 Sonnet v2 | “v2” is this dataset's label for the [explicitly announced October 22 upgrade](https://www.anthropic.com/news/3-5-models-and-computer-use), avoiding ambiguity with June. |
| o1-preview / o1 | Distinct public model names and releases, on September 12 and December 5, 2024. The pro compute mode is not counted separately. [Preview](https://openai.com/index/introducing-openai-o1-preview/), [production availability](https://openai.com/index/introducing-chatgpt-pro/) |
| Claude 3 / Claude 4 | Simultaneously announced Opus and Sonnet variants are separate models and bursts within one announcement. [Claude 3](https://www.anthropic.com/news/claude-3-family), [Claude 4](https://www.anthropic.com/news/claude-4) |
| GPT-5.5 | April 23 ChatGPT/Codex rollout is the event; April 24 API availability is not a second event. [Announcement](https://openai.com/index/introducing-gpt-5-5/) |
| GPT-5.6 | July 9 general release is the event; earlier closed evaluation is excluded. Sol/Terra/Luna are separate models within one announcement. [Announcement](https://openai.com/index/gpt-5-6/) |
| Fable / Mythos | Only public Fable is included on June 9 and September 1, 2026; restricted Mythos access does not add events. [Official log](https://platform.claude.com/docs/en/release-notes/overview) |
| Gemini 1.0 | Use the 2023-12-06 announcement, when Pro reached Bard and Nano reached Pixel 8 Pro; API access on December 13 is in the note, not a second event. [Announcement](https://blog.google/innovation-and-ai/technology/ai/google-gemini-ai/) |
| Gemini Ultra 1.0 / 1.5 Pro | Ultra was announced on December 6 but first released on 2024-02-08. Gemini 1.5 Pro uses its 2024-02-15 limited-preview introduction, following the Claude precedent for request-based access; the April public preview and May GA are not counted again. [Ultra](https://blog.google/products-and-platforms/products/gemini/bard-gemini-advanced-app/), [1.5 Pro](https://blog.google/innovation-and-ai/products/google-gemini-next-generation-model-february-2024/) |
| Gemini 3 Pro | Marked preview: the developer post and API name it `gemini-3-pro-preview`, although the Gemini app rollout was broad. [Announcement](https://blog.google/products-and-platforms/products/gemini/gemini-3/) |
| GPT-6 Astra / Sol / 6.1 Sol | September 3, 22 and 29 rollout dates, corroborated by the dated related-article listings and update notices on the official posts. [Astra](https://openai.com/index/gpt-6-astra/), [Sol/Luna](https://openai.com/index/introducing-gpt-6-sol-and-luna/), [6.1 Sol](https://openai.com/index/introducing-gpt-6-1-sol/) |

All selected model records carry primary evidence in [the source JSON](../data/releases.json). The generated [CSV ledger](../preview/sources.csv) preserves every URL and note. Titles and short notes are editorial summaries; publisher articles are not copied into this repository. Source pages may change after verification.

## Main families, access and the expanded labs

The common unit is one named main-family general-purpose model. Open weights are neither required nor sufficient. Llama and DeepSeek LLM/V/R are main families; Meta's Muse successors include Spark, Wonder and the small general-purpose Glimmer tier. GPT-oss and Gemma are auxiliary families, while Spark Open is an extra channel for existing Spark. “Open-weight” describes availability, not an OSI license certification; no weights are bundled. Named DeepSeek V4 Pro and Flash are separate models even when launched together; routine dated refreshes remain excluded. This is an editorial boundary, so the following table records borderline decisions instead of implying a mechanical completeness guarantee.

| Candidate | Decision and reason / primary evidence |
| --- | --- |
| LLaMA, 2023-02-24 | Include, release. Researcher application-based weights were publicly introduced that day. Same first-public-introduction precedent as Claude and limited-preview Gemini 1.5 Pro; unlike a closed safety-partner evaluation. [Announcement](https://ai.meta.com/blog/large-language-model-llama-meta-ai/) |
| DeepSeek LLM, 2023-11-29 | Include grouped 7B/67B base/chat. Official GitHub first commit and Hugging Face creation both fall on Nov 29. [Repository](https://github.com/deepseek-ai/DeepSeek-LLM), [model card](https://huggingface.co/deepseek-ai/deepseek-llm-67b-chat) |
| DeepSeek V2, 2024-05-06 | Include. Repository explicitly dates release May 6; the model repository was created April 28, so creation date is not used as launch evidence on its own. [Official News section](https://github.com/deepseek-ai/DeepSeek-V2) |
| R1-Lite-Preview, 2024-11-20 | Include, preview. First publicly usable main reasoning family, on web only; API/weights were still promised. Separately named general-purpose Lite tiers are included; distillations and specialists remain excluded. **Reviewer attention (要確認): editorial family-introduction boundary.** [Announcement](https://www.deepseek.com/en/news/r1-lite-preview/), [API news](https://api-docs.deepseek.com/zh-cn/news/news1120/) |
| V2-0517 / V2-0628 / V2.5-1210 | Exclude routine dated same-family improvements. V2.5-1210 has a release post, but it describes ordinary benchmark/user-experience improvements without a new family or explicit major retraining method. **要確認: editorial major-versus-routine boundary.** [Change log](https://api-docs.deepseek.com/updates/), [1210 post](https://api-docs.deepseek.com/news/news1210/) |
| V3-0324 / R1-0528 | Include explicit major reasoning revisions, not every date snapshot. V3 uses March 24 API-log rollout; standalone news is March 25. R1 uses May 28. [V3 log](https://api-docs.deepseek.com/updates/), [V3 news](https://api-docs.deepseek.com/news/news250325/), [R1](https://www.deepseek.com/en/news/r1-0528/) |
| V3.1-Terminus, 2025-09-22 | Exclude. Official text says existing capabilities are maintained while language consistency and agent behavior are fixed/optimized. A new suffix alone is insufficient. **要確認: editorial bug-fix-versus-major boundary.** [Release](https://api-docs.deepseek.com/news/news250922/) |
| V3.2-Exp / V3.2 | Include Sept 29 preview and Dec 1 general successor; exclude same-day Speciale and retain its source as context. The general V3.2 replaced V3.2-Exp in app/web/API and supplies the exact `DeepSeek-V3.2` ECI row (146.11, dated Dec 1). Speciale is a reasoning-maxed specialist without tool calls, served only through a temporary endpoint until Dec 15 despite published weights. Treat it like Deep Think / Pro compute-maxed modes and the excluded Prover/Math specialist lines; it does not supply this event's score. **要確認 (editorial specialist-versus-main-tier boundary).** [Speciale model card](https://huggingface.co/deepseek-ai/DeepSeek-V3.2-Speciale), [preview](https://api-docs.deepseek.com/news/news250929/), [release](https://www.deepseek.com/en/news/deepseek-v3-2/) |
| V4 preview / Flash-0731 / Pro August GA | Include April 24 V4 preview and Aug 13 Pro revision; match their April/August Pro ECI rows separately. Exclude July 31 Flash-only re-post-training: same architecture and size, Flash API in public beta, Pro and app/web unchanged. The separately named April V4 Flash preview is also included; its routine July refresh is excluded. V4.1 Flash and its Oct 17 main revision remain included. **要確認 (editorial).** [Preview](https://www.deepseek.com/en/news/v4-preview/), [July log](https://api-docs.deepseek.com/updates/), [August](https://api-docs.deepseek.com/news/news260813/) |
| V4-Flash-Vision-Exp, 2026-08-21 | Exclude vision-specific experimental adjunct: official log says pure-text abilities remain at the ordinary Flash level. Native multimodality in a main general model (Llama 3.2/4, V4.1) remains in scope. [Log](https://api-docs.deepseek.com/updates/) |
| V4.1 Flash / Flash-1017 | Include Sep 10 main new architecture; include Oct 17 explicit self-feedback reinforcement-learning revision with new weights and broad gains. Do not reuse September ECI for October. The Search/Fetch service is excluded. **要確認: editorial major-retraining boundary for 1017.** Launch news originally planned retiring V4 Pro on Sep 14; the current log instead retains it. No extra event for this service-policy correction. [Sep release](https://api-docs.deepseek.com/news/news260910/), [Oct release](https://api-docs.deepseek.com/news/news261017/), [current log](https://api-docs.deepseek.com/updates/) |
| DeepSeek Coder / Math / Prover / VL / Janus / OCR / R1 distilled / MoE 16B | Exclude separate specialist, research or distilled families. The [MoE 16B research prototype](https://github.com/deepseek-ai/DeepSeek-MoE) was a small efficiency/architecture demonstration, not a new main model generation. They do not establish general main-family launches. [Official organization](https://huggingface.co/deepseek-ai) |
| Llama 3.2, 2024-09-25 | Include grouped text and general multimodal LLM tiers, highest shipped 90B. These accept images but generate general language; they are not image-generation models. [Announcement](https://ai.meta.com/blog/llama-3-2-connect-2024-vision-edge-mobile-devices/) |
| Llama 4 / Behemoth, 2025-04-05 | Include Scout and Maverick separately, each with its own ECI. Exclude unreleased Behemoth; no substitution from a later or unreleased tier. [Announcement](https://ai.meta.com/blog/llama-4-multimodal-intelligence/) |
| Muse Spark 1.2, 2026-08-05 | Include main Spark revision. Although coding-focused, the same model retains general-agent capability and is publicly available via API; Muse Code product itself is excluded. **要確認: editorial distinction from a separate coding-only branch.** [Announcement](https://research.meta.ai/blog/introducing-muse-code-and-muse-spark-1-2) |
| Muse Glimmer / Image / Video / Voice; Code Llama / Llama Guard | Include Glimmer as a separately named general-purpose small tier (30B, public weights, dialogue/reasoning/tools); exclude the specialist/media/safety lines. [Glimmer](https://research.meta.ai/blog/introducing-muse-glimmer-open-agentic-model), [official research index](https://research.meta.ai/) |
| Muse Wonder, 2026-10-12 | Include Wonder and Full as separate models; both publicly available, Full through a subscription. Full is described as a larger trained base-model tier rather than a compute-only mode. Neither has an exact ECI match in this snapshot. [Announcement](https://research.meta.ai/blog/muse-wonder) |
| Muse Spark Open, 2026-10-15 | Exclude. Meta describes it as the open-weight version of existing Muse Spark, with adapted safety post-training. Releasing those weights adds an availability channel rather than a new main revision; open weights are neither required nor sufficient. This parallels the GPT-oss / Gemma exclusion now that Muse is Meta's closed main line. **要確認 (editorial).** [Announcement](https://research.meta.ai/blog/muse-spark-open), [model card](https://huggingface.co/meta-models/Muse-Spark-Open-816B-A42B) |

### Existing labs: October 3–19, 2026 audit

| Lab | Result |
| --- | --- |
| OpenAI | No qualifying additions. Exclude Oct 7 GPT-6 Sol/Luna October update as a same-name ChatGPT model update plus wider ChatGPT availability, following the exclusion of the GPT-4o updates in 2024–2025 and later availability channels. **要確認 (editorial same-name-update boundary).** Oct 8 API availability, Oct 9 Ultrafast, Oct 15 GPT-Live/Slides, Oct 16 Pro workflow improvements and restricted Rosalind remain excluded as channels, service/compute modes, media/product features or restricted specialist access. [System card](https://deploymentsafety.openai.com/gpt-6-october/), [release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes) |
| Anthropic | Include Oct 7 Haiku 5.5 as a named small general-purpose tier under the revised rule. Other entries are pricing, SDK/Compliance API/Managed Agents or Opus fast-mode availability. [Official platform log](https://platform.claude.com/docs/en/release-notes/overview), [newsroom](https://www.anthropic.com/news) |
| Google | Add Oct 13 Gemini 4 Argon GA/public rollout. Sept 30 restricted Fairwind announcement remains excluded. API and app logs agree on Oct 13. Epoch's Sept 30 model date describes the same named model, not the public rollout date; retain that distinction in the event note. [API log](https://ai.google.dev/gemini-api/docs/changelog), [app log](https://gemini.google/release-notes/) |

Source verification used actual public HTTP GETs on 2026-10-19. After the editorial corrections, all 53 unique URLs attached to the 28 retained new records have 200 responses in `output/qa/source-http.json`. That original audit retains 62 responses, including nine URLs used only for excluded candidates or other historical checks; `output/qa/reinspection/source-selection.json` reconciles the current selection. The OpenAI October system card is retained only as evidence for an exclusion, not as a new event (the blog and Help Center were readable through web retrieval but returned scripted HTTP 403). HTTP status, final URL, SHA-256 and local responses are preserved; 200 alone does not establish a claim. Existing historical records were retained, rather than claiming a fresh full-text re-audit of all older three-lab sources.

### What this comparison adds

Retrospective ECI matching shows Llama 2 70B at 113.84 versus GPT-4 at 125.88 in July 2023 (12.04-point difference), then Llama 3.1 405B at 128.76 versus GPT-4o May at 129.05 in July 2024 (0.29). Thus the sampled open-weight main tier had largely closed that particular gap by July 2024. This is a comparison of selected released checkpoints, not all open/closed models, a causal claim or a statistically significant ranking. DeepSeek R1 (138.96) versus o1 (141.84) in January 2025 similarly narrows to 2.88 points; both gaps are within or close to ECI's published uncertainty. Meta's 2026 Spark/Wonder transition also shows why company identity must not be treated as an immutable open-weight/closed-weight classification.

The camera follows the calendar and recent score distribution with smooth, gradual framing, then reveals the whole chart once at the observation cutoff. All per-kick zoom, four-bar sinusoidal motion, groove-start pullbacks, launch punch-ins and shake are removed; there is no drop shake. Its state remains a pure function of time. Decorative animation never displaces the data point or quantizes release dates.

## Capability scores

Burst heights use the [Epoch Capabilities Index (ECI)](https://epoch.ai/benchmarks/eci) published by Epoch AI under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Scores were copied from Epoch's [CSV export](https://epoch.ai/data/eci_scores.csv) on 2026-10-19 and are stored with each record as `capability: { model, score }`. ECI combines many benchmarks onto one scale, so models from 2023 and 2026 can be compared directly. Epoch publishes an uncertainty interval several points wide for each model; a gap of a few points is not a ranking.

Mapping rules:

- The official publisher date controls the plotted launch day. Epoch CSV dates differ for the same named checkpoints: V2 May 6 vs May 7, Llama 3.2 Sept 25 vs Sept 24, Llama 4 April 5 vs April 6, V4.1 Flash Sept 10 vs Sept 9, and Argon Oct 13 public release vs Sept 30 restricted introduction. Notes preserve these differences; score matching still uses the exact version, rather than altering launch dates to match a benchmark table.

- Use the ECI entry for the model version released in that event. Dated variants must match: GPT-4 → `GPT-4 (Mar 2023)`, GPT-4 Turbo → `GPT-4 Turbo (Nov 2023)`, GPT-4o → `GPT-4o (May 2024)`, Claude 3.5 Sonnet v2 → `Claude 3.5 Sonnet (October 2024)`, Gemini 2.0 Flash → `Gemini 2.0 Flash (Dec 2024)` (the experimental release), Gemini 2.5 Pro → `Gemini 2.5 Pro (Mar 2025)`.
- Each named model uses its own exact ECI row. Same-lab/same-day models no longer share the leading model’s score. Parameter-size variants retained as one model continue using the largest released size. Never fabricate a score for an absent CSV row.
- o1 uses Epoch's `o1` entry, which was evaluated on the `o1-2024-12-17` API snapshot of the model launched on December 5.
- Never substitute a later snapshot. Gemini 1.5 Pro (February 2024 preview) has no score because Epoch only lists the May and September 2024 versions.

<!-- unscored:start -->
未採点は16モデル: Claude（2023-03-14）、Claude Instant（2023-03-14）、PaLM 2（2023-05-10）、Gemini Ultra 1.0（2024-02-08）、Gemini 1.5 Pro（2024-02-15）、DeepSeek V2-Lite（2024-05-16）、DeepSeek V2.5（2024-09-05）、DeepSeek R1-Lite-Preview（2024-11-20）、Gemini 2.0 Flash-Lite（2025-02-05）、GPT-5.1 Instant（2025-11-12）、GPT-5.2 Instant（2025-12-11）、GPT-5.3 Instant（2026-03-03）、Muse Glimmer（2026-08-10）、Muse Wonder（2026-10-12）、Muse Wonder Full（2026-10-12）、DeepSeek V4.1 Flash-1017（2026-10-17）。高さを持たない横軸上の噴き出し花火で表し、一覧は「—」です。
<!-- unscored:end -->

`npm run scores -- --csv output/qa/eci-2026-10-19.csv --retrieved 2026-10-19` imports the frozen local CSV. The stage-two additions have 20 exact mapped rows and six records without `capability`; all 20 mapped additions receive scores. Only the pre-existing GPT-5.3 Instant mapping remains missing. `retrievedOn` describes retrospective index retrieval, not what was knowable at launch. The earlier [October 19 review](reviews/2026-10-19-update.md) retains its historical before/after table.

### 要確認 / unresolved mappings and dates

- PaLM 2: the public Bard/API size versus Epoch PaLM 2-L/M/S remains **to be confirmed**. Leave unscored.
- Claude Instant 1.2: Epoch's `Claude Instant` is dated 2023-08-09, matching 1.2; exact version identity remains **to be confirmed**. The initial March Claude Instant remains unscored.
- Gemini 1.5 Flash: retain the May 14 I/O public preview date. The [API changelog](https://ai.google.dev/gemini-api/docs/changelog) also records May 10; the first-public 05-10/05-14 distinction remains **to be confirmed**. Epoch's May checkpoint is dated May 23.

Claude 3 Haiku uses March 13 availability rather than March 4 notice (Epoch March 7). Claude 3.5 Haiku uses November 4 API availability rather than the October 22 announcement/ECI date. The 26 stage-two official URLs were checked by Claude on 2026-10-20; this implementation preserves them verbatim without a new network audit.

## Metrics

For each year, intersect the calendar year with the dataset's observation window:

```text
observed_days = inclusive_end_day - inclusive_start_day + 1
days_per_model = observed_days / selected_model_count
mean_adjacent_gap = (last_model_day - first_model_day) / (model_count - 1)
```

The conclusion presents **days per model**, a density measure. It is not the mean adjacent gap, the duration of training, or a prediction of the next release. Leap years use 366 days. A zero-event year has no density estimate; zero- and one-event years have no mean-gap estimate. Same-day models contribute a zero-day adjacent gap, including models from the same lab. Generated tables label the counts “Models” and density “Days / model”.

<!-- yearly-stats:start -->
| Observation | Days | Models | Days / model |
| --- | ---: | ---: | ---: |
| 2023 | 365 | 12 | 30.4 |
| 2024 | 366 | 24 | 15.3 |
| 2025 | 365 | 36 | 10.1 |
| 2026-01-01–2026-10-19 | 292 | 44 | 6.6 |
<!-- yearly-stats:end -->

The 2026 result is year-to-date, so it is not directly interchangeable with a completed year's cadence. The original post's “18 days” is not treated as verified evidence and is not hard-coded. The rendering and generated statistics always recompute values from the JSON.

### Launch pace (the indicator panel)

During the calendar travel, a panel beside the chart (under it in portrait) plots a smoothed launch rate, read like an indicator with a price chart:

```text
pace(t) = 365 / τ · Σ exp(−(t − d_i) / τ)   over selected launch dates d_i ≤ t,   τ = 60 days
```

The unit is MODELS / YEAR, annualized: the rate the recent launches would add up to over a year. Each model adds about 6.1 at its own `onsets` time (including the salvo offset), while keeping its impulse at its factual date coordinate, and its contribution falls to 37% after 60 days; a steady cadence of one launch every g days settles to an average of 365 / g. Dotted gridlines mark those averages for one launch every 60, 30, 14 and 7 days (6, 12, 26 and 52 a year), labelled with both values. A 3-day cadence (about 122 models/year) is eligible once the running peak exceeds 1.5 times the weekly cadence, and appears when it fits the scale. The pace only looks back. Every model counts separately, including same-lab/same-day models, and each model also leaves its lab-shaped mark on the panel's baseline. Launches before the observation window are not in the dataset, so the curve starts at zero and understates the pace in early 2023. It is a display smoothing of this curated sample, not a statistical estimate of industry activity or a forecast. The scale reserves 35% above the running peak for cadence labels: `max(18, peak / 0.65)`. It only widens when the running peak rises.

<!-- pace-summary:start -->
観測終了日のペースは年83.8モデル（約4.4日に1モデル）です。2026年途中集計の平均は6.6日／モデル（年55.0モデル）で、直近の集中により終了時のペースが高くなっています。
<!-- pace-summary:end -->

## Visual time

The main stage is a two-dimensional chart. The horizontal axis is one continuous calendar from January 1 of the first year to December 31 of the last; dates after the observation cutoff are hatched. The vertical axis is the ECI score, with gridlines every 10 points and headroom above the highest score. Each rocket climbs straight up from its exact date and bursts at its score, then leaves a marker. A step line per lab follows that lab's highest score so far, rising when a launch sets a new high. Launches without a score spray a low fountain on the date axis instead of taking a height. Each burst has the same 68 rays, radius and 1.9-second lifetime. Five stable lab-specific burst forms and five marker shapes distinguish the labs in the legend, plot and ledger without relying on color. The original three colors remain unchanged; DeepSeek uses copper and Meta rose. Palette checks apply the Machado et al. (2009) full-severity protanopia and deuteranopia matrices in linear sRGB, then compare Oklab distances; the reproducible contact sheet and pairwise distances are in `output/qa/`. These simulations support design review, not a universal perception guarantee. Burst positions are never shifted for legibility; late 2026 launches overlap because they are close in date and score. In crowded moments, only decorative bloom/trails dim by a shared inverse-square-root crowd factor; point geometry, ray count, size and lifetime stay unchanged. Callouts last up to 1.6 seconds and are drawn above bursts and step lines on a dark backing plate with a thin lab-colored border. Each row represents one announcement (same lab and day), derived by `launchGroups(data)` in descending ECI order, then unscored JSON order. `joinNames` retains the first full name and elides only shared leading words on later names, always keeping at least one word. The subtitle lists all scores in the same order (— for missing scores, NOT YET SCORED if all are absent). Announcements within 0.3 seconds share at most three rows; the existing overflow counts whole additional announcements after they occur, never unnamed models within a row. The launch-pace panel has the chart's width and shares its calendar and camera: it pans and zooms horizontally with the chart, while its vertical scale follows the pace alone. In landscape it sits beside the chart at the same height, so both get the full plot height; in portrait it sits under the date axis. Its baseline uses each lab's marker shape for every launch, including unscored ones; five labs use five tightly spaced lanes. Each preview model retains its own asterisk and hollow data marker. An announcement callout glyph is hollow only if every constituent model is a preview; o1-preview * with released o1-mini therefore has a filled callout glyph. The large year counter sits in the plot's upper left, which early (low) scores leave empty.

The playback clock has 45 seconds of continuous, linear calendar travel, a 3.75-second introduction, a 3.75-second final hold, and a 7.5-second conclusion: 60 seconds, exactly 32 bars of the 128 BPM score. A calendar day always has the same film duration, including across leap years. The clock stops at the observation cutoff. There are no release-date pauses or late-film speedups. Active bursts retain their full lifetime across year transitions, using their own event year for geometry. Markers and step lines persist and remain faintly behind the conclusion; they are not additional launches. The conclusion also shows the highest ECI among selected launches in the first and last year. The first model of each announcement bursts at the date’s onset; subsequent models follow at `BAR_SECONDS / 16` (0.1171875 seconds) intervals. The upward trail and sound start 0.36 seconds before each individual burst. All rendering, audio, visibility, counters and pace use these `makeTimeline` onsets. Date/ECI coordinates stay fixed. The leading models of different labs on the same date burst simultaneously. Intro/outro are presentation sections outside the calendar clock.

Both layouts show up to four announcements per lab, with a two-row card grid for four/five labs in portrait. Each row has all model names and the leading ECI. Compact names use 32 px (minimum 25) in portrait and 28 px (minimum 22) in landscape. A fitting name stays on one line; only names that exceed the minimum wrap. Joined labels break after “ · ” with the separator on the first line. Word-boundary wrapping is reserved for an individual oversized model. Dates sit immediately below the last name line with the original date size and baseline gap. Each row's height includes its extra name line and measured spacing that keeps its date closer to its own last name than to the next row. New arrivals push by that actual height over 0.28 seconds, without overlap. The highlight covers the entire name/date/score block, and rows fade before reaching the column's lower clip. Two-line rows can leave only three announcements visible. Compact landscape headings move upward to provide room for restored text; portrait cards extend lower, with the explanatory footer condensed to two lines.

Each announcement's complete name, date and score must remain inside the actual column clip for at least 1.4 continuous seconds, including row motion and scene transitions. Tests use measured glyph bounds and drawing positions, rather than a row-number proxy. Compact cards elide repeated Claude/DeepSeek prefixes and month qualifier years, retaining purely numeric Claude family names. Real announcement labels are checked without ellipsis or +N, including draw calls for callouts and ledger rows. Synthetic oversized fixtures may use the existing ellipsis fallback. Captions and the source ledger retain full official names. Future density that violates these geometric/dwell checks requires a layout or timing change.


Audio and video share the same logical clock. The renderer maps the last video frame to the logical ending; audio cue times use exactly the same `(frames - 1) / fps / logical_duration` scale. Intro/outro frame rounding does not accumulate drift. The 128 BPM score's sections (intro, travel, arrival, conclusion) start on bar lines; launch cues are not quantized to the beat. See [audio synthesis and mastering](audio.md).

## Updating and verification

Open each proposed primary source and check the model name, stated date, launch/preview status, and access distinction. Keep a note when sources disagree. Add events chronologically, store differently named models separately, and move `endDate` / `verifiedOn` only after reviewing that window. Rebuild both formats and inspect the opening, each year, busy clusters, and ending.

CI validates structure, real calendar dates, ordering, supported official domains, duplicate IDs and lab/date/name triples, source presence, leap-year arithmetic, partial windows, onset visibility, deterministic frames, and text bounds. It encodes and fully decodes smoke films. It does not verify current web contents or prove that the editorial sample is exhaustive.

General visual QA uses `scripts/visual-checks.mjs` (`npm run qa:visual`). Targeted real-speed salvo windows and native PNGs are generated by `node scripts/smoke-per-model.mjs` into `output/qa/per-model/windows/`. The real fixture also writes palette simulations and contrast/pairwise metrics; its default output is Git-ignored under `output/qa/real/`.
