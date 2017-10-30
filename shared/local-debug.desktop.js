// @flow
import {jsonDebugFileName} from './constants/platform.desktop'
import noop from 'lodash/noop'

// Set this to true if you want to turn off most console logging so you can profile easier
const PERF = false

let config = {
  enableActionLogging: true, // Log actions to the log
  enableStoreLogging: false, // Log full store changes
  featureFlagsOverride: null, // Override feature flags
  filterActionLogs: null, // Filter actions in log
  forceImmediateLogging: false, // Don't wait for idle to log
  forwardLogs: true, // Send logs to remote console
  ignoreDisconnectOverlay: false, // Let you use the app even in a disconnected state
  immediateStateLogging: false, // Don't wait for idle to log state
  isTesting: false, // Is running a unit test
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
  config.enableActionLogging = false
  config.enableStoreLogging = true
  config.filterActionLogs = null // '^chat|entity'
  config.forwardLogs = false
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

  // $FlowIssue doens't like messing w/ console
  console._log = console.log
  // $FlowIssue doens't like messing w/ console
  console._warn = console.warn
  // $FlowIssue doens't like messing w/ console
  console._error = console.error
  // $FlowIssue doens't like messing w/ console
  console._info = console.info

  // $FlowIssue doens't like messing w/ console
  console.log = noop
  // $FlowIssue doens't like messing w/ console
  console.warn = noop
  // $FlowIssue doens't like messing w/ console
  console.error = noop
  // $FlowIssue doens't like messing w/ console
  console.info = noop

  config.enableActionLogging = false
  config.enableStoreLogging = false
  config.filterActionLogs = null
  config.forceImmediateLogging = false
  config.forwardLogs = false
  config.ignoreDisconnectOverlay = false
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
