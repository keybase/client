/* @flow */

import type {identifyUiDisplayTLFCreateWithInviteRpcParam} from './types/flow-types'
import type {TypedAction} from './types/flux'
import type {Folder} from '../folders/list'
import type {UserInfo} from '../common-adapters/user-bio'
import type {PlatformsExpandedType} from '../constants/types/more'
import type {Time} from '../constants/types/flow-types'

// Types
export type Proof = {
  id: string,
  type: PlatformsExpandedType,
  mTime: Time,
  meta: ?SimpleProofMeta,
  humanUrl: ?string,
  profileUrl: ?string,
  name: string,
  state: SimpleProofState,
  isTracked: bool,
}

export type OverviewProofState = {
  allOk: boolean,
  anyWarnings: boolean,
  anyError: boolean,
  anyPending: boolean,
  anyDeletedProofs: boolean,
  anyUnreachableProofs: boolean,
  anyUpgradedProofs: boolean,
  anyNewProofs: boolean,
  anyChanged: boolean,
}

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
export const updateBTC = 'tracker:updateBTC'
export const updatePGPKey = 'tracker:updatePGPKey'

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

export type ShowNonUser = TypedAction<'tracker:showNonUser', identifyUiDisplayTLFCreateWithInviteRpcParam, void>

export const pendingIdentify = 'tracker:pendingIdentify'
export type PendingIdentify = TypedAction<'tracker:pendingIdentify', {username: string, pending: boolean}, void>

export type NonUserActions = ShowNonUser | OnClose | PendingIdentify | UpdateFolders

export type TrackingInfo = {
  username: string,
  fullname: string,
  followsYou: boolean,
  following: boolean
}

export type TrackerState = {
  type: 'tracker',
  eldestKidChanged: boolean,
  currentlyFollowing: boolean,
  lastAction: ?('followed' | 'refollowed' | 'unfollowed' | 'error'),
  serverActive: boolean,
  trackerState: SimpleProofState,
  username: string,
  shouldFollow: ?boolean,
  reason: ?string,
  waiting: boolean,
  userInfo: UserInfo,
  proofs: Array<Proof>,
  closed: boolean,
  hidden: boolean,
  trackToken: ?string,
  needTrackTokenDismiss: boolean,
  tlfs: Array<Folder>,
}

export function isLoading (state: ?TrackerState): boolean {
  // TODO (mm) ideally userInfo should be null until we get a response from the server
  // Same with proofs (instead of empty array). So we know the difference between
  // not having data and having empty data.

  if (!state) {
    return true
  }

  // This logic is only valid for info on a keybase user (non user trackers are different)
  if (state.type !== 'tracker') {
    return false
  }

  return !state.userInfo || state.userInfo.followersCount === -1
}

export function bufferToNiceHexString (fingerPrint: Buffer): string {
  try {
    // $FlowIssue
    return fingerPrint.toString('hex').slice(-16).toUpperCase().match(/(.{4})(.{4})(.{4})(.{4})/).slice(1).join(' ')
  } catch (_) {
    return ''
  }
}
