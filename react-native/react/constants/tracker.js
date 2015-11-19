'use strict'
/* @flow */

// Simple state of the overall proof result
export type SimpleProofState = 'normal' | 'warning' | 'error' | 'pending'

// Constants
export const normal: SimpleProofState = 'normal'
export const warning: SimpleProofState = 'warning'
export const error: SimpleProofState = 'error'
export const pending: SimpleProofState = 'pending'

// Actions
export const updateTracker = 'tracker:updateTracker'
