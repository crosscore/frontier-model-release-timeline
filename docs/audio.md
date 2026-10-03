# Afterburn / 004

An original procedural electronic score and launch sound design, composed for this film. All tones come from mathematical oscillators and seeded noise in [src/audio.mjs](../src/audio.mjs). There are no recordings, third-party samples, borrowed melodies, generative music services, paid APIs, or credentials. The composition, synthesized master and sound effects are distributed with the project under [MIT](../LICENSE). The separately bundled font is OFL.

It replaces “Liftoff / 003”, which ended on a held A major chord and had a light low end, with a bass-heavy groove that keeps running after the drop and simply fades out. (“Ignition / 002” and “Afterglow / 001” accompanied earlier editions.)

## Score and cues

- 128 BPM, 4/4. The 30-second film is exactly 16 bars: 1 intro, 12 calendar travel, 1 arrival hold, 2 conclusion. Am(add9), F, C and G, one chord per bar, from the first travel bar; E (the dominant) in the bar before the observation cutoff; the loop restarts on Am at the drop and keeps cycling until the fade. There is no closing cadence.
- The low end carries the track:
  - the kick is a saturated sine that falls from 175 Hz to 50 Hz with a long sub tail and a short click, so it reads on small speakers as well as on a subwoofer;
  - a mono sine sub bass ducks almost fully under each kick, which gives the groove its pump;
  - a “reese” mid bass (two detuned saws an octave above the sub) runs through its own low-pass and saturation, and in the drop that filter wobbles on eighth notes.
- The energy follows the film's structure, not the release dates. Sections are set by calendar-travel progress:
  - intro: muffled pads and a kick on beats 1 and 3, after an opening boom;
  - groove A (bars 2–5): four-on-the-floor kick, one long sub note per bar, offbeat closed hats, an eighth-note pluck arpeggio;
  - groove B (bars 6–9): offbeat sub and reese bass, sixteenth hats, claps on beats 2 and 4, a sixteenth arpeggio;
  - groove C (bars 10–11): rolling sixteenth reese, an offbeat open hat, a snare body under the claps, and a supersaw octave above the pads;
  - a crash marks the start of grooves B and C.
- A resonant low-pass on the synth bus opens from 600 Hz in the intro to fully open at the build. A dotted-eighth ping-pong delay adds width, and the synths pump against each kick by a depth that grows with the section.
- The build (bar 12) starts a two-bar noise riser and a snare roll that accelerates from eighths to sixteenths, reaching thirty-seconds in the first half of bar 13. There the kick rolls in eighths and the bass gives way to a sub that slides up an octave on E; in the second half everything except an uplifter sweep and a reverse swell drops out. The cutoff lands on an impact and the drop: kick on every beat, offbeat sub, sixteenth reese wobble, a supersaw lead hook and offbeat chord stabs.
- Measured on the full mix before mastering (music and launch cues), the bar-level RMS stays within about 1 dB from bar 2 to bar 12 while the arrangement thickens, dips in the breath bar, peaks in the drop bar about 1.5 dB above the grooves, and then falls with the fade. The added density rather than the level carries the build.
- Every selected event has a whistle that starts 0.36 logical seconds before its date, then, exactly at its date, a bright crack, a low body, a chime on the current chord and a crackle tail of about one second. Each lab has its own stereo position (OpenAI left, Anthropic right, Google centre) and chime tone. Same-day releases remain simultaneous rather than snapping to a musical grid.
- Deterministic event seeds and `1 / sqrt(neighbor_count)` gain reduce overload when nearby launches overlap. Neighbor count uses a symmetric 0.35-logical-second window. No event is removed for musical convenience.
- At each burst the pads, synths and reese duck by up to about 3 dB (8 ms attack, 0.16 s decay constant), so the launch cue sits above the music. The kick and sub are not ducked, so the beat stays solid under dense launches.
- Soft saturation glues the mix. A look-ahead limiter (2 ms, 80 ms release) with its ceiling 12 dB above the mix RMS trims only the sharpest transients; because the level is set from the RMS, a single stray peak cannot change the loudness of the whole track. The track reaches full level within 10 ms, under the opening boom, and fades out over the last 3.2 seconds (a quarter of the duration for shorter renders).
- Musical cues snap to the beat grid. When the renderer's frame-count time scale moves a cue by less than 60 ms from a beat, it lands on the beat, so the drop stays on bar 14 in the final film. The camera uses the same cue points and kick times, so its section moves and beat bumps match the score.

## Reproduction and measurement

`npm run render` synthesizes a 48 kHz stereo PCM master in a temporary WAV, applies FFmpeg two-pass linear loudness normalization targeting **−16 LUFS / −1.5 dBTP**, encodes AAC at 192 kb/s, and muxes the identical encoded track into the MP4. If reaching −16 LUFS would push the true peak above the ceiling, the target is lowered rather than letting loudnorm fall back to dynamic compression. The temporary WAV is removed after mastering. Both aspect ratios use the same score, seed and clock.

The renderer also writes `soundtrack-<format>.m4a` and `audio-<format>.json`. The JSON includes the actual encoded-track loudness and all launch/burst timestamps. `npm run verify:media` remeasures the **finished MP4**, checks integrated loudness within 1.5 LU of the target, peak ≤ −1 dBTP and LRA ≤ 9 LU, verifies stereo AAC at 48 kHz and matching duration, then decodes video and audio completely. The published preview measures −16.0 LUFS / −6.0 dBTP with a loudness range of 2.4 LU.

`--duration` compresses or stretches the visual/data clock and launch cues for smoke testing; the music remains 128 BPM. Use the default duration for the published presentation. Unit tests cover deterministic stereo samples, nonzero mono output, finite/unclipped PCM, the drop being the loudest bar, the groove still running in the conclusion, the fade reaching near silence, the kick pattern, WAV structure and one-to-one event synchronization.

Technical measurements and image-based review do not prove subjective listening quality, and this document does not claim that a human listening test approved the score. Listen at a comfortable device volume and judge it yourself.
