'use strict'

import { NAVIGATE_UP, NAVIGATE, NAVIGATE_APPEND } from '../constants/routerActionTypes'

export function getCurrentURI (state) {
  return state.tabbedRouter
    .getIn(['tabs', state.tabbedRouter.get('activeTab'), 'uri'])
}

export function getCurrentTab (state) {
  return state.tabbedRouter.get('activeTab')
}

export function navigateUp () {
  return {
    type: NAVIGATE_UP
  }
}

export function navigateTo (uri) {
  return {
    type: NAVIGATE,
    uri: uri
  }
}

export function routeAppend (routeStr) {
  return {
    type: NAVIGATE_APPEND,
    topRoute: routeStr
  }
}
