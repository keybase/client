// @flow
/*
 * File to stash local debug changes to. Never check this in with changes
 */

import * as Tabs from './constants/tabs'
import {updateConfig} from './command-line.desktop.js'

let config: {[key:string]: any} = {
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
  printRoutes: false,
  skipSecondaryDevtools: true,
  initialTabState: {},
  forceMainWindowPosition: null,
  closureStoreCheck: false,
  logStatFrequency: 0,
  actionStatFrequency: 0,
  isTesting: false,
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
  config.printRoutes = true
  config.initialTabState = {
    [Tabs.loginTab]: [],
    [Tabs.settingsTab]: ['devMenu', 'dumbSheet'],
  }
  config.logStatFrequency = 0.8
  config.actionStatFrequency = 0.8

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
  isTesting,
  logStatFrequency,
  overrideLoggedInTab,
  printOutstandingRPCs,
  printRPC,
  printRoutes,
  reactPerf,
  reduxDevToolsEnable,
  reduxDevToolsSelect,
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
