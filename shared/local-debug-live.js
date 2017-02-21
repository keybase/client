// @flow
import {envVarDebugJson, isTesting} from './local-debug'

/*
 * This file is used for setting the dumbFilter & related settings
 * on both desktop and native
 */

// Shared settings
const dumbFilterJson = (envVarDebugJson() || {}).dumbFilter || 'avatar'
const dumbFilterOverride = '' // Changing this will apply during a hot reload session

export const dumbFilter = dumbFilterOverride || dumbFilterJson

// Mobile only settings
export const dumbIndex = 9
export const dumbFullscreen = isTesting
