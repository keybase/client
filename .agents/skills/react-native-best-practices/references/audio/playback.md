# Audio Playback

Patterns for playing audio in React Native using react-native-audio-api source nodes.

For core concepts and AudioContext lifecycle, see **`audio.md`**.
For audio effects, see **`effects-and-analysis.md`**.

---

## AudioBufferSourceNode

The primary node for playing pre-recorded audio. Load audio into an `AudioBuffer`, assign it to a source node, connect to the destination, and start.

```tsx
const source = audioContext.createBufferSource();
source.buffer = audioBuffer;
source.connect(audioContext.destination);
source.start(audioContext.currentTime);
```

**Single-use rule**: An `AudioBufferSourceNode` can be started only once. To replay the same sound, create a new node. The node is very inexpensive to create; always reuse the `AudioBuffer`.

### Start with Scheduling

The `start` method accepts precise timing parameters:

```tsx
// Start immediately
source.start();

// Start at a specific time
source.start(audioContext.currentTime + 1.0);

// Start at a time, from an offset, for a duration
source.start(audioContext.currentTime, 2.0, 5.0); // starts 2s in, plays for 5s
```

Time values use the same coordinate system as `audioContext.currentTime`.

### Looping

```tsx
source.loop = true;
source.loopStart = 0.5; // seconds
source.loopEnd = 3.0;   // seconds
source.start();
```

Use the `onLoopEnded` event to know when the buffer loops:

```tsx
source.onLoopEnded = () => {
  console.log('Loop restarted');
};
```

### Playback Rate and Pitch

The `playbackRate` `AudioParam` changes the speed and pitch simultaneously:

```tsx
source.playbackRate.value = 2.0; // double speed, one octave higher
```

For pitch correction (speed change without pitch change), create the source with `pitchCorrection: true`:

```tsx
const source = audioContext.createBufferSource({ pitchCorrection: true });
```

Pitch correction introduces processing latency. When scheduling precise playback times, start samples slightly ahead of the intended time. Use `source.getLatency()` to query the latency value. When `pitchCorrection` is enabled, `playbackRate` is clamped to [0, 3].

---

## OscillatorNode

Generates periodic wave signals (sine, square, sawtooth, triangle). Useful for synthesizers, test tones, and sound design.

```tsx
const osc = audioContext.createOscillator();
osc.type = 'sine'; // 'sine' | 'square' | 'sawtooth' | 'triangle'
osc.frequency.value = 440; // A4
osc.connect(audioContext.destination);
osc.start(audioContext.currentTime);
osc.stop(audioContext.currentTime + 2);
```

Like `AudioBufferSourceNode`, oscillators are single-use. Create a new one for each tone.

### Frequency and Detune

Both are `AudioParam` objects supporting scheduling:

```tsx
// Slide from A4 to A5 over 1 second
osc.frequency.setValueAtTime(440, audioContext.currentTime);
osc.frequency.linearRampToValueAtTime(880, audioContext.currentTime + 1);

// Detune by one semitone (100 cents)
osc.detune.value = 100;
```

### Custom Waveforms

Use `PeriodicWave` for custom timbres:

```tsx
const real = new Float32Array([0, 0.5, 0.3, 0.1]);
const imag = new Float32Array([0, 0, 0, 0]);
const wave = audioContext.createPeriodicWave(real, imag);
osc.setPeriodicWave(wave);
```

For OscillatorNode API details, webfetch the [OscillatorNode docs](https://docs.swmansion.com/react-native-audio-api/docs/sources/oscillator-node).

---

## StreamerNode (Mobile Only)

Decodes and plays HTTP Live Streaming (HLS) audio data:

```tsx
const streamer = audioContext.createStreamer();
streamer.initialize('https://example.com/stream.m3u8');
streamer.connect(audioContext.destination);
streamer.start(audioContext.currentTime);
```

For StreamerNode API details, webfetch the [StreamerNode docs](https://docs.swmansion.com/react-native-audio-api/docs/sources/streamer-node).

---

## AudioBufferQueueSourceNode (Mobile Only)

A specialized source for playing sequential buffers. Useful for streaming audio chunks or playing a playlist of buffers without gaps.

```tsx
const queue = audioContext.createBufferQueueSource();

const id1 = queue.enqueueBuffer(buffer1);
const id2 = queue.enqueueBuffer(buffer2);

queue.connect(audioContext.destination);
queue.start(audioContext.currentTime);
```

### Queue Management

```tsx
queue.dequeueBuffer(id1);  // remove a specific buffer
queue.clearBuffers();       // remove all queued buffers
```

### Pause and Resume

Unlike `AudioBufferSourceNode`, `AudioBufferQueueSourceNode` supports true pause/resume:

```tsx
queue.pause();  // halts playback, keeps position
queue.start();  // resumes from where it paused
```

### Buffer End Events

```tsx
queue.onBufferEnded = (event) => {
  console.log(`Buffer ${event.bufferId} ended`);
  if (event.isLastBufferInQueue) {
    console.log('Queue exhausted');
  }
};
```

For AudioBufferQueueSourceNode API details, webfetch the [AudioBufferQueueSourceNode docs](https://docs.swmansion.com/react-native-audio-api/docs/sources/audio-buffer-queue-source-node).

---

## AudioParam Scheduling

`AudioParam` controls time-varying properties on audio nodes (gain, frequency, delay time, etc.). Use scheduling methods for smooth, click-free transitions.

### Available Methods

| Method | Use case |
|--------|----------|
| `setValueAtTime(value, time)` | Instant change at a specific time |
| `linearRampToValueAtTime(value, endTime)` | Linear fade between previous event and target |
| `exponentialRampToValueAtTime(value, endTime)` | Exponential fade (perceptually even for volume) |
| `setTargetAtTime(target, startTime, timeConstant)` | Asymptotic approach (good for decay/release) |
| `setValueCurveAtTime(values, startTime, duration)` | Follow an arbitrary curve |
| `cancelScheduledValues(cancelTime)` | Cancel all scheduled changes after a time |
| `cancelAndHoldAtTime(cancelTime)` | Cancel and freeze at the current value |

### Volume Fade Example

```tsx
const gain = audioContext.createGain();

// Fade in over 2 seconds
gain.gain.setValueAtTime(0, audioContext.currentTime);
gain.gain.linearRampToValueAtTime(1, audioContext.currentTime + 2);
```

### Avoiding Clicks

Direct gain changes (e.g., `gain.gain.value = 0`) cause audible clicks. Always ramp:

```tsx
// Bad: causes click
gain.gain.value = 0;

// Good: smooth fade
gain.gain.setValueAtTime(gain.gain.value, audioContext.currentTime);
gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
```

**Gotcha**: `exponentialRampToValueAtTime` cannot ramp to 0 (exponential never reaches zero). Use a very small value like 0.001, then `setValueAtTime(0, ...)` immediately after.

**Gotcha**: Avoid calling `setValueAtTime` more than ~31 times for continuous changes. Use ramp methods or `setValueCurveAtTime` instead for better performance.

For AudioParam API details, webfetch the [AudioParam docs](https://docs.swmansion.com/react-native-audio-api/docs/core/audio-param).

---

## Noise Generation

Generate noise by filling an `AudioBuffer` with computed samples and looping it.

### White Noise

```tsx
function createWhiteNoise(audioContext: AudioContext): AudioBuffer {
  const bufferSize = audioContext.sampleRate * 2;
  const output = new Float32Array(bufferSize);

  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  buffer.copyToChannel(output, 0, 0);
  return buffer;
}

// Play it looped
const source = audioContext.createBufferSource();
source.buffer = createWhiteNoise(audioContext);
source.loop = true;
source.connect(audioContext.destination);
source.start();
```

### Pink Noise

Uses the Paul Kellet refined method for a -3dB/octave roll-off:

```tsx
function createPinkNoise(audioContext: AudioContext): AudioBuffer {
  const bufferSize = 2 * audioContext.sampleRate;
  const output = new Float32Array(bufferSize);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    output[i] = 0.11 * (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362);
    b6 = white * 0.115926;
  }

  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  buffer.copyToChannel(output, 0, 0);
  return buffer;
}
```

### Brownian Noise

-12dB/octave roll-off, sounds like a waterfall:

```tsx
function createBrownianNoise(audioContext: AudioContext): AudioBuffer {
  const bufferSize = 2 * audioContext.sampleRate;
  const output = new Float32Array(bufferSize);
  let lastOut = 0;

  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    output[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = output[i];
    output[i] *= 3.5;
  }

  const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
  buffer.copyToChannel(output, 0, 0);
  return buffer;
}
```

---

## References

- [AudioBufferSourceNode](https://docs.swmansion.com/react-native-audio-api/docs/sources/audio-buffer-source-node)
- [OscillatorNode](https://docs.swmansion.com/react-native-audio-api/docs/sources/oscillator-node)
- [StreamerNode](https://docs.swmansion.com/react-native-audio-api/docs/sources/streamer-node)
- [AudioBufferQueueSourceNode](https://docs.swmansion.com/react-native-audio-api/docs/sources/audio-buffer-queue-source-node)
- [AudioParam](https://docs.swmansion.com/react-native-audio-api/docs/core/audio-param)
- [Noise generation guide](https://docs.swmansion.com/react-native-audio-api/docs/guides/noise-generation)
