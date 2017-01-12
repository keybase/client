// @flow
/*
 * File to stash local debug changes to. Never check this in with changes
 */

import * as Tabs from './constants/tabs'
import {updateConfig} from './command-line.desktop.js'

let config: {[key: string]: any} = {
  actionStatFrequency: 0,
  allowStartupFailure: false,
  closureStoreCheck: false,
  devStoreChangingFunctions: false,
  enableActionLogging: true,
  enableStoreLogging: false,
  forceMainWindowPosition: null,
  forwardLogs: true,
  ignoreDisconnectOverlay: false,
  initialTabState: {},
  isTesting: false,
  logStatFrequency: 0,
  overrideLoggedInTab: null,
  printOutstandingRPCs: false,
  printRPC: false,
  printRoutes: false,
  reactPerf: false,
  redirectOnLogout: true,
  reduxDevToolsEnable: false,
  reduxDevToolsSelect: state => state, // only watch a subset of the store
  resetEngineOnHMR: false,
  showAllTrackers: false,
  showDevTools: false,
  skipSecondaryDevtools: true,
}

if (__DEV__ && process.env.KEYBASE_LOCAL_DEBUG) {
  config.allowStartupFailure = true
  config.devStoreChangingFunctions = true
  config.enableActionLogging = false
  config.enableStoreLogging = true
  config.forwardLogs = false
  config.initialTabState = {
    [Tabs.loginTab]: [],
    [Tabs.settingsTab]: ['devMenu', 'dumbSheet'],
  }
  config.actionStatFrequency = 0.8
  config.logStatFrequency = 0.8
  config.overrideLoggedInTab = Tabs.settingsTab
  config.printOutstandingRPCs = true
  config.printRPC = true
  config.printRoutes = true
  config.reactPerf = false
  config.redirectOnLogout = false
  config.reduxDevToolsEnable = false
  config.reduxDevToolsSelect = state => state.tracker
  config.showAllTrackers = false
  config.showDevTools = false

  const envJson = envVarDebugJson()
  config = {...config, ...envJson}
}

config = updateConfig(config)

export const {
  actionStatFrequency,
  allowStartupFailure,
  closureStoreCheck,
  devStoreChangingFunctions,
  enableActionLogging,
  enableStoreLogging,
  forceMainWindowPosition,
  forwardLogs,
  ignoreDisconnectOverlay,
  isTesting,
  logStatFrequency,
  overrideLoggedInTab,
  printOutstandingRPCs,
  printRPC,
  printRoutes,
  reactPerf,
  reduxDevToolsEnable,
  reduxDevToolsSelect,
  resetEngineOnHMR,
  showAllTrackers,
  showDevTools,
  skipSecondaryDevtools,
} = config

export function initTabbedRouterState () {
  if (!__DEV__ || !process.env.KEYBASE_LOCAL_DEBUG) {
    return []
  }

  return config.initialTabState
}

export function envVarDebugJson () {
  if (process.env.KEYBASE_LOCAL_DEBUG_JSON) {
    try {
      return JSON.parse(process.env.KEYBASE_LOCAL_DEBUG_JSON)
    } catch (e) {
      console.warn('Invalid KEYBASE_LOCAL_DEBUG_JSON:', e)
    }
  }

  return null
}
