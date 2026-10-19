# Long Exposure / 007

An original procedural melodic-house score for the 60-second film: 128 BPM, 4/4, B♭ major. Mathematical oscillators and seeded, filtered noise in [src/audio.mjs](../src/audio.mjs) create every tone. No recordings, third-party samples, borrowed music, external generation services or paid APIs are used. Code, composition and generated sound are [MIT](../LICENSE); the separately bundled Manrope font is OFL.

The score is designed and checked without listening. Measurements and spectrograms establish levels, timing and spectral balance; subjective musical quality needs human listening.

## Shape

007 replaces 006 because 006's final drop jumped about 11 LU above the bar before it (bar 26 → 27 on the published master) and the film ended loud. 007 keeps one level from the groove to the reveal: the music rises in a slow arc across the calendar, the reveal is a change of colour (the theme enters) rather than of loudness, and the closing bars only fall.

`musicArc` sets the music's level as one ramp in dB before mastering: −6 at the start, −2.5 at the calendar, −1.5 at the lift, 0 at the groove, +1 at the build, −0.5 at the reveal, −1 for the closing bars and −2.5 for the final chord. Every change is a ramp across bars. The arrangement adds and removes layers on top of it.

## Arrangement

The default film is exactly **32 bars / 60.000 seconds / 1800 frames at 30 fps**.

| Bars | Seconds | Music | Picture |
| --- | --- | --- | --- |
| 1–2 | 0–3.75 | The pad fades in under a closed filter (E♭ → F); the electric piano answers the title's three beats (G4, B♭4, D5); two soft heartbeat kicks and a noise swell in bar 2 | Beat-staged title |
| 3–10 | 3.75–18.75 | A: four-on-the-floor kick, pumped sub, offbeat plucked bass and closed hats, sequence in eighths. From bar 7 the electric piano plays the theme an octave down, the sequence moves to sixteenths, and clap and shaker enter | Linear calendar travel |
| 11–14 | 18.75–26.25 | Lift: the hats open, the pad and sequence filters open, a swell and a one-beat snare fill lead into the groove | Calendar, weak light sweep |
| 15–22 | 26.25–41.25 | Groove: crash, sixteenth hats, clap with snare, sixteenth bass pickups; the launches lead | Calendar, kick light and section wave |
| 23–25 | 41.25–46.875 | Build: E♭, E♭, F; a slow band-pass riser, eighth-note snares in bar 25 | Growing vignette and now-line glow |
| 26 | 46.875–48.75 | Half a bar of sixteenth snares, then the breath: kick, hats and plucked bass stop; sub, pad and sequence hold; a swell | Last launches continue on their exact dates |
| 27–30 | 48.75–56.25 | Reveal: crash, the groove returns at the same level, and the lead sings the four-bar theme for the first time | One wide reveal; marker relight; summary from 52.5 s |
| 31 | 56.25–58.125 | Closing: drums and plucked bass stop; E♭ pad, fading eighth-note sequence, the lead's answer | Summary note |
| 32 | 58.125–60 | Final B♭6/9: an electric-piano strum, the five lab chime notes rolled upward from their own pans, the lead's held B♭; last second tapered to zero | End card, then background-colour fade |

`timeline.mjs` supplies `cuePoints`, `scorePart`, `energy` and `kickTimes` to both synthesis and drawing. The summary scene's `outro` cue (52.5 s) differs from the music's `musicOutro` (56.25 s). The `finale` cue is 58.125 s. For travel T bars, A/lift/drop1 receive round(T/3), round(T/6), round(T/3), with at least two build bars where space permits. Short cuts omit the shortest sections instead of creating negative intervals. `--duration 3` is a compressed smoke test; music still uses 128 BPM.

### Harmony and instruments

- One chord per bar in B♭ major: the calendar loops **B♭add9–E♭maj9–Gm11–F7sus4** (I–IV–vi–V), the build holds E♭ then F, the reveal loops again, and the film closes E♭ → B♭6/9. While launches can sound, chord voicings top out at MIDI 74 (D5) and exclude A, E, F♯, B and C♯, a semitone under the chimes.
- Theme: four bars over B♭–E♭–Gm–F (D5 C5 B♭4 C5 / D5 E♭5 F5 G5 / B♭5 G5 F5 D5 / E♭5 D5 C5), an answer over E♭ and a held B♭ to close. Its first four bars are heard in A, an octave down, on the electric piano; the lead sings it only after the last launch.
- Pad: three saws per note at ±9 cents, spread in stereo, gently pumped by the kick; its low-pass opens from 420 Hz to 3.2 kHz across the calendar and closes to 1.7 kHz at the end.
- Sequence: a two-saw pluck walking the chord's four arp notes up and down, eighths at first and sixteenths from the middle of A; its filter opens through the build.
- Electric piano: two-operator FM with a short tine and a 4.6 Hz tremolo.
- Lead: one gliding voice (two saws ±5 cents and a sine an octave down) with a 30 ms glide and delayed vibrato.
- Bass: a pumped mono sine sub on B♭1, E♭2, G1 and F2 (49–87 Hz), and a plucked saw bass an octave up on the offbeat eighths, with sixteenth pickups in the full sections. Kick and sub do not duck for launches.
- Drums: a round, lightly saturated kick; offbeat closed hats in A and open hats from the lift; sixteenth hats and shaker once the groove is full; a three-tap clap on beats 2 and 4 with a snare layer in the full sections; one-beat fills; crashes at the calendar, the groove and the reveal.
- Space: a damped dotted-eighth ping-pong delay and an eight-line feedback-delay reverb (2.2 s), both high-passed so the low end stays mono.

## Launch cues and mix

One unquantized sound cue per model is retained: a whistle begins 0.36 logical seconds before the burst; the crack, body, lab chime and crackle burst exactly on it. Each announcement's first model bursts on its date and the rest follow at sixteenth-note intervals. Five lab identities keep fixed pans and B♭-major-pentatonic chimes:

| Lab | Pan | Chime |
| --- | ---: | --- |
| OpenAI | −0.50 | D6 |
| DeepSeek | −0.25 | C6 |
| Google | 0.00 | G5 |
| Meta | +0.25 | F6 |
| Anthropic | +0.50 | B♭5 |

Launches within 0.35 s share gain by `1/sqrt(n)`; crowded crackles become shorter and softer. Ducking uses an 8 ms look-ahead, an 80 ms hold and a 110 ms release. At full duck the texture (pad, sequence, keys, lead, delay and reverb) steps down about 10 dB, percussion about 8 dB, the plucked bass about 2.5 dB and swells about 4.5 dB. Kick and sub stay steady. The duck follows exact burst times, including the last launches in the breath.

`synthesize(..., { stems: true })` exposes stereo BGM and SFX before saturation/limiting, with their shared ending envelope and output gain. Soft saturation has its knee 13 dB above mix RMS; a 2 ms look-ahead / 80 ms release limiter has a ceiling 12 dB above RMS. These are synthesis stages. [audio-master.mjs](../scripts/audio-master.mjs) retains two-pass **linear** gain normalization to **−14 LUFS**, with a **−1.0 dBTP ceiling**, followed by 48 kHz stereo AAC at 192 kb/s. AAC is copied unchanged into each MP4.

The renderer maps its last frame to the logical ending. Launch cues use the identical `1799/1800` scale in the default film; musical section cues within 60 ms of a beat snap to the grid. The audio diagnostics default to that published render clock; `--logical-clock` measures unscaled logical seconds. This snap affects only music, never launches.

## Measurements

The final 30 fps render clock gives the following figures. Complete band/event/bar data are reproducible in `output/qa/audio-metrics.json` and `audio-report.md`; [the review](reviews/2026-10-20-long-exposure.md) records the final MP4 measurements.

| Measurement | Result |
| --- | ---: |
| AAC / final MP4 integrated loudness | −14.05 LUFS |
| True Peak | −3.45 dBTP |
| FFmpeg loudnorm LRA | 3.9 LU |
| Whole-track SFX/BGM, broadband | −13.59 dB |
| 80 ms event median SFX/BGM, broadband | −7.02 dB |
| 80 ms event median / p10 / minimum, 500–10 kHz | +10.21 / +7.03 / +2.31 dB |
| Models with SFX ≥ BGM in 500–10 kHz | 116/116 (100%) |
| Loudest eventful SFX bar above median | +1.37 dB |

The arc, from BGM bar RMS (`sectionDynamics` in [analyze-audio.mjs](../scripts/analyze-audio.mjs); the same limits, `ARC`, run in the tests at 8 kHz):

| Check | Result | Limit |
| --- | ---: | ---: |
| Largest rise from one bar to the next, from bar 3 on | +1.51 dB | ≤ 2 |
| Quietest groove bar above the loudest of the first four calendar bars | +2.05 dB | ≥ 1.5 |
| Loudest reveal bar above the loudest groove bar | −0.41 dB | ≤ 0.5 |
| Step from the last build bar into the reveal | +0.85 dB | ≤ 1.5 |
| Breath below the quietest reveal bar | 1.85 dB | ≥ 1 |
| Smallest fall from one closing bar to the next (bars 30–32) | 2.15 dB | ≥ 1 |

| BGM band | RMS, dBFS | Share of whole BGM | L/R correlation |
| --- | ---: | ---: | ---: |
| 20–120 Hz | −17.15 | −1.72 dB | 1.000 |
| 120–500 Hz | −22.23 | −6.80 dB | 0.832 |
| 500–2000 Hz | −25.34 | −9.92 dB | 0.769 |
| 2–10 kHz | −34.59 | −19.17 dB | 0.866 |

007 is darker than 006 (2–10 kHz share −19.2 dB against −13.1 dB): it has no supersaw stack, and the pad and sequence filters top out at 3.2–3.3 kHz so the chime band stays clear. The spectrograms show the filter opening across the calendar, the theme's harmonics after the last launch and the closing bars thinning out. These spectral observations do not establish how the score sounds on speakers.

## Reproduce the checks

```bash
node scripts/analyze-audio.mjs --fast  # stems, band/event/bar RMS, loudness profiles, acceptance assertions
node scripts/analyze-audio.mjs         # also AAC master, loudness curves and spectrograms
npm test
npm run verify:media -- --out preview
npm run verify:media -- --out preview --format portrait
npm run qa:visual
```

The default full audio analysis needs only this checkout and FFmpeg. `--compare` additionally enables the optional historical sketch comparison, requiring four ignored local M4As in `output/bgm-sketches/` and Git revision `0bfea69`; it is not needed for current-score validation.

Band RMS uses fourth-order Butterworth edges; the 80 ms windows count every event once, including overlaps. LUFS uses a JavaScript BS.1770 meter for profiles and FFmpeg `loudnorm`/`ebur128` for the encoded master. LRA can differ between meters because their gating differs. Energy ratios describe level, not psychoacoustic masking. Spectrograms use FFmpeg `showspectrumpic`, log 20 Hz–16 kHz, 90 dB range.

Tests cover the 32-bar clock and exact cues; the kick pattern; shared sound/light energy; section order; the arc above; the final chord and silent endpoint; deterministic unclipped PCM; launch identity/timing/crowd sharing; harmonic spacing and the theme's key; and real-data cue balance (SFX/BGM over the calendar, where every launch is). Visual tests retain nameplate, text-bound/collision, palette/contrast and camera-motion checks.

## History

**Supernova / 006** was the previous 60-second score: 128 BPM progressive house in G minor (Gm–E♭–B♭–Fsus2) with seven-voice supersaw chords, a rolling bass, a two-octave hook saved for the final drop and a closing G minor hit. Its published masters measured −14.15 LUFS / −1.70 dBTP / 6.8 LU LRA, with the event presence median at +14.42 dB. Its final drop stood about 10 LU above the calendar, which the project owner found too abrupt; that is why 007 replaced it.

**Deep Field / 005** was the 30-second, 16-bar score before it: Undertow's sustained pumping mono bass with Low Orbit's sparse dub chords, a short pentatonic hook at the cutoff and a 3.2-second fade. Its published 900-frame masters measured −15.99 LUFS / −6.89 dBTP / 3.5 LU LRA.

Before 005: **Afterburn / 004**, **Liftoff / 003**, **Ignition / 002**, **Afterglow / 001**. The original synthesis and MIT distribution continue in 007.
