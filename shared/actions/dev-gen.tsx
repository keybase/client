// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of dev but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'dev:'
export const debugCount = 'dev:debugCount'
export const updateDebugConfig = 'dev:updateDebugConfig'

// Action Creators
export const createDebugCount = (payload?: undefined) => ({payload, type: debugCount as typeof debugCount})
export const createUpdateDebugConfig = (payload: {
  readonly dumbFilter: string
  readonly dumbFullscreen: boolean
  readonly dumbIndex: number
}) => ({payload, type: updateDebugConfig as typeof updateDebugConfig})

// Action Payloads
export type DebugCountPayload = ReturnType<typeof createDebugCount>
export type UpdateDebugConfigPayload = ReturnType<typeof createUpdateDebugConfig>

// All Actions
// prettier-ignore
export type Actions =
  | DebugCountPayload
  | UpdateDebugConfigPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
