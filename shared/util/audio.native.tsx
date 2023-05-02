import {Audio, InterruptionModeIOS, InterruptionModeAndroid} from 'expo-av'

// we MUST only setup recording while recording else audio gets routed to the earpiece on ios
export const setupAudioMode = async (allowRecord: boolean) => {
  return Audio.setAudioModeAsync({
    allowsRecordingIOS: allowRecord,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    playThroughEarpieceAndroid: false,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: false,
    staysActiveInBackground: true,
  })
}
