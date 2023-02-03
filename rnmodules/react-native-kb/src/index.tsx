import {NativeModules, Platform, NativeEventEmitter} from 'react-native'

const LINKING_ERROR =
  `The package 'react-native-kb' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ios: "- You have run 'pod install'\n", default: ''}) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo managed workflow\n'

// @ts-ignore
const isTurboModuleEnabled: boolean = global.__turboModuleProxy != null

const KbModule = isTurboModuleEnabled ? require('./NativeKb').default : NativeModules.Kb

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

export const androidCheckPushPermissions = (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    return Kb.androidCheckPushPermissions()
  }
  return Promise.resolve(false)
}
export const androidRequestPushPermissions = (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    return Kb.androidRequestPushPermissions()
  }
  return Promise.resolve(false)
}
export const androidGetRegistrationToken = (): Promise<string> => {
  if (Platform.OS === 'android') {
    return Kb.androidGetRegistrationToken()
  }
  return Promise.resolve('')
}

export const androidUnlink = (path: string): Promise<void> => {
  if (Platform.OS === 'android') {
    return Kb.androidUnlink(path)
  }
  return Promise.resolve()
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
  return Promise.resolve()
}

export const androidAppColorSchemeChanged = (mode: 'system' | 'alwaysDark' | 'alwaysLight' | ''): void => {
  if (Platform.OS === 'android') {
    Kb.androidAppColorSchemeChanged(mode)
  }
}

export const androidSetApplicationIconBadgeNumber = (n: number): void => {
  if (Platform.OS === 'android') {
    Kb.androidSetApplicationIconBadgeNumber(n)
  }
}

export const androidGetInitialBundleFromNotification = (): Promise<any> => {
  if (Platform.OS === 'android') {
    return Kb.androidGetInitialBundleFromNotification()
  }
  return Promise.resolve(null)
}
export const androidGetInitialShareFileUrl = (): Promise<string> => {
  if (Platform.OS === 'android') {
    return Kb.androidGetInitialShareFileUrl()
  }
  return Promise.resolve('')
}
export const androidGetInitialShareText = (): Promise<string> => {
  if (Platform.OS === 'android') {
    return Kb.androidGetInitialShareText()
  }
  return Promise.resolve('')
}
export const engineReset = (): void => {
  return Kb.engineReset()
}
export const engineStart = (): void => {
  return Kb.engineStart()
}
export const getNativeEmitter = () => {
  return new NativeEventEmitter(Kb as any)
}

export const androidIsDeviceSecure: boolean = Kb.getConstants().androidIsDeviceSecure
export const androidIsTestDevice: boolean = Kb.getConstants().androidIsTestDevice
export const appVersionCode: string = Kb.getConstants().appVersionCode
export const appVersionName: string = Kb.getConstants().appVersionCode
export const darkModeSupported: boolean = Kb.getConstants().darkModeSupported
export const fsCacheDir: string = Kb.getConstants().fsCacheDir
export const fsDownloadDir: string = Kb.getConstants().fsDownloadDir
export const guiConfig: string = Kb.getConstants().guiConfig
export const serverConfig: string = Kb.getConstants().serverConfig
export const uses24HourClock: boolean = Kb.getConstants().uses24HourClock
export const version: string = Kb.getConstants().version
