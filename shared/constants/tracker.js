/* @flow */

import type {identifyUiDisplayTLFCreateWithInviteRpc} from './types/flow-types'
import type {TypedAction} from './types/flux'
import type {Folder} from '../folders/list'

// Simple state of the overall proof result
export type SimpleProofState = 'normal' | 'warning' | 'error' | 'checking' | 'revoked'
export type SimpleProofMeta = 'upgraded' | 'new' | 'unreachable' | 'pending' | 'deleted' | 'none' | 'ignored'

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
export const metaIgnored: SimpleProofMeta = 'ignored'

// Actions
export const registerIdentifyUi = 'tracker:registerIdentifyUi'
export const markActiveIdentifyUi = 'tracker:markActive'

export const updateUsername = 'tracker:updateUsername'
export const updateUserInfo = 'tracker:updateUserInfo'
export const updateReason = 'tracker:updateReason'
export const updateEldestKidChanged = 'tracker:updateEldestKidChanged'
export const updateTrackers = 'tracker:updateTrackers'

export const setProofs = 'tracker:setProofs'
export const updateProof = 'tracker:updateProof'

export const updateProofState = 'tracker:updateProofState'

export const reportLastTrack = 'tracker:reportLastTrack'

export const setNeedTrackTokenDismiss = 'tracker:setNeedTrackTokenDismiss'
export const remoteDismiss = 'tracker:remoteDismiss'
export const onClose = 'tracker:onClose'
export type OnClose = TypedAction<'tracker:onClose', void, void>

export const onFollow = 'tracker:onFollow'
export const onRefollow = 'tracker:onRefollow'
export const onUnfollow = 'tracker:onUnfollow'
export const onError = 'tracker:onError'
export const onWaiting = 'tracker:onWaiting'

export const showTracker = 'tracker:showTracker'
export const updateTrackToken = 'tracker:updateTrackToken'

export const userUpdated = 'tracker:userUpdated'

export const startTimer = 'tracker:startTimer'
export const stopTimer = 'tracker:stopTimer'

export const rpcUpdateTimerSeconds = 60 * 1000

export const showNonUser = 'tracker:showNonUser'

export const updateFolders = 'tracker:updateFolders'
export type UpdateFolders = TypedAction<'tracker:updateFolders', {username: string, tlfs: Array<Folder>}, void>

export type ShowNonUser = TypedAction<'tracker:showNonUser', identifyUiDisplayTLFCreateWithInviteRpc.param, void>

export const pendingIdentify = 'tracker:pendingIdentify'
export type PendingIdentify = TypedAction<'tracker:pendingIdentify', {username: string, pending: boolean}, void>

export type NonUserActions = ShowNonUser | OnClose | PendingIdentify | UpdateFolders

export type TrackingInfo = {
  username: string,
  fullname: string,
  followsYou: boolean,
  following: boolean
}
