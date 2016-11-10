// @flow
/*
 * File to stash local debug changes to. Never check this in with changes
 */

import * as Tabs from './constants/tabs'
import {NativeModules} from 'react-native'
import {updateDebugConfig} from './actions/dev'

const nativeBridge = NativeModules.KeybaseEngine || NativeModules.ObjcEngine

let config: {[key: string]: any} = {
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
  dumbSheetOnly: false,
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
  config.dumbSheetOnly = false
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
  dumbSheetOnly,
} = config

export function initTabbedRouterState () {
  if (!__DEV__) {
    return []
  }

  return config.initialTabState
}

export function setup (store: any) {
  const updateLiveConfig = () => store.dispatch(updateDebugConfig(require('./local-debug-live')))

  if (module.hot) {
    module.hot.accept(() => updateLiveConfig())
  }
  updateLiveConfig()
}

export function envVarDebugJson () {
  return null
}
