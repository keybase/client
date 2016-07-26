// @flow

import {envVarDebugJson} from './local-debug'

const dumbFilterJson = (envVarDebugJson() || {}).dumbFilter || ''
export const dumbFilter = dumbFilterJson || ''

// the following only apply to mobile:
export const dumbIndex = 10
export const dumbFullscreen = false
