// @flow
import * as Types from './types/profile2'
import * as RPCTypes from './types/rpc-gen'
import * as I from 'immutable'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  usernameToDetails: I.Map(),
})

export const makeDetails: I.RecordFactory<Types._Details> = I.Record({
  assertions: I.Map(),
  bio: null,
  followThem: null,
  followersCount: null,
  followingCount: null,
  followsYou: null,
  fullname: null,
  guiID: null,
  location: null,
  publishedTeams: null,
  reason: '',
  showTracker: false,
  state: 'error',
  username: '',
})

export const generateGUIID = () =>
  Buffer.from([...Array(8)].map(() => Math.floor(Math.random() * 256))).toString('utf8')

export const makeAssertion: I.RecordFactory<Types._Assertion> = I.Record({
  assertionKey: '',
  metas: [],
  proofURL: '',
  siteIcon: '',
  siteURL: '',
  state: 'error',
  type: '',
  value: '',
})

export const rpcResultToStatus = (result: RPCTypes.Identify3ResultType) => {
  switch (result) {
    case RPCTypes.identify3UiIdentify3ResultType.ok:
      return 'valid'
    case RPCTypes.identify3UiIdentify3ResultType.broken:
      return 'error'
    case RPCTypes.identify3UiIdentify3ResultType.needsUpgrade:
      return 'needsUpgrade'
    case RPCTypes.identify3UiIdentify3ResultType.canceled:
      return 'canceled'
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
      return 'black'
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
      return 'error'
  }
}

export const noDetails = makeDetails({})
export const noAssertion = makeAssertion({})
export const waitingKey = 'profile2:waitingKey'
