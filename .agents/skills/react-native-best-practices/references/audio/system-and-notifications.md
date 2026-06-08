# System Integration, Notifications, and Testing

Patterns for audio session management, system events, media notifications, permissions, and testing in react-native-audio-api.

For core concepts, see **`audio.md`**.
For recording-specific setup, see **`recording.md`**.

---

## AudioManager

`AudioManager` is the bridge between your app and the system audio layer. It configures iOS audio sessions, manages permissions, and provides system event listeners.

Import it as a static class:

```tsx
import { AudioManager } from 'react-native-audio-api';
```

---

## iOS Audio Session Configuration

Configure the audio session before creating an `AudioContext` or starting recording. Session options control how your app interacts with other audio sources on the device.

```tsx
AudioManager.setAudioSessionOptions({
  iosCategory: 'playback',
  iosMode: 'default',
  iosOptions: ['defaultToSpeaker', 'allowBluetoothA2DP'],
});
```

### Session Categories

| Category | Use case |
|----------|----------|
| `playback` | Audio/music playback. Silences other apps. |
| `record` | Recording only. No playback output. |
| `playAndRecord` | Simultaneous recording and playback. Use for voice chat, live monitoring, or graph processing with recorder. |
| `ambient` | Non-essential audio (game sounds). Mixes with other apps, respects silent switch. |
| `soloAmbient` | Like ambient but silences other apps. Default system category. |
| `multiRoute` | Routes audio to multiple outputs simultaneously. |

### Session Modes

| Mode | Use case |
|------|----------|
| `default` | Standard mode for most use cases |
| `voiceChat` | Optimized for voice communication |
| `videoChat` | Optimized for video calls |
| `gameChat` | Optimized for game voice chat |
| `measurement` | Audio measurement and analysis |
| `moviePlayback` | Movie/video playback |
| `spokenAudio` | Podcasts, audiobooks |
| `voicePrompt` | Short voice prompts |
| `videoRecording` | Video recording |

### Session Options

| Option | Effect |
|--------|--------|
| `mixWithOthers` | Mix audio with other apps instead of silencing them |
| `duckOthers` | Lower other apps' volume while yours plays |
| `defaultToSpeaker` | Route playback to speaker instead of earpiece |
| `allowBluetoothA2DP` | Enable high-quality Bluetooth audio output |
| `allowBluetoothHFP` | Enable Bluetooth hands-free profile (for calls) |
| `allowAirPlay` | Enable AirPlay streaming |
| `interruptSpokenAudioAndMixWithOthers` | Interrupt spoken audio from other apps, then mix |
| `overrideMutedMicrophoneInterruption` | Continue recording when another app mutes the mic |

### Session Activation

```tsx
const success = await AudioManager.setAudioSessionActivity(true);
// Deactivate when done
AudioManager.setAudioSessionActivity(false);
```

### Disabling Internal Session Management

If you use another audio library alongside react-native-audio-api, disable internal session management and handle it yourself:

```tsx
AudioManager.disableSessionManagement(); // call before creating AudioContext
```

Calling `setAudioSessionOptions` or `setAudioSessionActivity` later re-enables internal management.

---

## System Events

### Audio Interruptions

Other apps or system events (phone calls, alarms) can interrupt your audio session:

```tsx
AudioManager.observeAudioInterruptions(true);

const sub = AudioManager.addSystemEventListener('interruption', (event) => {
  if (event.type === 'began') {
    // Another app took audio focus. Pause your playback.
  } else if (event.type === 'ended' && event.shouldResume) {
    // Interruption ended and you can resume.
    audioContext.resume();
  }
});

// Cleanup
sub.remove();
```

On Android, pass an `AudioFocusType` to `observeAudioInterruptions` to set the native audio focus:

```tsx
AudioManager.observeAudioInterruptions('gain'); // 'gain' | 'gainTransient' | 'gainTransientExclusive' | 'gainTransientMayDuck'
```

### Volume Changes

```tsx
AudioManager.observeVolumeChanges(true);

const sub = AudioManager.addSystemEventListener('volumeChange', (event) => {
  console.log('New volume:', event.value);
});
```

### Route Changes

Detect headphone connects/disconnects and other routing changes:

```tsx
const sub = AudioManager.addSystemEventListener('routeChange', (event) => {
  console.log('Route changed:', event.reason);
  // Reasons: 'NewDeviceAvailable', 'OldDeviceUnavailable', 'CategoryChange', etc.
});
```

### Audio Ducking

```tsx
const sub = AudioManager.addSystemEventListener('duck', () => {
  // System is asking your app to lower volume
});
```

---

## Active Session Reclaiming (iOS, Experimental)

In some cases, the system never sends an `interruption ended` event. Enable active reclaiming to automatically reactivate the session when other audio stops:

```tsx
AudioManager.activelyReclaimSession(true);
```

---

## Device Information

```tsx
const sampleRate = AudioManager.getDevicePreferredSampleRate();

const devices = await AudioManager.getDevicesInfo();
// { availableInputs, availableOutputs, currentInputs (iOS), currentOutputs (iOS) }
```

---

## PlaybackNotificationManager

Manages system-level media notifications with playback controls (play, pause, next, previous, seek).

```tsx
import { PlaybackNotificationManager } from 'react-native-audio-api';

// Show notification with metadata
await PlaybackNotificationManager.show({
  title: 'Song Title',
  artist: 'Artist Name',
  album: 'Album',
  duration: 240,
  state: 'playing',
});

// Listen for control actions
const playSub = PlaybackNotificationManager.addEventListener(
  'playbackNotificationPlay',
  () => {
    audioContext.resume();
    PlaybackNotificationManager.show({ state: 'playing' });
  }
);

const pauseSub = PlaybackNotificationManager.addEventListener(
  'playbackNotificationPause',
  () => {
    audioContext.suspend();
    PlaybackNotificationManager.show({ state: 'paused' });
  }
);

const seekSub = PlaybackNotificationManager.addEventListener(
  'playbackNotificationSeekTo',
  (event) => {
    // event.value is the seek position in seconds
    PlaybackNotificationManager.show({ elapsedTime: event.value });
  }
);

// Update progress
PlaybackNotificationManager.show({ elapsedTime: 60 });

// Cleanup
playSub.remove();
pauseSub.remove();
seekSub.remove();
await PlaybackNotificationManager.hide();
```

### Platform Differences

**iOS**: Notification controls only appear when an `AudioContext` is running. `show()`/`hide()` only update metadata. To fully hide controls, suspend or close the `AudioContext`. Elapsed time does not auto-update; set it manually on each state change.

**Android**: `show()`/`hide()` directly control notification visibility. Works independently of `AudioContext` state.

### Enable/Disable Controls

```tsx
await PlaybackNotificationManager.enableControl('nextTrack', true);
await PlaybackNotificationManager.enableControl('seekTo', false);
```

Available controls: `play`, `pause`, `stop`, `nextTrack`, `previousTrack`, `skipForward`, `skipBackward`, `seekTo`.

For PlaybackNotificationManager API details, webfetch the [PlaybackNotificationManager docs](https://docs.swmansion.com/react-native-audio-api/docs/system/playback-notification-manager).

---

## RecordingNotificationManager (Android Only)

Shows a system notification with pause/resume controls for recording.

```tsx
import { RecordingNotificationManager } from 'react-native-audio-api';

RecordingNotificationManager.show({
  title: 'Recording',
  contentText: 'Tap to pause',
  paused: false,
  smallIconResourceName: 'ic_mic',
  pauseIconResourceName: 'ic_pause',
  resumeIconResourceName: 'ic_play',
  color: 0xff6200,
});

const pauseSub = RecordingNotificationManager.addEventListener(
  'recordingNotificationPause',
  () => {
    recorder.pause();
    RecordingNotificationManager.show({ paused: true, contentText: 'Paused' });
  }
);

const resumeSub = RecordingNotificationManager.addEventListener(
  'recordingNotificationResume',
  () => {
    recorder.resume();
    RecordingNotificationManager.show({ paused: false, contentText: 'Recording...' });
  }
);

// Cleanup
pauseSub.remove();
resumeSub.remove();
RecordingNotificationManager.hide();
```

Resource names reference files in `res/drawable` without the extension (e.g., `photo.png` becomes `photo`).

For RecordingNotificationManager API details, webfetch the [RecordingNotificationManager docs](https://docs.swmansion.com/react-native-audio-api/docs/system/recording-notification-manager).

---

## Permissions

### Recording Permissions

```tsx
// Request (shows system dialog)
const status = await AudioManager.requestRecordingPermissions();
// 'Granted' | 'Denied' | 'Undetermined'

// Check without prompting
const status = await AudioManager.checkRecordingPermissions();
```

Throws an error if `NSMicrophoneUsageDescription` is missing from `Info.plist` (iOS).

### Notification Permissions

```tsx
const status = await AudioManager.requestNotificationPermissions();
```

---

## Testing with Mocks

react-native-audio-api provides a comprehensive mock implementation for unit testing without audio hardware.

### Setup

```tsx
// Option 1: Direct import
import { AudioContext, AudioRecorder } from 'react-native-audio-api/mock';

// Option 2: Module mock
jest.mock('react-native-audio-api', () =>
  require('react-native-audio-api/mock')
);
```

### Testing Audio Graphs

```tsx
import { AudioContext } from 'react-native-audio-api/mock';

it('should build an audio effect chain', () => {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  filter.type = 'lowpass';
  filter.frequency.value = 2000;
  gain.gain.value = 0.8;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  expect(filter.type).toBe('lowpass');
  expect(gain.gain.value).toBe(0.8);
});
```

### Testing Recording

```tsx
import { AudioRecorder, FileFormat } from 'react-native-audio-api/mock';

it('should record and stop', () => {
  const recorder = new AudioRecorder();
  recorder.enableFileOutput({ format: FileFormat.M4A });

  const start = recorder.start();
  expect(start.status).toBe('success');
  expect(recorder.isRecording()).toBe(true);

  const stop = recorder.stop();
  expect(stop.status).toBe('success');
  expect(recorder.isRecording()).toBe(false);
});
```

### Testing Context Lifecycle

```tsx
it('should manage context state', async () => {
  const ctx = new AudioContext();
  expect(ctx.state).toBe('running');

  await ctx.suspend();
  expect(ctx.state).toBe('suspended');

  await ctx.resume();
  expect(ctx.state).toBe('running');

  await ctx.close();
  expect(ctx.state).toBe('closed');
});
```

### Testing Offline Rendering

```tsx
import { OfflineAudioContext } from 'react-native-audio-api/mock';

it('should render offline', async () => {
  const offCtx = new OfflineAudioContext({
    numberOfChannels: 2,
    length: 44100,
    sampleRate: 44100,
  });

  const osc = offCtx.createOscillator();
  osc.connect(offCtx.destination);

  const buffer = await offCtx.startRendering();
  expect(buffer.numberOfChannels).toBe(2);
  expect(buffer.length).toBe(44100);
});
```

For the full mock API, webfetch the [testing docs](https://docs.swmansion.com/react-native-audio-api/docs/other/testing).

---

## References

- [AudioManager](https://docs.swmansion.com/react-native-audio-api/docs/system/audio-manager)
- [PlaybackNotificationManager](https://docs.swmansion.com/react-native-audio-api/docs/system/playback-notification-manager)
- [RecordingNotificationManager](https://docs.swmansion.com/react-native-audio-api/docs/system/recording-notification-manager)
- [Testing](https://docs.swmansion.com/react-native-audio-api/docs/other/testing)
- [Compatibility](https://docs.swmansion.com/react-native-audio-api/docs/other/compatibility)
