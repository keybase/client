'use strict'

import * as types from '../constants/profileActionTypes'
import Immutable from 'immutable'

const initialState = Immutable.Map()

export default function (state = initialState, action) {
  switch (action.type) {
    case types.INIT_PROFILE:
      return state.mergeDeep({
        [action.username]: {
          username: action.username,
          proofs: {}
        }
      })
    case types.PROFILE_RECEIVED_DISPLAY_KEY:
      return state.mergeDeep({
        [action.username]: {
          proofs: {
            pgp: action.key
          }
        }
      })
    case types.PROFILE_CHECKING_NETWORKS:
      return state.mergeDeep({
        [action.username]: {
          proofs: {
            ...action.networks.reduce((a, b) => { a[b] = {}; return a }, {})
          }
        }
      })
    case types.PROFILE_NETWORK_UPDATE:
      return state.mergeDeep({
        [action.username]: {
          proofs: {
            ...{
              [action.network]: action.update
            }
          }
        }
      })
    default:
      return state
  }
}
