# Audio Core Concepts

Core concepts and patterns for react-native-audio-api. Follows the [Web Audio API specification](https://www.w3.org/TR/webaudio-1.1/) for cross-platform consistency across iOS, Android, and web.

For playback patterns, see **`playback.md`**.
For recording, see **`recording.md`**.
For effects and analysis, see **`effects-and-analysis.md`**.
For worklets, see **`worklets.md`**.
For system integration, see **`system-and-notifications.md`**.

---

## Decision Tree

Pick the approach based on what the feature needs.

```
Do you need simple file playback with no effects or real-time processing?
├── YES → Consider Expo Audio (simpler API, less control)
└── NO  → Use react-native-audio-api
    ├── Playing pre-recorded audio files → AudioBufferSourceNode (see playback.md)
    ├── Generating tones or periodic signals → OscillatorNode (see playback.md)
    ├── Streaming HLS audio → StreamerNode (see playback.md, mobile only)
    ├── Playing sequential buffers → AudioBufferQueueSourceNode (see playback.md, mobile only)
    ├── Recording from microphone → AudioRecorder (see recording.md)
    ├── Applying effects to audio → GainNode, BiquadFilterNode, etc. (see effects-and-analysis.md)
    ├── Visualizing audio data → AnalyserNode (see effects-and-analysis.md)
    ├── Custom real-time audio processing → Worklets (see worklets.md)
    └── System integration (notifications, interruptions) → AudioManager (see system-and-notifications.md)
```

---

## AudioContext Lifecycle

`AudioContext` is the central object that controls the audio-processing graph. It manages node creation, audio decoding, and the rendering lifecycle.

### Singleton Pattern

Encapsulate `AudioContext` in a singleton class to keep audio logic outside of React components and maintain consistent state across the app.

```tsx
import { AudioContext } from 'react-native-audio-api';

class AudioManager {
  private static instance: AudioManager;
  readonly context: AudioContext;

  private constructor() {
    this.context = new AudioContext();
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }
}

export const audioManager = AudioManager.getInstance();
```

### Context States

- `running`: The audio context is actively processing audio.
- `suspended`: Time progression is paused. Use `suspend()` when audio is temporarily not needed.
- `closed`: The context is permanently shut down. Use `close()` when the audio feature is done.

### Mount/Unmount Pattern

Activate the context when the audio feature mounts, suspend on unmount:

```tsx
useEffect(() => {
  const ctx = audioManager.context;

  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  return () => {
    ctx.suspend();
  };
}, []);
```

Call `close()` only when the audio feature is permanently torn down. Wrapping every play/record call in activate/deactivate pairs adds perceptible latency.

---

## Audio Graph

An audio graph is a network of nodes connected in a signal flow:

- **Source nodes** generate or provide audio data (`AudioBufferSourceNode`, `OscillatorNode`, `StreamerNode`, `RecorderAdapterNode`)
- **Effect nodes** transform audio data (`GainNode`, `BiquadFilterNode`, `DelayNode`, `ConvolverNode`, `StereoPannerNode`, `WaveShaperNode`)
- **Analysis nodes** extract data without modifying the signal (`AnalyserNode`)
- **Destination node** represents the final output (`audioContext.destination`)

Nodes connect with `.connect()` and disconnect with `.disconnect()`:

```tsx
const source = audioContext.createBufferSource();
const gain = audioContext.createGain();
const analyser = audioContext.createAnalyser();

source.connect(gain);
gain.connect(analyser);
analyser.connect(audioContext.destination);
```

Audio is rendered in blocks of 128 sample-frames (render quantum). The system audio callback drives the rendering thread.

---

## Decoding Audio Data

Use `decodeAudioData` to load audio from files, URLs, ArrayBuffers, or bundled assets:

```tsx
// From a URL or local file path
const buffer = await audioContext.decodeAudioData('https://example.com/audio.mp3');

// From an ArrayBuffer
const buffer = await audioContext.decodeAudioData(arrayBuffer);

// From a bundled asset (mobile only)
const buffer = await audioContext.decodeAudioData(require('./audio.mp3'));
```

The audio is automatically resampled to match the context's `sampleRate`. Pass an optional `sampleRate` parameter to override.

For base64-encoded PCM data, use `decodePCMInBase64`:

```tsx
const buffer = await audioContext.decodePCMInBase64(base64String, 44100, 2, true);
```

For full format support details, webfetch the [decoding docs](https://docs.swmansion.com/react-native-audio-api/docs/utils/decoding).

---

## Storing AudioBuffers in State

`AudioBuffer` objects are safe to store in React state, Zustand, Redux, or any state container. The buffer holds a reference to native memory. Copying that reference into state does not copy the audio data, so there is no performance concern.

```tsx
const [buffer, setBuffer] = useState<AudioBuffer | null>(null);

async function load(url: string) {
  const loaded = await audioContext.decodeAudioData(url);
  setBuffer(loaded);
}
```

---

## Creating Buffers Programmatically

Use `createBuffer` for procedural audio (noise, tones, test signals):

```tsx
const sampleRate = audioContext.sampleRate;
const bufferSize = sampleRate * 2; // 2 seconds
const buffer = audioContext.createBuffer(1, bufferSize, sampleRate);

const channelData = new Float32Array(bufferSize);
for (let i = 0; i < bufferSize; i++) {
  channelData[i] = Math.random() * 2 - 1; // white noise
}
buffer.copyToChannel(channelData, 0, 0);
```

---

## References

- [React Native Audio API docs](https://docs.swmansion.com/react-native-audio-api/)
- [AudioContext](https://docs.swmansion.com/react-native-audio-api/docs/core/audio-context)
- [BaseAudioContext](https://docs.swmansion.com/react-native-audio-api/docs/core/base-audio-context)
- [AudioNode](https://docs.swmansion.com/react-native-audio-api/docs/core/audio-node)
