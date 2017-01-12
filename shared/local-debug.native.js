// @flow
/*
 * File to stash local debug changes to. Never check this in with changes
 */

import * as Tabs from './constants/tabs'
import {NativeModules} from 'react-native'
import {updateDebugConfig} from './actions/dev'

const nativeBridge = NativeModules.KeybaseEngine || NativeModules.ObjcEngine

let config: {[key: string]: any} = {
  actionStatFrequency: 0,
  allowStartupFailure: false,
  devStoreChangingFunctions: false,
  dumbSheetOnly: false,
  enableActionLogging: true,
  enableStoreLogging: false,
  forwardLogs: true,
  initialTabState: {},
  isTesting: nativeBridge.test === '1',
  logStatFrequency: 0,
  overrideLoggedInTab: null,
  printOutstandingRPCs: false,
  printRPC: false,
  printRoutes: false,
  reactPerf: false,
  redirectOnLogout: true,
  showAllTrackers: false,
}

if (__DEV__ && true) {
  config.allowStartupFailure = true
  config.devStoreChangingFunctions = true
  config.dumbSheetOnly = false
  config.enableActionLogging = false
  config.enableStoreLogging = true
  config.forwardLogs = true
  config.initialTabState = {
    [Tabs.loginTab]: [],
    [Tabs.settingsTab]: ['devMenu', 'dumbSheet'],
  }
  config.overrideLoggedInTab = Tabs.settingsTab
  config.printOutstandingRPCs = true
  config.printRPC = true
  config.printRoutes = true
  config.reactPerf = false
  config.redirectOnLogout = false
  config.showAllTrackers = false
}

export const {
  actionStatFrequency,
  allowStartupFailure,
  devStoreChangingFunctions,
  dumbSheetOnly,
  enableActionLogging,
  enableStoreLogging,
  forwardLogs,
  isTesting,
  logStatFrequency,
  overrideLoggedInTab,
  printOutstandingRPCs,
  printRPC,
  printRoutes,
  reactPerf,
  reduxDevToolsSelect,
  showAllTrackers,
  showDevTools,
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
