import * as RPCTypes from './types/rpc-gen'
import type * as Types from './types/tracker2'
import type {TypedState} from './reducer'

const emptyArray: any = []
const emptyMap: any = new Map()

export const makeState = (): Types.State => ({
  proofSuggestions: emptyArray,
  showTrackerSet: new Set(),
  usernameToDetails: new Map(),
  usernameToNonUserDetails: new Map(),
})

export const noDetails = Object.freeze<Types.Details>({
  assertions: emptyMap,
  blocked: false,
  guiID: '',
  hidFromFollowers: false,
  reason: '',
  resetBrokeTrack: false,
  state: 'unknown',
  stellarHidden: false,
  teamShowcase: emptyArray,
  username: '',
  webOfTrustEntries: emptyArray,
})

export const noNonUserDetails = Object.freeze<Types.NonUserDetails>({
  assertionKey: '',
  assertionValue: '',
  description: '',
  siteIcon: emptyArray,
  siteIconDarkmode: emptyArray,
  siteIconFull: emptyArray,
  siteIconFullDarkmode: emptyArray,
  siteURL: '',
})

export const generateGUIID = () => Math.floor(Math.random() * 0xfffffffffffff).toString(16)

export const noAssertion = Object.freeze<Types.Assertion>({
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

export const rpcResultToStatus = (result: RPCTypes.Identify3ResultType) => {
  switch (result) {
    case RPCTypes.Identify3ResultType.ok:
      return 'valid'
    case RPCTypes.Identify3ResultType.broken:
      return 'broken'
    case RPCTypes.Identify3ResultType.needsUpgrade:
      return 'needsUpgrade'
    case RPCTypes.Identify3ResultType.canceled:
      return 'error'
  }
}

export const rpcRowColorToColor = (color: RPCTypes.Identify3RowColor): Types.AssertionColor => {
  switch (color) {
    case RPCTypes.Identify3RowColor.blue:
      return 'blue'
    case RPCTypes.Identify3RowColor.red:
      return 'red'
    case RPCTypes.Identify3RowColor.black:
      return 'black'
    case RPCTypes.Identify3RowColor.green:
      return 'green'
    case RPCTypes.Identify3RowColor.gray:
      return 'gray'
    case RPCTypes.Identify3RowColor.yellow:
      return 'yellow'
    case RPCTypes.Identify3RowColor.orange:
      return 'orange'
  }
}

export const rpcRowStateToAssertionState = (state: RPCTypes.Identify3RowState): Types.AssertionState => {
  switch (state) {
    case RPCTypes.Identify3RowState.checking:
      return 'checking'
    case RPCTypes.Identify3RowState.valid:
      return 'valid'
    case RPCTypes.Identify3RowState.error:
      return 'error'
    case RPCTypes.Identify3RowState.warning:
      return 'warning'
    case RPCTypes.Identify3RowState.revoked:
      return 'revoked'
  }
}

export const rpcAssertionToAssertion = (row: RPCTypes.Identify3Row): Types.Assertion => ({
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

export const rpcSuggestionToAssertion = (s: RPCTypes.ProofSuggestion): Types.Assertion => {
  const ourKey = s.key === 'web' ? 'dnsOrGenericWebSite' : s.key
  return {
    ...noAssertion,
    // we have a special case where we want to differentiate between a dns or web proof, so we have a special pseudo type we use
    assertionKey: ourKey,
    belowFold: s.belowFold,
    color: 'gray',
    metas: (s.metas || []).map(m => ({color: rpcRowColorToColor(m.color), label: m.label})),
    pickerSubtext: s.pickerSubtext,
    pickerText: s.pickerText,
    proofURL: '',
    siteIcon: s.profileIcon || [],
    siteIconDarkmode: s.profileIconDarkmode || [],
    siteIconFull: s.pickerIcon || [],
    siteIconFullDarkmode: s.pickerIconDarkmode || [],
    siteURL: '',
    state: 'suggestion',
    type: ourKey,
    value: s.profileText,
  }
}

const _scoreAssertionKey = (a: string) => {
  switch (a) {
    case 'pgp':
      return 110
    case 'twitter':
      return 100
    case 'facebook':
      return 90
    case 'github':
      return 80
    case 'reddit':
      return 75
    case 'hackernews':
      return 70
    case 'https':
      return 60
    case 'http':
      return 50
    case 'dns':
      return 40
    case 'stellar':
      return 30
    case 'btc':
      return 20
    case 'zcash':
      return 10
    default:
      return 1
  }
}
export const sortAssertionKeys = (a: string, b: string) => {
  const pa = a.split(':')
  const pb = b.split(':')

  const typeA = pa[0]
  const typeB = pb[0]

  if (typeA === typeB) {
    return pa[1].localeCompare(pb[1])
  }

  const scoreA = _scoreAssertionKey(typeB)
  const scoreB = _scoreAssertionKey(typeA)
  return scoreA - scoreB
}

export const waitingKey = 'tracker2:waitingKey'
export const profileLoadWaitingKey = 'tracker2:profileLoad'
export const nonUserProfileLoadWaitingKey = 'tracker2:nonUserProfileLoad'

export const followThem = (state: TypedState, username: string) => state.config.following.has(username)
export const followsYou = (state: TypedState, username: string) => state.config.followers.has(username)
export const getDetails = (state: TypedState, username: string) =>
  state.tracker2.usernameToDetails.get(username) || noDetails
export const getNonUserDetails = (state: TypedState, username: string) =>
  state.tracker2.usernameToNonUserDetails.get(username) || noNonUserDetails

export const guiIDToUsername = (state: Types.State, guiID: string) => {
  const det = [...state.usernameToDetails.values()].find(d => d.guiID === guiID)
  return det ? det.username : null
}

// when suggestions are implemented, we'll probably want to show rejected entries if they have a suggestion
export const showableWotEntry = (entry: Types.WebOfTrustEntry): boolean =>
  entry.status === RPCTypes.WotStatusType.accepted || entry.status === RPCTypes.WotStatusType.proposed
