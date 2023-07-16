// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of config but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'config:'
export const androidShare = 'config:androidShare'
export const initListenerLoops = 'config:initListenerLoops'
export const loadOnStart = 'config:loadOnStart'
export const revoked = 'config:revoked'

// Action Creators
/**
 * Intent fired with a share url
 */
export const createAndroidShare = (payload: {readonly url?: string; readonly text?: string} = {}) => ({
  payload,
  type: androidShare as typeof androidShare,
})
/**
 * Internal action just to start saga-like spawn processes
 */
export const createInitListenerLoops = (payload?: undefined) => ({
  payload,
  type: initListenerLoops as typeof initListenerLoops,
})
/**
 * This action is dispatched multiple times with various flags.
 * If you want to do something as a result of startup or login listen to this.
 */
export const createLoadOnStart = (payload: {
  readonly phase:
    | 'initialStartupAsEarlyAsPossible'
    | 'connectedToDaemonForFirstTime'
    | 'reloggedIn'
    | 'startupOrReloginButNotInARush'
}) => ({payload, type: loadOnStart as typeof loadOnStart})
export const createRevoked = (payload?: undefined) => ({payload, type: revoked as typeof revoked})

// Action Payloads
export type AndroidSharePayload = ReturnType<typeof createAndroidShare>
export type InitListenerLoopsPayload = ReturnType<typeof createInitListenerLoops>
export type LoadOnStartPayload = ReturnType<typeof createLoadOnStart>
export type RevokedPayload = ReturnType<typeof createRevoked>

// All Actions
// prettier-ignore
export type Actions =
  | AndroidSharePayload
  | InitListenerLoopsPayload
  | LoadOnStartPayload
  | RevokedPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
