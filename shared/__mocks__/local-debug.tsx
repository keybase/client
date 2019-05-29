if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

export const allowMultipleInstances = false
export const enableActionLogging = false
export const enableStoreLogging = false
export const featureFlagsOverride = false
export const filterActionLogs = false
export const forceImmediateLogging = false
export const ignoreDisconnectOverlay = false
export const immediateStateLogging = false
export const isDevApplePushToken = false
export const isTesting = false
export const maskStrings = false
export const printOutstandingRPCs = false
export const printOutstandingTimerListeners = false
export const printRPC = false
export const printRPCBytes = false
export const printRPCStats = false
export const reduxSagaLogger = false
export const reduxSagaLoggerMasked = false
export const setup = () => {}
export const showDevTools = false
export const skipSecondaryDevtools = false
export const userTimings = false
