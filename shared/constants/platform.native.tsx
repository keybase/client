import {Dimensions, Platform, NativeModules} from 'react-native'
import {cachesDirectoryPath} from '../util/file.native'
import * as iPhoneXHelper from 'react-native-iphone-x-helper'

const nativeBridge = NativeModules.KeybaseEngine || {
  isDeviceSecure: 'fallback',
  isTestDevice: false,
  serverConfig: '',
  usingSimulator: 'fallback',
  version: 'fallback',
}
export const version = nativeBridge.version
// Currently this is given to us as a boolean, but no real documentation on this, so just in case it changes in the future.
// Android only field that tells us if there is a lock screen.
export const isDeviceSecureAndroid: boolean =
  typeof nativeBridge.isDeviceSecure === 'boolean'
    ? nativeBridge.isDeviceSecure
    : nativeBridge.isDeviceSecure === 'true' || false
export const isTestDevice = nativeBridge.isTestDevice

export const isRemoteDebuggerAttached = typeof __REMOTEDEV__ !== 'undefined'
export const runMode = 'prod'
export const isIOS = Platform.OS === 'ios'
export const isAndroid = !isIOS
export const isMobile = true
export const isDarwin = false
export const isElectron = false
export const isLinux = false
export const isWindows = false
export const isMac = false
export const defaultUseNativeFrame = true
export const fileUIName = 'File Explorer'
export const mobileOsVersion = Platform.Version
const mobileOsVersionNumber = typeof mobileOsVersion === 'string' ? parseInt(mobileOsVersion) : -1
export const isAndroidNewerThanM = isAndroid && mobileOsVersionNumber > 22
export const isAndroidNewerThanN = isAndroid && mobileOsVersionNumber >= 26
export const shortcutSymbol = ''

export const isIPhoneX = iPhoneXHelper.isIphoneX()

// isLargeScreen means you have at larger screen like iPhone 6,7 or Pixel
// See https://material.io/devices/
export const isLargeScreen = Dimensions.get('window').height >= 667

const _dir = `${cachesDirectoryPath}/Keybase`
export const logFileDir = _dir
export const pprofDir = _dir
export const serverConfigFileName = `${_dir}/keybase.app.serverConfig`

// Noop on iOS.
// If we want to implement this on iOS it may be better to have iOS and android
// subscribe to changes from Go directly. Instead of having to rely on JS as the
// middle person.
export const appColorSchemeChanged =
  NativeModules.KeybaseEngine && isAndroid ? NativeModules.KeybaseEngine.appColorSchemeChanged : () => {}
