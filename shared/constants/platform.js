// @flow
// $FlowIssue
import * as specific from './platform.specific'
import * as shared from './platform.shared'
import type {OSType} from './platform.shared'

const OS: OSType = specific.OS
const isMobile = specific.isMobile
const isIOS = OS === shared.OS_IOS
const isAndroid = OS === shared.OS_ANDROID
const runMode = specific.runMode

export default shared

export {
  OS,
  isMobile,
  isAndroid,
  isIOS,
  runMode,
}
