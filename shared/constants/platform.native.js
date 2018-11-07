// @flow
import {Dimensions, Platform, NativeModules} from 'react-native'
import {cachesDirectoryPath} from '../util/file.native'

const nativeBridge = NativeModules.KeybaseEngine || {
  isDeviceSecure: 'fallback',
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

export const runMode = 'prod'
export const isIOS = Platform.OS === 'ios'
export const isAndroid = !isIOS
export const isMobile = true
export const isDarwin = false
export const isElectron = false
export const isLinux = false
export const isWindows = false
export const fileUIName = 'File Explorer'
export const mobileOsVersion = Platform.Version
export const isAndroidNewerThanM = isAndroid && parseInt(mobileOsVersion) > 22
export const isAndroidNewerThanN = isAndroid && parseInt(mobileOsVersion, 10) >= 26

export const isIPhoneX =
  Platform.OS === 'ios' && !Platform.isPad && !Platform.isTVOS && Dimensions.get('window').height >= 812

// isLargeScreen means you have at larger screen like iPhone 6,7 or Pixel
// See https://material.io/devices/
export const isLargeScreen = Dimensions.get('window').height >= 667

const _dir = `${cachesDirectoryPath}/Keybase`
export const logFileDir = _dir
export const logFileName = `${_dir}/rn.log`
export const pprofDir = _dir
export const serverConfigFileName = `${_dir}/keybase.app.serverConfig`
