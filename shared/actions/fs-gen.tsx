// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of fs but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'fs:'
export const setCriticalUpdate = 'fs:setCriticalUpdate'

// Action Creators
export const createSetCriticalUpdate = (payload: {readonly critical: boolean}) => ({
  payload,
  type: setCriticalUpdate as typeof setCriticalUpdate,
})

// Action Payloads
export type SetCriticalUpdatePayload = ReturnType<typeof createSetCriticalUpdate>

// All Actions
// prettier-ignore
export type Actions =
  | SetCriticalUpdatePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
