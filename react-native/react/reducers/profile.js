'use strict'

import * as types from '../constants/profileActionTypes'

const initialState = {
  profile: {}
}

export default function (state = initialState, action) {
  const existingProfile = state.profile[action.username]
  switch (action.type) {
    case types.INIT_PROFILE:
      return {
        ...state,
        profile: {
          [action.username]: {
            ...existingProfile,
            username: action.username
          }
        }
      }
    default:
      return state
  }
}
