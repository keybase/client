// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of settings but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'settings:'
export const loadLockdownMode = 'settings:loadLockdownMode'
export const loadedLockdownMode = 'settings:loadedLockdownMode'
export const onChangeLockdownMode = 'settings:onChangeLockdownMode'
export const stop = 'settings:stop'

// Action Creators
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
export const createStop = (payload: {readonly exitCode: RPCTypes.ExitCode}) => ({
  payload,
  type: stop as typeof stop,
})

// Action Payloads
export type LoadLockdownModePayload = ReturnType<typeof createLoadLockdownMode>
export type LoadedLockdownModePayload = ReturnType<typeof createLoadedLockdownMode>
export type OnChangeLockdownModePayload = ReturnType<typeof createOnChangeLockdownMode>
export type StopPayload = ReturnType<typeof createStop>

// All Actions
// prettier-ignore
export type Actions =
  | LoadLockdownModePayload
  | LoadedLockdownModePayload
  | OnChangeLockdownModePayload
  | StopPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
