import {Linking} from 'react-native'

// The URL that launched the app, handed out once per run. The navigator mounts again on every
// account switch, and a launch link followed a second time would replay it: a share above all.
let launchURLTaken = false
export const takeLaunchURL = async (): Promise<string | undefined> => {
  if (launchURLTaken) return undefined
  launchURLTaken = true
  try {
    return (await Linking.getInitialURL()) ?? undefined
  } catch {
    return undefined
  }
}
