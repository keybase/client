/*
 * File to stash local debug changes to. Never check this in with changes
 */

import {createRouterState} from './reducers/router'
import * as Tabs from './constants/tabs'
import {updateConfig} from './command-line.desktop.js'

let config = {
  allowStartupFailure: false,
  printRPC: false,
  showDevTools: false,
  showAllTrackers: false,
  reduxDevToolsEnable: false,
  redirectOnLogout: true,
  reduxDevToolsSelect: state => state, // only watch a subset of the store
  enableStoreLogging: false,
  enableActionLogging: true,
  forwardLogs: true,
  devStoreChangingFunctions: false,
  printOutstandingRPCs: false,
  reactPerf: false,
  overrideLoggedInTab: null,
  focusOnShow: true,
  dumbFilter: '',
  printRoutes: false,
}

if (__DEV__ && process.env.KEYBASE_LOCAL_DEBUG) {
  config.allowStartupFailure = true
  config.printRPC = true
  config.showDevTools = false
  config.showAllTrackers = false
  config.reduxDevToolsEnable = false
  config.redirectOnLogout = false
  config.reduxDevToolsSelect = state => state.tracker
  config.enableStoreLogging = true
  config.enableActionLogging = false
  config.forwardLogs = false
  config.devStoreChangingFunctions = true
  config.printOutstandingRPCs = true
  config.reactPerf = false
  config.overrideLoggedInTab = Tabs.settingsTab
  config.focusOnShow = false
  config.dumbFilter = ''
  config.printRoutes = true

  let envJson = null
  if (process.env.KEYBASE_LOCAL_DEBUG_JSON) {
    try {
      envJson = JSON.parse(process.env.KEYBASE_LOCAL_DEBUG_JSON)
    } catch (e) {
      console.warn('Invalid KEYBASE_LOCAL_DEBUG_JSON:', e)
    }
  }

  config = {...config, ...envJson}
}

config = updateConfig(config)

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
  focusOnShow,
  dumbFilter,
  printRoutes,
} = config

export function initTabbedRouterState (state) {
  if (!__DEV__ || !process.env.KEYBASE_LOCAL_DEBUG) {
    return state
  }

  return {
    ...state,
    tabs: {
      ...state.tabs,
      [Tabs.loginTab]: createRouterState([], []),
      [Tabs.settingsTab]: createRouterState(['devMenu', 'dumbSheet'], []),
    },
  }
}
