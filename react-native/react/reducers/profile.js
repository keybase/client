'use strict'

import * as Constants from '../constants/profile'
import Immutable from 'immutable'

const initialState = Immutable.Map()

export default function (state = initialState, action) {
  let update = null

  switch (action.type) {
    case Constants.initProfile:
      update = {
        username: action.username,
        avatar: action.avatar,
        proofs: {},
        summary: {
          bio: null,
          fullName: null
        }
      }
      break
    case Constants.profileReceivedDisplayKey:
      update = {
        proofs: {
          pgp: action.key
        }
      }
      break
    case Constants.profileCheckingNetworks:
      update = {
        proofs: {
          ...action.networks.reduce((a, b) => { a[b] = {}; return a }, {})
        }
      }
      break
    case Constants.profileNetworkUpdate:
      update = {
        proofs: {
          ...{
            [action.network]: action.update
          }
        }
      }
      break
    case Constants.profileSummaryLoaded:
      return state.mergeDeep(action.summaries)
    default:
      return state
  }

  return state.mergeDeep({ [action.username]: update })
}
