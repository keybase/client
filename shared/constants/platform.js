/* @flow */

// $FlowIssue with platform specific files
import * as native from './platform.native'
import * as shared from './platform.shared'

import type {OSType} from './platform.shared'

export const OS: OSType = native.OS
export const isMobile = native.isMobile
export const runMode = native.runMode

export default shared
