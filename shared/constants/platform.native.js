// @flow
import {Dimensions, Platform, NativeModules} from 'react-native'
// Modules from the native part of the code. Differently named on android/ios
const nativeBridge = NativeModules.KeybaseEngine ||
NativeModules.ObjcEngine || {
  version: 'fallback',
  appVersionName: 'fallback',
  appVersionCode: 'fallback',
  usingSimulator: 'fallback',
  isDeviceSecure: 'fallback',
}
const isStoryBook = (NativeModules.Storybook && NativeModules.Storybook.isStorybook) || false
const version = nativeBridge.version
const appVersionName = nativeBridge.appVersionName
const appVersionCode = nativeBridge.appVersionCode
const isSimulator = nativeBridge.usingSimulator === '1'
// Currently this is given to us as a boolean, but no real documentation on this, so just in case it changes in the future.
// Android only field that tells us if there is a lock screen.
const isDeviceSecureAndroid: boolean = typeof nativeBridge.isDeviceSecure === 'boolean'
  ? nativeBridge.isDeviceSecure
  : nativeBridge.isDeviceSecure === 'true' || false

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
const isAndroidNewerThanM = parseInt(mobileOsVersion) > 22

const isIPhoneX =
  Platform.OS === 'ios' && !Platform.isPad && !Platform.isTVOS && Dimensions.get('window').height === 812

// isLargeScreen means you have at larger screen like iPhone 6,7 or Pixel
// See https://material.io/devices/
const isLargeScreen = Dimensions.get('window').height >= 667

export {
  appVersionCode,
  appVersionName,
  fileUIName,
  isAndroid,
  isAndroidNewerThanM,
  isDarwin,
  isDeviceSecureAndroid,
  isElectron,
  isIOS,
  isIPhoneX,
  isLargeScreen,
  isLinux,
  isMobile,
  isSimulator,
  isStoryBook,
  isWindows,
  mobileOsVersion,
  runMode,
  version,
}
