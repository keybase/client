/* @flow */

// $FlowIssue platform files
import {showAllTrackers} from '../local-debug'

import * as Constants from '../constants/tracker'
import {normal, warning, error, checking} from '../constants/tracker'
import {metaNew, metaUpgraded} from '../constants/tracker'

import {identify} from '../constants/types/keybase_v1'

import type {UserInfo} from '../tracker/bio.render.types'
import type {Proof} from '../tracker/proofs.render.types'
import type {SimpleProofState, SimpleProofMeta} from '../constants/tracker'

import type {Identity, RemoteProof, LinkCheckResult, ProofState, identifyUi_TrackDiffType, TrackSummary} from '../constants/types/flow-types'
import type {Action} from '../constants/types/flux'

type TrackerState = {
  serverActive: boolean,
  proofState: SimpleProofState,
  username: ?string,
  shouldFollow: ?boolean,
  reason: string,
  userInfo: UserInfo,
  proofs: Array<Proof>,
  closed: boolean,
  lastTrack: ?TrackSummary
}

type State = {
  serverStarted: boolean,
  trackers: {[key: string]: TrackerState}
}

const initialProofState = checking

const initialState: State = {
  serverStarted: false,
  trackers: {}
}

function initialTrackerState (): TrackerState {
  return {
    serverActive: false,
    username: null,
    proofState: initialProofState,
    shouldFollow: true,
    proofs: [],
    reason: '', // TODO: get the reason
    closed: true,
    lastTrack: null,
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

// Just mutating the substate of the tracker
function updateUserState (state: TrackerState, action: Action): State | Object {
  switch (action.type) {
    case Constants.onFollowChecked:
      if (action.payload == null) {
        return state
      }
      const shouldFollow: boolean = action.payload.shouldFollow

      return {
        shouldFollow
      }
    case Constants.onCloseFromActionBar:
      return {
        closed: true
      }
    case Constants.onCloseFromHeader:
      return {
        closed: true,
        shouldFollow: false // don't follow if they close x out the window
      }
    case Constants.onRefollow: // TODO
      return state
    case Constants.onUnfollow: // TODO
      return state

    case Constants.updateProofState:
      const proofs = state.proofs
      const allOk: boolean = proofs.reduce((acc, p) => acc && p.state === normal, true)
      const anyWarnings: boolean = proofs.reduce((acc, p) => acc || p.state === warning, false)
      const anyError: boolean = proofs.reduce((acc, p) => acc || p.state === error, false)
      const anyPending: boolean = proofs.reduce((acc, p) => acc || p.state === checking, false)

      let proofState: SimpleProofState = error

      if (allOk) {
        proofState = normal
      } else if (anyWarnings) {
        proofState = warning
      } else if (anyError) {
        proofState = error
      } else if (anyPending) {
        proofState = checking
      }

      return {
        proofState
      }

    case Constants.setProofs:
      if (!action.payload) {
        return state
      }

      const identity: Identity = action.payload.identity

      return {
        proofs: identity.proofs.map(rp => remoteProofToProof(rp.proof))
      }

    case Constants.updateProof:
      if (!action.payload) {
        return state
      }

      const rp: RemoteProof = action.payload.remoteProof
      const lcr: LinkCheckResult = action.payload.linkCheckResult
      return {
        proofs: updateProof(state.proofs, rp, lcr)
      }

    case Constants.updateUserInfo:
      if (!action.payload) {
        return state
      }
      return {
        userInfo: action.payload.userInfo
      }

    case Constants.markActiveIdentifyUi:
      const serverActive = action.payload && !!action.payload.active || false
      // The server wasn't active and now it is, we reset closed state
      const closed = (showAllTrackers && !state.serverActive && serverActive) ? false : state.closed
      return {
        serverActive,
        closed
      }

    case Constants.reportLastTrack:
      return {
        lastTrack: action.payload && action.payload.track
      }

    case Constants.decideToShowTracker:
      // The tracker is already open
      if (!state.closed) {
        return state
      }

      if (state.proofState !== checking && (state.proofState !== normal || !state.lastTrack)) {
        return {
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

  if (trackerState) {
    const userState = updateUserState(trackerState, action)
    if (userState === trackerState) {
      return state
    }

    return {
      ...state,
      trackers: {
        ...state.trackers,
        // $FlowIssue computed
        [action.payload.username]: {
          ...trackerState,
          ...userState
        }
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
            // $FlowIssue computed
            [username]: initialTrackerState()
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

function proofStateToSimpleProofState (proofState: ProofState): SimpleProofState {
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

function trackDiffToSimpleProofMeta (diff: identifyUi_TrackDiffType): ?SimpleProofMeta {
  return {
    // $FlowIssue no computed
    [0]: null, /* 'NONE_0' */
    // $FlowIssue no computed
    [1]: null, /* 'ERROR_1' */
    // $FlowIssue no computed
    [2]: null, /* 'CLASH_2' */
    // $FlowIssue no computed
    [3]: null, /* 'REVOKED_3' */
    // $FlowIssue no computed
    [4]: metaUpgraded, /* 'UPGRADED_4' */
    // $FlowIssue no computed
    [5]: metaNew, /* 'NEW_5' */
    // $FlowIssue no computed
    [6]: null, /* 'REMOTE_FAIL_6' */
    // $FlowIssue no computed
    [7]: null, /* 'REMOTE_WORKING_7' */
    // $FlowIssue no computed
    [8]: null /* 'REMOTE_CHANGED_8' */
  }[diff]
}

function remoteProofToProof (rp: RemoteProof, lcr: ?LinkCheckResult): Proof {
  const proofState: SimpleProofState = lcr && proofStateToSimpleProofState(lcr.proofResult.state) || checking

  let proofType: string = ''
  if (rp.proofType === identify.ProofType.genericWebSite || rp.proofType === identify.ProofType.dns) {
    proofType = 'web'
  } else {
    proofType = mapTagToName(identify.ProofType, rp.proofType) || ''
  }

  let meta = trackDiffToSimpleProofMeta(0)
  if (lcr && lcr.diff && lcr.diff.type) {
    meta = trackDiffToSimpleProofMeta(lcr.diff.type)
  }

  return {
    state: proofState,
    id: rp.sigID,
    meta: meta,
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
