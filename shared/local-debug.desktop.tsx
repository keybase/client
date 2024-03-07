import noop from 'lodash/noop'
import KB2 from './util/electron.desktop'
import {debugWarning} from '@/util/debug-warning'

let config = {
  // Set this to true if you want to turn off most console logging so you can profile easier
  PERF: false,
  allowMultipleInstances: false, // let more run
  featureFlagsOverride: '' as string | undefined, // Override feature flags
  forceImmediateLogging: false, // Don't wait for idle to log
  ignoreDisconnectOverlay: false, // Let you use the app even in a disconnected state
  isDevApplePushToken: false,
  printOutstandingRPCs: false, // Periodically print rpcs we're waiting for
  printOutstandingTimerListeners: false, // Periodically print listeners to the second clock
  printRPC: false, // Print rpc traffic
  printRPCBytes: false, // Print raw bytes going over the wire
  printRPCStats: false, // Print more detailed stats about rpcs
  printRPCWaitingSession: false, // session / waiting info
  showDevTools: false,
  skipAppFocusActions: false, // dont emit actions when going foreground/background, helpful while working on other actions stuff
  skipExtensions: true, // if true dont load devtools extensions
  skipSecondaryDevtools: true,
}

// Developer settings
if (__DEV__) {
  config.printOutstandingRPCs = true
  config.printOutstandingTimerListeners = true
  config.printRPC = true
  config.printRPCStats = true
  config.printRPCWaitingSession = false
  config.showDevTools = true
  config.skipExtensions = false
  config.skipSecondaryDevtools = true
}

config = {
  ...config,
  ...KB2.constants.configOverload,
}

// If performance testing
if (config.PERF) {
  debugWarning('local debug config.PERF is ONNNNNn')

  const c = console
  c.log = noop
  c.warn = noop
  c.error = noop
  c.info = noop

  config.forceImmediateLogging = false
  config.ignoreDisconnectOverlay = false
  config.printOutstandingRPCs = false
  config.printOutstandingTimerListeners = false
  config.printRPC = false
  config.skipExtensions = true
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
  printRPCWaitingSession,
  showDevTools,
  skipAppFocusActions,
  skipExtensions,
  skipSecondaryDevtools,
} = config
