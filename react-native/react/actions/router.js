'use strict'

import * as types from '../constants/routerActionTypes'

export function navigateTo (uri) {
  return {
    type: types.NAVIGATE,
    uri: uri
  }
}
