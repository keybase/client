// @flow
/*
 * File to stash local debug changes to. Never check this in with changes
 */

import {NativeModules} from 'react-native'
import {updateDebugConfig} from './actions/dev'
import noop from 'lodash/noop'

const nativeBridge = NativeModules.KeybaseEngine || {test: 'fallback'}

// Uncomment this to disable yellowboxes
// console.disableYellowBox = true

// Set this to true if you want to turn off most console logging so you can profile easier
const PERF = false

let config = {
  enableActionLogging: true, // Log actions to the log
  enableStoreLogging: false, // Log full store changes
  featureFlagsOverride: null, // Override feature flags
  filterActionLogs: null, // Filter actions in log
  forceImmediateLogging: false, // Don't wait for idle to log
  forwardLogs: true, // Send logs to remote console
  immediateStateLogging: false, // Don't wait for idle to log state
  isDevApplePushToken: false, // Use a dev push token
  isTesting: nativeBridge.test === '1', // Is running a unit test
  maskStrings: false, // Replace all hiddenstrings w/ fake values
  printBridgeB64: false, // Print raw b64 going over the wire
  printOutstandingRPCs: false, // Periodically print rpcs we're waiting for
  printRPC: false, // Print rpc traffic
  reduxSagaLogger: false, // Print saga debug info
  reduxSagaLoggerMasked: true, // Print saga debug info masked out
  userTimings: false, // Add user timings api to timeline in chrome
}

// Developer settings
if (__DEV__) {
  config.enableActionLogging = false
  config.enableStoreLogging = false
  config.forwardLogs = false
  config.immediateStateLogging = false
  config.isDevApplePushToken = true
  config.printOutstandingRPCs = true
  config.printRPC = true
  config.reduxSagaLoggerMasked = false
  config.userTimings = true
}

if (PERF) {
  console.warn('\n\n\nlocal debug PERF is ONNNNNn!!!!!1!!!11!!!!\nAll console.logs disabled!\n\n\n')

  window.console._log = window.console.log
  window.console._warn = window.console.warn
  window.console._error = window.console.error
  window.console._info = window.console.info

  window.console.log = noop
  window.console.warn = noop
  window.console.error = noop
  window.console.info = noop

  config.enableActionLogging = false
  config.enableStoreLogging = false
  config.filterActionLogs = null
  config.forceImmediateLogging = false
  config.forwardLogs = false
  config.immediateStateLogging = false
  config.printOutstandingRPCs = false
  config.printRPC = false
  config.reduxSagaLogger = false
  config.reduxSagaLoggerMasked = false
  config.userTimings = true
}

export const {
  enableActionLogging,
  enableStoreLogging,
  featureFlagsOverride,
  filterActionLogs,
  forceImmediateLogging,
  forwardLogs,
  immediateStateLogging,
  isDevApplePushToken,
  isTesting,
  maskStrings,
  printBridgeB64,
  printOutstandingRPCs,
  printRPC,
  reduxSagaLogger,
  reduxSagaLoggerMasked,
  userTimings,
} = config

export function setup(store: any) {
  const updateLiveConfig = () => store.dispatch(updateDebugConfig(require('./local-debug-live')))

  if (module.hot) {
    module.hot.accept(() => updateLiveConfig())
  }
  updateLiveConfig()
}
