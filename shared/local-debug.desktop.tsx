import noop from 'lodash/noop'
import KB2 from './util/electron.desktop'

let config = {
  // Set this to true if you want to turn off most console logging so you can profile easier
  PERF: false,
  allowMultipleInstances: false, // let more run
  debugFullLogs: false, // only for getting full action logs in debug mode
  enableActionLogging: true, // Log actions to the log
  enableStoreLogging: false, // Log full store changes
  featureFlagsOverride: '', // Override feature flags
  filterActionLogs: null, // Filter actions in log
  forceImmediateLogging: false, // Don't wait for idle to log
  ignoreDisconnectOverlay: false, // Let you use the app even in a disconnected state
  immediateStateLogging: false, // Don't wait for idle to log state
  isDevApplePushToken: false,
  isTesting: __STORYBOOK__, // Is running a unit test
  partyMode: false,
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
  userTimings: false, // Add user timings api to timeline in chrome
}

// Developer settings
if (__DEV__) {
  config.debugFullLogs = false
  config.enableActionLogging = false
  config.enableStoreLogging = true
  config.filterActionLogs = null // '^chat|entity'
  config.printOutstandingRPCs = true
  config.printOutstandingTimerListeners = true
  config.printRPC = true
  config.printRPCStats = true
  config.printRPCWaitingSession = false
  config.showDevTools = true
  config.skipExtensions = false
  config.skipSecondaryDevtools = true
  config.userTimings = true
}

config = {
  ...config,
  ...KB2.constants.configOverload,
}

// If debugFullLogs
if (config.debugFullLogs) {
  console.warn('\n\n\nlocal debug config.debugFullLogs is ONNNNNn!!!!!1!!!11!!!!\n')
  config.printRPC = true
  config.enableActionLogging = true
}
// If performance testing
if (config.PERF) {
  console.warn('\n\n\nlocal debug config.PERF is ONNNNNn!!!!!1!!!11!!!!\nAll console.logs disabled!\n\n\n')

  const c: any = console
  c.log = noop
  c.warn = noop
  c.error = noop
  c.info = noop

  config.enableActionLogging = false
  config.enableStoreLogging = false
  config.filterActionLogs = null
  config.forceImmediateLogging = false
  config.ignoreDisconnectOverlay = false
  config.immediateStateLogging = false
  config.printOutstandingRPCs = false
  config.printOutstandingTimerListeners = false
  config.printRPC = false
  config.skipExtensions = true
  config.userTimings = false
}

export const {
  allowMultipleInstances,
  debugFullLogs,
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
  printRPCWaitingSession,
  showDevTools,
  skipAppFocusActions,
  skipExtensions,
  skipSecondaryDevtools,
  userTimings,
} = config
