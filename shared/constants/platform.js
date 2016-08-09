// @flow
// $FlowIssue
import * as native from './platform.native'
import * as shared from './platform.shared'
import type {OSType} from './platform.shared'

const OS: OSType = native.OS
const isMobile = native.isMobile
const runMode = native.runMode

export default shared

export {
  OS,
  isMobile,
  runMode,
}
