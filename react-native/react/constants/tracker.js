/* @flow */

// Simple state of the overall proof result
export type SimpleProofState = 'normal' | 'warning' | 'error' | 'checking' | 'revoked'
export type SimpleProofMeta = 'upgraded' | 'new'

// Constants
export const normal: SimpleProofState = 'normal'
export const warning: SimpleProofState = 'warning'
export const error: SimpleProofState = 'error'
export const checking: SimpleProofState = 'checking'
export const revoked: SimpleProofState = 'revoked'

export const metaUpgraded: SimpleProofMeta = 'upgraded'
export const metaNew: SimpleProofMeta = 'new'

// Actions
export const registerIdentifyUi = 'tracker:registerIdentifyUi'
export const markActiveIdentifyUi = 'tracker:markActive'

export const updateUsername = 'tracker:updateUsername'
export const updateUserInfo = 'tracker:updateUserInfo'

export const setProofs = 'tracker:setProofs'
export const updateProof = 'tracker:updateProof'

export const updateProofState = 'tracker:updateProofState'

export const reportLastTrack = 'tracker:reportLastTrack'

export const onCloseFromActionBar = 'tracker:onCloseFromActionBar'
export const onCloseFromHeader = 'tracker:onCloseFromHeader'

export const onRefollow = 'tracker:onRefollow'
export const onUnfollow = 'tracker:onUnfollow'
export const onFollowHelp = 'tracker:onFollowHelp'
export const onFollowChecked = 'tracker:onFollowChecked'

export const decideToShowTracker = 'tracker:decideToShowTracker'

export const updateTrackToken = 'tracker:updateTrackToken'

export const userUpdated = 'tracker:userUpdated'

export const startTimer = 'tracker:startTimer'
export const stopTimer = 'tracker:stopTimer'

export const rpcUpdateTimerSeconds = 60 * 1000
