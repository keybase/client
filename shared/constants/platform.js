// @flow
// $FlowIssue
import * as specific from './platform.specific'
import * as shared from './platform.shared'
import type {OSType} from './platform.shared'

const OS: OSType = specific.OS
const isMobile = specific.isMobile
const runMode = specific.runMode

export default shared

export {
  OS,
  isMobile,
  runMode,
}
