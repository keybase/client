# Audio Recording

Patterns for recording audio in React Native using `AudioRecorder` from react-native-audio-api.

For core concepts, see **`audio.md`**.
For connecting recordings to the audio graph, see **`effects-and-analysis.md`**.

---

## AudioRecorder Overview

`AudioRecorder` captures audio from the system microphone. It supports three modes of operation:

1. **File recording**: Writes audio data directly to the filesystem
2. **Data callback**: Emits raw audio buffers for streaming or custom processing
3. **Graph processing**: Connects the recorder to an `AudioContext` for real-time processing through the audio graph

All three modes can be active simultaneously.

### Singleton Pattern

Create one `AudioRecorder` instance and reuse it. Switching between recorder instances has noticeable impact on device performance, memory, and battery.

```tsx
import { AudioRecorder } from 'react-native-audio-api';

export const recorder = new AudioRecorder();
```

---

## Permissions

Recording requires microphone permissions. Configure them during app setup and request at runtime before starting.

### Expo Setup

```json
{
  "plugins": [
    [
      "react-native-audio-api",
      {
        "iosMicrophonePermission": "This app needs microphone access to record audio.",
        "androidPermissions": ["android.permission.RECORD_AUDIO"]
      }
    ]
  ]
}
```

### Runtime Permission Request

```tsx
import { AudioManager } from 'react-native-audio-api';

const status = await AudioManager.requestRecordingPermissions();
if (status !== 'Granted') {
  console.warn('Microphone permission denied');
  return;
}
```

Use `AudioManager.checkRecordingPermissions()` to check without prompting.

---

## File Recording

The simplest mode. Audio is encoded and written directly to disk.

```tsx
import { AudioRecorder, AudioManager } from 'react-native-audio-api';

AudioManager.setAudioSessionOptions({
  iosCategory: 'record',
  iosMode: 'default',
  iosOptions: [],
});

const recorder = new AudioRecorder();
recorder.enableFileOutput(); // default: M4A, high quality, cache directory

// Start recording
const permissions = await AudioManager.requestRecordingPermissions();
if (permissions !== 'Granted') return;

await AudioManager.setAudioSessionActivity(true);
const startResult = recorder.start();
if (startResult.status === 'error') {
  console.warn(startResult.message);
  return;
}
console.log('Recording to:', startResult.path);

// Stop recording
const stopResult = recorder.stop();
if (stopResult.status === 'success') {
  console.log('File:', stopResult.path, 'Duration:', stopResult.duration);
}
AudioManager.setAudioSessionActivity(false);
```

### File Output Configuration

```tsx
import { FileFormat, FilePreset, FileDirectory } from 'react-native-audio-api';

recorder.enableFileOutput({
  format: FileFormat.M4A,      // M4A | Wav | Caf | Flac
  preset: FilePreset.High,     // Lossless | High | Medium | Low
  directory: FileDirectory.Document, // Document | Cache (default)
  subDirectory: 'recordings',
  fileNamePrefix: 'voice_note',
  channelCount: 1,
});
```

### File Format Guide

| Format | Best for | Notes |
|--------|----------|-------|
| `M4A` | General recording, voice notes | Default. Good compression, wide compatibility |
| `Wav` | Lossless capture | Large files, use with `Lossless` preset |
| `Caf` | iOS lossless capture | Apple-specific container |
| `Flac` | High quality with compression | Lossless compression, smaller than WAV |

### Preset Guide

| Preset | Use case |
|--------|----------|
| `Lossless` | Maximum quality, large files. Only with WAV or CAF |
| `High` | Music, high-quality voice. Near-lossless perception |
| `Medium` | Voice notes, podcasts. Good quality/size balance |
| `Low` | Quick notes, diagnostics. Small files, speech-only |

### Custom Preset

```tsx
recorder.enableFileOutput({
  format: FileFormat.M4A,
  preset: {
    bitRate: 128000,
    sampleRate: 44100,
    bitDepth: 16,
    iosQuality: IOSAudioQuality.High,
    flacCompressionLevel: FlacCompressionLevel.L5,
  },
});
```

### File Name Override

```tsx
const result = recorder.start({ fileNameOverride: `session_${sessionId}` });
```

### Disable File Output

```tsx
recorder.disableFileOutput(); // finalizes current file if recording is active
```

---

## Data Callback

Delivers raw audio buffers periodically. Useful for streaming, speech-to-text, or custom processing on the JS thread.

```tsx
const sampleRate = 16000;

recorder.onAudioReady(
  {
    sampleRate,
    bufferLength: sampleRate * 0.1, // 100ms chunks
    channelCount: 1,
  },
  ({ buffer, numFrames, when }) => {
    // buffer is an AudioBuffer with PCM data
    // numFrames: number of audio frames in this chunk
    // when: timestamp relative to recording start
  }
);

// Clean up when done
recorder.clearOnAudioReady();
```

The `sampleRate`, `bufferLength`, and `channelCount` are preferred values. Actual values may differ depending on hardware capabilities.

---

## Graph Processing

Connects the recorder to the audio graph through a `RecorderAdapterNode` for real-time processing with effects, analysis, or worklets.

```tsx
import { AudioRecorder, AudioContext, AudioManager } from 'react-native-audio-api';

AudioManager.setAudioSessionOptions({
  iosCategory: 'playAndRecord',
  iosMode: 'default',
  iosOptions: [],
});

const recorder = new AudioRecorder();
const audioContext = new AudioContext();

const adapter = audioContext.createRecorderAdapter();
const gain = audioContext.createGain();

// Build the graph: recorder → adapter → gain → destination
adapter.connect(gain);
gain.connect(audioContext.destination);
recorder.connect(adapter);

await AudioManager.setAudioSessionActivity(true);
await audioContext.resume();
recorder.start();
```

Use `playAndRecord` session category when both recording and playback are needed simultaneously.

### Disconnect

```tsx
recorder.disconnect(); // disconnects from the audio graph
```

---

## Pause and Resume

```tsx
recorder.pause();    // pauses without finalizing the file
recorder.resume();   // resumes from where it paused
```

### State Queries

```tsx
recorder.isRecording(); // true if actively recording
recorder.isPaused();    // true if paused
recorder.getCurrentDuration(); // current recording duration (file output only)
```

---

## Error Handling

```tsx
recorder.onError((error) => {
  console.error('Recording error:', error.message);
});

// Clean up
recorder.clearOnError();
```

---

## Background Recording

To record while the app is in the background, configure platform permissions:

### Expo

```json
{
  "plugins": [
    [
      "react-native-audio-api",
      {
        "iosBackgroundMode": true,
        "iosMicrophonePermission": "Microphone access for recording.",
        "androidPermissions": [
          "android.permission.RECORD_AUDIO",
          "android.permission.FOREGROUND_SERVICE",
          "android.permission.FOREGROUND_SERVICE_MICROPHONE"
        ],
        "androidForegroundService": true,
        "androidFSTypes": ["microphone"]
      }
    ]
  ]
}
```

For bare React Native setup details, webfetch the [AudioRecorder docs](https://docs.swmansion.com/react-native-audio-api/docs/inputs/audio-recorder).

---

## References

- [AudioRecorder](https://docs.swmansion.com/react-native-audio-api/docs/inputs/audio-recorder)
- [Getting started (permissions)](https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/getting-started)
- [Expo plugin options](https://docs.swmansion.com/react-native-audio-api/docs/other/audio-api-plugin)
