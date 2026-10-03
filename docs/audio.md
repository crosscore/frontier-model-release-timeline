# Afterglow / 001

An original procedural electronic score and launch sound design, composed for this film. All tones come from mathematical oscillators and seeded noise in [src/audio.mjs](../src/audio.mjs). There are no recordings, third-party samples, borrowed melodies, generative music services, paid APIs, or credentials. The composition, synthesized master and sound effects are distributed with the project under [MIT](../LICENSE). The separately bundled font is OFL.

## Score and cues

- 100 BPM, 4/4; Am(add9), Fmaj7, Cmaj9 and Gsus2 voicings.
- Soft additive-synthesis pads, plucked arpeggios and delays, bass with audible harmonics, filtered-noise percussion.
- After the intro, beat and arpeggio patterns remain constant during calendar travel. Harmonic changes shape the composition; no tempo ramp or extra late-film percussion fabricates a denser release history.
- Every selected event has a rising cue starting 0.46 logical seconds before its date and a restrained noise/chime burst exactly at its date. Notes come from the current chord. Same-day releases remain simultaneous rather than snapping to a musical grid.
- Deterministic event seeds, restrained stereo placement and `1 / sqrt(neighbor_count)` gain reduce overload when nearby launches overlap. Neighbor count uses a symmetric 0.75-logical-second window. No event is removed for musical convenience.
- At each actual burst, the music bed ducks by up to about 7.5 dB (12 ms attack, brief hold, about 0.4 s recovery), and the accent has a little filtered high-frequency noise to keep it distinct from the low percussion. This is an event-driven mixing envelope, not an increase in musical beat density.
- The score starts and ends with a fade. Tones have attack/release envelopes; no sharp discontinuity, square-wave oscillator or recorded explosion is used.

## Reproduction and measurement

`npm run render` synthesizes a 48 kHz stereo PCM master in a temporary WAV, applies FFmpeg two-pass loudness normalization targeting **−18 LUFS / −2.5 dBTP / LRA 9**, encodes AAC at 192 kb/s, and muxes the identical encoded track into the MP4. The temporary WAV is removed after mastering. Both aspect ratios use the same score, seed and clock.

The renderer also writes `soundtrack-<format>.m4a` and `audio-<format>.json`. The JSON includes the actual encoded-track loudness and all launch/burst timestamps. A true-peak target is a ceiling, not a request to amplify every transient to that level; the finished master can peak substantially lower. `npm run verify:media` remeasures the **finished MP4**, checks −20…−16 integrated LUFS, peak ≤ −1 dBTP and LRA ≤ 9 LU, verifies stereo AAC at 48 kHz and matching duration, then decodes video and audio completely.

`--duration` compresses or stretches the visual/data clock and launch cues for smoke testing; the music remains 100 BPM. Use the default duration for the published presentation. Unit tests cover deterministic stereo samples, nonzero mono output, finite/unclipped PCM, fade endpoints, WAV structure and one-to-one event synchronization.

Technical measurements and image-based external review do not prove subjective listening quality. The attached audio is available for listening at a comfortable device volume; neither the reviewer nor this README claims a human listening panel approved the music.
