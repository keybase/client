// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/tracker'
import * as RPCTypes from '../constants/types/flow-types'
import _ from 'lodash'

import type {Action} from '../constants/types/flux'
import type {PlatformsExpandedType} from '../constants/types/more'

const initialProofState = Constants.checking

const initialState: Constants.State = {
  cachedIdentifies: {},
  pendingIdentifies: {},
  serverStarted: false,
  timerActive: 0,
  trackers: {},
  tracking: [],
}

function initialTrackerState(username: string): Constants.TrackerState {
  return {
    closed: true,
    currentlyFollowing: false,
    eldestKidChanged: false,
    error: null,
    hidden: false,
    lastAction: null,
    needTrackTokenDismiss: false,
    proofs: [],
    reason: null,
    serverActive: true,
    shouldFollow: true,
    tlfs: [],
    trackToken: null,
    trackerState: initialProofState,
    trackers: [],
    tracking: [],
    type: 'tracker',
    userInfo: {
      avatar: null,
      bio: '',
      followersCount: -1,
      followingCount: -1,
      followsYou: false,
      fullname: '', // TODO get this info,
      location: '', // TODO: get this information
      uid: '',
    },
    username,
    waiting: false,
  }
}

function initialNonUserState(assertion: string): Constants.NonUserState {
  return {
    closed: true,
    error: null,
    hidden: true,
    inviteLink: null,
    isPrivate: false,
    name: assertion,
    reason: '',
    type: 'nonUser',
  }
}

function updateNonUserState(
  state: Constants.NonUserState,
  action: Constants.NonUserActions
): Constants.NonUserState {
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

function dedupeProofs(proofs: Array<Constants.Proof>): Array<Constants.Proof> {
  return _.uniqBy(proofs, 'id')
}

function updateUserState(
  username: string,
  state: Constants.TrackerState,
  action: Action
): Constants.TrackerState {
  switch (action.type) {
    case Constants.identifyStarted:
      return {...state, error: null}
    case Constants.updateReason:
      // In case the reason is null, let's use our existing reason
      return {
        ...state,
        reason: (action.payload && action.payload.reason) || state.reason,
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
        trackerState: 'normal',
      }
    case Constants.onUnfollow:
      return {
        ...state,
        currentlyFollowing: false,
        lastAction: 'unfollowed',
        reason: `You have unfollowed ${state.username}.`,
      }
    case Constants.onError:
      let errorText = 'There was an error updating your follow status.'
      if (action.payload && action.payload.extraText) {
        errorText = `There was an error: ${action.payload.extraText}`
      }
      return {
        ...state,
        error: errorText,
      }
    case Constants.updateEldestKidChanged: {
      return {
        ...state,
        eldestKidChanged: true,
      }
    }
    case Constants.updateProofState:
      const proofsGeneralState = overviewStateOfProofs(state.proofs)
      const trackerMessage = deriveTrackerMessage(
        state.username,
        state.currentlyFollowing,
        proofsGeneralState
      )
      const reason = trackerMessage || state.reason

      return {
        ...state,
        changed: proofsGeneralState.anyChanged,
        reason,
        shouldFollow: deriveShouldFollow(proofsGeneralState),
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

      const identity: RPCTypes.Identity = action.payload.identity
      return {
        ...state,
        proofs: dedupeProofs([
          ...state.proofs,
          ...(identity.revokedDetails || []).map(rv => revokedProofToProof(rv)),
          ...(identity.proofs || []).map(rp => remoteProofToProof(username, Constants.checking, rp.proof)),
        ]),
      }

    case Constants.updatePGPKey: {
      if (!action.payload) {
        return state
      }
      const url = `https://keybase.io/${state.username}/sigchain`
      const proof = {
        color: 'green',
        // TODO: We don't currently get the sigID so we can't link to the actual sigChain statement. See https://keybase.atlassian.net/browse/CORE-3529
        humanUrl: url,
        id: action.payload.kid,
        isTracked: state.currentlyFollowing,
        mTime: 0,
        meta: null,
        name: action.payload.fingerPrint,
        profileUrl: url,
        state: 'normal',
        type: 'pgp',
      }

      return {
        ...state,
        proofs: dedupeProofs(state.proofs.concat([proof])),
      }
    }

    case Constants.updateZcash: {
      if (!action.payload) {
        return state
      }

      const url = `https://keybase.io/${state.username}/sigchain#${action.payload.sigID}`
      const proof = {
        color: 'green',
        humanUrl: url,
        id: action.payload.sigID,
        isTracked: state.currentlyFollowing,
        mTime: 0,
        meta: null,
        name: action.payload.address,
        profileUrl: url,
        state: 'normal',
        type: 'zcash',
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
        color: 'green',
        humanUrl: url,
        id: action.payload.sigID,
        isTracked: state.currentlyFollowing,
        mTime: 0,
        meta: null,
        name: action.payload.address,
        profileUrl: url,
        state: 'normal',
        type: 'btc',
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

      const rp: RPCTypes.RemoteProof = action.payload.remoteProof
      const lcr: RPCTypes.LinkCheckResult = action.payload.linkCheckResult
      return {
        ...state,
        proofs: updateProof(username, state.proofs, rp, lcr),
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
      const serverActive = (action.payload && !!action.payload.active) || false
      return {
        ...state,
        serverActive,
      }

    case Constants.reportLastTrack:
      const currentlyFollowing = !!(action.payload && action.payload.track)
      const proofs = state.proofs.map(
        p => (['btc', 'pgp'].includes(p.type) ? {...p, isTracked: currentlyFollowing} : p)
      )

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
        trackersLoaded: true,
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
          error,
          serverActive: false,
        }
      }
      return {...state, error: null}
    default:
      return state
  }
}

export default function(state: Constants.State = initialState, action: Action): Constants.State {
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
            [action.payload.username]: action.payload.pending ? true : undefined,
          },
        }
      }
      break
  }

  if (userKey && trackerOrNonUserState && trackerOrNonUserState.type === 'tracker') {
    const newTrackerState = updateUserState(userKey, trackerOrNonUserState, action)
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
        const serverStarted = (action.payload && !!action.payload.started) || false
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

function mapValueToKey<K: string, V>(obj: {[key: K]: V}, tag: V): ?K {
  // $FlowIssue the problem is that Object.keys returns an array of strings
  return Object.keys(obj).find(key => obj[key] === tag)
}

function stateToColor(state: Constants.SimpleProofState): string {
  if (state === Constants.normal) {
    return 'green'
  } else if (state === Constants.warning) {
    return 'yellow'
  } else if (state === Constants.error) {
    return 'red'
  }

  return 'gray'
}

function proofStateToSimpleProofState(
  proofState: RPCTypes.ProofState,
  diff: ?RPCTypes.TrackDiff,
  remoteDiff: ?RPCTypes.TrackDiff,
  breaksTracking: boolean
): ?Constants.SimpleProofState {
  if (breaksTracking) {
    return Constants.error
  }
  // If there is no difference in what we've tracked from the server or remote resource it's good.
  if (
    diff &&
    remoteDiff &&
    diff.type === RPCTypes.IdentifyCommonTrackDiffType.none &&
    remoteDiff.type === RPCTypes.IdentifyCommonTrackDiffType.none
  ) {
    return Constants.normal
  }

  const statusName: ?string = mapValueToKey(RPCTypes.ProveCommonProofState, proofState)
  switch (statusName) {
    case 'ok':
      return Constants.normal
    case 'tempFailure':
    case 'superseded':
    case 'posted':
      return Constants.warning
    case 'revoked':
    case 'permFailure':
    case 'none':
      return Constants.error
    case 'looking':
      return Constants.checking
    default:
      return null
  }
}

function diffAndStatusMeta(
  diff: ?RPCTypes.TrackDiffType,
  proofResult: ?RPCTypes.ProofResult,
  isTracked: boolean
): {diffMeta: ?Constants.SimpleProofMeta, statusMeta: ?Constants.SimpleProofMeta} {
  const {status, state} = proofResult || {}

  if (status && status !== RPCTypes.ProveCommonProofStatus.ok && isTracked) {
    return {
      diffMeta: Constants.metaIgnored,
      statusMeta: null,
    }
  }

  return {
    diffMeta: trackDiffToSimpleProofMeta(diff),
    statusMeta: proofStatusToSimpleProofMeta(status, state),
  }

  function trackDiffToSimpleProofMeta(diff: ?RPCTypes.TrackDiffType): ?Constants.SimpleProofMeta {
    if (!diff) {
      return null
    }

    return {
      [RPCTypes.IdentifyCommonTrackDiffType.none]: null,
      [RPCTypes.IdentifyCommonTrackDiffType.error]: null,
      [RPCTypes.IdentifyCommonTrackDiffType.clash]: null,
      [RPCTypes.IdentifyCommonTrackDiffType.revoked]: Constants.metaDeleted,
      [RPCTypes.IdentifyCommonTrackDiffType.upgraded]: Constants.metaUpgraded,
      [RPCTypes.IdentifyCommonTrackDiffType.new]: Constants.metaNew,
      [RPCTypes.IdentifyCommonTrackDiffType.remoteFail]: null,
      [RPCTypes.IdentifyCommonTrackDiffType.remoteWorking]: null,
      [RPCTypes.IdentifyCommonTrackDiffType.remoteChanged]: null,
      [RPCTypes.IdentifyCommonTrackDiffType.newEldest]: null,
    }[diff]
  }

  function proofStatusToSimpleProofMeta(
    status: ?RPCTypes.ProofStatus,
    state: ?RPCTypes.ProofState
  ): ?Constants.SimpleProofMeta {
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
      [RPCTypes.ProveCommonProofStatus.none]: null,
      [RPCTypes.ProveCommonProofStatus.ok]: null,
      [RPCTypes.ProveCommonProofStatus.local]: null,
      [RPCTypes.ProveCommonProofStatus.found]: null,
      [RPCTypes.ProveCommonProofStatus.baseError]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.hostUnreachable]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.permissionDenied]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.failedParse]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.dnsError]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.authFailed]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.http500]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.timeout]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.internalError]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.baseHardError]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.notFound]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.contentFailure]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.badUsername]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.badRemoteId]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.textNotFound]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.badArgs]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.contentMissing]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.titleNotFound]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.serviceError]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.torSkipped]: null,
      [RPCTypes.ProveCommonProofStatus.torIncompatible]: null,
      [RPCTypes.ProveCommonProofStatus.http300]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.http400]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.httpOther]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.emptyJson]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.deleted]: Constants.metaDeleted,
      [RPCTypes.ProveCommonProofStatus.serviceDead]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.badSignature]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.badApiUrl]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.unknownType]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.noHint]: Constants.metaUnreachable,
      [RPCTypes.ProveCommonProofStatus.badHintText]: Constants.metaUnreachable,
    }[status]
  }
}

// TODO Have the service give this information.
// Currently this is copied from the website: https://github.com/keybase/keybase/blob/658aa97a9ad63733444298353a528e7f8499d8b9/lib/mod/user_lol.iced#L971
function proofUrlToProfileUrl(proofType: number, name: string, key: ?string, humanUrl: ?string): string {
  key = key || ''
  switch (proofType) {
    case RPCTypes.ProveCommonProofType.dns:
      return `http://${name}`
    case RPCTypes.ProveCommonProofType.genericWebSite:
      return `${key}://${name}`
    case RPCTypes.ProveCommonProofType.twitter:
      return `https://twitter.com/${name}`
    case RPCTypes.ProveCommonProofType.facebook:
      return `https://facebook.com/${name}`
    case RPCTypes.ProveCommonProofType.github:
      return `https://github.com/${name}`
    case RPCTypes.ProveCommonProofType.reddit:
      return `https://reddit.com/user/${name}`
    case RPCTypes.ProveCommonProofType.hackernews:
      return `https://news.ycombinator.com/user?id=${name}`
    default:
      return humanUrl || ''
  }
}

function remoteProofToProofType(rp: RPCTypes.RemoteProof): PlatformsExpandedType {
  if (rp.proofType === RPCTypes.ProveCommonProofType.genericWebSite) {
    return rp.key === 'http' ? 'http' : 'https'
  } else {
    // $FlowIssue
    return mapValueToKey(RPCTypes.ProveCommonProofType, rp.proofType)
  }
}

function revokedProofToProof(rv: RPCTypes.RevokedProof): Constants.Proof {
  return {
    color: stateToColor(Constants.error),
    humanUrl: '',
    id: rv.proof.sigID,
    isTracked: false,
    mTime: rv.proof.mTime,
    meta: Constants.metaDeleted,
    name: rv.proof.displayMarkup,
    profileUrl: '',
    state: Constants.error,
    type: remoteProofToProofType(rv.proof),
  }
}

function remoteProofToProof(
  username: string,
  oldProofState: Constants.SimpleProofState,
  rp: RPCTypes.RemoteProof,
  lcr: ?RPCTypes.LinkCheckResult
): Constants.Proof {
  const proofState: Constants.SimpleProofState =
    (lcr &&
      proofStateToSimpleProofState(lcr.proofResult.state, lcr.diff, lcr.remoteDiff, lcr.breaksTracking)) ||
    oldProofState
  const isTracked = !!(lcr &&
    lcr.diff &&
    lcr.diff.type === RPCTypes.IdentifyCommonTrackDiffType.none &&
    !lcr.breaksTracking)
  const {diffMeta, statusMeta} = diffAndStatusMeta(
    lcr && lcr.diff && lcr.diff.type,
    lcr && lcr.proofResult,
    isTracked
  )
  const humanUrl =
    (rp.key !== 'dns' && lcr && lcr.hint && lcr.hint.humanUrl) ||
    `https://keybase.io/${username}/sigchain#${rp.sigID}`

  return {
    color: stateToColor(proofState),
    humanUrl: humanUrl,
    id: rp.sigID,
    isTracked,
    mTime: rp.mTime,
    meta: statusMeta || diffMeta,
    name: rp.displayMarkup,
    profileUrl: rp.displayMarkup && proofUrlToProfileUrl(rp.proofType, rp.displayMarkup, rp.key, humanUrl),
    state: proofState,
    type: remoteProofToProofType(rp),
  }
}

function updateProof(
  username: string,
  proofs: Array<Constants.Proof>,
  rp: RPCTypes.RemoteProof,
  lcr: RPCTypes.LinkCheckResult
): Array<Constants.Proof> {
  let found = false
  let updated = proofs.map(proof => {
    if (proof.id === rp.sigID) {
      found = true
      return remoteProofToProof(username, proof.state, rp, lcr)
    }
    return proof
  })

  if (!found) {
    updated.push(remoteProofToProof(username, Constants.checking, rp, lcr))
  }

  return updated
}

export function overviewStateOfProofs(proofs: Array<Constants.Proof>): Constants.OverviewProofState {
  const allOk = proofs.every(p => p.state === Constants.normal)
  const [anyWarnings, anyError, anyPending] = [
    Constants.warning,
    Constants.error,
    Constants.checking,
  ].map(s => proofs.some(p => p.state === s))
  const [anyDeletedProofs, anyUnreachableProofs, anyUpgradedProofs, anyNewProofs, anyPendingProofs] = [
    Constants.metaDeleted,
    Constants.metaUnreachable,
    Constants.metaUpgraded,
    Constants.metaNew,
    Constants.metaPending,
  ].map(m => proofs.some(p => p.meta === m))
  const anyChanged = proofs.some(proof => proof.meta && proof.meta !== Constants.metaNone)
  return {
    allOk,
    anyChanged,
    anyDeletedProofs,
    anyError,
    anyNewProofs,
    anyPending,
    anyPendingProofs,
    anyUnreachableProofs,
    anyUpgradedProofs,
    anyWarnings,
  }
}

export function deriveSimpleProofState(
  eldestKidChanged: boolean,
  {
    allOk,
    anyWarnings,
    anyError,
    anyPending,
    anyDeletedProofs,
    anyUnreachableProofs,
  }: {
    allOk: boolean,
    anyWarnings: boolean,
    anyError: boolean,
    anyPending: boolean,
    anyDeletedProofs: boolean,
    anyUnreachableProofs: boolean,
  }
): Constants.SimpleProofState {
  if (eldestKidChanged) {
    return Constants.error
  }

  if (allOk) {
    return Constants.normal
  } else if (anyPending) {
    return Constants.checking
  } else if (anyWarnings || anyUnreachableProofs) {
    return Constants.warning
  } else if (anyError || anyDeletedProofs) {
    return Constants.error
  }

  return Constants.error
}

function deriveTrackerMessage(
  username: string,
  currentlyFollowing: boolean,
  {
    allOk,
    anyDeletedProofs,
    anyUnreachableProofs,
    anyUpgradedProofs,
    anyNewProofs,
  }: {
    allOk: boolean,
    anyDeletedProofs: boolean,
    anyUnreachableProofs: boolean,
    anyUpgradedProofs: boolean,
    anyNewProofs: boolean,
  }
): ?string {
  if (allOk || !currentlyFollowing) {
    return null
  } else if (anyDeletedProofs || anyUnreachableProofs) {
    return `Some of ${username}'s proofs have changed since you last followed them.`
  } else if (anyUpgradedProofs) {
    return `${username} added new proofs to their profile since you last followed them.`
  }
}

function deriveShouldFollow({allOk}: {allOk: boolean}): boolean {
  return allOk
}
