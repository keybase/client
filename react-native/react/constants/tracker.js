/* @flow */

// Simple state of the overall proof result
export type SimpleProofState = 'normal' | 'warning' | 'error' | 'pending' | 'deleted' | 'checking'
export type SimpleProofMeta = 'new' | 'deleted' | 'unreachable' | 'pending'

// Constants
export const normal: SimpleProofState = 'normal'
export const warning: SimpleProofState = 'warning'
export const error: SimpleProofState = 'error'
export const checking: SimpleProofState = 'checking'
export const pending: SimpleProofState = 'pending'
export const deleted: SimpleProofState = 'deleted'

export const metaNew: SimpleProofMeta = 'new'
export const metaDeleted: SimpleProofMeta = 'deleted'
export const metaUnreachable: SimpleProofMeta = 'unreachable'
export const metaPending: SimpleProofMeta = 'pending'

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
