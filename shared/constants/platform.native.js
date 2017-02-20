// @flow
import {Platform} from 'react-native'
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
}
