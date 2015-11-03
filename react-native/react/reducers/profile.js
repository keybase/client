'use strict'

import * as Constants from '../constants/profile'
import Immutable from 'immutable'

const initialState = Immutable.Map()

export default function (state = initialState, action) {
  let update = null

  switch (action.type) {
    case Constants.init:
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
    case Constants.receivedDisplayKey:
      update = {
        proofs: {
          pgp: action.key
        }
      }
      break
    case Constants.checkingNetworks:
      update = {
        proofs: {
          ...action.networks.reduce((a, b) => { a[b] = {}; return a }, {})
        }
      }
      break
    case Constants.networkUpdate:
      update = {
        proofs: {
          ...{
            [action.network]: action.update
          }
        }
      }
      break
    case Constants.summaryLoaded:
      return state.mergeDeep(action.summaries)
    default:
      return state
  }

  return state.mergeDeep({ [action.username]: update })
}
