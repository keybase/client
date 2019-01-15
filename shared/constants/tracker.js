// @flow
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from './types/tracker'
import {type PlatformsExpandedType} from '../constants/types/more'
import {uniqBy} from 'lodash-es'

const cachedIdentifyGoodUntil = 1000 * 60 * 60
const profileFromUI = '@@UI-PROFILE'

const trackerType = 'tracker'
const nonUserType = 'nonUser'

// Constants
const normal: Types.SimpleProofState = 'normal'
const warning: Types.SimpleProofState = 'warning'
const error: Types.SimpleProofState = 'error'
const checking: Types.SimpleProofState = 'checking'
const revoked: Types.SimpleProofState = 'revoked'

const metaNone: Types.SimpleProofMeta = 'none'
const metaUpgraded: Types.SimpleProofMeta = 'upgraded'
const metaNew: Types.SimpleProofMeta = 'new'
const metaUnreachable: Types.SimpleProofMeta = 'unreachable'
const metaPending: Types.SimpleProofMeta = 'pending'
const metaDeleted: Types.SimpleProofMeta = 'deleted'
const metaIgnored: Types.SimpleProofMeta = 'ignored'

const rpcUpdateTimerSeconds = 60 * 1000

function isLoading(state: ?Types.TrackerState): boolean {
  // TODO (mm) ideally userInfo should be null until we get a response from the server
  // Same with proofs (instead of empty array). So we know the difference between
  // not having data and having empty data.

  if (!state) {
    return true
  }

  // This logic is only valid for info on a keybase user (non user trackers are different)
  if (state.type !== trackerType) {
    return false
  }

  return !state.userInfo || state.userInfo.followersCount === -1
}

function bufferToNiceHexString(fingerPrint: Buffer): string {
  try {
    const match = fingerPrint
      .toString('hex')
      .slice(-16)
      .toUpperCase()
      .match(/(.{4})(.{4})(.{4})(.{4})/)
    if (match) {
      return match.slice(1).join(' ')
    }
  } catch (error) {}
  return ''
}

const initialState: Types.State = {
  cachedIdentifies: {},
  nonUserTrackers: {},
  pendingIdentifies: {},
  serverStarted: false,
  userTrackers: {},
}

const initialTrackerState = (username: string): Types.TrackerState => ({
  closed: true,
  currentlyFollowing: false,
  eldestKidChanged: false,
  error: null,
  hidden: false,
  lastAction: null,
  needTrackTokenDismiss: false,
  proofs: [],
  reason: null,
  selectedTeam: '',
  serverActive: true,
  shouldFollow: true,
  stellarFederationAddress: null,
  tlfs: [],
  trackToken: null,
  trackerState: checking,
  trackers: [],
  trackersLoaded: false,
  tracking: [],
  type: trackerType,
  userInfo: {
    avatar: null,
    bio: '',
    followersCount: -1,
    followingCount: -1,
    followsYou: false,
    fullname: '', // TODO get this info,
    location: '', // TODO: get this information
    showcasedTeams: [],
    uid: '',
  },
  username,
  waiting: false,
})

const initialNonUserState = (assertion: string): Types.NonUserState => ({
  closed: true,
  error: null,
  hidden: true,
  inviteLink: null,
  isPrivate: false,
  name: assertion,
  reason: '',
  type: nonUserType,
})

function mapValueToKey<K: string, V>(obj: {[key: K]: V}, tag: V): ?K {
  return Object.keys(obj).find(key => obj[key] === tag)
}

function stateToColor(state: Types.SimpleProofState): string {
  if (state === normal) {
    return 'green'
  } else if (state === warning) {
    return 'yellow'
  } else if (state === error) {
    return 'red'
  }

  return 'gray'
}

function proofStateToSimpleProofState(
  proofState: RPCTypes.ProofState,
  diff: ?RPCTypes.TrackDiff,
  remoteDiff: ?RPCTypes.TrackDiff,
  breaksTracking: boolean
): ?Types.SimpleProofState {
  if (breaksTracking) {
    return error
  }
  // If there is no difference in what we've tracked from the server or remote resource it's good.
  if (
    diff &&
    remoteDiff &&
    diff.type === RPCTypes.identifyCommonTrackDiffType.none &&
    remoteDiff.type === RPCTypes.identifyCommonTrackDiffType.none
  ) {
    return normal
  }

  const statusName: ?string = mapValueToKey(RPCTypes.proveCommonProofState, proofState)
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

function diffAndStatusMeta(
  diff: ?RPCTypes.TrackDiffType,
  proofResult: ?RPCTypes.ProofResult,
  isTracked: boolean
): {diffMeta: ?Types.SimpleProofMeta, statusMeta: ?Types.SimpleProofMeta} {
  const {status, state} = proofResult || {}

  if (status && status !== RPCTypes.proveCommonProofStatus.ok && isTracked) {
    return {
      diffMeta: metaIgnored,
      statusMeta: null,
    }
  }

  return {
    diffMeta: trackDiffToSimpleProofMeta(diff),
    statusMeta: proofStatusToSimpleProofMeta(status, state),
  }

  function trackDiffToSimpleProofMeta(diff: ?RPCTypes.TrackDiffType): ?Types.SimpleProofMeta {
    if (!diff) {
      return null
    }

    return {
      [RPCTypes.identifyCommonTrackDiffType.none]: null,
      [RPCTypes.identifyCommonTrackDiffType.error]: null,
      [RPCTypes.identifyCommonTrackDiffType.clash]: null,
      [RPCTypes.identifyCommonTrackDiffType.revoked]: metaDeleted,
      [RPCTypes.identifyCommonTrackDiffType.upgraded]: metaUpgraded,
      [RPCTypes.identifyCommonTrackDiffType.new]: metaNew,
      [RPCTypes.identifyCommonTrackDiffType.remoteFail]: null,
      [RPCTypes.identifyCommonTrackDiffType.remoteWorking]: null,
      [RPCTypes.identifyCommonTrackDiffType.remoteChanged]: null,
      [RPCTypes.identifyCommonTrackDiffType.newEldest]: null,
    }[diff]
  }

  function proofStatusToSimpleProofMeta(
    status: ?RPCTypes.ProofStatus,
    state: ?RPCTypes.ProofState
  ): ?Types.SimpleProofMeta {
    if (!status) {
      return null
    }

    // FIXME: uncomment once the backend indicates pending-state failures based
    // on low proof age.
    // if (state === proveCommonProofState.tempFailure) {
    //   return metaPending
    // }

    // The full mapping between the proof status we get back from the server
    // and a simplified representation that we show the users.
    return {
      [RPCTypes.proveCommonProofStatus.none]: null,
      [RPCTypes.proveCommonProofStatus.ok]: null,
      [RPCTypes.proveCommonProofStatus.local]: null,
      [RPCTypes.proveCommonProofStatus.found]: null,
      [RPCTypes.proveCommonProofStatus.baseError]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.hostUnreachable]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.permissionDenied]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.failedParse]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.dnsError]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.authFailed]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.http500]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.timeout]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.internalError]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.baseHardError]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.notFound]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.contentFailure]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.badUsername]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.badRemoteId]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.textNotFound]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.badArgs]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.contentMissing]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.titleNotFound]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.serviceError]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.torSkipped]: null,
      [RPCTypes.proveCommonProofStatus.torIncompatible]: null,
      [RPCTypes.proveCommonProofStatus.http300]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.http400]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.httpOther]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.emptyJson]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.deleted]: metaDeleted,
      [RPCTypes.proveCommonProofStatus.serviceDead]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.badSignature]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.badApiUrl]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.unknownType]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.noHint]: metaUnreachable,
      [RPCTypes.proveCommonProofStatus.badHintText]: metaUnreachable,
    }[status]
  }
}

// TODO Have the service give this information.
// Currently this is copied from the website: https://github.com/keybase/keybase/blob/658aa97a9ad63733444298353a528e7f8499d8b9/lib/mod/user_lol.iced#L971
function proofUrlToProfileUrl(proofType: number, name: string, key: ?string, humanUrl: ?string): string {
  switch (proofType) {
    case RPCTypes.proveCommonProofType.dns:
      return `http://${name}`
    case RPCTypes.proveCommonProofType.genericWebSite:
      return `${key || ''}://${name}`
    case RPCTypes.proveCommonProofType.twitter:
      return `https://twitter.com/${name}`
    case RPCTypes.proveCommonProofType.facebook:
      return `https://facebook.com/${name}`
    case RPCTypes.proveCommonProofType.github:
      return `https://github.com/${name}`
    case RPCTypes.proveCommonProofType.reddit:
      return `https://reddit.com/user/${name}`
    case RPCTypes.proveCommonProofType.hackernews:
      return `https://news.ycombinator.com/user?id=${name}`
    default:
      return humanUrl || ''
  }
}

function remoteProofToProofType(rp: RPCTypes.RemoteProof): PlatformsExpandedType {
  if (rp.proofType === RPCTypes.proveCommonProofType.genericWebSite) {
    return rp.key === 'http' ? 'http' : 'https'
  } else {
    // $FlowIssue
    return mapValueToKey(RPCTypes.proveCommonProofType, rp.proofType)
  }
}

const revokedProofToProof = (rv: RPCTypes.RevokedProof): Types.Proof => ({
  color: stateToColor(error),
  humanUrl: '',
  id: rv.proof.sigID,
  isTracked: false,
  mTime: rv.proof.mTime,
  meta: metaDeleted,
  name: rv.proof.displayMarkup,
  profileUrl: '',
  state: error,
  type: remoteProofToProofType(rv.proof),
})

function remoteProofToProof(
  username: string,
  oldProofState: Types.SimpleProofState,
  rp: RPCTypes.RemoteProof,
  lcr: ?RPCTypes.LinkCheckResult
): Types.Proof {
  const proofState: Types.SimpleProofState =
    (lcr &&
      proofStateToSimpleProofState(lcr.proofResult.state, lcr.diff, lcr.remoteDiff, lcr.breaksTracking)) ||
    oldProofState
  const isTracked = !!(
    lcr &&
    lcr.diff &&
    lcr.diff.type === RPCTypes.identifyCommonTrackDiffType.none &&
    !lcr.breaksTracking
  )
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
  proofs: Array<Types.Proof>,
  rp: RPCTypes.RemoteProof,
  lcr: RPCTypes.LinkCheckResult
): Array<Types.Proof> {
  let found = false
  let updated = proofs.map(proof => {
    if (proof.id === rp.sigID) {
      found = true
      return remoteProofToProof(username, proof.state, rp, lcr)
    }
    return proof
  })

  if (!found) {
    updated.push(remoteProofToProof(username, checking, rp, lcr))
  }

  return updated
}

function overviewStateOfProofs(proofs: Array<Types.Proof>): Types.OverviewProofState {
  const allOk = proofs.every(p => p.state === normal)
  const [anyWarnings, anyError, anyPending] = [warning, error, checking].map(s =>
    proofs.some(p => p.state === s)
  )
  const [anyDeletedProofs, anyUnreachableProofs, anyUpgradedProofs, anyNewProofs, anyPendingProofs] = [
    metaDeleted,
    metaUnreachable,
    metaUpgraded,
    metaNew,
    metaPending,
  ].map(m => proofs.some(p => p.meta === m))
  const anyChanged = proofs.some(proof => proof.meta && proof.meta !== metaNone)
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

function deriveSimpleProofState(
  eldestKidChanged: boolean,
  {allOk, anyWarnings, anyError, anyPending, anyDeletedProofs, anyUnreachableProofs}: Types.OverviewProofState
): Types.SimpleProofState {
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

function deriveTrackerMessage(
  username: string,
  currentlyFollowing: boolean,
  {allOk, anyDeletedProofs, anyUnreachableProofs, anyUpgradedProofs, anyNewProofs}: Types.OverviewProofState
): ?string {
  if (allOk || !currentlyFollowing) {
    return null
  } else if (anyDeletedProofs || anyUnreachableProofs) {
    return `Some of ${username}'s proofs have changed since you last followed them.`
  } else if (anyUpgradedProofs) {
    return `${username} added new proofs to their profile since you last followed them.`
  }
}

const deriveShouldFollow = ({allOk}: {allOk: boolean}): boolean => allOk
const dedupeProofs = (proofs: Array<Types.Proof>): Array<Types.Proof> => uniqBy(proofs, 'id')

export {
  bufferToNiceHexString,
  cachedIdentifyGoodUntil,
  checking,
  dedupeProofs,
  deriveShouldFollow,
  deriveSimpleProofState,
  deriveTrackerMessage,
  error,
  initialNonUserState,
  initialState,
  initialTrackerState,
  isLoading,
  metaDeleted,
  metaIgnored,
  metaNew,
  metaNone,
  metaPending,
  metaUnreachable,
  metaUpgraded,
  nonUserType,
  normal,
  overviewStateOfProofs,
  profileFromUI,
  remoteProofToProof,
  revoked,
  revokedProofToProof,
  rpcUpdateTimerSeconds,
  trackerType,
  updateProof,
  warning,
}
