// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Tabs from '../constants/tabs'
import type * as Types from '../constants/types/route-tree'

// Constants
export const resetStore = 'common:resetStore' // not a part of route-tree but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'route-tree:'
export const navigateAppend = 'route-tree:navigateAppend'
export const navigateUp = 'route-tree:navigateUp'
export const navigateUpNoop = 'route-tree:navigateUpNoop'
export const switchTab = 'route-tree:switchTab'

// Action Creators
/**
 * Nav up but no longer focused, for logging only
 */
export const createNavigateUpNoop = (payload?: undefined) => ({
  payload,
  type: navigateUpNoop as typeof navigateUpNoop,
})
/**
 * ONLY used by the new nav. Switch to a different tab.
 */
export const createSwitchTab = (payload: {readonly tab: Tabs.AppTab; readonly params?: Object}) => ({
  payload,
  type: switchTab as typeof switchTab,
})
export const createNavigateAppend = (payload: {
  readonly fromKey?: string
  readonly path: Types.PathParam
  readonly replace?: boolean
}) => ({payload, type: navigateAppend as typeof navigateAppend})
export const createNavigateUp = (payload: {readonly fromKey?: string} = {}) => ({
  payload,
  type: navigateUp as typeof navigateUp,
})

// Action Payloads
export type NavigateAppendPayload = ReturnType<typeof createNavigateAppend>
export type NavigateUpNoopPayload = ReturnType<typeof createNavigateUpNoop>
export type NavigateUpPayload = ReturnType<typeof createNavigateUp>
export type SwitchTabPayload = ReturnType<typeof createSwitchTab>

// All Actions
// prettier-ignore
export type Actions =
  | NavigateAppendPayload
  | NavigateUpNoopPayload
  | NavigateUpPayload
  | SwitchTabPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
