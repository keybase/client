/*
 * File to stash local debug changes to. Never check this in with changes
 */
import {LogBox} from 'react-native'
import {NativeModules} from './util/native-modules.native'
import noop from 'lodash/noop'

// Toggle this to disable yellowboxes
LogBox.ignoreAllLogs()

// store the vanilla console helpers
window.console._log = window.console.log
window.console._warn = window.console.warn
window.console._error = window.console.error
window.console._info = window.console.info

// uncomment this to watch the RN bridge traffic: https://github.com/facebook/react-native/commit/77e48f17824870d30144a583be77ec5c9cf9f8c5
// require('react-native/Libraries/BatchedBridge/MessageQueue').spy(msg =>
//   console._log('queuespy: ', msg, JSON.stringify(msg).length)
// )
// uncomment this to watch for event loop stalls: https://github.com/facebook/react-native/blob/0.59-stable/Libraries/Interaction/BridgeSpyStallHandler.js
// require('react-native/Libraries/Interaction/InteractionStallDebugger').install({thresholdMS: 100})

// Set this to true if you want to turn off most console logging so you can profile easier
const PERF = false

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
  isTesting: false, // NativeModules.Storybook.isStorybook, // Is running a unit test
  partyMode: false,
  printOutstandingRPCs: false, // Periodically print rpcs we're waiting for
  printOutstandingTimerListeners: false, // Periodically print listeners to the second clock
  printRPC: false, // Print rpc traffic
  printRPCBytes: false, // Print raw b64-encoded bytes going over the wire
  printRPCStats: false, // print detailed info on stats
  printRPCWaitingSession: false,
  showDevTools: false,
  skipAppFocusActions: false,
  skipSecondaryDevtools: false,
  userTimings: false, // Add user timings api to timeline in chrome
  virtualListMarks: false, // If true add constraints to items in virtual lists so we can tell when measuring is incorrect
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
  config.printOutstandingTimerListeners = true
  config.printRPCWaitingSession = false
  config.printRPC = true
  // TODO is this even used?
  config.printRPCStats = true
  config.userTimings = false

  // uncomment this to watch the RN bridge traffic: https://github.com/facebook/react-native/commit/77e48f17824870d30144a583be77ec5c9cf9f8c5
  // MessageQueue.spy(msg => console._log('queuespy: ', msg, JSON.stringify(msg).length))
}

// uncomment if doing local archive builds
// const debuggingOnLocalArchiveBuild = true
// if (debuggingOnLocalArchiveBuild) {
//   for (let i = 0; i < 50; ++i) {
//     console.log('TEMP dev push token!')
//   }
//   config.isDevApplePushToken = true
// }

// const debuggingReleaseBuild = false
// if (debuggingReleaseBuild) {
//   for (let i = 0; i < 50; ++i) {
//     console.log('TEMP debug release build one')
//   }
//   // in release we don't get console logs on ios, so instead use native logger and edit the objc side
//   window.console.log = (...a) => NativeModules.KBNativeLogger.log([['e', a.join(' ')]])
//   window.console.warn = window.console.log
//   window.console.error = window.console.log
//   window.console.info = window.console.log
// }

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
  config.userTimings = true
}

if (NativeModules.KeybaseEngine.serverConfig) {
  try {
    const serverConfig = JSON.parse(NativeModules.KeybaseEngine.serverConfig)
    if (serverConfig.lastLoggedInUser) {
      const userConfig = serverConfig[serverConfig.lastLoggedInUser] || {}
      if (userConfig.printRPCStats) {
        config.printRPCStats = true
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
  partyMode,
  printOutstandingRPCs,
  printOutstandingTimerListeners,
  printRPC,
  printRPCBytes,
  printRPCStats,
  showDevTools,
  skipSecondaryDevtools,
  userTimings,
  virtualListMarks,
} = config
