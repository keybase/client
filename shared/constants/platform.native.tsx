import {Dimensions, Platform} from 'react-native'
import Constants from 'expo-constants'
import * as ScreenCapture from 'expo-screen-capture'
import * as RPCGen from '@/constants/types/rpc-gen'
import {
  androidIsDeviceSecure,
  fsCacheDir,
} from 'react-native-kb'

export {version, androidIsTestDevice, uses24HourClock, fsCacheDir} from 'react-native-kb'

export const isNewArch = !!global.__turboModuleProxy

const screenProtectorConfigKey = 'ui.screenprotector'

export const getSecureFlagSetting = async (): Promise<boolean> => {
  if (!isAndroid) return false
  try {
    const value = await RPCGen.configGuiGetValueRpcPromise({path: screenProtectorConfigKey})
    // Default to secure (true) if not explicitly set
    if (!value.isNull && value.b === false) return false
    return true
  } catch {
    return true
  }
}

export const setSecureFlagSetting = async (secure: boolean): Promise<boolean> => {
  if (!isAndroid) return false
  try {
    if (secure) {
      await ScreenCapture.preventScreenCaptureAsync('screenprotector')
    } else {
      await ScreenCapture.allowScreenCaptureAsync('screenprotector')
    }
    await RPCGen.configGuiSetValueRpcPromise({
      path: screenProtectorConfigKey,
      value: {b: secure, isNull: false},
    })
    return true
  } catch {
    return false
  }
}
// Currently this is given to us as a boolean, but no real documentation on this, so just in case it changes in the future.
// Android only field that tells us if there is a lock screen.
export const isDeviceSecureAndroid = androidIsDeviceSecure
export const runMode = 'prod'
export const pathSep = '/'

export const isIOS = Platform.OS === 'ios'
export const isAndroid = !isIOS
export const isMobile = true
export const isTablet = Platform.OS === 'ios' && Platform.isPad
export const isPhone = !isTablet

export const isDarwin = false
export const isElectron = false
export const isLinux = false
export const isWindows = false
export const isMac = false

export const getModKey = (_e: {metaKey: boolean; ctrlKey: boolean}): boolean => {
  return false
}
export const isDebuggingInChrome = typeof location !== 'undefined'

export const defaultUseNativeFrame = true
export const fileUIName = 'File Explorer'
export const mobileOsVersion = Platform.Version
const mobileOsVersionNumber = typeof mobileOsVersion === 'string' ? parseInt(mobileOsVersion) : -1
export const isAndroidNewerThanM = isAndroid && mobileOsVersionNumber > 22
export const isAndroidNewerThanN = isAndroid && mobileOsVersionNumber >= 26
export const shortcutSymbol = ''
export const realDeviceName = Constants.deviceName ?? ''

const windowHeight = Dimensions.get('window').height
// isLargeScreen means you have at larger screen like iPhone 6,7 or Pixel
// See https://material.io/devices/
export const isLargeScreen = windowHeight >= 667

const _dir = `${fsCacheDir}/Keybase`
export const logFileDir = _dir
export const pprofDir = _dir
export const serverConfigFileName = `${_dir}/keybase.app.serverConfig`

export const downloadFolder = ''
