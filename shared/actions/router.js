import * as Constants from '../constants/router'

export function getCurrentURI (state) {
  return state.tabbedRouter
    .getIn(['tabs', state.tabbedRouter.get('activeTab'), 'uri'])
}

export function getCurrentTab (state) {
  return state.tabbedRouter.get('activeTab')
}

export function navigateUp (tab) {
  return {
    type: Constants.navigateUp,
    payload: {tab}
  }
}

export function navigateBack (tab) {
  return {
    type: Constants.navigateBack,
    payload: {tab}
  }
}

export function navigateTo (uri, tab) {
  return {
    type: Constants.navigate,
    payload: {uri, tab}
  }
}

export function routeAppend (route, tab) {
  return {
    type: Constants.navigateAppend,
    payload: {route, tab}
  }
}
