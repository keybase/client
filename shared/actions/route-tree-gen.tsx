// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as Tabs from '../constants/tabs'
import type * as Types from '../constants/types/route-tree'

// Constants
export const resetStore = 'common:resetStore' // not a part of route-tree but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'route-tree:'
export const clearModals = 'route-tree:clearModals'
export const navUpToScreen = 'route-tree:navUpToScreen'
export const navigateAppend = 'route-tree:navigateAppend'
export const navigateUp = 'route-tree:navigateUp'
export const navigateUpNoop = 'route-tree:navigateUpNoop'
export const onNavChanged = 'route-tree:onNavChanged'
export const popStack = 'route-tree:popStack'
export const setParams = 'route-tree:setParams'
export const switchLoggedIn = 'route-tree:switchLoggedIn'
export const switchTab = 'route-tree:switchTab'
export const tabLongPress = 'route-tree:tabLongPress'

// Action Creators
/**
 * Nav up but no longer focused, for logging only
 */
export const createNavigateUpNoop = (payload?: undefined) => ({
  payload,
  type: navigateUpNoop as typeof navigateUpNoop,
})
/**
 * ONLY used by the new nav. Navigates up to this route if it already exists, noops otherwise.
 */
export const createNavUpToScreen = (payload: {readonly name: string; readonly params?: Object}) => ({
  payload,
  type: navUpToScreen as typeof navUpToScreen,
})
/**
 * ONLY used by the new nav. Switch login stacks
 */
export const createSwitchLoggedIn = (payload: {readonly loggedIn: boolean}) => ({
  payload,
  type: switchLoggedIn as typeof switchLoggedIn,
})
/**
 * ONLY used by the new nav. Switch to a different tab.
 */
export const createSwitchTab = (payload: {readonly tab: Tabs.AppTab; readonly params?: Object}) => ({
  payload,
  type: switchTab as typeof switchTab,
})
/**
 * ONLY used by the new nav. use this to clear any modal routes
 */
export const createClearModals = (payload?: undefined) => ({payload, type: clearModals as typeof clearModals})
/**
 * Reset a stack
 */
export const createPopStack = (payload?: undefined) => ({payload, type: popStack as typeof popStack})
/**
 * a tab was pressed
 */
export const createTabLongPress = (payload: {readonly tab: string}) => ({
  payload,
  type: tabLongPress as typeof tabLongPress,
})
/**
 * deprecated soon
 */
export const createSetParams = (payload: {readonly params: Object; readonly key: string}) => ({
  payload,
  type: setParams as typeof setParams,
})
export const createNavigateAppend = (payload: {
  readonly fromKey?: string
  readonly path: any
  readonly replace?: boolean
}) => ({payload, type: navigateAppend as typeof navigateAppend})
export const createNavigateUp = (payload: {readonly fromKey?: string} = {}) => ({
  payload,
  type: navigateUp as typeof navigateUp,
})
export const createOnNavChanged = (payload: {
  readonly prev: Types.NavState | undefined
  readonly next: Types.NavState | undefined
  readonly navAction: any
}) => ({payload, type: onNavChanged as typeof onNavChanged})

// Action Payloads
export type ClearModalsPayload = ReturnType<typeof createClearModals>
export type NavUpToScreenPayload = ReturnType<typeof createNavUpToScreen>
export type NavigateAppendPayload = ReturnType<typeof createNavigateAppend>
export type NavigateUpNoopPayload = ReturnType<typeof createNavigateUpNoop>
export type NavigateUpPayload = ReturnType<typeof createNavigateUp>
export type OnNavChangedPayload = ReturnType<typeof createOnNavChanged>
export type PopStackPayload = ReturnType<typeof createPopStack>
export type SetParamsPayload = ReturnType<typeof createSetParams>
export type SwitchLoggedInPayload = ReturnType<typeof createSwitchLoggedIn>
export type SwitchTabPayload = ReturnType<typeof createSwitchTab>
export type TabLongPressPayload = ReturnType<typeof createTabLongPress>

// All Actions
// prettier-ignore
export type Actions =
  | ClearModalsPayload
  | NavUpToScreenPayload
  | NavigateAppendPayload
  | NavigateUpNoopPayload
  | NavigateUpPayload
  | OnNavChangedPayload
  | PopStackPayload
  | SetParamsPayload
  | SwitchLoggedInPayload
  | SwitchTabPayload
  | TabLongPressPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
