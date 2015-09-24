'use strict'

import * as types from '../constants/routerActionTypes'

export function navigateUp () {
  return {
    type: types.NAVIGATE_UP
  }
}

export function navigateTo (uri) {
  return {
    type: types.NAVIGATE,
    uri: uri
  }
}

export function routeAppend (routeStr) {
  return {
    type: types.NAVIGATE_APPEND,
    topRoute: routeStr
  }
}
