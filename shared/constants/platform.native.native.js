// @flow
import {Platform} from 'react-native'
import {OS_ANDROID, OS_IOS} from './platform.shared'

const OS = Platform.OS === 'ios' ? OS_IOS : OS_ANDROID
const isMobile = true
const runMode = 'staging' // TODO: make this properly set by env variables

export {
  OS,
  isMobile,
  runMode,
}
