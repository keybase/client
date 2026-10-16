import {Linking} from 'react-native'

// The URL that launched the app, handed out once per run. The navigator mounts again on every
// account switch, and a launch link followed a second time would replay it: a share above all.
// A caller that only wants some links passes accept, and a link it turns down stays for the next.
let launchURL: Promise<string | undefined> | undefined
let launchURLTaken = false
export const takeLaunchURL = async (accept?: (url: string) => boolean): Promise<string | undefined> => {
  launchURL ??= Linking.getInitialURL().then(
    url => url ?? undefined,
    () => undefined
  )
  const url = await launchURL
  if (launchURLTaken || (url && accept && !accept(url))) return undefined
  launchURLTaken = true
  return url
}
