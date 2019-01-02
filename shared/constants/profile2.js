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
  metas: [],
  proofURL: '',
  site: '',
  siteIcon: '',
  siteURL: '',
  state: 'error',
  username: '',
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

export const noDetails = makeDetails({})
export const noAssertion = makeAssertion({})
export const waitingKey = 'profile2:waitingKey'
