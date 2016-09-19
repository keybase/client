// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/tracker'
import _ from 'lodash'
import type {Proof, OverviewProofState, SimpleProofState, SimpleProofMeta, NonUserActions, TrackerState, NonUserState, TrackerOrNonUserState} from '../constants/tracker'
import type {Action} from '../constants/types/flux'
import type {Identity, RemoteProof, RevokedProof, LinkCheckResult, ProofState, TrackDiff, TrackDiffType, ProofStatus, ProofResult} from '../constants/types/flow-types'
import type {PlatformsExpandedType} from '../constants/types/more'
import {IdentifyCommonTrackDiffType, ProveCommonProofState, ProveCommonProofType, ProveCommonProofStatus} from '../constants/types/flow-types'

const {metaNone, metaNew, metaUpgraded, metaUnreachable, metaDeleted, metaIgnored, metaPending,
  normal, warning, error, checking} = Constants

export type State = {
  serverStarted: boolean,
  trackers: {[key: string]: TrackerOrNonUserState},
  pendingIdentifies: {[key: string]: boolean},
  cachedIdentifies: {[key: string]: number}, // good until unix timestamp
  timerActive: number,
  tracking: Array<{
    username: string,
    fullname: string,
    followsYou: boolean,
    following: boolean,
  }>
}

const initialProofState = checking

const initialState: State = {
  serverStarted: false,
  timerActive: 0,
  trackers: {},
  pendingIdentifies: {},
  cachedIdentifies: {},
  tracking: [],
}

function initialTrackerState (username: string): TrackerState {
  return {
    closed: true,
    error: null,
    currentlyFollowing: false,
    eldestKidChanged: false,
    hidden: false,
    lastAction: null,
    needTrackTokenDismiss: false,
    proofs: [],
    reason: null,
    serverActive: false,
    shouldFollow: true,
    trackToken: null,
    trackerState: initialProofState,
    type: 'tracker',
    trackers: [],
    tracking: [],
    userInfo: {
      fullname: '', // TODO get this info,
      followersCount: -1,
      followingCount: -1,
      followsYou: false,
      uid: '',
      bio: '',
      avatar: null,
      location: '', // TODO: get this information
    },
    username,
    waiting: false,
    tlfs: [],
  }
}

function initialNonUserState (assertion: string): NonUserState {
  return {
    closed: true,
    hidden: true,
    inviteLink: null,
    isPrivate: false,
    name: assertion,
    reason: '',
    type: 'nonUser',
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
        inviteLink: action.payload.throttled ? null : action.payload.inviteLink,
        isPrivate: action.payload.isPrivate,
        name: action.payload.assertion,
        reason: `You opened ${action.payload.folderName}`,
        serviceName: action.payload.socialAssertion.service,
      }
    case Constants.onClose:
      return {
        ...state,
        closed: true,
        hidden: true,
      }
    default:
      return state
  }
}

function dedupeProofs (proofs: Array<Proof>): Array<Proof> {
  return _.uniqBy(proofs, 'id')
}

function updateUserState (state: TrackerState, action: Action): TrackerState {
  switch (action.type) {
    case Constants.identifyStarted:
      return {...state, error: null}
    case Constants.updateReason:
      // In case the reason is null, let's use our existing reason
      return {
        ...state,
        reason: action.payload && action.payload.reason || state.reason,
      }
    case Constants.updateTrackToken:
      return {
        ...state,
        trackToken: action.payload && action.payload.trackToken,
      }
    case Constants.onClose:
      return {
        ...state,
        closed: true,
        hidden: false,
        lastAction: null,
        needTrackTokenDismiss: !state.trackToken, // did we have a track token at this time?
        shouldFollow: false, // don't follow if they close x out the window
      }
    case Constants.setNeedTrackTokenDismiss:
      return {
        ...state,
        needTrackTokenDismiss: action.payload.needTrackTokenDismiss,
      }
    case Constants.onWaiting:
      return {
        ...state,
        waiting: action.payload.waiting,
      }
    case Constants.onFollow:
      return {
        ...state,
        currentlyFollowing: true,
        lastAction: 'followed',
        reason: `You have followed ${state.username}.`,
      }
    case Constants.onRefollow:
      return {
        ...state,
        lastAction: 'refollowed',
        reason: `You have re-followed ${state.username}.`,
      }
    case Constants.onUnfollow:
      return {
        ...state,
        currentlyFollowing: false,
        lastAction: 'unfollowed',
        reason: `You have unfollowed ${state.username}.`,
      }
    case Constants.onError:
      return {
        ...state,
        lastAction: 'error',
        reason: 'There was an error updating your follow status.',
      }
    case Constants.updateEldestKidChanged: {
      return {
        ...state,
        eldestKidChanged: true,
      }
    }
    case Constants.updateProofState:
      const proofsGeneralState = overviewStateOfProofs(state.proofs)
      const trackerMessage = deriveTrackerMessage(state.username, state.currentlyFollowing, proofsGeneralState)
      const reason = trackerMessage || state.reason

      return {
        ...state,
        changed: proofsGeneralState.anyChanged,
        shouldFollow: deriveShouldFollow(proofsGeneralState),
        reason,
        trackerState: deriveSimpleProofState(state.eldestKidChanged, proofsGeneralState),
      }

    case Constants.resetProofs:
      if (!action.payload) {
        return state
      }

      return {
        ...state,
        proofs: [],
      }

    case Constants.setProofs:
      if (!action.payload) {
        return state
      }

      const identity: Identity = action.payload.identity
      return {
        ...state,
        proofs: dedupeProofs([
          ...state.proofs,
          ...(identity.revokedDetails || []).map(rv => revokedProofToProof(rv)),
          ...(identity.proofs || []).map(rp => remoteProofToProof(checking, rp.proof)),
        ]),
      }

    case Constants.updatePGPKey: {
      if (!action.payload) {
        return state
      }
      const url = `https://keybase.io/${state.username}/sigchain`
      const proof = {
        state: 'normal',
        id: action.payload.kid,
        meta: null,
        type: 'pgp',
        mTime: 0,
        color: 'green',
        name: action.payload.fingerPrint,
        // TODO: We don't currently get the sigID so we can't link to the actual sigChain statement. See https://keybase.atlassian.net/browse/CORE-3529
        humanUrl: url,
        profileUrl: url,
        isTracked: state.currentlyFollowing,
      }

      return {
        ...state,
        proofs: dedupeProofs(state.proofs.concat([proof])),
      }
    }

    case Constants.updateBTC: {
      if (!action.payload) {
        return state
      }

      const url = `https://keybase.io/${state.username}/sigchain#${action.payload.sigID}`
      const proof = {
        state: 'normal',
        id: action.payload.sigID,
        meta: null,
        type: 'btc',
        mTime: 0,
        color: 'green',
        name: action.payload.address,
        humanUrl: url,
        profileUrl: url,
        isTracked: state.currentlyFollowing,
      }

      return {
        ...state,
        proofs: dedupeProofs(state.proofs.concat([proof])),
      }
    }

    case Constants.updateProof:
      if (!action.payload) {
        return state
      }

      const rp: RemoteProof = action.payload.remoteProof
      const lcr: LinkCheckResult = action.payload.linkCheckResult
      return {
        ...state,
        proofs: updateProof(state.proofs, rp, lcr),
      }

    case Constants.updateUserInfo:
      if (!action.payload) {
        return state
      }
      return {
        ...state,
        userInfo: action.payload.userInfo,
      }

    case Constants.markActiveIdentifyUi:
      const serverActive = action.payload && !!action.payload.active || false
      return {
        ...state,
        serverActive,
      }

    case Constants.reportLastTrack:
      const currentlyFollowing = !!(action.payload && action.payload.track)
      const proofs = state.proofs.map(p => ['btc', 'pgp'].includes(p.type)
        ? {...p, isTracked: currentlyFollowing}
        : p)

      return {
        ...state,
        currentlyFollowing,
        proofs,
      }

    case Constants.showTracker:
      return {
        ...state,
        closed: false,
        hidden: false,
      }

    case Constants.remoteDismiss:
      return {
        ...state,
        closed: true,
      }

    case Constants.updateTrackers:
      if (action.error) {
        return state
      }

      return {
        ...state,
        trackers: action.payload.trackers,
        tracking: action.payload.tracking,
      }
    case Constants.updateFolders:
      if (action.error) {
        return state
      }

      return {
        ...state,
        tlfs: action.payload.tlfs,
      }
    case Constants.identifyFinished:
      if (action.error) {
        const error = action.payload.error
        return {
          ...state,
          serverActive: false,
          trackerState: Constants.error,
          reason: error,
          error,
        }
      }
      return {...state, error: null}
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
        trackers: {},
      }
    case Constants.startTimer:
      return {
        ...state,
        timerActive: state.timerActive + 1,
      }
    case Constants.stopTimer:
      return {
        ...state,
        timerActive: state.timerActive - 1,
      }
    case Constants.cacheIdentify:
      if (!action.error) {
        return {
          ...state,
          cachedIdentifies: {
            ...state.cachedIdentifies,
            [action.payload.uid]: action.payload.goodTill,
          },
        }
      }
      break
    case Constants.pendingIdentify:
      if (!action.error) {
        return {
          ...state,
          pendingIdentifies: {
            ...state.pendingIdentifies,
            [action.payload.username]: action.payload.pending,
          },
        }
      }
      break
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
        [userKey]: newTrackerState,
      },
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
        [userKey]: newNonUserState,
      },
    }
  } else {
    switch (action.type) {
      case Constants.registerIdentifyUi:
        const serverStarted = action.payload && !!action.payload.started || false
        return {
          ...state,
          serverStarted,
        }
      case Constants.updateUsername:
        if (!action.payload || !userKey) {
          return state
        }

        return {
          ...state,
          trackers: {
            ...state.trackers,
            [userKey]: initialTrackerState(userKey),
          },
        }
      case Constants.showNonUser:
        if (!userKey) return state

        return {
          ...state,
          trackers: {
            ...state.trackers,
            [userKey]: updateNonUserState(initialNonUserState(userKey), action),
          },
        }
      default:
        return state
    }
  }
}

function mapValueToKey<K: string, V> (obj: {[key: K]: V}, tag: V): ?K {
  // $FlowIssue the problem is that Object.keys returns an array of strings
  return Object.keys(obj).find(key => obj[key] === tag)
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

function proofStateToSimpleProofState (proofState: ProofState, diff: ?TrackDiff, remoteDiff: ?TrackDiff): ?SimpleProofState {
  // If there is no difference in what we've tracked from the server or remote resource it's good.
  if (diff && remoteDiff && diff.type === IdentifyCommonTrackDiffType.none && remoteDiff.type === IdentifyCommonTrackDiffType.none) {
    return normal
  }

  const statusName: ?string = mapValueToKey(ProveCommonProofState, proofState)
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
      return checking
    default:
      return null
  }
}

function diffAndStatusMeta (diff: ?TrackDiffType, proofResult: ?ProofResult, isTracked: bool) : {diffMeta: ?SimpleProofMeta, statusMeta: ?SimpleProofMeta} {
  const {status, state} = proofResult || {}

  if (status && status !== ProveCommonProofStatus.ok && isTracked) {
    return {
      diffMeta: metaIgnored,
      statusMeta: null,
    }
  }

  return {
    diffMeta: trackDiffToSimpleProofMeta(diff),
    statusMeta: proofStatusToSimpleProofMeta(status, state),
  }

  function trackDiffToSimpleProofMeta (diff: ?TrackDiffType): ?SimpleProofMeta {
    if (!diff) {
      return null
    }

    return {
      [IdentifyCommonTrackDiffType.none]: null,
      [IdentifyCommonTrackDiffType.error]: null,
      [IdentifyCommonTrackDiffType.clash]: null,
      [IdentifyCommonTrackDiffType.revoked]: metaDeleted,
      [IdentifyCommonTrackDiffType.upgraded]: metaUpgraded,
      [IdentifyCommonTrackDiffType.new]: metaNew,
      [IdentifyCommonTrackDiffType.remoteFail]: null,
      [IdentifyCommonTrackDiffType.remoteWorking]: null,
      [IdentifyCommonTrackDiffType.remoteChanged]: null,
      [IdentifyCommonTrackDiffType.newEldest]: null,
    }[diff]
  }

  function proofStatusToSimpleProofMeta (status: ?ProofStatus, state: ?ProofState): ?SimpleProofMeta {
    if (!status) {
      return null
    }

    // FIXME: uncomment once the backend indicates pending-state failures based
    // on low proof age.
    // if (state === ProveCommonProofState.tempFailure) {
    //   return metaPending
    // }

    // The full mapping between the proof status we get back from the server
    // and a simplified representation that we show the users.
    return {
      [ProveCommonProofStatus.none]: null,
      [ProveCommonProofStatus.ok]: null,
      [ProveCommonProofStatus.local]: null,
      [ProveCommonProofStatus.found]: null,
      [ProveCommonProofStatus.baseError]: metaUnreachable,
      [ProveCommonProofStatus.hostUnreachable]: metaUnreachable,
      [ProveCommonProofStatus.permissionDenied]: metaUnreachable,
      [ProveCommonProofStatus.failedParse]: metaUnreachable,
      [ProveCommonProofStatus.dnsError]: metaUnreachable,
      [ProveCommonProofStatus.authFailed]: metaUnreachable,
      [ProveCommonProofStatus.http500]: metaUnreachable,
      [ProveCommonProofStatus.timeout]: metaUnreachable,
      [ProveCommonProofStatus.internalError]: metaUnreachable,
      [ProveCommonProofStatus.baseHardError]: metaUnreachable,
      [ProveCommonProofStatus.notFound]: metaUnreachable,
      [ProveCommonProofStatus.contentFailure]: metaUnreachable,
      [ProveCommonProofStatus.badUsername]: metaUnreachable,
      [ProveCommonProofStatus.badRemoteId]: metaUnreachable,
      [ProveCommonProofStatus.textNotFound]: metaUnreachable,
      [ProveCommonProofStatus.badArgs]: metaUnreachable,
      [ProveCommonProofStatus.contentMissing]: metaUnreachable,
      [ProveCommonProofStatus.titleNotFound]: metaUnreachable,
      [ProveCommonProofStatus.serviceError]: metaUnreachable,
      [ProveCommonProofStatus.torSkipped]: null,
      [ProveCommonProofStatus.torIncompatible]: null,
      [ProveCommonProofStatus.http300]: metaUnreachable,
      [ProveCommonProofStatus.http400]: metaUnreachable,
      [ProveCommonProofStatus.httpOther]: metaUnreachable,
      [ProveCommonProofStatus.emptyJson]: metaUnreachable,
      [ProveCommonProofStatus.deleted]: metaDeleted,
      [ProveCommonProofStatus.serviceDead]: metaUnreachable,
      [ProveCommonProofStatus.badSignature]: metaUnreachable,
      [ProveCommonProofStatus.badApiUrl]: metaUnreachable,
      [ProveCommonProofStatus.unknownType]: metaUnreachable,
      [ProveCommonProofStatus.noHint]: metaUnreachable,
      [ProveCommonProofStatus.badHintText]: metaUnreachable,
    }[status]
  }
}

// TODO Have the service give this information.
// Currently this is copied from the website: https://github.com/keybase/keybase/blob/658aa97a9ad63733444298353a528e7f8499d8b9/lib/mod/user_lol.iced#L971
function proofUrlToProfileUrl (proofType: number, name: string, key: ?string, humanUrl: ?string): string {
  key = key || ''
  switch (proofType) {
    case ProveCommonProofType.dns: return `http://${name}`
    case ProveCommonProofType.genericWebSite: return `${key}://${name}`
    case ProveCommonProofType.twitter: return `https://twitter.com/${name}`
    case ProveCommonProofType.facebook: return `https://facebook.com/${name}`
    case ProveCommonProofType.github: return `https://github.com/${name}`
    case ProveCommonProofType.reddit: return `https://reddit.com/user/${name}`
    case ProveCommonProofType.coinbase: return `https://coinbase.com/${name}`
    case ProveCommonProofType.hackernews: return `https://news.ycombinator.com/user?id=${name}`
    default: return humanUrl || ''
  }
}

function remoteProofToProofType (rp: RemoteProof): PlatformsExpandedType {
  if (rp.proofType === ProveCommonProofType.genericWebSite) {
    return rp.key === 'http' ? 'http' : 'https'
  } else {
    // $FlowIssue
    return mapValueToKey(ProveCommonProofType, rp.proofType)
  }
}

function revokedProofToProof (rv: RevokedProof): Proof {
  return {
    state: error,
    id: rv.proof.sigID,
    meta: metaDeleted,
    type: remoteProofToProofType(rv.proof),
    mTime: rv.proof.mTime,
    color: stateToColor(error),
    name: rv.proof.displayMarkup,
    humanUrl: '',
    profileUrl: '',
    isTracked: false,
  }
}

function remoteProofToProof (oldProofState: SimpleProofState, rp: RemoteProof, lcr: ?LinkCheckResult): Proof {
  const proofState: SimpleProofState = lcr && proofStateToSimpleProofState(lcr.proofResult.state, lcr.diff, lcr.remoteDiff) || oldProofState
  const isTracked = !!(lcr && lcr.diff && lcr.diff.type === IdentifyCommonTrackDiffType.none && !lcr.breaksTracking)
  const {diffMeta, statusMeta} = diffAndStatusMeta(lcr && lcr.diff && lcr.diff.type, lcr && lcr.proofResult, isTracked)
  const humanUrl = (lcr && lcr.hint && lcr.hint.humanUrl)

  return {
    state: proofState,
    id: rp.sigID,
    meta: statusMeta || diffMeta,
    type: remoteProofToProofType(rp),
    mTime: rp.mTime,
    color: stateToColor(proofState),
    name: rp.displayMarkup,
    humanUrl: humanUrl,
    profileUrl: rp.displayMarkup && proofUrlToProfileUrl(rp.proofType, rp.displayMarkup, rp.key, humanUrl),
    isTracked,
  }
}

function updateProof (proofs: Array<Proof>, rp: RemoteProof, lcr: LinkCheckResult): Array<Proof> {
  let found = false
  let updated = proofs.map(proof => {
    if (proof.id === rp.sigID) {
      found = true
      return remoteProofToProof(proof.state, rp, lcr)
    }
    return proof
  })

  if (!found) {
    updated.push(remoteProofToProof(checking, rp, lcr))
  }

  return updated
}

export function overviewStateOfProofs (proofs: Array<Proof>): OverviewProofState {
  const allOk = proofs.every(p => p.state === normal)
  const [anyWarnings, anyError, anyPending] = [warning, error, checking].map(s => proofs.some(p => p.state === s))
  const [anyDeletedProofs, anyUnreachableProofs, anyUpgradedProofs, anyNewProofs, anyPendingProofs] = [metaDeleted, metaUnreachable, metaUpgraded, metaNew, metaPending].map(m => proofs.some(p => p.meta === m))
  const anyChanged = proofs.some(proof => proof.meta && proof.meta !== metaNone)
  return {allOk, anyWarnings, anyError, anyPending, anyDeletedProofs, anyUnreachableProofs, anyUpgradedProofs, anyNewProofs, anyChanged, anyPendingProofs}
}

export function deriveSimpleProofState (
  eldestKidChanged: boolean,
  {allOk, anyWarnings, anyError, anyPending, anyDeletedProofs, anyUnreachableProofs}: {allOk: boolean, anyWarnings: boolean, anyError: boolean, anyPending: boolean, anyDeletedProofs : boolean, anyUnreachableProofs : boolean}
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
  currentlyFollowing: boolean,
  {allOk, anyDeletedProofs, anyUnreachableProofs, anyUpgradedProofs, anyNewProofs}: {allOk: boolean, anyDeletedProofs: boolean, anyUnreachableProofs: boolean, anyUpgradedProofs: boolean, anyNewProofs: boolean}
): ?string {
  if (allOk || !currentlyFollowing) {
    return null
  } else if (anyDeletedProofs || anyUnreachableProofs) {
    return `Some of ${username}’s proofs have changed since you last followed them.`
  } else if (anyUpgradedProofs) {
    return `${username} added new proofs to their profile since you last followed them.`
  }
}

function deriveShouldFollow ({allOk}: {allOk: boolean}): boolean {
  return allOk
}
