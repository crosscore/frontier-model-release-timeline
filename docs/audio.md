# Ignition / 002

An original procedural electronic score and launch sound design, composed for this film. All tones come from mathematical oscillators and seeded noise in [src/audio.mjs](../src/audio.mjs). There are no recordings, third-party samples, borrowed melodies, generative music services, paid APIs, or credentials. The composition, synthesized master and sound effects are distributed with the project under [MIT](../LICENSE). The separately bundled font is OFL.

It replaces the calmer 100 BPM “Afterglow / 001” from the second edition, to match the 30-second cut.

## Score and cues

- 128 BPM, 4/4; Am(add9), F, C and G, one chord per bar. The 30-second film is exactly 16 bars: 1 intro, 12 calendar travel, 1 arrival hold, 2 conclusion.
- Detuned band-limited sawtooth pads, a sixteenth-note arpeggio, offbeat bass with a sine sub, four-on-the-floor kick, layered clap on beats 2 and 4, offbeat open hat, and a sidechain pump keyed to the kick.
- The energy follows the film's structure, not the release dates: pad brightness and arpeggio/hat level rise across calendar travel, and sixteenth-note ticks enter halfway through. The bar before the observation cutoff has a noise riser and snare roll; the cutoff lands on a crash, sub drop and chord stab. Launch density itself is conveyed only by the launch cues.
- Every selected event has a whistle that starts 0.36 logical seconds before its date, then, exactly at its date, a bright crack, a low body, a chime on the current chord and a crackle tail of about one second. Each lab has its own stereo position (OpenAI left, Anthropic right, Google centre) and chime tone. Same-day releases remain simultaneous rather than snapping to a musical grid.
- Deterministic event seeds and `1 / sqrt(neighbor_count)` gain reduce overload when nearby launches overlap. Neighbor count uses a symmetric 0.35-logical-second window. No event is removed for musical convenience.
- At each burst the music ducks by up to about 5 dB (8 ms attack, 0.16 s decay constant), so the launch cue sits above the beat.
- Soft saturation glues the mix. A look-ahead limiter (2 ms, 80 ms release) with its ceiling 13 dB above the mix RMS trims only the sharpest transients; because the level is set from the RMS, a single stray peak cannot change the loudness of the whole track. The score fades in over 0.4 s and out over 1.4 s.

## Reproduction and measurement

`npm run render` synthesizes a 48 kHz stereo PCM master in a temporary WAV, applies FFmpeg two-pass linear loudness normalization targeting **−16 LUFS / −1.5 dBTP**, encodes AAC at 192 kb/s, and muxes the identical encoded track into the MP4. If reaching −16 LUFS would push the true peak above the ceiling, the target is lowered rather than letting loudnorm fall back to dynamic compression. The temporary WAV is removed after mastering. Both aspect ratios use the same score, seed and clock.

The renderer also writes `soundtrack-<format>.m4a` and `audio-<format>.json`. The JSON includes the actual encoded-track loudness and all launch/burst timestamps. `npm run verify:media` remeasures the **finished MP4**, checks integrated loudness within 1.5 LU of the target, peak ≤ −1 dBTP and LRA ≤ 9 LU, verifies stereo AAC at 48 kHz and matching duration, then decodes video and audio completely. The published preview measures −16.1 LUFS / −1.8 dBTP.

`--duration` compresses or stretches the visual/data clock and launch cues for smoke testing; the music remains 128 BPM. Use the default duration for the published presentation. Unit tests cover deterministic stereo samples, nonzero mono output, finite/unclipped PCM, fade endpoints, WAV structure and one-to-one event synchronization.

Technical measurements and image-based review do not prove subjective listening quality, and this document does not claim that a human listening test approved the score. Listen at a comfortable device volume and judge it yourself.
