// @flow
import {jsonDebugFileName} from './constants/platform.desktop'
import {noop} from 'lodash-es'

// Set this to true if you want to turn off most console logging so you can profile easier
const PERF = false

let config = {
  allowMultipleInstances: false, // Multiple instances of the app
  enableActionLogging: true, // Log actions to the log
  enableStoreLogging: false, // Log full store changes
  featureFlagsOverride: null, // Override feature flags
  filterActionLogs: null, // Filter actions in log
  forceImmediateLogging: false, // Don't wait for idle to log
  ignoreDisconnectOverlay: false, // Let you use the app even in a disconnected state
  immediateStateLogging: false, // Don't wait for idle to log state
  isTesting: __SCREENSHOT__, // Is running a unit test
  maskStrings: false, // Replace all hiddenstrings w/ fake values
  printOutstandingRPCs: false, // Periodically print rpcs we're waiting for
  printRPC: false, // Print rpc traffic
  reduxSagaLogger: false, // Print saga debug info
  reduxSagaLoggerMasked: true, // Print saga debug info masked out
  showDevTools: false, // Show devtools on start
  skipSecondaryDevtools: true, // Don't show devtools for menubar/trackers etc
  userTimings: false, // Add user timings api to timeline in chrome
}

// Developer settings
if (__DEV__) {
  config.allowMultipleInstances = true
  config.enableActionLogging = false
  config.enableStoreLogging = true
  config.filterActionLogs = null // '^chat|entity'
  config.printOutstandingRPCs = true
  config.printRPC = true
  config.reduxSagaLogger = false
  config.reduxSagaLoggerMasked = false
  config.userTimings = true
}

// Load overrides from a local json file
if (!__STORYBOOK__) {
  const fs = require('fs')
  if (fs.existsSync(jsonDebugFileName)) {
    try {
      const pathJson = JSON.parse(fs.readFileSync(jsonDebugFileName, 'utf-8'))
      console.log('Loaded', jsonDebugFileName, pathJson)
      config = {...config, ...pathJson}
    } catch (e) {
      console.warn('Invalid local debug file')
    }
  }
}

// If performance testing
if (PERF) {
  console.warn('\n\n\nlocal debug PERF is ONNNNNn!!!!!1!!!11!!!!\nAll console.logs disabled!\n\n\n')

  // Flow (correctly) doesn't like assigning to console
  const c: any = console

  c._log = console.log
  c._warn = console.warn
  c._error = console.error
  c._info = console.info

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
  config.printRPC = false
  config.reduxSagaLogger = false
  config.reduxSagaLoggerMasked = false
  config.userTimings = true
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
  isTesting,
  maskStrings,
  printOutstandingRPCs,
  printRPC,
  reduxSagaLogger,
  reduxSagaLoggerMasked,
  showDevTools,
  skipSecondaryDevtools,
  userTimings,
} = config
