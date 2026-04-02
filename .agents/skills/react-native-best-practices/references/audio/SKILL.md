---
name: audio
description: "Software Mansion's best practices for audio in React Native using react-native-audio-api. Covers audio playback (buffer sources, oscillators, streaming), recording (file, callback, graph), audio effects (gain, filters, delay, convolver, panner, waveshaper), real-time analysis and visualization, audio worklets (custom synthesis, UIRuntime/AudioRuntime), system integration (sessions, interruptions, permissions), and testing. Trigger on: react-native-audio-api, AudioContext, AudioRecorder, AudioBuffer, AudioBufferSourceNode, AudioBufferQueueSourceNode, OscillatorNode, StreamerNode, GainNode, BiquadFilterNode, DelayNode, ConvolverNode, StereoPannerNode, WaveShaperNode, AnalyserNode, AudioParam, AudioManager, PlaybackNotificationManager, RecordingNotificationManager, WorkletNode, WorkletSourceNode, WorkletProcessingNode, audio playback, record audio, microphone, waveform, audio visualization, audio streaming, audio worklet, or any React Native feature that captures, processes, or emits sound."
---

# Audio

Software Mansion's production audio patterns for React Native using react-native-audio-api.

Load at most one reference file per question. For API signatures and config options, webfetch the documentation pages linked in each reference file.

## Critical Rules

- **Single AudioContext**: Create one `AudioContext` instance per app. Multiple instances lead to conflicting states (one running, another suspended). Encapsulate it in a singleton class.
- **Single AudioRecorder**: Create one `AudioRecorder` instance and reuse it. Switching between recorder instances has noticeable impact on performance, memory, and battery.
- **Suspend when idle**: A running `AudioContext` plays silence even with no source nodes connected, draining battery. On iOS, it also prevents the lock screen from showing a paused state. Use `suspend()` when audio is temporarily not needed, `close()` when done permanently.
- **AudioBufferSourceNode is single-use**: An `AudioBufferSourceNode` can be started only once. To replay the same sound, create a new node. Nodes are inexpensive to create; reuse the `AudioBuffer`.
- **Use AudioParam scheduling for smooth changes**: Direct, immediate changes to gain, frequency, or other params cause audible clicks. Use `linearRampToValueAtTime`, `exponentialRampToValueAtTime`, or `setTargetAtTime` for smooth transitions.
- **Mutate typed arrays in place for visualizations**: When passing audio data to Reanimated shared values, use `.modify()` to mutate the existing `Float32Array` rather than allocating a new one each frame. Allocating at 60fps+ causes GC jank.

## References

| File | When to read |
|------|-------------|
| `audio.md` | Decision tree for choosing an audio approach; AudioContext lifecycle and singleton pattern; audio graph concepts; decoding audio data; AudioBuffer state management |
| `playback.md` | Playing audio with `AudioBufferSourceNode`, `OscillatorNode`, `StreamerNode`, `AudioBufferQueueSourceNode`; looping and scheduling; `AudioParam` scheduling methods; playback rate and pitch; noise generation |
| `recording.md` | Recording audio with `AudioRecorder`; three recording modes (file, data callback, graph processing); file output configuration and formats; permissions; background recording setup |
| `effects-and-analysis.md` | Audio effects chain (`GainNode`, `BiquadFilterNode`, `DelayNode`, `ConvolverNode`, `StereoPannerNode`, `WaveShaperNode`); ADSR envelopes; `AnalyserNode` for time-domain and frequency-domain data; audio visualization patterns |
| `worklets.md` | Audio worklets with `WorkletNode`, `WorkletSourceNode`, `WorkletProcessingNode`; `UIRuntime` vs `AudioRuntime`; performance budgets and latency constraints; custom synthesis and real-time processing |
| `system-and-notifications.md` | `AudioManager` for session configuration and system events; `PlaybackNotificationManager` and `RecordingNotificationManager` for media controls; permissions; interruption handling; testing with mocks |
