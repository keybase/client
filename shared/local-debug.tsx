/*
 * File to stash local debug changes to. Never check this in with changes
 */
import noop from 'lodash/noop'
import {isMobile} from '@/constants/platform'

// Mobile-only side effects (disabled yellow box warnings)
if (isMobile) {
  const {LogBox} = require('react-native') as {LogBox: {ignoreAllLogs: () => void}}
  LogBox.ignoreAllLogs()
}

const PERF = false as boolean

let config = {
  allowMultipleInstances: false,
  featureFlagsOverride: '' as string | undefined,
  forceImmediateLogging: false,
  ignoreDisconnectOverlay: false,
  isDevApplePushToken: false,
  printOutstandingRPCs: false,
  printOutstandingTimerListeners: false,
  printRPC: false,
  printRPCBytes: false,
  printRPCStats: false,
  printRPCWaitingSession: false,
  showDevTools: false,
  skipAppFocusActions: false,
  skipSecondaryDevtools: true,
}

if (__DEV__) {
  if (isMobile) {
    config.isDevApplePushToken = true
    config.printOutstandingRPCs = false
    config.printOutstandingTimerListeners = false
    config.printRPCWaitingSession = false
    config.printRPC = false
    config.printRPCStats = false
  } else {
    config.printOutstandingRPCs = true
    config.printOutstandingTimerListeners = true
    config.printRPC = true
    config.printRPCStats = true
    config.printRPCWaitingSession = false
    config.showDevTools = true
    config.skipSecondaryDevtools = true
  }
}

if (!isMobile) {
  const KB2 = require('./util/electron.desktop').default as {
    constants: {configOverload?: Partial<typeof config>}
  }
  config = {...config, ...KB2.constants.configOverload}
}

if (isMobile) {
  const rnkb = require('react-native-kb') as {serverConfig?: string}
  if (rnkb.serverConfig) {
    try {
      const sc = JSON.parse(rnkb.serverConfig) as undefined | {[key: string]: unknown}
      if (sc?.['lastLoggedInUser']) {
        const lastLoggedInUser = sc['lastLoggedInUser']
        if (typeof lastLoggedInUser === 'string') {
          const userConfig = sc[lastLoggedInUser] as {[key: string]: unknown}
          if (typeof userConfig === 'object' && userConfig['printRPCStats']) {
            config.printRPCStats = true
          }
        }
      }
    } catch {}
  }
}

if (PERF) {
  console.warn('\n\n\nlocal debug PERF is ONNNNNn!!!!!1!!!11!!!!\nAll console.logs disabled!\n\n\n')

  console.log = noop
  console.warn = noop
  console.error = noop
  console.info = noop

  config.forceImmediateLogging = false
  config.printOutstandingRPCs = false
  config.printOutstandingTimerListeners = false
  config.printRPC = false
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
  skipSecondaryDevtools,
} = config
