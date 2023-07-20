// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Types from '../constants/types/route-tree'

// Constants
export const resetStore = 'common:resetStore' // not a part of route-tree but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'route-tree:'
export const navigateAppend = 'route-tree:navigateAppend'
export const navigateUpNoop = 'route-tree:navigateUpNoop'

// Action Creators
/**
 * Nav up but no longer focused, for logging only
 */
export const createNavigateUpNoop = (payload?: undefined) => ({
  payload,
  type: navigateUpNoop as typeof navigateUpNoop,
})
export const createNavigateAppend = (payload: {
  readonly fromKey?: string
  readonly path: Types.PathParam
  readonly replace?: boolean
}) => ({payload, type: navigateAppend as typeof navigateAppend})

// Action Payloads
export type NavigateAppendPayload = ReturnType<typeof createNavigateAppend>
export type NavigateUpNoopPayload = ReturnType<typeof createNavigateUpNoop>

// All Actions
// prettier-ignore
export type Actions =
  | NavigateAppendPayload
  | NavigateUpNoopPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
