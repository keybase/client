// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as Tabs from '../constants/tabs'

// Constants
export const resetStore = 'common:resetStore' // not a part of route-tree but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'route-tree:'
export const clearModals = 'route-tree:clearModals'
export const navUpToScreen = 'route-tree:navUpToScreen'
export const navigateAppend = 'route-tree:navigateAppend'
export const navigateUp = 'route-tree:navigateUp'
export const resetStack = 'route-tree:resetStack'
export const switchLoggedIn = 'route-tree:switchLoggedIn'
export const switchTab = 'route-tree:switchTab'

// Payload Types
type _ClearModalsPayload = void
type _NavUpToScreenPayload = {readonly routeName: string}
type _NavigateAppendPayload = {readonly fromKey?: string; readonly path: any; readonly replace?: boolean}
type _NavigateUpPayload = {readonly fromKey?: string}
type _ResetStackPayload = {readonly tab: Tabs.AppTab; readonly actions: Array<any>; readonly index: number}
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
export const createNavigateAppend = (payload: _NavigateAppendPayload): NavigateAppendPayload => ({
  payload,
  type: navigateAppend,
})
export const createNavigateUp = (payload: _NavigateUpPayload = Object.freeze({})): NavigateUpPayload => ({
  payload,
  type: navigateUp,
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
export type ResetStackPayload = {readonly payload: _ResetStackPayload; readonly type: typeof resetStack}
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
  | ResetStackPayload
  | SwitchLoggedInPayload
  | SwitchTabPayload
  | {type: 'common:resetStore', payload: {}}
