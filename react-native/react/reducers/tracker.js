/* @flow */

// $FlowIssue platform files
import {showAllTrackers} from '../local-debug'

import * as Constants from '../constants/tracker'
import * as ConfigConstants from '../constants/config'

import {normal, warning, error, checking} from '../constants/tracker'
import {metaNew, metaUpgraded, metaUnreachable, metaDeleted} from '../constants/tracker'

import {identify} from '../constants/types/keybase_v1'

import type {UserInfo} from '../tracker/bio.render'
import type {Proof} from '../tracker/proofs.render'
import type {SimpleProofState, SimpleProofMeta} from '../constants/tracker'

import type {Identity, RemoteProof, LinkCheckResult, ProofState, TrackDiff, TrackDiffType, ProofStatus, TrackSummary} from '../constants/types/flow-types'
import type {Action} from '../constants/types/flux'

export type TrackerState = {
  serverActive: boolean,
  trackerState: SimpleProofState,
  trackerMessage: ?string,
  username: string,
  shouldFollow: ?boolean,
  reason: string,
  userInfo: UserInfo,
  proofs: Array<Proof>,
  closed: boolean,
  trackToken: ?string,
  lastTrack: ?TrackSummary
}

export type State = {
  serverStarted: boolean,
  trackers: {[key: string]: TrackerState},
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
    serverActive: false,
    username,
    trackerState: initialProofState,
    trackerMessage: null,
    shouldFollow: true,
    proofs: [],
    reason: '', // TODO: get the reason
    closed: true,
    lastTrack: null,
    trackToken: null,
    userInfo: {
      fullname: '', // TODO get this info,
      followersCount: -1,
      followingCount: -1,
      followsYou: false,
      avatar: null,
      location: '' // TODO: get this information
    }
  }
}

function updateUserState (state: TrackerState, action: Action): TrackerState {
  let shouldFollow: boolean
  switch (action.type) {
    case Constants.onFollowChecked:
      if (action.payload == null) {
        return state
      }
      shouldFollow = action.payload.shouldFollow

      return {
        ...state,
        shouldFollow
      }
    case Constants.updateTrackToken:
      return {
        ...state,
        trackToken: action.payload && action.payload.trackToken
      }
    case Constants.userUpdated:
      return {
        ...state,
        closed: true
      }
    case Constants.onCloseFromActionBar:
      return {
        ...state,
        closed: true
      }
    case Constants.onCloseFromHeader:
      return {
        ...state,
        closed: true,
        shouldFollow: false // don't follow if they close x out the window
      }
    case Constants.onRefollow:
      return {
        ...state,
        closed: true
      }
    case Constants.onUnfollow: // TODO
      return state

    case Constants.updateProofState:
      const proofs = state.proofs
      const allOk: boolean = proofs.reduce((acc, p) => acc && p.state === normal, true)
      const anyWarnings: boolean = proofs.reduce((acc, p) => acc || p.state === warning, false)
      const anyError: boolean = proofs.reduce((acc, p) => acc || p.state === error, false)
      const anyPending: boolean = proofs.reduce((acc, p) => acc || p.state === checking, false)

      // Helper to reduce boiler plate.
      const anyMetaCheck = (v: SimpleProofMeta) => ((acc, p) => acc || p.meta === v)

      const anyDeletedProofs : boolean = proofs.reduce(anyMetaCheck(metaDeleted), false)
      const anyUnreachableProofs : boolean = proofs.reduce(anyMetaCheck(metaUnreachable), false)
      const anyUpgradedProofs : boolean = proofs.reduce(anyMetaCheck(metaUpgraded), false)
      const anyNewProofs: boolean = proofs.reduce(anyMetaCheck(metaNew), false)

      return {
        ...state,
        shouldFollow: deriveShouldFollow(allOk),
        trackerState: deriveTrackerState(allOk, anyWarnings, anyError, anyPending, anyDeletedProofs, anyUnreachableProofs),
        trackerMessage: deriveTrackerMessage(state.username, allOk, anyDeletedProofs, anyUnreachableProofs, anyUpgradedProofs, anyNewProofs)
      }

    case Constants.setProofs:
      if (!action.payload) {
        return state
      }

      const identity: Identity = action.payload.identity

      return {
        ...state,
        proofs: identity.proofs.map(rp => remoteProofToProof(rp.proof))
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
      // The server wasn't active and now it is, we reset closed state
      const closed = !state.serverActive && serverActive ? true : state.closed
      return {
        ...state,
        serverActive,
        closed
      }

    case Constants.reportLastTrack:
      return {
        ...state,
        lastTrack: action.payload && action.payload.track
      }

    case Constants.decideToShowTracker:
      if (showAllTrackers) {
        return {
          ...state,
          closed: false
        }
      }

      // The tracker is already open
      if (!state.closed) {
        return state
      }

      if (state.trackerState !== checking && (state.trackerState !== normal || !state.lastTrack)) {
        return {
          ...state,
          closed: false
        }
      }
      return state

    default:
      return state
  }
}

export default function (state: State = initialState, action: Action): State {
  const username: string = (action.payload && action.payload.username) ? action.payload.username : ''
  const trackerState = username ? state.trackers[username] : null
  switch (action.type) {
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

  if (trackerState) {
    const newTrackerState = updateUserState(trackerState, action)
    if (newTrackerState === trackerState) {
      return state
    }

    return {
      ...state,
      trackers: {
        ...state.trackers,
        [username]: newTrackerState
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
        if (!action.payload) {
          return state
        }
        const username = action.payload.username

        return {
          ...state,
          trackers: {
            ...state.trackers,
            [username]: initialTrackerState(username)
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
  if (diff && remoteDiff && diff.type === identify.TrackDiffType.none && remoteDiff === identify.TrackDiffType.none) {
    return normal
  }

  const statusName: ?string = mapTagToName(identify.ProofState, proofState)
  switch (statusName) {
    case 'ok':
      return normal
    case 'tempFailure':
    case 'superseded':
    case 'posted':
      return warning
    case 'revoked':
    case 'permFailure':
      return error
    case 'looking':
    case 'none':
    default:
      return checking
  }
}

function trackDiffToSimpleProofMeta (diff: TrackDiffType): ?SimpleProofMeta {
  /* eslint-disable key-spacing*/
  return {
    [identify.TrackDiffType.none]         : null,
    [identify.TrackDiffType.error]        : null,
    [identify.TrackDiffType.clash]        : null,
    [identify.TrackDiffType.revoked]      : null,
    [identify.TrackDiffType.upgraded]     : metaUpgraded,
    [identify.TrackDiffType.new]          : metaNew,
    [identify.TrackDiffType.remotefail]   : null,
    [identify.TrackDiffType.remoteworking]: null,
    [identify.TrackDiffType.remotechanged]: null,
    [identify.TrackDiffType.neweldest]    : null
  }[diff]
  /* eslint-enable key-spacing*/
}

function proofStatusToSimpleProofMeta (status: ProofStatus): ?SimpleProofMeta {
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

function remoteProofToProof (rp: RemoteProof, lcr: ?LinkCheckResult): Proof {
  const proofState: SimpleProofState = lcr && proofStateToSimpleProofState(lcr.proofResult.state, lcr.diff, lcr.remoteDiff) || checking

  let proofType: string = ''
  if (rp.proofType === identify.ProofType.genericWebSite || rp.proofType === identify.ProofType.dns) {
    proofType = 'web'
  } else {
    proofType = mapTagToName(identify.ProofType, rp.proofType) || ''
  }

  let diffMeta: ?SimpleProofMeta
  let statusMeta: ?SimpleProofMeta
  if (lcr && lcr.diff && lcr.diff.type != null) {
    diffMeta = trackDiffToSimpleProofMeta(lcr.diff.type)
  }
  if (lcr && lcr.proofResult && lcr.proofResult.status != null) {
    statusMeta = proofStatusToSimpleProofMeta(lcr.proofResult.status)
  }

  return {
    state: proofState,
    id: rp.sigID,
    meta: statusMeta || diffMeta,
    type: proofType,
    color: stateToColor(proofState),
    name: rp.displayMarkup,
    humanUrl: (lcr && lcr.hint && lcr.hint.humanUrl)
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
): SimpleProofState {
  if (anyWarnings || anyUnreachableProofs) {
    return warning
  } else if (anyError || anyDeletedProofs) {
    return error
  } else if (anyPending) {
    return checking
  } else if (allOk) {
    return normal
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
  if (anyDeletedProofs) {
    return `${username} deleted some proofs.`
  } else if (anyUnreachableProofs) {
    return `Some of ${username}’s proofs are compromised or have changed.`
  } else if (anyUpgradedProofs) {
    return `${username} added some identity proofs.`
  } else if (allOk) {
    return null
  }
}

function deriveShouldFollow (allOk: boolean): boolean {
  return allOk
}
