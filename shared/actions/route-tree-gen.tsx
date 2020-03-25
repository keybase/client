// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as Tabs from '../constants/tabs'
import * as Types from '../constants/types/route-tree'

// Constants
export const resetStore = 'common:resetStore' // not a part of route-tree but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'route-tree:'
export const clearModals = 'route-tree:clearModals'
export const navUpToScreen = 'route-tree:navUpToScreen'
export const navigateAppend = 'route-tree:navigateAppend'
export const navigateUp = 'route-tree:navigateUp'
export const onNavChanged = 'route-tree:onNavChanged'
export const resetStack = 'route-tree:resetStack'
export const setParams = 'route-tree:setParams'
export const switchLoggedIn = 'route-tree:switchLoggedIn'
export const switchTab = 'route-tree:switchTab'

// Payload Types
type _ClearModalsPayload = void
type _NavUpToScreenPayload = {readonly routeName: string}
type _NavigateAppendPayload = {readonly fromKey?: string; readonly path: any; readonly replace?: boolean}
type _NavigateUpPayload = {readonly fromKey?: string}
type _OnNavChangedPayload = {
  readonly prev: Array<Types.NavState>
  readonly next: Array<Types.NavState>
  readonly navAction: any
}
type _ResetStackPayload = {
  readonly tab: Tabs.AppTab | 'loggedOut'
  readonly actions: Array<any>
  readonly index: number
}
type _SetParamsPayload = {readonly params: Object; readonly key: string}
type _SwitchLoggedInPayload = {readonly loggedIn: boolean}
type _SwitchTabPayload = {readonly tab: Tabs.AppTab}

// Action Creators
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
export const createClearModals = (payload: _ClearModalsPayload): ClearModalsPayload => ({
  payload,
  type: clearModals,
})
/**
 * Reset a specific stack. actions is route tree actions TODO better typing
 */
export const createResetStack = (payload: _ResetStackPayload): ResetStackPayload => ({
  payload,
  type: resetStack,
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
export type NavigateUpPayload = {readonly payload: _NavigateUpPayload; readonly type: typeof navigateUp}
export type OnNavChangedPayload = {readonly payload: _OnNavChangedPayload; readonly type: typeof onNavChanged}
export type ResetStackPayload = {readonly payload: _ResetStackPayload; readonly type: typeof resetStack}
export type SetParamsPayload = {readonly payload: _SetParamsPayload; readonly type: typeof setParams}
export type SwitchLoggedInPayload = {
  readonly payload: _SwitchLoggedInPayload
  readonly type: typeof switchLoggedIn
}
export type SwitchTabPayload = {readonly payload: _SwitchTabPayload; readonly type: typeof switchTab}

// All Actions
// prettier-ignore
export type Actions =
  | ClearModalsPayload
  | NavUpToScreenPayload
  | NavigateAppendPayload
  | NavigateUpPayload
  | OnNavChangedPayload
  | ResetStackPayload
  | SetParamsPayload
  | SwitchLoggedInPayload
  | SwitchTabPayload
  | {type: 'common:resetStore', payload: {}}
