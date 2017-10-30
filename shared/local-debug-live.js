// @flow

/*
 * This file is used for setting the dumbFilter & related settings on native
 */

// Shared settings
const dumbFilterJson = ''
const dumbFilterOverride = '' // Changing this will apply during a hot reload session

export const dumbFilter = dumbFilterOverride || dumbFilterJson

// Mobile only settings
export const dumbIndex = 0
