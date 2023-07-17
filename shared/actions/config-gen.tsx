// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of config but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'config:'
export const initListenerLoops = 'config:initListenerLoops'
export const revoked = 'config:revoked'

// Action Creators
/**
 * Internal action just to start saga-like spawn processes
 */
export const createInitListenerLoops = (payload?: undefined) => ({
  payload,
  type: initListenerLoops as typeof initListenerLoops,
})
export const createRevoked = (payload?: undefined) => ({payload, type: revoked as typeof revoked})

// Action Payloads
export type InitListenerLoopsPayload = ReturnType<typeof createInitListenerLoops>
export type RevokedPayload = ReturnType<typeof createRevoked>

// All Actions
// prettier-ignore
export type Actions =
  | InitListenerLoopsPayload
  | RevokedPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
