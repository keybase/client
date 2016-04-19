/*
 * File to stash local debug changes to. Never check this in with changes
 */

import {createRouterState} from './reducers/router'
import * as Tabs from './constants/tabs'

let config = {
  allowStartupFailure: false,
  printRPC: false,
  showAllTrackers: false,
  redirectOnLogout: true,
  enableStoreLogging: false,
  enableActionLogging: true,
  forwardLogs: true,
  devStoreChangingFunctions: false,
  printOutstandingRPCs: false,
  reactPerf: false,
  overrideLoggedInTab: null,
  dumbFilter: '',
  dumbIndex: 0
}

if (__DEV__ && true) {
  config.allowStartupFailure = true
  config.printRPC = true
  config.showAllTrackers = false
  config.redirectOnLogout = false
  config.enableStoreLogging = true
  config.enableActionLogging = false
  config.forwardLogs = true
  config.devStoreChangingFunctions = true
  config.printOutstandingRPCs = true
  config.reactPerf = false
  config.overrideLoggedInTab = Tabs.moreTab
  config.dumbFilter = ''
  config.dumbIndex = 0
}

export const {
  enableActionLogging,
  allowStartupFailure,
  printRPC,
  showDevTools,
  showAllTrackers,
  reduxDevToolsSelect,
  enableStoreLogging,
  forwardLogs,
  devStoreChangingFunctions,
  printOutstandingRPCs,
  reactPerf,
  overrideLoggedInTab,
  dumbFilter,
  dumbIndex
} = config

export function initTabbedRouterState (state) {
  if (!__DEV__) {
    return state
  }

  return {
    ...state,
    tabs: {
      ...state.tabs,
      [Tabs.loginTab]: createRouterState([], []),
      [Tabs.moreTab]: createRouterState(['devMenu', 'dumbSheet'], [])
    },
    activeTab: Tabs.loginTab
  }
}
