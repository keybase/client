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
          username: action.username
        }
      }
    default:
      return state
  }
}
