import {NativeModules, Platform, NativeEventEmitter} from 'react-native'

const LINKING_ERROR =
  `The package 'react-native-kb' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ios: "- You have run 'pod install'\n", default: ''}) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n'

const isTurboModuleEnabled = global.__turboModuleProxy != null

const KbModule = isTurboModuleEnabled ? require('./NativeKb').default : NativeModules['Kb']

const Kb = KbModule
  ? KbModule
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR)
        },
      }
    )

export const getDefaultCountryCode = (): Promise<string> => {
  return Kb.getDefaultCountryCode()
}

export const logSend = (
  status: string,
  feedback: string,
  sendLogs: boolean,
  sendMaxBytes: boolean,
  traceDir: string,
  cpuProfileDir: string
): Promise<string> => {
  return Kb.logSend(status, feedback, sendLogs, sendMaxBytes, traceDir, cpuProfileDir)
}

export const install = () => {
  Kb.install()
}
export const iosGetHasShownPushPrompt = (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    return Kb.iosGetHasShownPushPrompt()
  }
  return Promise.resolve(false)
}

export const androidOpenSettings = () => {
  if (Platform.OS === 'android') {
    Kb.androidOpenSettings()
  }
}

export const androidSetSecureFlagSetting = (s: boolean): Promise<boolean> => {
  if (Platform.OS === 'android') {
    return Kb.androidSetSecureFlagSetting(s)
  }
  return Promise.resolve(false)
}

export const androidGetSecureFlagSetting = (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    return Kb.androidGetSecureFlagSetting()
  }
  return Promise.resolve(false)
}

export const androidShareText = (text: string, mimeType: string): Promise<boolean> => {
  if (Platform.OS === 'android') {
    return Kb.androidShareText(text, mimeType)
  }
  return Promise.resolve(false)
}

export const androidShare = (text: string, mimeType: string): Promise<boolean> => {
  if (Platform.OS === 'android') {
    return Kb.androidShare(text, mimeType)
  }
  return Promise.resolve(false)
}

export const androidUnlink = (path: string): Promise<void> => {
  if (Platform.OS === 'android') {
    return Kb.androidUnlink(path)
  }
  return Promise.reject()
}

export const androidAddCompleteDownload = (o: {
  description: string
  mime: string
  path: string
  showNotification: boolean
  title: string
}): Promise<void> => {
  if (Platform.OS === 'android') {
    return Kb.androidAddCompleteDownload(o)
  }
  return Promise.reject()
}

export const androidAppColorSchemeChanged = (mode: 'system' | 'alwaysDark' | 'alwaysLight' | ''): void => {
  if (Platform.OS === 'android') {
    Kb.androidAppColorSchemeChanged(mode)
  }
}

export const checkPushPermissions = (): Promise<boolean> => {
  return Kb.checkPushPermissions()
}

export const requestPushPermissions = (): Promise<boolean> => {
  return Kb.requestPushPermissions()
}

export const getRegistrationToken = (): Promise<string> => {
  return Kb.getRegistrationToken()
}

export const setApplicationIconBadgeNumber = (n: number): void => {
  Kb.setApplicationIconBadgeNumber(n)
}

export const getInitialNotification = (): Promise<object | null> => {
  return Kb.getInitialNotification()
}

export const removeAllPendingNotificationRequests = (): void => {
  Kb.removeAllPendingNotificationRequests()
}

export const addNotificationRequest = (config: {body: string; id: string}): Promise<void> => {
  return Kb.addNotificationRequest(config)
}

// Hardware keyboard events
const hwKeyPressedListeners: any[] = []

export const onHWKeyPressed = (callback: (event: {pressedKey: string}) => void): void => {
  const emitter = getNativeEmitter()
  const listener = emitter.addListener('hardwareKeyPressed', callback)
  hwKeyPressedListeners.push(listener)
}

export const removeOnHWKeyPressed = (): void => {
  hwKeyPressedListeners.forEach(listener => listener?.remove())
  hwKeyPressedListeners.length = 0
}

// Paste image events (iOS)
let pasteImageListenerCount = 0

export const registerPasteImage = (callback: (uris: Array<string>) => void): (() => void) => {
  if (Platform.OS !== 'ios') return () => {}
  const emitter = getNativeEmitter()
  const listener = emitter.addListener('onPasteImage', (event: {uris: Array<string>}) => {
    callback(event.uris)
  })
  pasteImageListenerCount++
  Kb.setEnablePasteImage(true)
  return () => {
    listener.remove()
    pasteImageListenerCount--
    Kb.setEnablePasteImage(pasteImageListenerCount > 0)
  }
}

export const engineReset = (): void => {
  return Kb.engineReset()
}
export const notifyJSReady = (): void => {
  return Kb.notifyJSReady()
}
export const shareListenersRegistered = (): void => {
  return Kb.shareListenersRegistered()
}

export const processVideo = (path: string): Promise<string> => {
  return Kb.processVideo(path)
}
export const getNativeEmitter = () => {
  return new NativeEventEmitter(Kb as any)
}

const KBC = Kb.getTypedConstants()
export const androidIsDeviceSecure: boolean = KBC.androidIsDeviceSecure
export const androidIsTestDevice: boolean = KBC.androidIsTestDevice
export const appVersionCode: string = KBC.appVersionCode
export const appVersionName: string = KBC.appVersionName
export const darkModeSupported: boolean = KBC.darkModeSupported
export const fsCacheDir: string = KBC.fsCacheDir
export const fsDownloadDir: string = KBC.fsDownloadDir
export const guiConfig: string = KBC.guiConfig
export const serverConfig: string = KBC.serverConfig
export const uses24HourClock: boolean = KBC.uses24HourClock
export const version: string = KBC.version
