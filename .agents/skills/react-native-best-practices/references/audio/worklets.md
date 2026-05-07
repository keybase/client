# Audio Worklets

Patterns for real-time audio processing and synthesis using worklets in react-native-audio-api. Mobile only.

For core concepts, see **`audio.md`**.
For built-in effect nodes, see **`effects-and-analysis.md`**.

---

## Overview

Audio worklets let you run JavaScript code on the audio rendering thread for custom real-time processing. Three worklet node types are available:

| Node | Purpose |
|------|---------|
| `WorkletNode` | **Read-only access** to audio data passing through the graph. Use for analysis, visualization, or driving UI from audio. |
| `WorkletSourceNode` | **Generates audio** procedurally. Use for custom synthesizers, tone generators, or procedural soundscapes. |
| `WorkletProcessingNode` | **Reads input and writes output**. Use for custom effects, filters, or signal transformations. |

All worklet nodes require `react-native-worklets` as a dependency:

```bash
npm install react-native-worklets
```

Supported versions: 0.6.x, 0.7.x. Nightly versions are always supported.

---

## Worklet Runtimes

Each worklet node takes a `workletRuntime` parameter selecting where the worklet executes:

### UIRuntime

Runs on the UI thread provided by `react-native-worklets`. Enables integration with Reanimated shared values and UI updates.

**Use when:**
- Updating UI elements from audio data (visualizations, meters)
- Integrating with Reanimated shared values
- Performance is less critical than UI responsiveness

### AudioRuntime

Runs on the audio rendering thread for maximum performance and minimal latency.

**Use when:**
- Real-time audio processing without dropouts
- Generating audio with precise timing
- Latency and throughput are critical
- Audio processing does not need to interact with UI

---

## WorkletNode (Read-Only Analysis)

Receives audio data for inspection without modifying it. The audio passes through unchanged.

```tsx
const worklet = (audioData: Array<Float32Array>, inputChannelCount: number) => {
  'worklet';
  // audioData[channel][sample] - read-only
  // Modifications are NOT reflected in the audio output
};

const workletNode = audioContext.createWorkletNode(
  worklet,
  1024,           // bufferLength
  2,              // inputChannelCount
  'UIRuntime'     // or 'AudioRuntime'
);

source.connect(workletNode);
workletNode.connect(audioContext.destination);
```

### Driving Reanimated from Audio Data

```tsx
import { useSharedValue } from 'react-native-reanimated';

const volume = useSharedValue(0);

const worklet = (audioData: Array<Float32Array>, channelCount: number) => {
  'worklet';
  let sum = 0;
  const samples = audioData[0];
  for (let i = 0; i < samples.length; i++) {
    sum += Math.abs(samples[i]);
  }
  volume.value = sum / samples.length;

  // Workaround: flush microtask queue so UI updates
  requestAnimationFrame(() => {});
};
```

**Known issue**: When using `UIRuntime`, shared value changes from the worklet may not always trigger UI updates. Add `requestAnimationFrame(() => {})` at the end of the worklet to flush the microtask queue. This has performance implications, so only use it when UI updates are missing.

### With AudioRecorder

```tsx
const adapter = audioContext.createRecorderAdapter();
adapter.connect(workletNode);
workletNode.connect(audioContext.destination);
recorder.connect(adapter);
recorder.start();
await audioContext.resume();
```

---

## WorkletSourceNode (Audio Generation)

Generates audio procedurally. Extends `AudioScheduledSourceNode` with `start()` and `stop()`.

```tsx
const sineWave = (
  audioData: Array<Float32Array>,
  framesToProcess: number,
  currentTime: number,
  startOffset: number
) => {
  'worklet';
  const frequency = 440;
  const sampleRate = 44100;

  for (let ch = 0; ch < audioData.length; ch++) {
    for (let i = 0; i < framesToProcess; i++) {
      const t = currentTime + (startOffset + i) / sampleRate;
      audioData[ch][i] = Math.sin(2 * Math.PI * frequency * t) * 0.5;
    }
  }
};

const sourceNode = audioContext.createWorkletSourceNode(sineWave, 'AudioRuntime');
sourceNode.connect(audioContext.destination);
sourceNode.start();

// Stop after 2 seconds
setTimeout(() => sourceNode.stop(), 2000);
```

### Parameters

- `audioData`: Write audio samples here. `audioData[channel][sample]`.
- `framesToProcess`: Number of samples to generate per channel.
- `currentTime`: Audio context time at the start of this processing block.
- `startOffset`: Sample offset within the block. Absolute time for sample `i` is: `currentTime + (startOffset + i) / sampleRate`.

---

## WorkletProcessingNode (Custom Effects)

Reads input audio and writes output audio. The core building block for custom effects.

```tsx
const gainEffect = (
  inputData: Array<Float32Array>,
  outputData: Array<Float32Array>,
  framesToProcess: number,
  currentTime: number
) => {
  'worklet';
  const gain = 0.5;

  for (let ch = 0; ch < inputData.length; ch++) {
    const input = inputData[ch];
    const output = outputData[ch];
    for (let i = 0; i < framesToProcess; i++) {
      output[i] = input[i] * gain;
    }
  }
};

const processingNode = audioContext.createWorkletProcessingNode(
  gainEffect,
  'AudioRuntime'
);

source.connect(processingNode);
processingNode.connect(audioContext.destination);
```

### Parameters

- `inputData`: Read audio from here. `inputData[channel][sample]`.
- `outputData`: Write processed audio here. `outputData[channel][sample]`.
- `framesToProcess`: Number of samples per channel. At most 128.
- `currentTime`: Audio context time at the start of this block.

---

## Performance Budget

The audio system processes at 44.1kHz by default, in blocks of 128 samples:

```
44100 samples/sec ÷ 128 samples/block ≈ 344 blocks/sec
1000ms ÷ 344 ≈ 2.9ms per block
```

Your worklet plus all other processing must complete within ~2.9ms per block at the default buffer size. Exceeding this causes audio dropouts.

### Recommendations

- **Increase `bufferLength`** to 256, 512, or 1024 if you do not need more than ~40fps of worklet invocations. Larger buffers give more time per invocation at the cost of higher latency.
- **Avoid blocking operations** in worklets. No API calls, no `console.log`, no async operations.
- **Minimize worklet count**. Chained worklet nodes add latency linearly. Combine processing into a single worklet where possible.
- **Use lookup tables** for expensive math (trig functions, power curves) instead of computing per-sample.
- **Measure and check logs** to ensure you are not dropping frames.
- **Use `AudioRuntime`** for performance-critical processing. Use `UIRuntime` only when you need Reanimated integration.

---

## Custom C++ Processing Nodes

For maximum performance beyond what JavaScript worklets can deliver, create a pure C++ TurboModule with a custom `AudioNode` subclass. This approach gives direct access to the native audio buffer at the C++ level.

A generator script handles the boilerplate:

```bash
npx rn-audioapi-custom-node-generator create -o ./
```

For a complete walkthrough, webfetch the [Create your own effect guide](https://docs.swmansion.com/react-native-audio-api/docs/guides/create-your-own-effect).

---

## References

- [Worklets introduction](https://docs.swmansion.com/react-native-audio-api/docs/worklets/worklets-introduction)
- [WorkletNode](https://docs.swmansion.com/react-native-audio-api/docs/worklets/worklet-node)
- [WorkletSourceNode](https://docs.swmansion.com/react-native-audio-api/docs/worklets/worklet-source-node)
- [WorkletProcessingNode](https://docs.swmansion.com/react-native-audio-api/docs/worklets/worklet-processing-node)
- [Create your own effect](https://docs.swmansion.com/react-native-audio-api/docs/guides/create-your-own-effect)
