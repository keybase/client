# Audio Effects and Analysis

Patterns for building audio effect chains and analyzing audio data in React Native using react-native-audio-api.

For core concepts, see **`audio.md`**.
For playback sources, see **`playback.md`**.

---

## Effect Nodes Overview

Effect nodes transform audio passing through them. Chain them between source and destination:

```tsx
source.connect(effectA);
effectA.connect(effectB);
effectB.connect(audioContext.destination);
```

All effect nodes are created from `AudioContext` (or `BaseAudioContext`) factory methods.

---

## GainNode

Controls volume. The most commonly used effect node.

```tsx
const gain = audioContext.createGain();
gain.gain.setValueAtTime(0.5, audioContext.currentTime); // 50% volume

source.connect(gain);
gain.connect(audioContext.destination);
```

### Fade In / Fade Out

```tsx
// Fade in over 2 seconds
gain.gain.setValueAtTime(0, audioContext.currentTime);
gain.gain.linearRampToValueAtTime(1, audioContext.currentTime + 2);

// Fade out over 0.5 seconds
gain.gain.setValueAtTime(1, audioContext.currentTime);
gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
gain.gain.setValueAtTime(0, audioContext.currentTime + 0.51);
```

**Gotcha**: `exponentialRampToValueAtTime` cannot reach 0. Ramp to a tiny value (0.001), then set to 0.

### ADSR Envelope

Use `GainNode` to shape how a sound's volume changes over time. This is essential for musical instruments and sound design.

```tsx
function playNoteWithEnvelope(
  audioContext: AudioContext,
  buffer: AudioBuffer,
  attack: number,
  decay: number,
  sustain: number,
  release: number
) {
  const source = audioContext.createBufferSource();
  const envelope = audioContext.createGain();
  const now = audioContext.currentTime;

  source.buffer = buffer;
  source.connect(envelope);
  envelope.connect(audioContext.destination);

  // Attack: silence → peak
  envelope.gain.setValueAtTime(0.001, now);
  envelope.gain.exponentialRampToValueAtTime(1.0, now + attack);

  // Decay: peak → sustain level
  envelope.gain.exponentialRampToValueAtTime(sustain, now + attack + decay);

  source.start(now);

  return {
    release: () => {
      const releaseStart = audioContext.currentTime;
      // Release: current → silence
      envelope.gain.setValueAtTime(envelope.gain.value, releaseStart);
      envelope.gain.exponentialRampToValueAtTime(0.001, releaseStart + release);
      envelope.gain.setValueAtTime(0, releaseStart + release + 0.01);
      source.stop(releaseStart + release + 0.02);
    },
  };
}
```

For GainNode API details, webfetch the [GainNode docs](https://docs.swmansion.com/react-native-audio-api/docs/effects/gain-node).

---

## BiquadFilterNode

Implements common audio filters: lowpass, highpass, bandpass, notch, allpass, peaking, lowshelf, highshelf.

```tsx
const filter = audioContext.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.value = 1000; // cutoff frequency in Hz
filter.Q.value = 1.0;         // quality factor

source.connect(filter);
filter.connect(audioContext.destination);
```

### Common Filter Types

| Type | Effect |
|------|--------|
| `lowpass` | Passes frequencies below cutoff, attenuates above |
| `highpass` | Passes frequencies above cutoff, attenuates below |
| `bandpass` | Passes a range around the center frequency |
| `notch` | Rejects a narrow band around the center frequency |
| `peaking` | Boosts/cuts around the center frequency (parametric EQ) |
| `lowshelf` | Boosts/cuts all frequencies below the shelf frequency |
| `highshelf` | Boosts/cuts all frequencies above the shelf frequency |

For BiquadFilterNode API details, webfetch the [BiquadFilterNode docs](https://docs.swmansion.com/react-native-audio-api/docs/effects/biquad-filter-node).

---

## DelayNode

Delays the audio signal by a specified time.

```tsx
const delay = audioContext.createDelay(5.0); // max delay time in seconds
delay.delayTime.value = 0.3; // 300ms delay

source.connect(delay);
delay.connect(audioContext.destination);
```

### Echo Effect

Create a feedback loop with a gain node to produce echo:

```tsx
const delay = audioContext.createDelay(1.0);
const feedback = audioContext.createGain();

delay.delayTime.value = 0.4;
feedback.gain.value = 0.5; // each echo is 50% quieter

source.connect(delay);
delay.connect(feedback);
feedback.connect(delay); // feedback loop
delay.connect(audioContext.destination);
source.connect(audioContext.destination); // dry signal
```

For DelayNode API details, webfetch the [DelayNode docs](https://docs.swmansion.com/react-native-audio-api/docs/effects/delay-node).

---

## ConvolverNode

Applies convolution reverb using an impulse response buffer. Great for adding room acoustics or spatial effects.

```tsx
const convolver = audioContext.createConvolver();
convolver.buffer = impulseResponseBuffer; // an AudioBuffer with the IR

source.connect(convolver);
convolver.connect(audioContext.destination);
```

For ConvolverNode API details, webfetch the [ConvolverNode docs](https://docs.swmansion.com/react-native-audio-api/docs/effects/convolver-node).

---

## StereoPannerNode

Positions audio in the stereo field.

```tsx
const panner = audioContext.createStereoPanner();
panner.pan.value = -1; // full left (-1 to 1)

source.connect(panner);
panner.connect(audioContext.destination);
```

For StereoPannerNode API details, webfetch the [StereoPannerNode docs](https://docs.swmansion.com/react-native-audio-api/docs/effects/stereo-panner-node).

---

## WaveShaperNode

Applies non-linear distortion using a shaping curve.

```tsx
const shaper = audioContext.createWaveShaper();
shaper.curve = makeDistortionCurve(400);
shaper.oversample = '4x'; // '2x' | '4x' | 'none'

source.connect(shaper);
shaper.connect(audioContext.destination);
```

For WaveShaperNode API details, webfetch the [WaveShaperNode docs](https://docs.swmansion.com/react-native-audio-api/docs/effects/wave-shaper-node).

---

## IIRFilterNode

Implements a general IIR (Infinite Impulse Response) filter when `BiquadFilterNode` types are insufficient.

```tsx
const iir = audioContext.createIIRFilter(feedforward, feedback);
```

For IIRFilterNode API details, webfetch the [IIRFilterNode docs](https://docs.swmansion.com/react-native-audio-api/docs/effects/iir-filter-node).

---

## AnalyserNode

Extracts time-domain and frequency-domain data from audio without modifying the signal. Essential for audio visualizations.

```tsx
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;           // power of 2, between 32 and 32768
analyser.smoothingTimeConstant = 0.8; // 0 (no smoothing) to 1 (heavy smoothing)

source.connect(analyser);
analyser.connect(audioContext.destination);
```

### Extracting Data

```tsx
// Frequency data (for spectrum visualizers, EQ displays)
const freqData = new Float32Array(analyser.frequencyBinCount);
analyser.getFloatFrequencyData(freqData); // values in dB

const freqBytes = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(freqBytes); // values 0-255

// Time-domain data (for waveform displays, oscilloscopes)
const timeData = new Float32Array(analyser.fftSize);
analyser.getFloatTimeDomainData(timeData); // values -1 to 1

const timeBytes = new Uint8Array(analyser.fftSize);
analyser.getByteTimeDomainData(timeBytes); // values 0-255 (127 = silence)
```

### Properties

- `fftSize`: Must be a power of 2 in [32, 32768]. Larger values give finer frequency resolution but more latency.
- `frequencyBinCount`: Always `fftSize / 2`. Number of frequency data points.
- `minDecibels` / `maxDecibels`: Range for byte frequency data mapping. Frequencies below `minDecibels` map to 0, above `maxDecibels` to 255.
- `smoothingTimeConstant`: Averaging with previous frame. Higher = smoother transitions.

---

## Audio Visualization with Reanimated

When passing audio data to Reanimated shared values for animation, mutate the existing typed array in place to avoid GC jank:

```tsx
import { useSharedValue } from 'react-native-reanimated';

const FFT_SIZE = 256;
const amplitudes = useSharedValue(new Float32Array(FFT_SIZE / 2));

function updateVisualization() {
  const data = new Float32Array(analyser.frequencyBinCount);
  analyser.getFloatFrequencyData(data);

  amplitudes.modify((prev) => {
    for (let i = 0; i < prev.length; i++) {
      prev[i] = data[i];
    }
    return prev;
  });

  requestAnimationFrame(updateVisualization);
}
```

**Why `.modify()`?** Assigning `amplitudes.value = new Float32Array(data)` allocates and garbage-collects a new array at 60fps or higher, causing jank. `.modify()` mutates the existing allocation on the UI thread, skipping GC entirely.

### Visualization with React State (Simple Approach)

For simpler visualizations where maximum performance is less critical:

```tsx
const [freqs, setFreqs] = useState(new Uint8Array(FFT_SIZE / 2));

function draw() {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  setFreqs(data);
  requestAnimationFrame(draw);
}
```

This triggers React re-renders on every frame. For high-performance visualizations, prefer the Reanimated shared value approach above.

---

## Building Effect Chains

Combine multiple effects in series:

```tsx
const gain = audioContext.createGain();
const filter = audioContext.createBiquadFilter();
const delay = audioContext.createDelay(1.0);
const analyser = audioContext.createAnalyser();

// Source → filter → gain → delay → analyser → destination
source.connect(filter);
filter.connect(gain);
gain.connect(delay);
delay.connect(analyser);
analyser.connect(audioContext.destination);
```

### Dry/Wet Mix

Route the original signal alongside the effected signal:

```tsx
const dryGain = audioContext.createGain();
const wetGain = audioContext.createGain();

dryGain.gain.value = 0.7;
wetGain.gain.value = 0.3;

source.connect(dryGain);
source.connect(effect);
effect.connect(wetGain);

dryGain.connect(audioContext.destination);
wetGain.connect(audioContext.destination);
```

---

## References

- [GainNode](https://docs.swmansion.com/react-native-audio-api/docs/effects/gain-node)
- [BiquadFilterNode](https://docs.swmansion.com/react-native-audio-api/docs/effects/biquad-filter-node)
- [DelayNode](https://docs.swmansion.com/react-native-audio-api/docs/effects/delay-node)
- [ConvolverNode](https://docs.swmansion.com/react-native-audio-api/docs/effects/convolver-node)
- [StereoPannerNode](https://docs.swmansion.com/react-native-audio-api/docs/effects/stereo-panner-node)
- [WaveShaperNode](https://docs.swmansion.com/react-native-audio-api/docs/effects/wave-shaper-node)
- [AnalyserNode](https://docs.swmansion.com/react-native-audio-api/docs/analysis/analyser-node)
- [Piano keyboard guide (ADSR)](https://docs.swmansion.com/react-native-audio-api/docs/guides/making-a-piano-keyboard)
- [See your sound guide (visualization)](https://docs.swmansion.com/react-native-audio-api/docs/guides/see-your-sound)
