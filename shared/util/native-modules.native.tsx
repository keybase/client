import {NativeModules as RNNativeModules, Platform} from 'react-native'
export const isIOS = Platform.OS === 'ios'

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
    androidAddCompleteDownload?: (o: {
      description: string
      mime: string
      path: string
      showNotification: boolean
      title: string
    }) => Promise<void>
    androidUnlink?: (path: string) => Promise<void>
  }
  // android only end
}

const NativeModules = RNNativeModules as NativeModulesType

// sanity check
if (!NativeModules.KeybaseEngine) {
  throw new Error('Missing native KeybaseEngine')
}
if (!NativeModules.GoJSIBridge) {
  throw new Error('Missing native GoJSIBridge')
}

export {NativeModules}
