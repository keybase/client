// @flow
/*
 * File to stash local debug changes to. Never check this in with changes
 */

import {NativeModules} from 'react-native'
import {updateDebugConfig} from './actions/dev'
import noop from 'lodash/noop'

const nativeBridge = NativeModules.KeybaseEngine

// Set this to true if you want to turn off most console logging so you can profile easier
const PERF = false

let config: {[key: string]: any} = {
  actionStatFrequency: 0,
  clickableVisible: false,
  colorBoxes: false, // set to true to color boxes to help debug layout and perf
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
  reduxSagaLogger: false,
  reduxSagaLoggerMasked: true,
  redirectOnLogout: true,
  showAllTrackers: false,
}

if (__DEV__ && true) {
  config.isDevApplePushToken = true
  config.clickableVisible = false
  config.dumbChatOnly = false
  config.dumbSheetOnly = false
  config.enableActionLogging = false
  config.enableStoreLogging = false
  config.forwardLogs = true
  config.immediateStateLogging = true
  config.printOutstandingRPCs = true
  config.printRPC = true
  config.printRoutes = true
  config.reactPerf = false
  config.redirectOnLogout = false
  config.reduxSagaLogger = false
  config.reduxSagaLoggerMasked = false
  config.showAllTrackers = false
}

if (PERF) {
  console.warn('\n\n\nlocal debug PERF is ONNNNNn!!!!!1!!!11!!!!\nAll console.logs disabled!\n\n\n')

  window.console._log = window.console.log
  window.console._warn = window.console.warn
  window.console._error = window.console.error

  window.console.log = noop
  window.console.warn = noop
  window.console.error = noop

  config = {
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
    isTesting: false,
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
}

export const {
  actionStatFrequency,
  clickableVisible,
  colorBoxes,
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
