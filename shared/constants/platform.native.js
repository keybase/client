// @flow
import {Platform, NativeModules} from 'react-native'
// Modules from the native part of the code. Differently named on android/ios
const nativeBridge = NativeModules.KeybaseEngine || NativeModules.ObjcEngine
const version = nativeBridge.version
const appVersionName = nativeBridge.appVersionName
const appVersionCode = nativeBridge.appVersionCode

const runMode = 'prod'
const isIOS = Platform.OS === 'ios'
const isAndroid = !isIOS
const isMobile = true

const isDarwin = false
const isElectron = false
const isLinux = false
const isWindows = false
const fileUIName = 'File Explorer'

export {
  fileUIName,
  isAndroid,
  isDarwin,
  isElectron,
  isIOS,
  isLinux,
  isMobile,
  isWindows,
  runMode,
  version,
  appVersionName,
  appVersionCode,
}
