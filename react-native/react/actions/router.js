'use strict'

import * as types from '../constants/routerActionTypes'

export function getCurrentURI (state) {
  return state.tabbedRouter
    .getIn(['tabs', state.tabbedRouter.get('activeTab'), 'uri'])
}

export function getCurrentTab (state) {
  return state.tabbedRouter.get('activeTab')
}

export function navigateUp () {
  return {
    type: types.NAVIGATE_UP
  }
}

export function navigateBack () {
  return {
    type: types.NAVIGATE_BACK
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
