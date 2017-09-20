// @flow
/*
 * File to stash local debug changes to. Never check this in with changes
 */

import * as Tabs from './constants/tabs'
import {jsonDebugFileName} from './constants/platform.desktop'
import {updateConfig} from './app/command-line.desktop.js'

let config: {[key: string]: any} = {
  actionStatFrequency: 0,
  allowMultipleInstances: false,
  closureStoreCheck: false,
  enableActionLogging: true,
  enableStoreLogging: false,
  featureFlagsOverride: null,
  forceImmediateLogging: false,
  forceMainWindowPosition: null,
  forwardLogs: true,
  ignoreDisconnectOverlay: false,
  immediateStateLogging: false,
  initialTabState: {},
  isTesting: false,
  logStatFrequency: 0,
  overrideLoggedInTab: null,
  printOutstandingRPCs: false,
  printRPC: false,
  printRoutes: false,
  filterActionLogs: null,
  reactPerf: false,
  redirectOnLogout: true,
  reduxSagaLogger: false,
  reduxSagaLoggerMasked: true,
  resetEngineOnHMR: false,
  showAllTrackers: false,
  showDevTools: false,
  skipSecondaryDevtools: true,
  userTimings: false,
}

if (__DEV__ && process.env.KEYBASE_LOCAL_DEBUG) {
  config.actionStatFrequency = 0.8
  config.allowMultipleInstances = true
  config.enableActionLogging = false
  config.enableStoreLogging = true
  config.forwardLogs = false
  config.logStatFrequency = 0.8
  config.overrideLoggedInTab = Tabs.settingsTab
  config.printOutstandingRPCs = true
  config.printRPC = false
  config.printRoutes = false
  config.filterActionLogs = null // '^chat|entity'
  config.redirectOnLogout = false
  config.reduxSagaLogger = false
  config.reduxSagaLoggerMasked = false
  config.userTimings = true

  const envJson = envVarDebugJson()
  config = {...config, ...envJson}
}

if (!__STORYBOOK__) {
  const fs = require('fs')
  if (fs.existsSync(jsonDebugFileName)) {
    try {
      const pathJson = JSON.parse(fs.readFileSync(jsonDebugFileName, 'utf-8'))
      console.log('Loaded', jsonDebugFileName, pathJson)
      config = {...config, ...pathJson}
    } catch (e) {
      console.warn('Invalid local debug file')
    }
  }
}

config = updateConfig(config)

if (__DEV__ && process.env.KEYBASE_PERF) {
  config.actionStatFrequency = 0
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
  allowMultipleInstances,
  closureStoreCheck,
  enableActionLogging,
  enableStoreLogging,
  featureFlagsOverride,
  forceImmediateLogging,
  forceMainWindowPosition,
  forwardLogs,
  ignoreDisconnectOverlay,
  immediateStateLogging,
  isTesting,
  logStatFrequency,
  overrideLoggedInTab,
  printOutstandingRPCs,
  printRPC,
  printRoutes,
  reactPerf,
  reduxSagaLogger,
  reduxSagaLoggerMasked,
  resetEngineOnHMR,
  showAllTrackers,
  showDevTools,
  skipSecondaryDevtools,
  filterActionLogs,
  userTimings,
} = config

export function envVarDebugJson() {
  if (process.env.KEYBASE_LOCAL_DEBUG_JSON) {
    try {
      return JSON.parse(process.env.KEYBASE_LOCAL_DEBUG_JSON)
    } catch (e) {
      console.warn('Invalid KEYBASE_LOCAL_DEBUG_JSON:', e)
    }
  }

  return null
}
