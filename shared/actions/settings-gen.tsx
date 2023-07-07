// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'
import type HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of settings but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'settings:'
export const dbNuke = 'settings:dbNuke'
export const deleteAccountForever = 'settings:deleteAccountForever'
export const loadLockdownMode = 'settings:loadLockdownMode'
export const loadedLockdownMode = 'settings:loadedLockdownMode'
export const onChangeLockdownMode = 'settings:onChangeLockdownMode'
export const processorProfile = 'settings:processorProfile'
export const stop = 'settings:stop'
export const trace = 'settings:trace'

// Action Creators
export const createDbNuke = (payload?: undefined) => ({payload, type: dbNuke as typeof dbNuke})
export const createDeleteAccountForever = (payload: {readonly passphrase?: HiddenString} = {}) => ({
  payload,
  type: deleteAccountForever as typeof deleteAccountForever,
})
export const createLoadLockdownMode = (payload?: undefined) => ({
  payload,
  type: loadLockdownMode as typeof loadLockdownMode,
})
export const createLoadedLockdownMode = (payload: {readonly status?: boolean} = {}) => ({
  payload,
  type: loadedLockdownMode as typeof loadedLockdownMode,
})
export const createOnChangeLockdownMode = (payload: {readonly enabled: boolean}) => ({
  payload,
  type: onChangeLockdownMode as typeof onChangeLockdownMode,
})
export const createProcessorProfile = (payload: {readonly durationSeconds: number}) => ({
  payload,
  type: processorProfile as typeof processorProfile,
})
export const createStop = (payload: {readonly exitCode: RPCTypes.ExitCode}) => ({
  payload,
  type: stop as typeof stop,
})
export const createTrace = (payload: {readonly durationSeconds: number}) => ({
  payload,
  type: trace as typeof trace,
})

// Action Payloads
export type DbNukePayload = ReturnType<typeof createDbNuke>
export type DeleteAccountForeverPayload = ReturnType<typeof createDeleteAccountForever>
export type LoadLockdownModePayload = ReturnType<typeof createLoadLockdownMode>
export type LoadedLockdownModePayload = ReturnType<typeof createLoadedLockdownMode>
export type OnChangeLockdownModePayload = ReturnType<typeof createOnChangeLockdownMode>
export type ProcessorProfilePayload = ReturnType<typeof createProcessorProfile>
export type StopPayload = ReturnType<typeof createStop>
export type TracePayload = ReturnType<typeof createTrace>

// All Actions
// prettier-ignore
export type Actions =
  | DbNukePayload
  | DeleteAccountForeverPayload
  | LoadLockdownModePayload
  | LoadedLockdownModePayload
  | OnChangeLockdownModePayload
  | ProcessorProfilePayload
  | StopPayload
  | TracePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
