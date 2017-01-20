// @flow
/*
 * File to stash local debug changes to. Never check this in with changes
 */

import * as Tabs from './constants/tabs'
import {updateConfig} from './command-line.desktop.js'

let config: {[key: string]: any} = {
  actionStatFrequency: 0,
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
  config.actionStatFrequency = 0
  config.devStoreChangingFunctions = true
  config.enableActionLogging = true
  config.enableStoreLogging = false
  config.forwardLogs = false
  config.logStatFrequency = 0
  config.overrideLoggedInTab = Tabs.settingsTab
  config.printOutstandingRPCs = false
  config.printRPC = false
  config.printRoutes = false
  config.redirectOnLogout = false

  const envJson = envVarDebugJson()
  config = {...config, ...envJson}
}

config = updateConfig(config)

if (__DEV__ && process.env.KEYBASE_PERF) {
  config.actionStatFrequency = 0
  config.devStoreChangingFunctions = false
  config.enableActionLogging = false
  config.enableStoreLogging = false
  config.forwardLogs = false
  config.logStatFrequency = 0
  config.overrideLoggedInTab = Tabs.settingsTab
  config.printOutstandingRPCs = false
  config.printRPC = false
  config.printRoutes = false
  config.redirectOnLogout = false
}

export const {
  actionStatFrequency,
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
