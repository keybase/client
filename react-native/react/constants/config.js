'use strict'
/* @flow */

export type NavState = 'navStartingUp' | 'navNeedsRegistration' | 'navNeedsLogin' | 'navLoggedIn' | 'navErrorStartingUp'

// Constants
export const navStartingUp = 'navStartingUp'
export const navNeedsRegistration = 'navNeedsRegistration'
export const navNeedsLogin = 'navNeedsLogin'
export const navLoggedIn = 'navLoggedIn'
export const navErrorStartingUp = 'navErrorStartingUp'

// Actions
export const startupLoading = 'Config:startupLoading'
export const startupLoaded = 'Config:startupLoaded'

export const devConfigLoading = 'Config:devConfigLoading'
export const devConfigLoaded = 'Config:devConfigLoaded'
export const devConfigUpdate = 'Config:devConfigUpdate'
export const devConfigSaved = 'Config:devConfigSaved'
