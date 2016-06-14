/* @flow */

import * as Constants from '../constants/tracker'
import * as CommonConstants from '../constants/common'

import {normal, warning, error, checking} from '../constants/tracker'
import {metaNew, metaUpgraded, metaUnreachable, metaDeleted, metaIgnored} from '../constants/tracker'

import {identify, identifyCommon, proveCommon} from '../constants/types/keybase-v1'

import type {UserInfo} from '../common-adapters/user-bio'
import type {Proof} from '../common-adapters/user-proofs'
import type {SimpleProofState, SimpleProofMeta, NonUserActions} from '../constants/tracker'

import type {Identity, RemoteProof, RevokedProof, LinkCheckResult, ProofState, TrackDiff, TrackDiffType, ProofStatus, TrackSummary} from '../constants/types/flow-types'
import type {Action} from '../constants/types/flux'

export type TrackerState = {
  type: 'tracker',
  eldestKidChanged: boolean,
  serverActive: boolean,
  trackerState: SimpleProofState,
  trackerMessage: ?string,
  username: string,
  shouldFollow: ?boolean,
  reason: ?string,
  waiting: boolean,
  userInfo: UserInfo,
  proofs: Array<Proof>,
  closed: boolean,
  hidden: boolean,
  trackToken: ?string,
  lastTrack: ?TrackSummary,
  needTrackTokenDismiss: boolean
}

export type NonUserState = {
  type: 'nonUser',
  closed: boolean,
  hidden: boolean,
  name: string,
  reason: string,
  isPrivate: boolean,
  inviteLink: ?string
}

type TrackerOrNonUserState = TrackerState | NonUserState

export type State = {
  serverStarted: boolean,
  trackers: {[key: string]: TrackerOrNonUserState},
  timerActive: number
}

const initialProofState = checking

const initialState: State = {
  serverStarted: false,
  timerActive: 0,
  trackers: {}
}

function initialTrackerState (username: string): TrackerState {
  return {
    type: 'tracker',
    eldestKidChanged: false,
    serverActive: false,
    username,
    trackerState: initialProofState,
    trackerMessage: null,
    shouldFollow: true,
    proofs: [],
    reason: null,
    closed: true,
    waiting: false,
    hidden: false,
    lastTrack: null,
    trackToken: null,
    lastAction: null,
    needTrackTokenDismiss: false,
    userInfo: {
      fullname: '', // TODO get this info,
      followersCount: -1,
      followingCount: -1,
      followsYou: false,
      bio: '',
      avatar: null,
      location: '' // TODO: get this information
    }
  }
}

function initialNonUserState (assertion: string): NonUserState {
  return {
    type: 'nonUser',
    closed: true,
    hidden: true,
    name: assertion,
    reason: '',
    isPrivate: false,
    inviteLink: null
  }
}

function updateNonUserState (state: NonUserState, action: NonUserActions): NonUserState {
  switch (action.type) {
    case Constants.showNonUser:
      if (action.error) {
        return state
      }

      return {
        ...state,
        closed: false,
        hidden: false,
        name: action.payload.assertion,
        serviceName: action.payload.socialAssertion.service,
        reason: `You opened ${action.payload.folderName}`,
        isPrivate: action.payload.isPrivate,
        inviteLink: action.payload.throttled ? null : action.payload.inviteLink
      }
    case Constants.onClose:
      return {
        ...state,
        closed: true,
        hidden: true
      }
    default:
      return state
  }
}

function updateUserState (state: TrackerState, action: Action): TrackerState {
  switch (action.type) {
    case Constants.updateReason:
      // In case the reason is null, let's use our existing reason
      return {
        ...state,
        reason: action.payload && action.payload.reason || state.reason
      }
    case Constants.updateTrackToken:
      return {
        ...state,
        trackToken: action.payload && action.payload.trackToken
      }
    case Constants.userUpdated:
      if (state.lastAction) {
        return state
      } else {
        return {
          ...state,
          closed: true,
          hidden: false
        }
      }
    case Constants.onClose:
      return {
        ...state,
        closed: true,
        hidden: false,
        lastAction: null,
        shouldFollow: false, // don't follow if they close x out the window
        needTrackTokenDismiss: !state.trackToken // did we have a track token at this time?
      }
    case Constants.setNeedTrackTokenDismiss:
      return {
        ...state,
        needTrackTokenDismiss: action.payload.needTrackTokenDismiss
      }
    case Constants.onWaiting:
      return {
        ...state,
        waiting: action.payload.waiting
      }
    case Constants.onFollow:
      return {
        ...state,
        lastAction: 'followed',
        reason: `You have followed ${state.username}.`
      }
    case Constants.onRefollow:
      return {
        ...state,
        lastAction: 'refollowed',
        reason: `You have re-followed ${state.username}.`
      }
    case Constants.onUnfollow:
      return {
        ...state,
        lastAction: 'unfollowed',
        reason: `You have unfollowed ${state.username}.`
      }
    case Constants.onError:
      return {
        ...state,
        lastAction: 'error',
        reason: 'There was an error updating your follow status.'
      }
    case Constants.updateEldestKidChanged: {
      return {
        ...state,
        eldestKidChanged: true
      }
    }
    case Constants.updateProofState:
      const proofs = state.proofs
      const allOk: boolean = proofs.reduce((acc, p) => acc && p.state === normal, true)
      const anyWarnings: boolean = proofs.reduce((acc, p) => acc || p.state === warning, false)
      const anyError: boolean = proofs.reduce((acc, p) => acc || p.state === error, false)
      const anyPending: boolean = proofs.reduce((acc, p) => acc || p.state === checking, false)

      // Helper to reduce boiler plate.
      const anyMetaCheck = (v: SimpleProofMeta) => ((acc, p) => acc || p.meta === v) // eslint-disable-line

      const anyDeletedProofs : boolean = proofs.reduce(anyMetaCheck(metaDeleted), false)
      const anyUnreachableProofs : boolean = proofs.reduce(anyMetaCheck(metaUnreachable), false)
      const anyUpgradedProofs : boolean = proofs.reduce(anyMetaCheck(metaUpgraded), false)
      const anyNewProofs: boolean = proofs.reduce(anyMetaCheck(metaNew), false)

      return {
        ...state,
        shouldFollow: deriveShouldFollow(allOk),
        trackerState: deriveTrackerState(allOk, anyWarnings, anyError, anyPending, anyDeletedProofs, anyUnreachableProofs, state.eldestKidChanged),
        trackerMessage: deriveTrackerMessage(state.username, allOk, anyDeletedProofs, anyUnreachableProofs, anyUpgradedProofs, anyNewProofs)
      }

    case Constants.setProofs:
      if (!action.payload) {
        return state
      }

      const identity: Identity = action.payload.identity
      return {
        ...state,
        proofs: [
          ...(identity.revokedDetails || []).map(rv => revokedProofToProof(rv)),
          ...identity.proofs.map(rp => remoteProofToProof(rp.proof))
        ]
      }

    case Constants.updateProof:
      if (!action.payload) {
        return state
      }

      const rp: RemoteProof = action.payload.remoteProof
      const lcr: LinkCheckResult = action.payload.linkCheckResult
      return {
        ...state,
        proofs: updateProof(state.proofs, rp, lcr)
      }

    case Constants.updateUserInfo:
      if (!action.payload) {
        return state
      }
      return {
        ...state,
        userInfo: action.payload.userInfo
      }

    case Constants.markActiveIdentifyUi:
      const serverActive = action.payload && !!action.payload.active || false
      return {
        ...state,
        serverActive
      }

    case Constants.reportLastTrack:
      return {
        ...state,
        lastTrack: action.payload && action.payload.track
      }

    case Constants.showTracker:
      return {
        ...state,
        closed: false,
        hidden: false
      }

    case Constants.remoteDismiss:
      return {
        ...state,
        closed: true
      }

    default:
      return state
  }
}

export default function (state: State = initialState, action: Action): State {
  const username: ?string = action.payload && action.payload.username
  const assertion: ?string = action.payload && action.payload.assertion
  const userKey = username || assertion

  const trackerOrNonUserState = userKey ? state.trackers[userKey] : null

  switch (action.type) {
    case CommonConstants.resetStore:
      return {
        ...state,
        trackers: {}
      }
    case Constants.startTimer:
      return {
        ...state,
        timerActive: state.timerActive + 1
      }
    case Constants.stopTimer:
      return {
        ...state,
        timerActive: state.timerActive - 1
      }
  }

  if (userKey && trackerOrNonUserState && trackerOrNonUserState.type === 'tracker') {
    const newTrackerState = updateUserState(trackerOrNonUserState, action)
    if (newTrackerState === trackerOrNonUserState) {
      return state
    }

    return {
      ...state,
      trackers: {
        ...state.trackers,
        [userKey]: newTrackerState
      }
    }
  } else if (userKey && trackerOrNonUserState && trackerOrNonUserState.type === 'nonUser') {
    const newNonUserState = updateNonUserState(trackerOrNonUserState, action)
    if (newNonUserState === trackerOrNonUserState) {
      return state
    }

    return {
      ...state,
      trackers: {
        ...state.trackers,
        [userKey]: newNonUserState
      }
    }
  } else {
    switch (action.type) {
      case Constants.registerIdentifyUi:
        const serverStarted = action.payload && !!action.payload.started || false
        return {
          ...state,
          serverStarted
        }
      case Constants.updateUsername:
        if (!action.payload || !userKey) {
          return state
        }

        return {
          ...state,
          trackers: {
            ...state.trackers,
            [userKey]: initialTrackerState(userKey)
          }
        }
      case Constants.showNonUser:
        if (!userKey) return state

        return {
          ...state,
          trackers: {
            ...state.trackers,
            [userKey]: updateNonUserState(initialNonUserState(userKey), action)
          }
        }
      default:
        return state
    }
  }
}

function mapTagToName (obj: any, tag: any): ?string {
  return Object.keys(obj).filter(x => obj[x] === tag)[0]
}

function stateToColor (state: SimpleProofState): string {
  if (state === normal) {
    return 'green'
  } else if (state === warning) {
    return 'yellow'
  } else if (state === error) {
    return 'red'
  }

  return 'gray'
}

function proofStateToSimpleProofState (proofState: ProofState, diff: ?TrackDiff, remoteDiff: ?TrackDiff): SimpleProofState {
  // If there is no difference in what we've tracked from the server or remote resource it's good.
  if (diff && remoteDiff && diff.type === identifyCommon.TrackDiffType.none && remoteDiff.type === identifyCommon.TrackDiffType.none) {
    return normal
  }

  const statusName: ?string = mapTagToName(proveCommon.ProofState, proofState)
  switch (statusName) {
    case 'ok':
      return normal
    case 'tempFailure':
    case 'superseded':
    case 'posted':
      return warning
    case 'revoked':
    case 'permFailure':
    case 'none':
      return error
    case 'looking':
    default:
      return checking
  }
}

function diffAndStatusMeta (diff: ?TrackDiffType, status: ?ProofStatus, isTracked: bool) : {diffMeta: ?SimpleProofMeta, statusMeta: ?SimpleProofMeta} {
  if (status && status !== proveCommon.ProofStatus.ok && isTracked) {
    return {
      diffMeta: metaIgnored,
      statusMeta: null
    }
  }

  return {
    diffMeta: trackDiffToSimpleProofMeta(diff),
    statusMeta: proofStatusToSimpleProofMeta(status)
  }

  function trackDiffToSimpleProofMeta (diff: TrackDiffType): ?SimpleProofMeta {
    if (!diff) {
      return null
    }

    return {
      [identify.TrackDiffType.none]: null,
      [identify.TrackDiffType.error]: null,
      [identify.TrackDiffType.clash]: null,
      [identify.TrackDiffType.revoked]: metaDeleted,
      [identify.TrackDiffType.upgraded]: metaUpgraded,
      [identify.TrackDiffType.new]: metaNew,
      [identify.TrackDiffType.remotefail]: null,
      [identify.TrackDiffType.remoteworking]: null,
      [identify.TrackDiffType.remotechanged]: null,
      [identify.TrackDiffType.neweldest]: null
    }[diff]
  }

  function proofStatusToSimpleProofMeta (status: ProofStatus): ?SimpleProofMeta {
    if (!status) {
      return null
    }
    // The full mapping between the proof status we get back from the server
    // and a simplified representation that we show the users.
    return {
      [identify.ProofStatus.none]: null,
      [identify.ProofStatus.ok]: null,
      [identify.ProofStatus.local]: null,
      [identify.ProofStatus.found]: null,
      [identify.ProofStatus.baseError]: null,
      [identify.ProofStatus.hostUnreachable]: metaUnreachable,
      [identify.ProofStatus.permissionDenied]: metaUnreachable,
      [identify.ProofStatus.failedParse]: metaUnreachable,
      [identify.ProofStatus.dnsError]: metaUnreachable,
      [identify.ProofStatus.authFailed]: metaUnreachable,
      [identify.ProofStatus.http500]: metaUnreachable,
      [identify.ProofStatus.timeout]: metaUnreachable,
      [identify.ProofStatus.internalError]: metaUnreachable,
      [identify.ProofStatus.baseHardError]: metaUnreachable,
      [identify.ProofStatus.notFound]: metaUnreachable,
      [identify.ProofStatus.contentFailure]: metaUnreachable,
      [identify.ProofStatus.badUsername]: metaUnreachable,
      [identify.ProofStatus.badRemoteId]: metaUnreachable,
      [identify.ProofStatus.textNotFound]: metaUnreachable,
      [identify.ProofStatus.badArgs]: metaUnreachable,
      [identify.ProofStatus.contentMissing]: metaUnreachable,
      [identify.ProofStatus.titleNotFound]: metaUnreachable,
      [identify.ProofStatus.serviceError]: metaUnreachable,
      [identify.ProofStatus.torSkipped]: null,
      [identify.ProofStatus.torIncompatible]: null,
      [identify.ProofStatus.http300]: metaUnreachable,
      [identify.ProofStatus.http400]: metaUnreachable,
      [identify.ProofStatus.httpOther]: metaUnreachable,
      [identify.ProofStatus.emptyJson]: metaUnreachable,
      [identify.ProofStatus.deleted]: metaDeleted,
      [identify.ProofStatus.serviceDead]: metaUnreachable,
      [identify.ProofStatus.badSignature]: metaUnreachable,
      [identify.ProofStatus.badApiUrl]: metaUnreachable,
      [identify.ProofStatus.unknownType]: metaUnreachable,
      [identify.ProofStatus.noHint]: metaUnreachable,
      [identify.ProofStatus.badHintText]: metaUnreachable
    }[status]
  }
}

// TODO Have the service give this information.
// Currently this is copied from the website: https://github.com/keybase/keybase/blob/658aa97a9ad63733444298353a528e7f8499d8b9/lib/mod/user_lol.iced#L971
/* eslint-disable no-multi-spaces */
function proofUrlToProfileUrl (proofType: number, name: string, key: ?string, humanUrl: ?string): string {
  switch (proofType) {
    case proveCommon.ProofType.dns            : return `http://${name}`
    case proveCommon.ProofType.genericWebSite : return `${key}://${name}`
    case proveCommon.ProofType.twitter        : return `https://twitter.com/${name}`
    case proveCommon.ProofType.github         : return `https://github.com/${name}`
    case proveCommon.ProofType.reddit         : return `https://reddit.com/user/${name}`
    case proveCommon.ProofType.coinbase       : return `https://coinbase.com/${name}`
    case proveCommon.ProofType.hackernews     : return `https://news.ycombinator.com/user?id=${name}`
    default: return humanUrl || ''
  }
}
/* eslint-enable no-multi-spaces */

function remoteProofToProofType (rp: RemoteProof): string {
  let proofType: string = ''
  if (rp.proofType === proveCommon.ProofType.genericWebSite) {
    proofType = rp.key
  } else {
    proofType = mapTagToName(proveCommon.ProofType, rp.proofType) || ''
  }
  return proofType
}

function revokedProofToProof (rv: RevokedProof): Proof {
  return {
    state: error,
    id: rv.proof.sigID,
    meta: metaDeleted,
    type: remoteProofToProofType(rv.proof),
    color: stateToColor(error),
    name: rv.proof.displayMarkup,
    humanUrl: '',
    profileUrl: '',
    isTracked: false
  }
}

function remoteProofToProof (rp: RemoteProof, lcr: ?LinkCheckResult): Proof {
  const proofState: SimpleProofState = lcr && proofStateToSimpleProofState(lcr.proofResult.state, lcr.diff, lcr.remoteDiff) || checking
  const isTracked = !!(lcr && lcr.diff && lcr.diff.type === identifyCommon.TrackDiffType.none && !lcr.breaksTracking)
  const {diffMeta, statusMeta} = diffAndStatusMeta(lcr && lcr.diff && lcr.diff.type, lcr && lcr.proofResult && lcr.proofResult.status, isTracked)
  const humanUrl = (lcr && lcr.hint && lcr.hint.humanUrl)

  return {
    state: proofState,
    id: rp.sigID,
    meta: statusMeta || diffMeta,
    type: remoteProofToProofType(rp),
    color: stateToColor(proofState),
    name: rp.displayMarkup,
    humanUrl: humanUrl,
    profileUrl: rp.displayMarkup && proofUrlToProfileUrl(rp.proofType, rp.displayMarkup, rp.key, humanUrl),
    isTracked
  }
}

function updateProof (proofs: Array<Proof>, rp: RemoteProof, lcr: LinkCheckResult): Array<Proof> {
  let found = false
  let updated = proofs.map(proof => {
    if (proof.id === rp.sigID) {
      found = true
      return remoteProofToProof(rp, lcr)
    }
    return proof
  })

  if (!found) {
    updated.push(remoteProofToProof(rp, lcr))
  }

  return updated
}

function deriveTrackerState (
  allOk: boolean,
  anyWarnings: boolean,
  anyError: boolean,
  anyPending: boolean,
  anyDeletedProofs : boolean,
  anyUnreachableProofs : boolean,
  eldestKidChanged: boolean
): SimpleProofState {
  if (eldestKidChanged) {
    return error
  }

  if (allOk) {
    return normal
  } else if (anyPending) {
    return checking
  } else if (anyWarnings || anyUnreachableProofs) {
    return warning
  } else if (anyError || anyDeletedProofs) {
    return error
  }

  return error
}

function deriveTrackerMessage (
  username: string,
  allOk: boolean,
  anyDeletedProofs : boolean,
  anyUnreachableProofs : boolean,
  anyUpgradedProofs : boolean,
  anyNewProofs: boolean
): ?string {
  if (allOk) {
    return null
  } else if (anyDeletedProofs || anyUnreachableProofs) {
    return `Some of ${username}’s proofs have changed since you last tracked them.`
  } else if (anyUpgradedProofs) {
    return `${username} added new proofs to their profile since you last tracked them.`
  }
}

function deriveShouldFollow (allOk: boolean): boolean {
  return allOk
}
