// @flow
import {envVarDebugJson, isTesting} from './local-debug'

/*
 * This file is used for setting the dumbFilter & related settings
 * on both desktop and native
 */

// Shared settings
const dumbFilterJson = (envVarDebugJson() || {}).dumbFilter || ''
const dumbFilterOverride = '' // Changing this will apply during a hot reload session

export const dumbFilter = dumbFilterOverride || dumbFilterJson

// Mobile only settings
export const dumbIndex = 0
export const dumbFullscreen = isTesting
