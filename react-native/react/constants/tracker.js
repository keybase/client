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
export const registerIdentifyUi = 'tracker:registerIdentifyUi'
export const markActiveIdentifyUi = 'tracker:markActive'

export const updateUsername = 'tracker:updateUsername'
export const updateUserInfo = 'tracker:updateUserInfo'

export const setProofs = 'tracker:setProofs'
export const updateProof = 'tracker:updateProof'

export const updateProofState = 'tracker:udpateProofState'

export const onCloseFromActionBar = 'tracker:onCloseFromActionBar'
export const onCloseFromHeader = 'tracker:onCloseFromHeader'

export const onRefollow = 'tracker:onRefollow'
export const onUnfollow = 'tracker:onUnfollow'
export const onFollowHelp = 'tracker:onFollowHelp'
export const onFollowChecked = 'tracker:onFollowChecked'
