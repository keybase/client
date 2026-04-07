import {setAudioModeAsync} from 'expo-audio'

// we MUST only setup recording while recording else audio gets routed to the earpiece on ios
export const setupAudioMode = async (allowRecord: boolean) => {
  return setAudioModeAsync({
    allowsRecording: allowRecord,
    interruptionMode: 'doNotMix',
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    shouldRouteThroughEarpiece: false,
  })
}
