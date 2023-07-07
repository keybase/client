// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of settings but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'settings:'
export const stop = 'settings:stop'

// Action Creators
export const createStop = (payload: {readonly exitCode: RPCTypes.ExitCode}) => ({
  payload,
  type: stop as typeof stop,
})

// Action Payloads
export type StopPayload = ReturnType<typeof createStop>

// All Actions
// prettier-ignore
export type Actions =
  | StopPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
