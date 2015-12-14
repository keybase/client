/*
 * File to stash local debug changes to. Never check this in with changes
 */

import {createRouterState} from './reducers/router'
import * as Tabs from './constants/tabs'
import {isDev} from './constants/platform'

let config = {
  overrideRouterState: null,
  overrideActiveTab: null,
  skipLoginRouteToRoot: false,
  allowStartupFailure: false,
  printRPC: false,
  showDevTools: false,
  showAllTrackers: false,
  reduxDevToolsSelect: state => state // only watch a subset of the store
}

if (isDev && false) {
  config.overrideRouterState = createRouterState(['devMenu', 'components'], [])
  config.overrideActiveTab = Tabs.moreTab
  config.skipLoginRouteToRoot = true
  config.allowStartupFailure = true
  config.printRPC = true
  config.showDevTools = true
  config.showAllTrackers = true
  config.reduxDevToolsSelect = state => state.tracker
}

export const {
  overrideRouterState,
  overrideActiveTab,
  skipLoginRouteToRoot,
  allowStartupFailure,
  printRPC,
  showDevTools,
  showAllTrackers,
  reduxDevToolsSelect
} = config
