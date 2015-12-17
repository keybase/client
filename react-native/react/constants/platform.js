/* @flow */

// $FlowIssue with platform specific files
import * as native from './platform.native'
import * as shared from './platform.shared'

import type {OSType} from './platform.shared'

export const isDev: boolean = native.isDev
export const OS: OSType = native.OS
export const isMobile = native.isMobile
export const kbfsPath = native.kbfsPath

export default shared
