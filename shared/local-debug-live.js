// @flow
import {envVarDebugJson} from './local-debug'

const dumbFilterJson = (envVarDebugJson() || {}).dumbFilter || ''
const dumbFilterOverride = '' // to override during a hot reload session

export const dumbFilter = dumbFilterOverride || dumbFilterJson

// the following only apply to mobile:
export const dumbIndex = 30
export const dumbFullscreen = false
