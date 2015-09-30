'use strict'

import * as types from '../constants/profileActionTypes'

const initialState = {}

export default function (state = initialState, action) {
  const existingProfile = state[action.username]

  switch (action.type) {
    case types.INIT_PROFILE:
      return {
        ...state,
        [action.username]: {
          ...existingProfile,
          username: action.username,
          proofs: {}
        }
      }
    case types.PROFILE_RECEIVED_DISPLAY_KEY:
      return {
        ...state,
        [action.username]: {
          ...existingProfile,
          proofs: {
            ...existingProfile.proofs,
            pgp: action.key
          }
        }
      }
    case types.PROFILE_CHECKING_NETWORKS:
      return {
        ...state,
        [action.username]: {
          ...existingProfile,
          proofs: {
            ...existingProfile.proofs,
            ...action.networks.reduce((a, b) => { a[b] = {}; return a }, {})
          }
        }
      }
    case types.PROFILE_NETWORK_UPDATE:
      return {
        ...state,
        [action.username]: {
          ...existingProfile,
          proofs: {
            ...existingProfile.proofs,
            ...{
              [action.network]: action.update
            }
          }
        }
      }
    default:
      return state
  }
}
