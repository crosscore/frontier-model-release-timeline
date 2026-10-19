# Deep Field / 005

An original procedural electronic score and launch sound design, composed for this film. All tones come from mathematical oscillators and seeded noise in [src/audio.mjs](../src/audio.mjs). There are no recordings, third-party samples, borrowed melodies, generative music services, paid APIs, or credentials. The composition, synthesized master and sound effects are distributed with the project under [MIT](../LICENSE). The separately bundled font is OFL.

It replaces “Afterburn / 004”, which was written for 51 launches. (“Liftoff / 003”, “Ignition / 002” and “Afterglow / 001” accompanied earlier editions.) The film now shows 79 launches from five labs. 004 could not voice five labs at all: it had three stereo positions and three chord tones.

Nobody has listened to this version for this document, and nothing here is a listening approval. Everything below is either a description of the code or a measurement.

## Why this track

The accepted composition keeps Undertow's sustained, pumping mono bass and restrained transients, combines it with Low Orbit's sparse dub stabs and dark space, and saves a short pentatonic hook for the drop. Pressure's metallic transients and Night Shift's continuous melodic upper parts would compete with dense launch cues. The new score keeps the launch band clearer while retaining the low-end pulse.

The four local sketches and 004 were compared again on the corrected 79-event dataset. Each candidate's music alone was matched to the new BGM's integrated loudness, then mixed with the same new launch-cue stem without ducking. These are energy measurements, not listening judgments.

| Music | Beat swing 20–120 / 120–500 Hz | 2–10 kHz share | Presence onsets/s | Bursts clearing the music in 500–10 kHz | Median burst-to-music ratio in 500–10 kHz |
| --- | ---: | ---: | ---: | ---: | ---: |
| Undertow | 7.6 / 16.9 dB | −22.6 dB | 1.4 | 67.1% | +1.1 dB |
| Pressure | 14.6 / 23.0 dB | −24.1 dB | 7.2 | 57.0% | +3.4 dB |
| Night Shift | 15.4 / 21.0 dB | −23.5 dB | 2.6 | 81.0% | +2.9 dB |
| Low Orbit | 15.0 / 27.4 dB | −25.9 dB | 5.8 | 91.1% | +6.9 dB |
| Afterburn / 004 music | 9.7 / 17.9 dB | −23.1 dB | 2.2 | 63.3% | +1.4 dB |
| Deep Field / 005 music | 8.8 / 14.8 dB | −28.8 dB | 1.6 | 83.5% | +3.0 dB |

In the common logical-clock mix comparison with ducking, the 500–10 kHz event median is +5.6 dB for 005 and +2.1 dB for 004; 92.4% and 72.2% of bursts respectively reach the BGM level in that band. Whole-track ratios are −19.0 and −19.6 dB. The final render-clock figures below are measured separately.

## Score

- 128 BPM, 4/4, G minor. The 30-second film is exactly 16 bars:
  - 1 intro;
  - grooves A (bars 2–5), B (6–9) and C (10–11) over the calendar;
  - a build (12);
  - a half-bar kick roll and a half-bar breath (13);
  - the drop at the observation cutoff (14), which keeps grooving through the summary (15) and fades out over the last 3.2 seconds. There is no closing cadence.
- Section boundaries are bar lines. For other durations, the grooves take 40 %, 40 % and 20 % of the calendar bars, rounded to whole bars.
- One root per bar: G, E♭, C, D from the first calendar bar, D in the bar before the drop, and G again at the drop.
- Low end, all mono:
  - Kick: a saturated sine falling from 210 Hz to 49 Hz (G) with a held body, a long tail and a noise click. It is low-passed at 9 kHz so the saturation adds no fizz, and it gets heavier section by section.
  - Sub: a sine on the root with a little second harmonic.
  - Bass: three detuned saws an octave up, one long note per bar. Its low-pass opens from 300 to 1100 Hz over the calendar, to 1500 Hz in the build and 1700 Hz in the drop.
  - The pump: sub and bass duck almost fully under every kick and swell back. In the kick roll the sub slides up an octave on D. In the breath only the risers remain.
- Upper texture, kept sparse:
  - A dub chord stab of B♭ D F G C (the G minor pentatonic itself, consonant over every root), once per bar in groove A and twice from groove B.
  - Offbeat closed hats; shaker, claps and rims from groove B; an offbeat open hat from groove C.
  - All of it is band-limited: hats 7–11 kHz, shaker under 10 kHz, claps under 5 kHz.
  - The texture bus is low-passed from 600 Hz in the intro to fully open in the drop, then feeds a damped dotted-eighth ping-pong delay and a dark eight-line reverb.
  - There are no supersaws, arpeggios or sixteenth-note synths.
- The drop hook: G–B♭–D, then a different answer in each of the four bars, a filtered saw plus sine. It uses only the five chime notes, so the launch pitches become the tune once the launches are over. It plays only in the drop.
- Transitions:
  - an opening boom, a sweep into the chart, small crashes at grooves B and C;
  - a two-bar noise riser with a snare roll accelerating from eighths to thirty-seconds;
  - an E♭-over-D pad and a rising sine under bar 13, and a reverse swell through the breath;
  - the drop impact.

## Launch cues

Every selected event has a whistle that starts 0.36 logical seconds before its date. Exactly at its date there is a burst made of four parts:

- a crack (noise between about 1.7 and 11 kHz with an 11 ms decay);
- a body (120–1700 Hz noise, nothing under the bass);
- the lab's chime (a sine with second and third partials);
- a short crackle.

Bursts are not quantized: they land on their own dates, and same-day releases burst together.

Each lab keeps its stereo position and chime by id, so reordering or filtering the labs changes nothing:

| Lab | Pan | Chime |
| --- | ---: | ---: |
| OpenAI | −0.50 | D6 |
| DeepSeek | −0.25 | C6 |
| Google | 0.00 | G5 |
| Meta | +0.25 | F6 |
| Anthropic | +0.50 | B♭5 |

The chimes are the five notes of G minor pentatonic. No chord in the score has a tone a semitone below any of them, so any set of chimes can ring together. Labs without a preset take the next free pan (0, ±0.5, ±0.25, ±0.375, ±0.125) and chime (G5 up to D7, still pentatonic) in dataset order. Up to nine labs get distinct voices; more raise an error instead of silently sharing one.

Dense clusters are kept from turning into a wash in four ways:

- **Neighbour gain.** Launches within 0.35 s share loudness by `1 / sqrt(n)`, where n counts the launches in that window, itself included (up to 11 on this dataset). No event is removed.
- **Shorter, softer crackles.**
  - 004 gave every launch 26 clicks of 12 ms over 0.18–1.08 s.
  - 005 gives 4–9 clicks of 8 ms over 0.1–0.7 s, band-passed at 2.2–12 kHz. Click count and level follow a crowding measure, Σ exp(−|Δt| / 0.5 s) over all launches, so clicks thin out and soften (by 4–16 dB) as launches crowd.
- **Spectral space.**
  - The music leaves 500–10 kHz mostly to the launches: bass and pads stay under about 1.7 kHz, and the stab is short.
  - Hats and claps are band-limited.
  - The chimes avoid the music's semitone clashes.
- **Transient ducking.** Around each burst the music above the sub steps aside, with a 5 ms look-ahead, a 40 ms hold and a 0.14 s release:

  | Layer | Ducking |
  | --- | ---: |
  | Texture and its echoes | −6 dB |
  | Percussion (hats, shaker, claps, rims) | −8 dB |
  | Pads and transitions | −4 dB |
  | Bass | −2.5 dB |

  The kick and sub never duck for launches, so the beat stays solid under dense clusters.

## Mix, stems and master

- Buses:
  - The music bus collects the kick and the snare roll, plus the sub, bass, pads and transitions, each of those with its own pump and ducking gain.
  - Hats and texture have their own buses for the delay and reverb sends.
  - The launch cues have their own bus.
- By default the synthesizer holds six stereo buffers and one level buffer, the same as 004.
- Soft saturation with its knee 13 dB above the mix RMS rounds only the loudest hits. A look-ahead limiter (2 ms, 80 ms release) with its ceiling 12 dB above the mix RMS trims only the sharpest transients. Because both follow the RMS, one stray peak cannot set the level of the whole track.
- The track reaches full level within 10 ms, under the opening boom, and fades out over the last 3.2 seconds (a quarter of the duration for shorter renders).
- `synthesize(data, timeline, { stems: true })` also returns `stems.bgm` and `stems.sfx`, each `[left, right]`. They are the music and launch-cue buses as they enter the saturation, with the fade and output gain they share with the mix. Their sum matches the mix to about −27 dB, the difference being the saturation and limiter. The two extra stereo buffers are only allocated on request.
- `npm run render` synthesizes a 48 kHz stereo PCM master in a temporary WAV and applies FFmpeg two-pass linear loudness normalization targeting **−16 LUFS / −1.5 dBTP**. It then encodes AAC at 192 kb/s and muxes the identical encoded track into the MP4. If reaching −16 LUFS would push the true peak above the ceiling, the target is lowered rather than letting loudnorm fall back to dynamic compression. The temporary WAV is removed after mastering. Both aspect ratios use the same score, seed and clock.
- The renderer also writes `soundtrack-<format>.m4a` and `audio-<format>.json`. The JSON includes:
  - the encoded-track loudness;
  - the lab voices;
  - every launch and burst time with its pan, chime and neighbour count;
  - the whole-track and median 80 ms launch-to-music ratios before mastering.
- `npm run verify:media` remeasures the **finished MP4**. It checks integrated loudness within 1.5 LU of the target, true peak ≤ −1 dBTP and LRA ≤ 9 LU, verifies stereo AAC at 48 kHz and matching duration, then decodes video and audio completely.
- Both finished 900-frame MP4s, regenerated after review, measure **−15.99 LUFS / −6.89 dBTP / 3.5 LU LRA** with FFmpeg `loudnorm`. The −1.5 dBTP target is a ceiling, not a requirement to raise peaks to that value.
- The common logical-clock comparison's temporary AAC measures −15.99 LUFS / −6.83 dBTP; LRA is 3.5 LU by `loudnorm`, 1.6 LU by `ebur128` and 1.6 LU by the JavaScript meter. Short-track range estimates depend on meter and gating, so these are named separately.
- With the actual render clock (`timeScale = 899/900`), pre-master whole-track SFX/BGM is −19.30 dB and the median broadband 80 ms ratio is −13.31 dB. In 500–10 kHz the median is +6.16 dB, p10 is +0.28 dB, and 92.4% of the 79 bursts reach the music level. The busiest bar's SFX RMS is 1.89 dB above the median eventful bar. `output/qa/audio-render-balance.json` records these figures. Compared with the logical-clock analysis, the frame-count scale moves exact-date launch cues slightly against the fixed 128 BPM score; the mix design stays unchanged.
- Section cue points snap to the beat grid. When the renderer's frame-count time scale moves a cue point by less than 60 ms from a beat, it lands on the beat, so the drop stays on bar 14 in the final film. The camera shares the section cue points, with no kick/beat bumps or repeated zoom/shake. Launch cues never snap.
- `--duration` compresses or stretches the visual/data clock and launch cues for smoke testing; the music remains 128 BPM. Use the default duration for the published presentation.

## Measurements and their limits

`node scripts/analyze-audio.mjs [--out output/qa] [--fast]` writes `audio-report.md`, `audio-metrics.json` and `audio-plots/` (FFmpeg spectrograms and loudness curves). `--fast` skips the candidates, the temporary master and the plots. The full run takes about 20 seconds and does not render video.

The optional full historical comparison requires the four ignored local sketch M4As in `output/bgm-sketches/` and Git commit `0bfea69` for 004's code and published M4A. Those comparison inputs are not needed to render 005 or run its tests. A checkout without the local sketches can still run `--fast` for the current score's stem/band diagnostics.

- **Launch-to-music ratio** (SFX/BGM) is measured from the stems, which share one gain. It is measured over the whole track and in the 80 ms after each burst, broadband and in 20–120, 120–500, 500–2000, 2000–10 000 Hz and a 500–10 000 Hz presence band. The report gives the median, the 10th percentile, and the share of bursts at or above 0 dB in the presence band. Every event counts once, even where windows overlap.
- **Bands** use 4th-order Butterworth edges, and octave bands are centred from 31.5 Hz to 16 kHz.
- **Per bar**: RMS of the mix and both stems, the launch-to-music ratio, the launch count and stereo correlation.
- **Loudness** comes from a JavaScript ITU-R BS.1770-4 meter (integrated, momentary, short-term, EBU Tech 3342 range), cross-checked against FFmpeg `ebur128` and `loudnorm` on the AAC master.
- **Beat swing** folds the level of a band over every beat and reports loudest minus quietest phase: a proxy for the pump. **Presence onsets** count 10 ms frames in 500–10 000 Hz that jump 6 dB: a proxy for rhythmic clutter where the launches live.
- **004 on this dataset** is resynthesized from Git commit `0bfea69` with two voices added for DeepSeek and Meta. Its stems use its mix-stage envelope and gain, and ignore its soft clipper.

Limits:

- These are energy ratios, not perceived loudness or masking thresholds. An 80 ms window favours the crack and body of a burst over its chime and crackle tail.
- Beat swing includes each kick's own energy.
- The sketches are measured from their AAC renders.
- Nothing here measures how the music feels, whether the hook is memorable, or how it plays on phone speakers. That needs a human listening check on the target devices.

## Tests

`test/audio.test.mjs` covers:

- one cue per event at its visual burst time, with simultaneous same-day bursts that keep distinct voices;
- deterministic, finite, unclipped stereo PCM with a nonzero mono sum and a silent start and end;
- the drop being louder than every groove bar, the groove still running when the summary appears, and the fade reaching near silence;
- the kick pattern, and sections starting on bar lines;
- five labs with distinct, finite pans and pentatonic chimes that stay fixed by id in any order or subset, plus fallback voices for unknown labs and for the real dataset;
- five same-day launches staying within a few dB of one launch;
- an off-grid launch starting on its own date rather than on the beat;
- stems absent by default and summing to the mix;
- density ratios on the real dataset: the whole-track ratio between −26 and −12 dB, the presence-band median ≥ +3 dB, the 10th percentile ≥ −3 dB, at least 75 % of bursts clearing the music, and the busiest bar no more than 4 dB above a typical eventful bar.

Technical measurements and image-based review do not prove subjective listening quality. This document does not claim that a human listening test approved the score. Listen at a comfortable device volume and judge it yourself.
