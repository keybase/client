import {NativeModules as RNNativeModules, Platform} from 'react-native'
const isIOS = Platform.OS === 'ios'

type NativeModulesType = {
  KeybaseEngine: {
    androidAppColorSchemeChanged?: (mode: 'system' | 'alwaysDark' | 'alwaysLight' | '') => void
    androidGetInitialBundleFromNotification?: () => Promise<any>
    androidGetInitialShareFileUrl?: () => Promise<string>
    androidGetInitialShareText?: () => Promise<string>
    androidSetApplicationIconBadgeNumber?: (n: number) => void
    reset: () => void
    start: () => void

    androidIsDeviceSecure: boolean
    androidIsTestDevice: boolean
    appVersionCode: string
    appVersionName: string
    darkModeSupported: boolean
    fsCacheDir: string
    fsDownloadDir: string
    guiConfig: string
    serverConfig: string
    uses24HourClock: boolean
    version: string
  }
  GoJSIBridge: {
    install: () => void
  }
  Utils: {
    getDefaultCountryCode: () => Promise<string>
    // android only
    androidGetRegistrationToken?: () => Promise<string>
    // android only
    androidAddCompleteDownload?: (o: {
      description: string
      mime: string
      path: string
      showNotification: boolean
      title: string
    }) => Promise<void>
    // android only
    androidUnlink?: (path: string) => Promise<void>
  }
  LogSend: {
    logSend: (
      status: string,
      feedback: string,
      sendLogs: boolean,
      sendMaxBytes: boolean,
      traceDir: string,
      cpuProfileDir: string
    ) => Promise<string>
  }
  NativeLogger?: {
    log: (tagsAndLogs: Array<[string, string]>) => void
    dump: (prefix: string) => Promise<Array<string>>
  }
  // android only start
  AndroidScreenProtector?: {
    setSecureFlagSetting: (s: boolean) => Promise<boolean>
    getSecureFlagSetting: () => Promise<boolean>
  }
  AndroidShareFiles?: {
    shareText: (text: string, mimeType: string) => Promise<boolean>
    share: (text: string, mimeType: string) => Promise<boolean>
  }
  AndroidSettings?: {
    open: () => void
  }
  // android only end

  // ios only start
  IOSPushPrompt?: {
    getHasShownPushPrompt: () => Promise<boolean>
  }
  // ios only end
}

const NativeModules = RNNativeModules as NativeModulesType

// sanity check
if (!NativeModules.KeybaseEngine) {
  throw new Error('Missing native KeybaseEngine')
}
if (!NativeModules.GoJSIBridge) {
  throw new Error('Missing native GoJSIBridge')
}
if (!NativeModules.Utils) {
  throw new Error('Missing native Utils')
}
if (!NativeModules.LogSend) {
  throw new Error('Missing native LogSend')
}
if (!NativeModules.NativeLogger) {
  throw new Error('Missing native NativeLogger')
}
if (isIOS) {
  if (!NativeModules.IOSPushPrompt) {
    throw new Error('Missing native IOSPushPrompt')
  }
} else {
  if (!NativeModules.AndroidScreenProtector) {
    throw new Error('Missing native AndroidScreenProtector')
  }
  if (!NativeModules.AndroidShareFiles) {
    throw new Error('Missing native AndroidShareFiles')
  }
  if (!NativeModules.AndroidSettings) {
    throw new Error('Missing native AndroidSettings')
  }
}

export {NativeModules}
