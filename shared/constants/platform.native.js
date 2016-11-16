// @flow
import {Platform} from 'react-native'
const runMode = 'staging' // TODO: make this properly set by env variables
const isIOS = Platform.OS === 'ios'
const isAndroid = !isIOS
const isMobile = true

const isDarwin = false
const isElectron = false
const isLinux = false
const isWindows = false

export {
  isAndroid,
  isDarwin,
  isElectron,
  isIOS,
  isLinux,
  isMobile,
  isWindows,
  runMode,
}
