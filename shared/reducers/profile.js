import * as Constants from '../constants/profile'
import * as CommonConstants from '../constants/common'
import Immutable from 'immutable'

const initialState = Immutable.Map()

export default function (state = initialState, action) {
  let update = null

  switch (action.type) {
    case CommonConstants.resetStore:
      return initialState.asMutable().asImmutable()

    case Constants.initProfile:
      update = {
        username: action.payload.username,
        avatar: null,
        proofs: {},
        summary: {
          bio: null,
          fullName: null,
        },
      }
      break
    case Constants.profileReceivedDisplayKey:
      update = {
        proofs: {
          pgp: action.payload.key,
        },
      }
      break
    case Constants.profileCheckingNetworks:
      update = {
        proofs: {
          ...action.payload.networks.reduce((a, b) => { a[b] = {}; return a }, {}),
        },
      }
      break
    case Constants.profileNetworkUpdate:
      update = {
        proofs: {
          ...{
            [action.payload.network]: action.payload.update,
          },
        },
      }
      break
    case Constants.profileSummaryLoaded:
      return state.mergeDeep(action.payload)
    default:
      return state
  }

  return state.mergeDeep({[action.payload.username]: update})
}
