// @flow
import * as Types from './types/tracker2'
import * as RPCTypes from './types/rpc-gen'
import * as I from 'immutable'
import type {TypedState} from './reducer'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  proofSuggestions: I.List(),
  usernameToDetails: I.Map(),
})

export const makeDetails: I.RecordFactory<Types._Details> = I.Record({
  assertions: I.Map(),
  bio: null,
  followers: I.OrderedSet(),
  followersCount: null,
  following: I.OrderedSet(),
  followingCount: null,
  fullname: null,
  guiID: null,
  location: null,
  reason: '',
  showTracker: false,
  state: 'error',
  teamShowcase: I.List(),
  username: '',
})

export const generateGUIID = () => Math.floor(Math.random() * 0xfffffffffffff).toString(16)

export const makeAssertion: I.RecordFactory<Types._Assertion> = I.Record({
  assertionKey: '',
  color: 'gray',
  metas: [],
  proofURL: '',
  sigID: '',
  siteIcon: '',
  siteURL: '',
  state: 'error',
  type: '',
  value: '',
})

export const makeMeta: I.RecordFactory<Types._AssertionMeta> = I.Record({
  color: 'black',
  label: '',
})

export const makeTeamShowcase: I.RecordFactory<Types._TeamShowcase> = I.Record({
  description: '',
  isOpen: false,
  membersCount: 0,
  name: '',
  publicAdmins: [],
})

export const rpcResultToStatus = (result: RPCTypes.Identify3ResultType) => {
  switch (result) {
    case RPCTypes.identify3UiIdentify3ResultType.ok:
      return 'valid'
    case RPCTypes.identify3UiIdentify3ResultType.broken:
      return 'broken'
    case RPCTypes.identify3UiIdentify3ResultType.needsUpgrade:
      return 'needsUpgrade'
    case RPCTypes.identify3UiIdentify3ResultType.canceled:
      return 'error'
    default:
    // flow is confused by number enums
    // Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(result)
  }
  return 'error'
}

export const rpcRowColorToColor = (color: RPCTypes.Identify3RowColor) => {
  switch (color) {
    case RPCTypes.identify3UiIdentify3RowColor.blue:
      return 'blue'
    case RPCTypes.identify3UiIdentify3RowColor.red:
      return 'red'
    case RPCTypes.identify3UiIdentify3RowColor.black:
      return 'black'
    case RPCTypes.identify3UiIdentify3RowColor.green:
      return 'green'
    case RPCTypes.identify3UiIdentify3RowColor.gray:
      return 'gray'
    case RPCTypes.identify3UiIdentify3RowColor.yellow:
      return 'yellow'
    case RPCTypes.identify3UiIdentify3RowColor.orange:
      return 'orange'
    default:
      throw new Error('Invalid identifyv3 row color ' + color)
  }
}

export const rpcRowStateToAssertionState = (state: RPCTypes.Identify3RowState): Types.AssertionState => {
  switch (state) {
    case RPCTypes.identify3UiIdentify3RowState.checking:
      return 'checking'
    case RPCTypes.identify3UiIdentify3RowState.valid:
      return 'valid'
    case RPCTypes.identify3UiIdentify3RowState.error:
      return 'error'
    case RPCTypes.identify3UiIdentify3RowState.warning:
      return 'warning'
    case RPCTypes.identify3UiIdentify3RowState.revoked:
      return 'revoked'
    default:
      throw new Error('Invalid identifyv3 row state ' + state)
  }
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

export const followThem = (state: TypedState, username: string) => state.config.following.has(username)
export const followsYou = (state: TypedState, username: string) => state.config.followers.has(username)
export const getDetails = (state: TypedState, username: string) =>
  state.tracker2.usernameToDetails.get(username, noDetails)

export const guiIDToUsername = (state: Types.State, guiID: string) => {
  const d = state.usernameToDetails.find(d => d.guiID === guiID)
  return d ? d.username : null
}
