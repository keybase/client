'use strict'

import * as types from '../constants/profileActionTypes'
import { routeAppend } from './router'
// import engine from '../engine'

export function pushNewProfile (username) {
  return function (dispatch, getState) {
    dispatch({
      type: types.INIT_PROFILE,
      username
    })
    dispatch(routeAppend({
      path: 'profile',
      username
    }))
  }
}
