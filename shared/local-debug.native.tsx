/*
 * File to stash local debug changes to. Never check this in with changes
 */
import {NativeModules, YellowBox} from 'react-native'
import {noop} from 'lodash-es'
const nativeBridge = NativeModules.KeybaseEngine || {test: 'fallback'}

// Uncomment this to disable yellowboxes
// console.disableYellowBox = true
//
// Ignore some yellowboxes on 3rd party libs we can't control
YellowBox.ignoreWarnings([
  "Module RNFetchBlob requires main queue setup since it overrides `constantsToExport` but doesn't implement `requiresMainQueueSetup`. In a future release React Native will default to initializing all native modules on a background thread unless explicitly opted-out of.",
  "Module RCTCameraManager requires main queue setup since it overrides `constantsToExport` but doesn't implement `requiresMainQueueSetup`. In a future release React Native will default to initializing all native modules on a background thread unless explicitly opted-out of.",
])

// store the vanilla console helpers
window.console._log = window.console.log
window.console._warn = window.console.warn
window.console._error = window.console.error
window.console._info = window.console.info

// uncomment this to watch the RN bridge traffic: https://github.com/facebook/react-native/commit/77e48f17824870d30144a583be77ec5c9cf9f8c5
// require('MessageQueue').spy(msg => console._log('queuespy: ', msg, JSON.stringify(msg).length))
// uncomment this to watch for event loop stalls: https://github.com/facebook/react-native/blob/0.59-stable/Libraries/Interaction/BridgeSpyStallHandler.js
// require('InteractionStallDebugger').install({thresholdMS: 100})

// Set this to true if you want to turn off most console logging so you can profile easier
const PERF = true

let config = {
  allowMultipleInstances: false,
  enableActionLogging: true, // Log actions to the log
  enableStoreLogging: false, // Log full store changes
  featureFlagsOverride: '', // Override feature flags
  filterActionLogs: null, // Filter actions in log
  forceImmediateLogging: false, // Don't wait for idle to log
  ignoreDisconnectOverlay: false,
  immediateStateLogging: false, // Don't wait for idle to log state
  isDevApplePushToken: false, // Use a dev push token
  isTesting: nativeBridge.test === '1' || (NativeModules.Storybook && NativeModules.Storybook.isStorybook), // Is running a unit test
  printOutstandingRPCs: false, // Periodically print rpcs we're waiting for
  printOutstandingTimerListeners: false, // Periodically print listeners to the second clock
  printRPC: false, // Print rpc traffic
  printRPCBytes: false, // Print raw b64-encoded bytes going over the wire
  printRPCStats: false, // print detailed info on stats
  printRPCWaitingSession: false,
  reduxSagaLogger: false, // Print saga debug info
  reduxSagaLoggerMasked: true, // Print saga debug info masked out
  showDevTools: false,
  skipAppFocusActions: false,
  skipSecondaryDevtools: false,
  userTimings: false, // Add user timings api to timeline in chrome
  virtualListMarks: false, // If true add constraints to items in virtual lists so we can tell when measuring is incorrect
}

// Developer settings
if (__DEV__) {
  config.enableActionLogging = true
  config.enableStoreLogging = true
  config.immediateStateLogging = false
  // Move this outside the if statement to get notifications working
  // with a "Profile" build on a phone.
  config.isDevApplePushToken = true
  config.printOutstandingRPCs = true
  config.printOutstandingTimerListeners = true
  config.printRPCWaitingSession = false
  config.printRPC = true
  config.printRPCStats = true
  config.reduxSagaLoggerMasked = false
  config.userTimings = false

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
  config.printOutstandingTimerListeners = false
  config.printRPC = false
  config.reduxSagaLogger = false
  config.reduxSagaLoggerMasked = false
  config.userTimings = true
}

if (nativeBridge.serverConfig) {
  try {
    const serverConfig = JSON.parse(nativeBridge.serverConfig)
    if (serverConfig.lastLoggedInUser) {
      const userConfig = serverConfig[serverConfig.lastLoggedInUser] || {}
      if (userConfig.printRPCStats) {
        config.printRPCStats = true
      }
      if (userConfig.chatIndexProfilingEnabled) {
        config.featureFlagsOverride = (config.featureFlagsOverride || '') + ',chatIndexProfilingEnabled'
      }
      if (userConfig.dbCleanEnabled) {
        config.featureFlagsOverride = (config.featureFlagsOverride || '') + ',dbCleanEnabled'
      }
    }
  } catch (e) {}
}

export const {
  allowMultipleInstances,
  enableActionLogging,
  enableStoreLogging,
  featureFlagsOverride,
  filterActionLogs,
  forceImmediateLogging,
  ignoreDisconnectOverlay,
  immediateStateLogging,
  isDevApplePushToken,
  isTesting,
  printOutstandingRPCs,
  printOutstandingTimerListeners,
  printRPC,
  printRPCBytes,
  printRPCStats,
  reduxSagaLogger,
  reduxSagaLoggerMasked,
  showDevTools,
  skipSecondaryDevtools,
  userTimings,
  virtualListMarks,
} = config
