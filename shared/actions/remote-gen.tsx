// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of remote but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'remote:'
export const dumpLogs = 'remote:dumpLogs'
export const installerRan = 'remote:installerRan'
export const showMain = 'remote:showMain'

// Action Creators
/**
 * desktop only: the installer ran and we can start up
 */
export const createInstallerRan = (payload?: undefined) => ({
  payload,
  type: installerRan as typeof installerRan,
})
export const createDumpLogs = (payload: {readonly reason: 'quitting through menu'}) => ({
  payload,
  type: dumpLogs as typeof dumpLogs,
})
export const createShowMain = (payload?: undefined) => ({payload, type: showMain as typeof showMain})

// Action Payloads
export type DumpLogsPayload = ReturnType<typeof createDumpLogs>
export type InstallerRanPayload = ReturnType<typeof createInstallerRan>
export type ShowMainPayload = ReturnType<typeof createShowMain>

// All Actions
// prettier-ignore
export type Actions =
  | DumpLogsPayload
  | InstallerRanPayload
  | ShowMainPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
