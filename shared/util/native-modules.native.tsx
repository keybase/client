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
  }
  GoJSIBridge: {
    install: () => void
  }
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
