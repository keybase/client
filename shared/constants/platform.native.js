// @flow
import {Dimensions, Platform, NativeModules} from 'react-native'
// Modules from the native part of the code. Differently named on android/ios
const nativeBridge = NativeModules.KeybaseEngine || NativeModules.ObjcEngine
const version = nativeBridge.version
const appVersionName = nativeBridge.appVersionName
const appVersionCode = nativeBridge.appVersionCode
const isSimulator = nativeBridge.usingSimulator === '1'

const runMode = 'prod'
const isIOS = Platform.OS === 'ios'
const isAndroid = !isIOS
const isMobile = true

const isDarwin = false
const isElectron = false
const isLinux = false
const isWindows = false
const fileUIName = 'File Explorer'
const mobileOsVersion = Platform.Version

// isLargeScreen means you have at larger screen like iPhone 6,7 or Pixel
// See https://material.io/devices/
const isLargeScreen = Dimensions.get('window').height >= 667

export {
  appVersionCode,
  appVersionName,
  fileUIName,
  isAndroid,
  isDarwin,
  isElectron,
  isIOS,
  isLargeScreen,
  isLinux,
  isMobile,
  isSimulator,
  isWindows,
  mobileOsVersion,
  runMode,
  version,
}
