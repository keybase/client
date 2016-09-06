/*
 * File to stash local debug changes to. Never check this in with changes
 */

import {updateDebugConfig} from './actions/dev'
import * as Tabs from './constants/tabs'
import {NativeModules} from 'react-native'

const nativeBridge = NativeModules.KeybaseEngine || NativeModules.ObjcEngine

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
  initialTabState: {},
  overrideLoggedInTab: null,
  printRoutes: false,
  logStatFrequency: 0,
  actionStatFrequency: 0,
  isTesting: nativeBridge.test === '1',
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
  config.initialTabState = {
    [Tabs.loginTab]: [],
    [Tabs.settingsTab]: ['devMenu', 'dumbSheet'],
  }
  config.overrideLoggedInTab = Tabs.settingsTab
  config.printRoutes = true
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
  printRoutes,
  logStatFrequency,
  actionStatFrequency,
  isTesting,
} = config

export function initTabbedRouterState () {
  if (!__DEV__) {
    return []
  }

  return config.initialTabState
}

export function setup (store) {
  const updateLiveConfig = () => store.dispatch(updateDebugConfig(require('./local-debug-live')))

  if (module.hot) {
    module.hot.accept(() => updateLiveConfig())
  }
  updateLiveConfig()
}

export function envVarDebugJson () {
  return null
}
