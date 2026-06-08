# Speech Processing

Production patterns for speech-to-text, text-to-speech, and voice activity detection using React Native ExecuTorch. For hook API signatures, webfetch the relevant page from the [official docs](https://docs.swmansion.com/react-native-executorch/docs/).

For model loading and resource fetcher setup, see **`setup.md`**.

---

## Speech-to-Text (useSpeechToText)

Transcribes spoken audio to text using Whisper models. For the full API, webfetch [useSpeechToText](https://docs.swmansion.com/react-native-executorch/docs/hooks/natural-language-processing/useSpeechToText).

### Audio requirements

- **Sample rate: 16kHz** -- this is mandatory. Mismatched sample rates produce garbled output silently.
- **Mono channel** -- use `getChannelData(0)` to extract a single channel.
- **Float32Array** -- the waveform must be a `Float32Array`.

### Batch transcription

Process a complete audio file at once. The `transcribe` method returns a `TranscriptionResult` object:

```tsx
import { useSpeechToText, WHISPER_TINY_EN } from 'react-native-executorch';
import { AudioContext } from 'react-native-audio-api';

const model = useSpeechToText({ model: WHISPER_TINY_EN });

const transcribe = async (audioFileUri: string) => {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const decoded = await audioContext.decodeAudioDataSource(audioFileUri);
  const waveform = decoded.getChannelData(0);

  const result = await model.transcribe(waveform);
  console.log(result.text);
};
```

### Timestamps and transcription stats

Pass `verbose: true` to get word-level timestamps and segment data (mimics the OpenAI Whisper API `verbose_json` format):

```tsx
const result = await model.transcribe(audioBuffer, { verbose: true });
// result: {
//   task: "transcription",
//   text: "Example text for a ...",
//   duration: 9.05,
//   language: "en",
//   segments: [
//     {
//       start: 0,
//       end: 5.4,
//       text: "Example text for",
//       words: [{ word: "Example", start: 0, end: 1.4 }, ...],
//       tokens: [1, 32, 45, ...],
//       temperature: 0.0,
//       avgLogprob: -1.235,
//       compressionRatio: 1.632
//     },
//     ...
//   ]
// }
```

### Multilingual transcription

Use a multilingual Whisper model and pass a language code:

```tsx
import { useSpeechToText, WHISPER_TINY } from 'react-native-executorch';

const model = useSpeechToText({ model: WHISPER_TINY }); // multilingual variant

const result = await model.transcribe(spanishAudio, { language: 'es' });
```

Using a multilingual model without specifying a language triggers auto-detection. Using an English-only model (e.g., `WHISPER_TINY_EN`) with a `language` option throws `MultilingualConfiguration`.

### Streaming transcription

For real-time transcription from a microphone, use the async iterator streaming API with `react-native-audio-api`:

```tsx
import { useSpeechToText, WHISPER_TINY_EN } from 'react-native-executorch';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';

const model = useSpeechToText({ model: WHISPER_TINY_EN });
const [recorder] = useState(() => new AudioRecorder());

// Configure audio session for recording
useEffect(() => {
  AudioManager.setAudioSessionOptions({
    iosCategory: 'playAndRecord',
    iosMode: 'spokenAudio',
    iosOptions: ['allowBluetooth', 'defaultToSpeaker'],
  });
  AudioManager.requestRecordingPermissions();
}, []);

const startStreaming = async () => {
  const sampleRate = 16000;

  // Feed audio chunks to the model
  recorder.onAudioReady(
    { sampleRate, bufferLength: 0.1 * sampleRate, channelCount: 1 },
    (chunk) => {
      model.streamInsert(chunk.buffer.getChannelData(0));
    }
  );

  await recorder.start();

  try {
    let accumulatedCommitted = '';
    const streamIter = model.stream({ verbose: false });

    for await (const { committed, nonCommitted } of streamIter) {
      if (committed.text) {
        accumulatedCommitted += committed.text;
      }
      setTranscribedText(accumulatedCommitted + nonCommitted.text);
    }
  } catch (error) {
    console.error('Error during streaming transcription:', error);
  }
};

const stopStreaming = () => {
  recorder.stop();
  model.streamStop();
};
```

The streaming API returns an async iterator that yields `{ committed, nonCommitted }` objects. `committed.text` is finalized and will not change. `nonCommitted.text` is tentative and may be revised as more audio arrives. Display both for responsive UI, but only persist committed text.

The streaming API uses the [whisper-streaming](https://aclanthology.org/2023.ijcnlp-demo.3.pdf) algorithm to split audio at sentence boundaries rather than fixed 30-second chunks. This introduces slight overhead but produces accurate transcription for arbitrarily long audio.

### Supported models

| Model | Language |
|---|---|
| whisper-tiny.en | English |
| whisper-tiny | Multilingual |
| whisper-base.en | English |
| whisper-base | Multilingual |
| whisper-small.en | English |
| whisper-small | Multilingual |

### Gotchas

- Whisper models process audio in segments up to 30 seconds. The streaming API handles chunking automatically.
- `streamInsert` must be called while `stream()` is active. Calling it before `stream()` or after `streamStop()` throws `StreamingNotStarted`.
- Calling `stream()` while another stream is active throws `StreamingInProgress`.

---

## Text-to-Speech (useTextToSpeech)

Synthesizes speech from text using Kokoro models. For the full API, webfetch [useTextToSpeech](https://docs.swmansion.com/react-native-executorch/docs/hooks/natural-language-processing/useTextToSpeech).

### Audio output format

- **Sample rate: 24kHz** -- create the `AudioContext` with `{ sampleRate: 24000 }`.
- **Float32Array** -- the waveform is returned as a `Float32Array`.

### Batch synthesis

Generate the complete waveform at once:

```tsx
import {
  useTextToSpeech,
  KOKORO_MEDIUM,
  KOKORO_VOICE_AF_HEART,
} from 'react-native-executorch';
import { AudioContext } from 'react-native-audio-api';

const tts = useTextToSpeech({
  model: KOKORO_MEDIUM,
  voice: KOKORO_VOICE_AF_HEART,
});

const speak = async (text: string) => {
  const waveform = await tts.forward({ text });

  const ctx = new AudioContext({ sampleRate: 24000 });
  const buffer = ctx.createBuffer(1, waveform.length, 24000);
  buffer.getChannelData(0).set(waveform);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
};
```

For long text, `forward` blocks until the entire waveform is computed. Use streaming for lower time-to-first-audio.

### Streaming synthesis

Generate and play audio chunk by chunk for immediate playback:

```tsx
const ctx = new AudioContext({ sampleRate: 24000 });

await tts.stream({
  text: 'This is a longer text that streams chunk by chunk.',
  onNext: async (chunk) => {
    return new Promise((resolve) => {
      const buffer = ctx.createBuffer(1, chunk.length, 24000);
      buffer.getChannelData(0).set(chunk);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onEnded = () => resolve();
      source.start();
    });
  },
});
```

You can dynamically insert text during streaming with `tts.streamInsert(text)` and stop with `tts.streamStop(instant)`.

### Synthesis from phonemes

If you have pre-computed phonemes (e.g., from an external dictionary or custom G2P model), skip the internal phoneme generation step:

```tsx
// Batch from phonemes
const audioData = await tts.forwardFromPhonemes({
  phonemes: 'hˈɛloʊ wˈɜːld',
});

// Streaming from phonemes
await tts.streamFromPhonemes({
  phonemes: 'hˈɛloʊ wˈɜːld',
  onNext: async (chunk) => { /* play chunk */ },
});
```

### Voice selection

Kokoro supports multiple voices. Pass a voice constant when initializing:

```tsx
import { KOKORO_VOICE_AF_HEART } from 'react-native-executorch';

const tts = useTextToSpeech({
  model: KOKORO_MEDIUM,
  voice: KOKORO_VOICE_AF_HEART,
});
```

Available voices:

| Voice | Gender | Accent |
|---|---|---|
| `KOKORO_VOICE_AF_HEART` | Female | American |
| `KOKORO_VOICE_AF_RIVER` | Female | American |
| `KOKORO_VOICE_AF_SARAH` | Female | American |
| `KOKORO_VOICE_AM_ADAM` | Male | American |
| `KOKORO_VOICE_AM_MICHAEL` | Male | American |
| `KOKORO_VOICE_AM_SANTA` | Male | American |
| `KOKORO_VOICE_BF_EMMA` | Female | British |
| `KOKORO_VOICE_BM_DANIEL` | Male | British |

Available models: `KOKORO_SMALL`, `KOKORO_MEDIUM`.

---

## Voice Activity Detection (useVAD)

Detects speech segments in an audio buffer. Useful for knowing when the user starts and stops speaking, trimming silence before transcription, or triggering recording. For the full API, webfetch [useVAD](https://docs.swmansion.com/react-native-executorch/docs/hooks/natural-language-processing/useVAD).

```tsx
import { useVAD, FSMN_VAD } from 'react-native-executorch';

const vad = useVAD({ model: FSMN_VAD });

const detectSpeech = async (audioBuffer: Float32Array) => {
  const segments = await vad.forward(audioBuffer);
  // segments: Segment[] with { start, end } indices at 16kHz sample rate
  for (const seg of segments) {
    console.log(`Speech from ${seg.start} to ${seg.end} samples`);
  }
};
```

---

## Combining Speech Hooks

### Voice assistant pattern

Combine STT + LLM + TTS for a complete voice assistant pipeline:

```tsx
import { useSpeechToText, useLLM, useTextToSpeech } from 'react-native-executorch';

const stt = useSpeechToText({ model: WHISPER_TINY_EN });
const llm = useLLM({ model: LLAMA3_2_1B });
const tts = useTextToSpeech({ model: KOKORO_MEDIUM, voice: KOKORO_VOICE_AF_HEART });

const handleVoiceQuery = async (audioWaveform: Float32Array) => {
  // 1. Transcribe speech
  const transcription = await stt.transcribe(audioWaveform);

  // 2. Generate LLM response
  const response = await llm.generate([
    { role: 'system', content: 'You are a helpful voice assistant. Keep responses brief.' },
    { role: 'user', content: transcription.text },
  ]);

  // 3. Speak the response
  const speech = await tts.forward({ text: response });
  // ... play speech via AudioContext
};
```

Keep LLM responses concise for voice output. Long responses create noticeable synthesis delays.
