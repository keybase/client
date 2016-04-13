/* @flow */

// Simple state of the overall proof result
export type SimpleProofState = 'normal' | 'warning' | 'error' | 'checking' | 'revoked'
export type SimpleProofMeta = 'upgraded' | 'new' | 'unreachable' | 'pending' | 'deleted' | 'none' | 'trackedBroken'

// Constants
export const normal: SimpleProofState = 'normal'
export const warning: SimpleProofState = 'warning'
export const error: SimpleProofState = 'error'
export const checking: SimpleProofState = 'checking'
export const revoked: SimpleProofState = 'revoked'

export const metaNone: SimpleProofMeta = 'none'
export const metaUpgraded: SimpleProofMeta = 'upgraded'
export const metaNew: SimpleProofMeta = 'new'
export const metaUnreachable: SimpleProofMeta = 'unreachable'
export const metaPending: SimpleProofMeta = 'pending'
export const metaDeleted: SimpleProofMeta = 'deleted'
export const metaTrackedBroken: SimpleProofMeta = 'trackedBroken'

// Actions
export const registerIdentifyUi = 'tracker:registerIdentifyUi'
export const markActiveIdentifyUi = 'tracker:markActive'

export const updateUsername = 'tracker:updateUsername'
export const updateUserInfo = 'tracker:updateUserInfo'
export const updateReason = 'tracker:updateReason'
export const updateEldestKidChanged = 'tracker:updateEldestKidChanged'

export const setProofs = 'tracker:setProofs'
export const updateProof = 'tracker:updateProof'

export const updateProofState = 'tracker:updateProofState'

export const reportLastTrack = 'tracker:reportLastTrack'

export const onUserTrackingLoading = 'tracker:userTrackingLoading'

export const onMaybeTrack = 'tracker:onMaybeTrack'
export const onClose = 'tracker:onClose'

export const onFollow = 'tracker:onFollow'
export const onRefollow = 'tracker:onRefollow'
export const onUnfollow = 'tracker:onUnfollow'
export const onError = 'tracker:onError'
export const onFollowHelp = 'tracker:onFollowHelp'
export const onFollowChecked = 'tracker:onFollowChecked'
export const onWaiting = 'tracker:onWaiting'

export const showTracker = 'tracker:showTracker'
export const updateTrackToken = 'tracker:updateTrackToken'

export const userUpdated = 'tracker:userUpdated'

export const startTimer = 'tracker:startTimer'
export const stopTimer = 'tracker:stopTimer'

export const rpcUpdateTimerSeconds = 60 * 1000
