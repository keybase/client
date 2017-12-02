// @flow

/*
 * This file is used for setting the dumbFilter & related settings on native
 */

// Shared settings
const dumbFilterJson = ''
const dumbFilterOverride = '' // Changing this will apply during a hot reload session

export const dumbFilter: string = dumbFilterOverride || dumbFilterJson
export const dumbFullscreen: boolean = false

// Mobile only settings
export const dumbIndex: number = 0
