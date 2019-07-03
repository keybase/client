import * as Types from './types/tracker2'
import * as RPCTypes from './types/rpc-gen'
import * as I from 'immutable'
import {TypedState} from './reducer'

export const makeState = I.Record<Types._State>({
  proofSuggestions: I.List(),
  usernameToDetails: I.Map(),
})

export const makeDetails = I.Record<Types._Details>({
  assertions: I.Map(),
  bio: null,
  blocked: false,
  followers: null,
  followersCount: null,
  following: null,
  followingCount: null,
  fullname: null,
  guiID: null,
  location: null,
  reason: '',
  registeredForAirdrop: false,
  showTracker: false,
  state: 'error',
  teamShowcase: I.List(),
  username: '',
})

export const generateGUIID = () => Math.floor(Math.random() * 0xfffffffffffff).toString(16)

export const makeAssertion = I.Record<Types._Assertion>({
  assertionKey: '',
  belowFold: false,
  color: 'gray',
  kid: '',
  metas: [],
  pickerIcon: [],
  pickerSubtext: '',
  pickerText: '',
  priority: -1,
  proofURL: '',
  sigID: '',
  siteIcon: [],
  siteIconFull: [],
  siteURL: '',
  state: 'error',
  timestamp: 0,
  type: '',
  value: '',
})

export const makeMeta = I.Record<Types._AssertionMeta>({
  color: 'black',
  label: '',
})

export const makeTeamShowcase = I.Record<Types._TeamShowcase>({
  description: '',
  isOpen: false,
  membersCount: 0,
  name: '',
  publicAdmins: [],
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
    default:
    // flow is confused by number enums
    // Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(result)
  }
  return 'error'
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
    default:
      throw new Error('Invalid identifyv3 row color ' + color)
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
    default:
      throw new Error('Invalid identifyv3 row state ' + state)
  }
}

export const rpcAssertionToAssertion = (row: RPCTypes.Identify3Row): Types.Assertion =>
  makeAssertion({
    assertionKey: `${row.key}:${row.value}`,
    color: rpcRowColorToColor(row.color),
    kid: row.kid || ',',
    metas: (row.metas || []).map(m => ({color: rpcRowColorToColor(m.color), label: m.label})).map(makeMeta),
    priority: row.priority,
    proofURL: row.proofURL,
    sigID: row.sigID,
    siteIcon: row.siteIcon || [],
    siteIconFull: row.siteIconFull || [],
    siteURL: row.siteURL,
    state: rpcRowStateToAssertionState(row.state),
    timestamp: row.ctime,
    type: row.key,
    value: row.value,
  })

export const rpcSuggestionToAssertion = (s: RPCTypes.ProofSuggestion): Types.Assertion => {
  const ourKey = s.key === 'web' ? 'dnsOrGenericWebSite' : s.key
  return makeAssertion({
    // we have a special case where we want to differentiate between a dns or web proof, so we have a special pseudo type we use
    assertionKey: ourKey,
    belowFold: s.belowFold,
    color: 'gray',
    metas: (s.metas || []).map(m => ({color: rpcRowColorToColor(m.color), label: m.label})).map(makeMeta),
    pickerIcon: s.pickerIcon || [],
    pickerSubtext: s.pickerSubtext,
    pickerText: s.pickerText,
    proofURL: '',
    siteIcon: s.profileIcon || [],
    siteURL: '',
    state: 'suggestion',
    type: ourKey,
    value: s.profileText,
  })
}

const _scoreAssertionKey = a => {
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

export const noDetails = makeDetails({})
export const noAssertion = makeAssertion({})
export const waitingKey = 'tracker2:waitingKey'
export const profileLoadWaitingKey = 'tracker2:profileLoad'

export const followThem = (state: TypedState, username: string) => state.config.following.has(username)
export const followsYou = (state: TypedState, username: string) => state.config.followers.has(username)
export const getDetails = (state: TypedState, username: string) =>
  state.tracker2.usernameToDetails.get(username, noDetails)

export const guiIDToUsername = (state: Types.State, guiID: string) => {
  const d = state.usernameToDetails.find(d => d.guiID === guiID)
  return d ? d.username : null
}
