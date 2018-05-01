// @flow
/*
 * File to stash local debug changes to. Never check this in with changes
 */

import {NativeModules} from 'react-native'
import * as DevGen from './actions/dev-gen'
import {noop} from 'lodash-es'
// import MessageQueue from 'react-native/Libraries/BatchedBridge/MessageQueue.js'

const nativeBridge = NativeModules.KeybaseEngine || {test: 'fallback'}

// Uncomment this to disable yellowboxes
// console.disableYellowBox = true

// store the vanilla console helpers
window.console._log = window.console.log
window.console._warn = window.console.warn
window.console._error = window.console.error
window.console._info = window.console.info

// Set this to true if you want to turn off most console logging so you can profile easier
const PERF = false

let config = {
  enableActionLogging: true, // Log actions to the log
  enableStoreLogging: false, // Log full store changes
  featureFlagsOverride: null, // Override feature flags
  filterActionLogs: null, // Filter actions in log
  forceImmediateLogging: false, // Don't wait for idle to log
  immediateStateLogging: false, // Don't wait for idle to log state
  isDevApplePushToken: false, // Use a dev push token
  isTesting: nativeBridge.test === '1' || (NativeModules.Storybook && NativeModules.Storybook.isStorybook), // Is running a unit test
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
  config.enableActionLogging = true
  config.enableStoreLogging = false
  config.immediateStateLogging = false
  // Move this outside the if statement to get notifications working
  // with a "Profile" build on a phone.
  config.isDevApplePushToken = true
  config.printOutstandingRPCs = true
  config.printRPC = true
  config.reduxSagaLoggerMasked = false
  config.userTimings = true

  // uncomment this to watch the RN bridge traffic: https://github.com/facebook/react-native/commit/77e48f17824870d30144a583be77ec5c9cf9f8c5
  // MessageQueue.spy(msg => console._log('queuespy: ', msg, JSON.stringify(msg).length))
}

if (PERF) {
  console.warn('\n\n\nlocal debug PERF is ONNNNNn!!!!!1!!!11!!!!\nAll console.logs disabled!\n\n\n')

  window.console.log = noop
  window.console.warn = noop
  window.console.error = noop
  window.console.info = noop

  config.enableActionLogging = false
  config.enableStoreLogging = false
  config.filterActionLogs = null
  config.forceImmediateLogging = false
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
  const updateLiveConfig = () => {
    const config = require('./local-debug-live')
    store.dispatch(DevGen.createUpdateDebugConfig({...config}))
  }

  if (module.hot) {
    module.hot.accept(() => updateLiveConfig())
  }
  updateLiveConfig()
}
