// @flow
/*
 * File to stash local debug changes to. Never check this in with changes
 */

import {NativeModules} from 'react-native'
import {updateDebugConfig} from './actions/dev'

const nativeBridge = NativeModules.KeybaseEngine

let config: {[key: string]: any} = {
  actionStatFrequency: 0,
  devStoreChangingFunctions: false,
  dumbChatOnly: false,
  dumbSheetOnly: false,
  enableActionLogging: true,
  enableStoreLogging: false,
  featureFlagsOverride: null,
  forceImmediateLogging: false,
  forwardLogs: true,
  isDevApplePushToken: false,
  isTesting: nativeBridge.test === '1',
  immediateStateLogging: false,
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
  config.isDevApplePushToken = true
  config.devStoreChangingFunctions = true
  config.dumbChatOnly = false
  config.dumbSheetOnly = false
  config.enableActionLogging = false
  config.enableStoreLogging = true
  config.forwardLogs = true
  config.immediateStateLogging = true
  config.printOutstandingRPCs = true
  config.printRPC = true
  config.printRoutes = true
  config.reactPerf = false
  config.redirectOnLogout = false
  config.showAllTrackers = false
}

export const {
  actionStatFrequency,
  devStoreChangingFunctions,
  dumbChatOnly,
  dumbSheetOnly,
  enableActionLogging,
  enableStoreLogging,
  featureFlagsOverride,
  forceImmediateLogging,
  forwardLogs,
  isDevApplePushToken,
  isTesting,
  immediateStateLogging,
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
