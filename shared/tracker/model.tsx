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

export const showableWotEntry = (entry: T.Tracker.WebOfTrustEntry): boolean =>
  entry.status === T.RPCGen.WotStatusType.accepted || entry.status === T.RPCGen.WotStatusType.proposed
