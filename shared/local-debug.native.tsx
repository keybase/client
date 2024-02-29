/*
 * File to stash local debug changes to. Never check this in with changes
 */
import {LogBox} from 'react-native'
import {serverConfig} from 'react-native-kb'
import noop from 'lodash/noop'

// Toggle this to disable yellowboxes
LogBox.ignoreAllLogs()

// uncomment this to watch the RN bridge traffic: https://github.com/facebook/react-native/commit/77e48f17824870d30144a583be77ec5c9cf9f8c5
// require('react-native/Libraries/BatchedBridge/MessageQueue').spy(msg => {
//   if (msg.module !== 'WebSocketModule') {
//     console._log('queuespy: ', msg, JSON.stringify(msg).length)
//   }
// })
// uncomment this to watch for event loop stalls: https://github.com/facebook/react-native/blob/0.59-stable/Libraries/Interaction/BridgeSpyStallHandler.js
// require('react-native/Libraries/Interaction/InteractionStallDebugger').install({thresholdMS: 100})

// Set this to true if you want to turn off most console logging so you can profile easier
const PERF = false as boolean

const config = {
  allowMultipleInstances: false,
  featureFlagsOverride: '', // Override feature flags
  forceImmediateLogging: false, // Don't wait for idle to log
  ignoreDisconnectOverlay: false,
  isDevApplePushToken: false, // Use a dev push token
  printOutstandingRPCs: false, // Periodically print rpcs we're waiting for
  printOutstandingTimerListeners: false, // Periodically print listeners to the second clock
  printRPC: false, // Print rpc traffic
  printRPCBytes: false, // Print raw b64-encoded bytes going over the wire
  printRPCStats: false, // print detailed info on stats
  printRPCWaitingSession: false,
  showDevTools: false,
  skipAppFocusActions: false,
  skipExtensions: true,
  skipSecondaryDevtools: true,
}

// Developer settings
if (__DEV__) {
  // Move this outside the if statement to get notifications working
  // with a "Profile" build on a phone.
  config.isDevApplePushToken = true
  config.printOutstandingRPCs = false
  config.printOutstandingTimerListeners = false
  config.printRPCWaitingSession = false
  config.printRPC = false
  // TODO is this even used?
  config.printRPCStats = false

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
//   window.console.log = (...a) => NativeModules.NativeLogger.log([['e', a.join(' ')]])
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

  config.forceImmediateLogging = false
  config.printOutstandingRPCs = false
  config.printOutstandingTimerListeners = false
  config.printRPC = false
}

if (serverConfig) {
  try {
    const sc = JSON.parse(serverConfig) as undefined | {[key: string]: unknown}
    if (sc?.['lastLoggedInUser']) {
      const lastLoggedInUser = sc['lastLoggedInUser']
      if (typeof lastLoggedInUser === 'string') {
        const userConfig = sc[lastLoggedInUser] as {[key: string]: unknown}
        if (typeof userConfig === 'object' && userConfig['printRPCStats']) {
          config.printRPCStats = true
        }
      }
    }
  } catch (e) {}
}

export const {
  allowMultipleInstances,
  featureFlagsOverride,
  forceImmediateLogging,
  ignoreDisconnectOverlay,
  isDevApplePushToken,
  printOutstandingRPCs,
  printOutstandingTimerListeners,
  printRPC,
  printRPCBytes,
  printRPCStats,
  showDevTools,
  skipExtensions,
  skipSecondaryDevtools,
} = config
