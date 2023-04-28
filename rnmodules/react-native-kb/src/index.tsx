import {NativeModules, Platform, NativeEventEmitter} from 'react-native'

const LINKING_ERROR =
  `The package 'react-native-kb' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ios: "- You have run 'pod install'\n", default: ''}) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n'

// @ts-expect-error
const isTurboModuleEnabled = global.__turboModuleProxy != null

const KbModule = isTurboModuleEnabled ? require('./NativeKb').default : NativeModules.Kb

console.log('aaa', isTurboModuleEnabled, Object.keys(NativeModules.Kb), Object.keys(KbModule))

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

export const getDefaultCountryCode = (): string => {
  return Kb.getDefaultCountryCode()
}

export const logSend = (
  status: string,
  feedback: string,
  sendLogs: boolean,
  sendMaxBytes: boolean,
  traceDir: string,
  cpuProfileDir: string
): string => {
  return Kb.logSend(status, feedback, sendLogs, sendMaxBytes, traceDir, cpuProfileDir)
}

export const iosGetHasShownPushPrompt = (): boolean => {
  if (Platform.OS === 'ios') {
    return Kb.iosGetHasShownPushPrompt()
  }
  return false
}

export const androidOpenSettings = () => {
  if (Platform.OS === 'android') {
    Kb.androidOpenSettings()
  }
}

export const androidSetSecureFlagSetting = (s: boolean): boolean => {
  if (Platform.OS === 'android') {
    return Kb.androidSetSecureFlagSetting(s)
  }
  return false
}

export const androidGetSecureFlagSetting = (): boolean => {
  if (Platform.OS === 'android') {
    return Kb.androidGetSecureFlagSetting()
  }
  return false
}

export const androidShareText = (text: string, mimeType: string): boolean => {
  if (Platform.OS === 'android') {
    return Kb.androidShareText(text, mimeType)
  }
  return false
}

export const androidShare = (text: string, mimeType: string): boolean => {
  if (Platform.OS === 'android') {
    return Kb.androidShare(text, mimeType)
  }
  return false
}

export const androidCheckPushPermissions = (): boolean => {
  if (Platform.OS === 'android') {
    return Kb.androidCheckPushPermissions()
  }
  return false
}
export const androidRequestPushPermissions = (): boolean => {
  if (Platform.OS === 'android') {
    return Kb.androidRequestPushPermissions()
  }
  return false
}
export const androidGetRegistrationToken = (): string => {
  if (Platform.OS === 'android') {
    return Kb.androidGetRegistrationToken()
  }
  return ''
}

export const androidUnlink = (path: string): void => {
  if (Platform.OS === 'android') {
    return Kb.androidUnlink(path)
  }
}

export const androidAddCompleteDownload = (o: {
  description: string
  mime: string
  path: string
  showNotification: boolean
  title: string
}): void => {
  if (Platform.OS === 'android') {
    return Kb.androidAddCompleteDownload(o)
  }
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

export const androidGetInitialBundleFromNotification = (): any => {
  if (Platform.OS === 'android') {
    return Kb.androidGetInitialBundleFromNotification()
  }
  return null
}
export const androidGetInitialShareFileUrl = (): string => {
  if (Platform.OS === 'android') {
    return Kb.androidGetInitialShareFileUrl()
  }
  return ''
}
export const androidGetInitialShareText = (): string => {
  if (Platform.OS === 'android') {
    return Kb.androidGetInitialShareText()
  }
  return ''
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
