# Supernova / 006

An original procedural progressive-house score for the 60-second film: 128 BPM, 4/4, G minor. Mathematical oscillators and seeded, filtered noise in [src/audio.mjs](../src/audio.mjs) create every tone. No recordings, third-party samples, borrowed music, external generation services or paid APIs are used. Code, composition and generated sound are [MIT](../LICENSE); the separately bundled Manrope font is OFL.

The score is designed and checked without listening. Measurements and spectrograms establish levels, timing and spectral balance; subjective musical quality needs human listening.

## Arrangement

The default film is exactly **32 bars / 60.000 seconds / 1800 frames at 30 fps**.

| Bars | Seconds | Music | Picture |
| --- | --- | --- | --- |
| 1–2 | 0–3.75 | Impact, sub boom, closed supersaw swells; half-note kicks in bar 2 | Beat-staged title |
| 3–10 | 3.75–18.75 | A: four-on-the-floor, pumping bass, offbeat chords and hats; denser arpeggios/claps halfway through | Linear calendar travel |
| 11–14 | 18.75–26.25 | Lift: sustained opening chords, four-bar riser, snare acceleration, two kick-free beats into drop1 | Calendar, weak light sweep |
| 15–22 | 26.25–41.25 | Drop1: 3–3–2 chord rhythm, rolling bass, full drums, fills; launches supply the melody | Calendar, kick light and section wave |
| 23–25 | 41.25–46.875 | Build: E♭–E♭–F, thinner bass, sustained chords, eighths then sixteenths on the snare | Growing vignette and now-line glow |
| 26 | 46.875–48.75 | Half-bar eighth-note kick roll, then breath with swells and risers | Last launches continue on their exact dates |
| 27–30 | 48.75–56.25 | Largest drop: impacts, full drums, supersaw hook doubled one octave up | One wide reveal; marker relight; summary from 52.5 s |
| 31 | 56.25–58.125 | Groove continues with rising high-pass | Summary note |
| 32 | 58.125–60 | Final Gm chord, kick/impact/crash, decaying tail; last second tapered to zero | End card, then background-colour fade |

`timeline.mjs` supplies `cuePoints`, `scorePart` and `energy` to both synthesis and drawing. The summary scene's `outro` cue (52.5 s) differs from the music's `musicOutro` (56.25 s). The `finale` cue is 58.125 s. For travel T bars, A/lift/drop1 receive round(T/3), round(T/6), round(T/3), with at least two build bars where space permits. Short cuts omit the shortest sections instead of creating negative intervals. `--duration 3` is a compressed smoke test; music still uses 128 BPM.

### Harmony and instruments

- One chord per bar: **Gm–E♭–B♭–Fsus2**; build uses E♭–E♭–F–F and returns to Gm at the drop. Chord voicings top out at MIDI 74 (D5) while launches are active. They exclude A, E, F♯, B and C♯, preserving the chimes' semitone-spacing rule.
- Supersaws: seven band-limited saw oscillators per note, detuned −24 to +24 cents, spread across stereo, filtered and deeply sidechained to the kick. Two 150 Hz high-pass stages remove low stereo-side energy; kick, sub and bass are mono.
- Plucks: chord-tone arpeggios in G4–D5, eighth notes in early A, sixteenths later, low-pass opening 1.2–3 kHz. Drop1 keeps these quieter beneath launch cues.
- Bass: offbeat/rolling saws and a pumped sine sub on G1, E♭2, B♭1, F1 (43.7–77.8 Hz). Kick and sub do not duck for launches.
- Hook: the four-bar melody specified in the design, first heard after all launches, in two octaves. Drop1 foreshadows its 3–3–2 rhythm with chords.
- Drums: saturated kick, layered clap/snare on beats 2/4, open hats, sixteenth-note closed hats and ride; seeded crashes, reverse swells, noise/pitch risers, accelerating rolls and downlifters mark transitions.
- Space: damped dotted-eighth ping-pong and an eight-line feedback-delay reverb. The last chord has its own decay rather than a long groove fade.

## Launch cues and mix

One unquantized sound cue per event is retained: a whistle begins 0.36 logical seconds before the date; the crack, body, lab chime and crackle burst exactly on the date. Same-day releases remain simultaneous. Five lab identities keep fixed pans and G-minor-pentatonic chimes:

| Lab | Pan | Chime |
| --- | ---: | --- |
| OpenAI | −0.50 | D6 |
| DeepSeek | −0.25 | C6 |
| Google | 0.00 | G5 |
| Meta | +0.25 | F6 |
| Anthropic | +0.50 | B♭5 |

Launches within 0.35 s share gain by `1/sqrt(n)`; crowded crackles become shorter and softer. Burst gain is increased relative to 005. Ducking uses an 8 ms look-ahead, an 80 ms hold and a 110 ms release. At full duck, texture/delays/reverb step down about 15 dB, percussion about 16 dB, bass about 5 dB and transitions about 9 dB. Kick and sub stay steady. The gain still follows exact dates, including the final cluster in the breath.

`synthesize(..., { stems: true })` exposes stereo BGM and SFX before saturation/limiting, with their shared ending envelope and output gain. Soft saturation has its knee 13 dB above mix RMS; a 2 ms look-ahead / 80 ms release limiter has a ceiling 12 dB above RMS. These are synthesis stages. [audio-master.mjs](../scripts/audio-master.mjs) retains two-pass **linear** gain normalization to **−14 LUFS**, with a **−1.0 dBTP ceiling**, followed by 48 kHz stereo AAC at 192 kb/s. AAC is copied unchanged into each MP4.

The renderer maps its last frame to the logical ending. Launch cues use the identical `1799/1800` scale in the default film; musical section cues within 60 ms of a beat snap to the grid. The audio diagnostics default to that published render clock; `--logical-clock` measures unscaled logical seconds. This snap affects only music, never launches.

## Measurements

The final 30 fps render clock gives the following pre-master stem measurements. Complete band/event/bar data are reproducible in `output/qa/audio-metrics.json` and `audio-report.md`; the implementation review records the final MP4 measurements.

| Measurement | Result |
| --- | ---: |
| AAC / final MP4 integrated loudness | −14.15 LUFS |
| True Peak | −1.70 dBTP |
| FFmpeg loudnorm LRA | 6.8 LU |
| Whole-track SFX/BGM, broadband | −16.10 dB |
| 80 ms event median SFX/BGM, broadband | −2.57 dB |
| 80 ms event median / p10, 500–10 kHz | +14.42 / +8.43 dB |
| Events with SFX ≥ BGM in 500–10 kHz | 79/79 (100%) |
| Loudest eventful SFX bar above median | +1.76 dB |

| BGM band | RMS, dBFS | Share of whole BGM | L/R correlation |
| --- | ---: | ---: | ---: |
| 20–120 Hz | −17.09 | −2.02 dB | 1.000 |
| 120–500 Hz | −22.57 | −7.50 dB | 0.842 |
| 500–2000 Hz | −23.98 | −8.91 dB | 0.655 |
| 2–10 kHz | −28.16 | −13.10 dB | 0.718 |

The quieter intro and breath, both drops, the high-pass bar and closing hit are visible in the BGM/master spectrograms. The two-octave hook adds upper harmonics only after the last event. These spectral observations do not establish how the hook sounds on speakers.

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

Tests cover the 32-bar clock and exact cues; shared sound/light energy; section order; drop/drop1/build/breath level contrasts; final hit and silent endpoint; deterministic unclipped PCM; launch identity/timing/crowd sharing; harmonic spacing; and real-data cue balance. Visual tests retain nameplate, text-bound/collision, palette/contrast and camera-motion checks. The odometer's clipped text window is included in collision checks.

## History

**Deep Field / 005** was the previous 30-second, 16-bar score. It combined Undertow's sustained pumping mono bass with Low Orbit's sparse dub chords and dark space, saved a short pentatonic hook for the cutoff drop, and faded its groove over 3.2 seconds. Its published 900-frame masters measured −15.99 LUFS / −6.89 dBTP / 3.5 LU LRA. On that edition's `899/900` render clock, the event presence median was +6.16 dB and 92.4% of launches cleared BGM. Those are historical measurements, not figures for 006.

Before 005: **Afterburn / 004**, **Liftoff / 003**, **Ignition / 002**, **Afterglow / 001**. The original synthesis and MIT distribution continue in 006.
