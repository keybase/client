// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of dev but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'dev:'
export const debugCount = 'dev:debugCount'
export const updateDebugConfig = 'dev:updateDebugConfig'

// Payload Types
type _DebugCountPayload = void
type _UpdateDebugConfigPayload = {
  readonly dumbFilter: string
  readonly dumbFullscreen: boolean
  readonly dumbIndex: number
}

// Action Creators
export const createDebugCount = (payload: _DebugCountPayload): DebugCountPayload => ({
  payload,
  type: debugCount,
})
export const createUpdateDebugConfig = (payload: _UpdateDebugConfigPayload): UpdateDebugConfigPayload => ({
  payload,
  type: updateDebugConfig,
})

// Action Payloads
export type DebugCountPayload = {readonly payload: _DebugCountPayload; readonly type: typeof debugCount}
export type UpdateDebugConfigPayload = {
  readonly payload: _UpdateDebugConfigPayload
  readonly type: typeof updateDebugConfig
}

// All Actions
// prettier-ignore
export type Actions =
  | DebugCountPayload
  | UpdateDebugConfigPayload
  | {type: 'common:resetStore', payload: {}}
