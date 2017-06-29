// @flow
/*
 * File to stash local debug changes to. Never check this in with changes
 */

import {NativeModules} from 'react-native'
import {updateDebugConfig} from './actions/dev'

const nativeBridge = NativeModules.KeybaseEngine

let config: {[key: string]: any} = {
  actionStatFrequency: 0,
  clickableVisible: false,
  dumbChatOnly: false,
  dumbSheetOnly: false,
  enableActionLogging: false,
  enableStoreLogging: false,
  featureFlagsOverride: null,
  forceImmediateLogging: false,
  forwardLogs: false,
  isDevApplePushToken: false,
  isTesting: nativeBridge.test === '1',
  immediateStateLogging: false,
  logStatFrequency: 0,
  overrideLoggedInTab: null,
  printOutstandingRPCs: false,
  printRPC: false,
  printRoutes: false,
  reactPerf: false,
  reduxSagaLogger: false,
  reduxSagaLoggerMasked: false,
  redirectOnLogout: false,
  showAllTrackers: false,
}

// if (__DEV__ && true) {
// config.isDevApplePushToken = true
// config.clickableVisible = false
// config.dumbChatOnly = false
// config.dumbSheetOnly = false
// config.enableActionLogging = false
// config.enableStoreLogging = true
// config.forwardLogs = true
// config.immediateStateLogging = true
// config.printOutstandingRPCs = true
// config.printRPC = true
// config.printRoutes = true
// config.reactPerf = false
// config.redirectOnLogout = false
// config.reduxSagaLogger = true
// config.reduxSagaLoggerMasked = false
// config.showAllTrackers = false
// }

export const {
  actionStatFrequency,
  clickableVisible,
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
  reduxSagaLoggerMasked,
  reduxSagaLogger,
  showAllTrackers,
  showDevTools,
} = config

export function setup(store: any) {
  const updateLiveConfig = () => store.dispatch(updateDebugConfig(require('./local-debug-live')))

  if (module.hot) {
    module.hot.accept(() => updateLiveConfig())
  }
  updateLiveConfig()
}

export function envVarDebugJson() {
  return null
}
