// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of tracker2 but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'tracker2:'
export const changeFollow = 'tracker2:changeFollow'
export const closeTracker = 'tracker2:closeTracker'
export const ignore = 'tracker2:ignore'
export const load = 'tracker2:load'

// Action Creators
export const createChangeFollow = (payload: {readonly guiID: string; readonly follow: boolean}) => ({
  payload,
  type: changeFollow as typeof changeFollow,
})
export const createCloseTracker = (payload: {readonly guiID: string}) => ({
  payload,
  type: closeTracker as typeof closeTracker,
})
export const createIgnore = (payload: {readonly guiID: string}) => ({payload, type: ignore as typeof ignore})
export const createLoad = (payload: {
  readonly assertion: string
  readonly forceDisplay?: boolean
  readonly fromDaemon?: boolean
  readonly guiID: string
  readonly ignoreCache?: boolean
  readonly reason: string
  readonly inTracker: boolean
}) => ({payload, type: load as typeof load})

// Action Payloads
export type ChangeFollowPayload = ReturnType<typeof createChangeFollow>
export type CloseTrackerPayload = ReturnType<typeof createCloseTracker>
export type IgnorePayload = ReturnType<typeof createIgnore>
export type LoadPayload = ReturnType<typeof createLoad>

// All Actions
// prettier-ignore
export type Actions =
  | ChangeFollowPayload
  | CloseTrackerPayload
  | IgnorePayload
  | LoadPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
