import * as T from '@/constants/types'

export const noDetails: T.Tracker.Details = {
  assertions: new Map(),
  blocked: false,
  followers: undefined,
  followersCount: undefined,
  following: undefined,
  followingCount: undefined,
  guiID: '',
  hidFromFollowers: false,
  reason: '',
  resetBrokeTrack: false,
  state: 'unknown' as const,
  stellarHidden: false,
  teamShowcase: [],
  username: '',
  webOfTrustEntries: [],
}

export const makeDetails = (username: string): T.Tracker.Details => ({
  ...noDetails,
  assertions: new Map(),
  teamShowcase: [],
  username,
  webOfTrustEntries: [],
})

export const cloneDetails = (details: T.Tracker.Details): T.Tracker.Details => ({
  ...details,
  assertions: new Map(details.assertions ?? []),
  followers: details.followers ? new Set(details.followers) : details.followers,
  following: details.following ? new Set(details.following) : details.following,
  teamShowcase: [...(details.teamShowcase ?? [])],
  webOfTrustEntries: [...(details.webOfTrustEntries ?? [])],
})

export const noNonUserDetails: T.Tracker.NonUserDetails = {
  assertionKey: '',
  assertionValue: '',
  description: '',
  siteIcon: [],
  siteIconDarkmode: [],
  siteIconFull: [],
  siteIconFullDarkmode: [],
  siteURL: '',
}

export const noAssertion = Object.freeze<T.Tracker.Assertion>({
  assertionKey: '',
  belowFold: false,
  color: 'gray',
  kid: '',
  metas: [],
  pickerSubtext: '',
  pickerText: '',
  priority: -1,
  proofURL: '',
  sigID: '',
  siteIcon: [],
  siteIconDarkmode: [],
  siteIconFull: [],
  siteIconFullDarkmode: [],
  siteURL: '',
  state: 'error',
  timestamp: 0,
  type: '',
  value: '',
})

const rpcRowColorToColor = (color: T.RPCGen.Identify3RowColor): T.Tracker.AssertionColor => {
  switch (color) {
    case T.RPCGen.Identify3RowColor.blue:
      return 'blue'
    case T.RPCGen.Identify3RowColor.red:
      return 'red'
    case T.RPCGen.Identify3RowColor.black:
      return 'black'
    case T.RPCGen.Identify3RowColor.green:
      return 'green'
    case T.RPCGen.Identify3RowColor.gray:
      return 'gray'
    case T.RPCGen.Identify3RowColor.yellow:
      return 'yellow'
    case T.RPCGen.Identify3RowColor.orange:
      return 'orange'
  }
}

const rpcRowStateToAssertionState = (state: T.RPCGen.Identify3RowState): T.Tracker.AssertionState => {
  switch (state) {
    case T.RPCGen.Identify3RowState.checking:
      return 'checking'
    case T.RPCGen.Identify3RowState.valid:
      return 'valid'
    case T.RPCGen.Identify3RowState.error:
      return 'error'
    case T.RPCGen.Identify3RowState.warning:
      return 'warning'
    case T.RPCGen.Identify3RowState.revoked:
      return 'revoked'
  }
}

export const identifyResultToDetailsState = (
  result: T.RPCGen.Identify3ResultType
): T.Tracker.DetailsState => {
  switch (result) {
    case T.RPCGen.Identify3ResultType.ok:
      return 'valid'
    case T.RPCGen.Identify3ResultType.broken:
      return 'broken'
    case T.RPCGen.Identify3ResultType.needsUpgrade:
      return 'needsUpgrade'
    case T.RPCGen.Identify3ResultType.canceled:
    default:
      return 'error'
  }
}

export const rpcAssertionToAssertion = (row: T.RPCGen.Identify3Row): T.Tracker.Assertion => ({
  ...noAssertion,
  assertionKey: `${row.key}:${row.value}`,
  color: rpcRowColorToColor(row.color),
  kid: row.kid || ',',
  metas: (row.metas || []).map(m => ({color: rpcRowColorToColor(m.color), label: m.label})),
  priority: row.priority,
  proofURL: row.proofURL,
  sigID: row.sigID,
  siteIcon: row.siteIcon || [],
  siteIconDarkmode: row.siteIconDarkmode || [],
  siteIconFull: row.siteIconFull || [],
  siteIconFullDarkmode: row.siteIconFullDarkmode || [],
  siteURL: row.siteURL,
  state: rpcRowStateToAssertionState(row.state),
  timestamp: row.ctime,
  type: row.key,
  value: row.value,
  wotProof: row.wotProof ?? undefined,
})

export const updateTrackerDetailsResult = (
  prev: T.Tracker.Details,
  result: T.Tracker.DetailsState,
  reason?: string
): T.Tracker.Details => {
  const details = cloneDetails(prev)
  const newReason =
    reason ||
    (result === 'broken' &&
      `Some of ${details.username}'s proofs have changed since you last followed them.`)
  return {
    ...details,
    reason:
      !details.resetBrokeTrack || details.reason.length === 0
        ? newReason || details.reason
        : details.reason,
    resetBrokeTrack: result === 'valid' ? false : details.resetBrokeTrack,
    state: result,
  }
}

export const updateTrackerDetailsBlocked = (
  prev: T.Tracker.Details,
  blockedSummary: T.RPCGen.UserBlockedSummary
): T.Tracker.Details => {
  const {blocker, blocks} = blockedSummary
  const userBlocks = blocks?.[prev.username]
  if (!userBlocks?.length && blocker !== prev.username) {
    return prev
  }

  const next = {
    ...cloneDetails(prev),
  }

  if (blocker === prev.username && next.followers) {
    for (const [username, blockStates] of Object.entries(blocks ?? {})) {
      for (const blockState of blockStates ?? []) {
        if (blockState.blockType === T.RPCGen.UserBlockType.follow && blockState.blocked) {
          next.followers.delete(username)
        }
      }
    }
    next.followersCount = next.followers.size
  }

  for (const blockState of userBlocks ?? []) {
    if (blockState.blockType === T.RPCGen.UserBlockType.chat) {
      next.blocked = blockState.blocked
    } else {
      next.hidFromFollowers = blockState.blocked
    }
  }

  return next
}

export const updateTrackerDetailsRow = (
  prev: T.Tracker.Details,
  row: T.RPCGen.Identify3Row
): T.Tracker.Details => {
  const details = cloneDetails(prev)
  const assertion = rpcAssertionToAssertion(row)
  const assertions = new Map(details.assertions ?? [])
  assertions.set(assertion.assertionKey, assertion)
  return {...details, assertions}
}

export const updateTrackerDetailsReset = (prev: T.Tracker.Details): T.Tracker.Details => {
  const details = cloneDetails(prev)
  return {
    ...details,
    reason: `${details.username} reset their account since you last followed them.`,
    resetBrokeTrack: true,
  }
}

export const updateTrackerDetailsUserCard = (
  prev: T.Tracker.Details,
  card: T.RPCGen.UserCard
): T.Tracker.Details => {
  const details = cloneDetails(prev)
  return {
    ...details,
    bio: card.bio,
    blocked: card.blocked,
    followersCount: card.unverifiedNumFollowers,
    followingCount: card.unverifiedNumFollowing,
    fullname: card.fullName,
    hidFromFollowers: card.hidFromFollowers,
    location: card.location,
    stellarHidden: card.stellarHidden,
    teamShowcase:
      card.teamShowcase?.map(t => ({
        description: t.description,
        isOpen: t.open,
        membersCount: t.numMembers,
        name: t.fqName,
        publicAdmins: t.publicAdmins ?? [],
      })) ?? [],
  }
}

export const updateTrackerDetailsSummary = (
  prev: T.Tracker.Details,
  summary: T.RPCGen.Identify3Summary
): T.Tracker.Details => ({...cloneDetails(prev), numAssertionsExpected: summary.numProofsToCheck})

export const showableWotEntry = (entry: T.Tracker.WebOfTrustEntry): boolean =>
  entry.status === T.RPCGen.WotStatusType.accepted || entry.status === T.RPCGen.WotStatusType.proposed
