// @flow
import {mapValues} from 'lodash'

import type {Folder} from '../folders/list'
import type {FriendshipUserInfo} from '../profile/friendships'
import type {PlatformsExpandedType} from '../constants/types/more'
import type {Time} from '../constants/types/flow-types'
import type {TypedAction} from './types/flux'
import type {identifyUiDisplayTLFCreateWithInviteRpcParam} from './types/flow-types'

const cachedIdentifyGoodUntil = 1000 * 60 * 60

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
export const resetProofs = 'tracker:resetProofs'
export const updateProof = 'tracker:updateProof'
export const updateZcash = 'tracker:updateZcash'
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

export const startTimer = 'tracker:startTimer'
export const stopTimer = 'tracker:stopTimer'

export const rpcUpdateTimerSeconds = 60 * 1000

export const showNonUser = 'tracker:showNonUser'

export const updateFolders = 'tracker:updateFolders'
export type UpdateFolders = TypedAction<'tracker:updateFolders', {username: string, tlfs: Array<Folder>}, void>

export type ShowNonUser = TypedAction<'tracker:showNonUser', identifyUiDisplayTLFCreateWithInviteRpcParam, void>

export const pendingIdentify = 'tracker:pendingIdentify'
export type PendingIdentify = TypedAction<'tracker:pendingIdentify', {username: string, pending: boolean}, void>
export const cacheIdentify = 'tracker:cacheIdentify'
export type CacheIdentify = TypedAction<'tracker:cacheIdentify', {username: string, goodTill: number}, void>

export const identifyStarted = 'tracker:identifyStarted'
export type IdentifyStarted = TypedAction<'tracker:identifyStarted', void, {error: string}>

export const identifyFinished = 'tracker:identifyFinished'
export type IdentifyFinished = TypedAction<'tracker:identifyFinished', {username: string}, {username: string, error: string}>

export type NonUserActions = ShowNonUser | OnClose | PendingIdentify | UpdateFolders

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

export type UserInfo = {
  fullname: string,
  followersCount: number,
  followingCount: number,
  followsYou: boolean,
  bio: string,
  uid: string,
  avatar: ?string,
  location: string,
}

export type TrackerState = {
  type: 'tracker',
  error: ?string,
  eldestKidChanged: boolean,
  currentlyFollowing: boolean,
  lastAction: ?('followed' | 'refollowed' | 'unfollowed' | 'error'),
  serverActive: boolean,
  trackerState: SimpleProofState,
  username: string,
  shouldFollow: ?boolean,
  reason: ?string,
  trackers: Array<FriendshipUserInfo>,
  tracking: Array<FriendshipUserInfo>,
  waiting: boolean,
  userInfo: UserInfo,
  proofs: Array<Proof>,
  closed: boolean,
  hidden: boolean,
  trackToken: ?string,
  needTrackTokenDismiss: boolean,
  tlfs: Array<Folder>,
}

export type NonUserState = {
  type: 'nonUser',
  error: ?string,
  closed: boolean,
  hidden: boolean,
  name: string,
  reason: string,
  isPrivate: boolean,
  inviteLink: ?string,
}

export type TrackerOrNonUserState = TrackerState | NonUserState

function isLoading (state: ?TrackerOrNonUserState): boolean {
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

function bufferToNiceHexString (fingerPrint: Buffer): string {
  try {
    // $FlowIssue
    return fingerPrint.toString('hex').slice(-16).toUpperCase().match(/(.{4})(.{4})(.{4})(.{4})/).slice(1).join(' ')
  } catch (_) {
    return ''
  }
}

export type State = {
  cachedIdentifies: {[key: string]: number}, // good until unix timestamp
  pendingIdentifies: {[key: string]: boolean},
  serverStarted: boolean,
  timerActive: number,
  trackers: {[key: string]: TrackerOrNonUserState},
  tracking: Array<{
    username: string,
    fullname: string,
    followsYou: boolean,
    following: boolean,
  }>,
}

const transformProof = (p) => ({
  id: p.id,
  isTracked: p.isTracked,
  meta: p.meta,
  state: p.state,
  type: p.type,
})

const transformTracker = (state: TrackerOrNonUserState) => {
  if (state.type === 'tracker') {
    return {
      changed: state.changed,
      closed: state.closed,
      currentlyFollowing: state.currentlyFollowing,
      error: state.error,
      lastAction: state.lastAction,
      needTrackTokenDismiss: state.needTrackTokenDismiss,
      proofs: mapValues(state.proofs, transformProof),
      reason: state.reason,
      serverActive: state.serverActive,
      type: state.type,
      waiting: state.waiting,
    }
  } else {
    return {}
  }
}

const actionLoggerTransform = (state: State) => {
  const out = {
    ...state,
    trackers: mapValues(state.trackers, transformTracker),
    tracking: undefined,
  }
  return out
}

export {
  actionLoggerTransform,
  cachedIdentifyGoodUntil,
  bufferToNiceHexString,
  isLoading,
}
