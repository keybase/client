'use strict'

import * as types from '../constants/profileActionTypes'
import Immutable from 'immutable'

const initialState = Immutable.Map()

export default function (state = initialState, action) {
  let update = null

  switch (action.type) {
    case types.INIT_PROFILE:
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
    case types.PROFILE_RECEIVED_DISPLAY_KEY:
      update = {
        proofs: {
          pgp: action.key
        }
      }
      break
    case types.PROFILE_CHECKING_NETWORKS:
      update = {
        proofs: {
          ...action.networks.reduce((a, b) => { a[b] = {}; return a }, {})
        }
      }
      break
    case types.PROFILE_NETWORK_UPDATE:
      update = {
        proofs: {
          ...{
            [action.network]: action.update
          }
        }
      }
      break
    case types.PROFILE_SUMMARY_LOADED:
      return state.mergeDeep(action.summaries)
    default:
      return state
  }

  return state.mergeDeep({ [action.username]: update })
}
