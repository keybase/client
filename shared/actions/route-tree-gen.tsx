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

// Payload Types
type _ClearModalsPayload = undefined
type _NavUpToScreenPayload = {readonly name: string; readonly params?: Object}
type _NavigateAppendPayload = {readonly fromKey?: string; readonly path: any; readonly replace?: boolean}
type _NavigateUpNoopPayload = undefined
type _NavigateUpPayload = {readonly fromKey?: string}
type _OnNavChangedPayload = {
  readonly prev: Array<Types.Route>
  readonly next: Array<Types.Route>
  readonly navAction: any
}
type _PopStackPayload = undefined
type _SetParamsPayload = {readonly params: Object; readonly key: string}
type _SwitchLoggedInPayload = {readonly loggedIn: boolean}
type _SwitchTabPayload = {readonly tab: Tabs.AppTab; readonly params?: Object}
type _TabLongPressPayload = {readonly tab: string}

// Action Creators
/**
 * Nav up but no longer focused, for logging only
 */
export const createNavigateUpNoop = (payload?: _NavigateUpNoopPayload): NavigateUpNoopPayload => ({
  payload,
  type: navigateUpNoop,
})
/**
 * ONLY used by the new nav. Navigates up to this route if it already exists, noops otherwise.
 */
export const createNavUpToScreen = (payload: _NavUpToScreenPayload): NavUpToScreenPayload => ({
  payload,
  type: navUpToScreen,
})
/**
 * ONLY used by the new nav. Switch login stacks
 */
export const createSwitchLoggedIn = (payload: _SwitchLoggedInPayload): SwitchLoggedInPayload => ({
  payload,
  type: switchLoggedIn,
})
/**
 * ONLY used by the new nav. Switch to a different tab.
 */
export const createSwitchTab = (payload: _SwitchTabPayload): SwitchTabPayload => ({payload, type: switchTab})
/**
 * ONLY used by the new nav. use this to clear any modal routes
 */
export const createClearModals = (payload?: _ClearModalsPayload): ClearModalsPayload => ({
  payload,
  type: clearModals,
})
/**
 * Reset a stack
 */
export const createPopStack = (payload?: _PopStackPayload): PopStackPayload => ({payload, type: popStack})
/**
 * a tab was pressed
 */
export const createTabLongPress = (payload: _TabLongPressPayload): TabLongPressPayload => ({
  payload,
  type: tabLongPress,
})
/**
 * deprecated soon
 */
export const createSetParams = (payload: _SetParamsPayload): SetParamsPayload => ({payload, type: setParams})
export const createNavigateAppend = (payload: _NavigateAppendPayload): NavigateAppendPayload => ({
  payload,
  type: navigateAppend,
})
export const createNavigateUp = (payload: _NavigateUpPayload = Object.freeze({})): NavigateUpPayload => ({
  payload,
  type: navigateUp,
})
export const createOnNavChanged = (payload: _OnNavChangedPayload): OnNavChangedPayload => ({
  payload,
  type: onNavChanged,
})

// Action Payloads
export type ClearModalsPayload = {readonly payload: _ClearModalsPayload; readonly type: typeof clearModals}
export type NavUpToScreenPayload = {
  readonly payload: _NavUpToScreenPayload
  readonly type: typeof navUpToScreen
}
export type NavigateAppendPayload = {
  readonly payload: _NavigateAppendPayload
  readonly type: typeof navigateAppend
}
export type NavigateUpNoopPayload = {
  readonly payload: _NavigateUpNoopPayload
  readonly type: typeof navigateUpNoop
}
export type NavigateUpPayload = {readonly payload: _NavigateUpPayload; readonly type: typeof navigateUp}
export type OnNavChangedPayload = {readonly payload: _OnNavChangedPayload; readonly type: typeof onNavChanged}
export type PopStackPayload = {readonly payload: _PopStackPayload; readonly type: typeof popStack}
export type SetParamsPayload = {readonly payload: _SetParamsPayload; readonly type: typeof setParams}
export type SwitchLoggedInPayload = {
  readonly payload: _SwitchLoggedInPayload
  readonly type: typeof switchLoggedIn
}
export type SwitchTabPayload = {readonly payload: _SwitchTabPayload; readonly type: typeof switchTab}
export type TabLongPressPayload = {readonly payload: _TabLongPressPayload; readonly type: typeof tabLongPress}

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
