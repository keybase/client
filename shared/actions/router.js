// @flow
import * as Constants from '../constants/router'
import type {Action} from '../constants/types/flux'
import type {URI} from '../constants/router'
import type {Tab} from '../constants/tabs'

export function navigateUp (tab?: Tab, till?: any): Action {
  return {
    type: Constants.navigateUp,
    payload: {tab, till},
  }
}

export function navigateBack (tab?: Tab): Action {
  return {
    type: Constants.navigateBack,
    payload: {tab},
  }
}

export function navigateTo (uri: URI | Array<any>, tab?: Tab): Action {
  return {
    type: Constants.navigate,
    payload: {uri, tab},
  }
}

export function routeAppend (route: any, tab?: Tab): Action {
  return {
    type: Constants.navigateAppend,
    payload: {route, tab},
  }
}

export function switchTab (tab: Tab) {
  return {
    type: Constants.switchTab,
    payload: tab,
  }
}
