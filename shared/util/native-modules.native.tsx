import {NativeModules as RNNativeModules} from 'react-native'

type NativeModulesType = {
  KeybaseEngine: {
    androidAppColorSchemeChanged?: (mode: 'system' | 'alwaysDark' | 'alwaysLight' | '') => void
    androidGetInitialBundleFromNotification?: () => Promise<any>
    androidGetInitialShareFileUrl?: () => Promise<string>
    androidGetInitialShareText?: () => Promise<string>
    androidIsDeviceSecure: '0' | '1'
    androidIsTestDevice: '0' | '1'
    androidSetApplicationIconBadgeNumber?: (n: number) => void
    appVersionCode: string
    appVersionName: string
    darkModeSupported: '0' | '1'
    fsCacheDir: string
    fsDownloadDir: string
    guiConfig: string
    reset: () => void
    serverConfig: string
    start: () => void
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
  // android only start
  ScreenProtector?: {
    setSecureFlagSetting: (s: boolean) => Promise<boolean>
    getSecureFlagSetting: () => Promise<boolean>
  }
  ShareFiles?: {
    shareText: (text: string, mimeType: string) => Promise<boolean>
    share: (text: string, mimeType: string) => Promise<boolean>
  }
  NativeSettings?: {
    open: () => void
  }
  // android only end

  // ios only start
  PushPrompt?: {
    getHasShownPushPrompt: () => Promise<boolean>
  }
  KBNativeLogger?: {
    log: (tagsAndLogs: Array<[string, string]>) => void
    dump: (prefix: string) => Promise<Array<string>>
  }
  // ios only end
}

const NativeModules = RNNativeModules as NativeModulesType
export {NativeModules}
