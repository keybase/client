// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as Tabs from '../constants/tabs'

// Constants
export const resetStore = 'common:resetStore' // not a part of route-tree but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'route-tree:'
export const clearModals = 'route-tree:clearModals'
export const navUpToScreen = 'route-tree:navUpToScreen'
export const navigateAppend = 'route-tree:navigateAppend'
export const navigateTo = 'route-tree:navigateTo'
export const navigateUp = 'route-tree:navigateUp'
export const putActionIfOnPath = 'route-tree:putActionIfOnPath'
export const resetStack = 'route-tree:resetStack'
export const switchRouteDef = 'route-tree:switchRouteDef'
export const switchTab = 'route-tree:switchTab'
export const switchTo = 'route-tree:switchTo'

// Payload Types
type _ClearModalsPayload = void
type _NavUpToScreenPayload = {readonly routeName: string}
type _NavigateAppendPayload = {
  readonly fromKey?: string
  readonly path: any
  readonly parentPath?: any
  readonly replace?: boolean
}
type _NavigateToPayload = {readonly path: any; readonly parentPath?: any; readonly replace?: boolean}
type _NavigateUpPayload = {readonly fromKey?: string}
type _PutActionIfOnPathPayload = {
  readonly expectedPath: any
  readonly otherAction: any
  readonly parentPath?: any
}
type _ResetStackPayload = {readonly tab: Tabs.AppTab; readonly actions: Array<any>; readonly index: number}
type _SwitchRouteDefPayload = {readonly loggedIn: boolean; readonly path?: any}
type _SwitchTabPayload = {readonly tab: Tabs.AppTab}
type _SwitchToPayload = {readonly path: any; readonly parentPath?: any}

// Action Creators
/**
 * ONLY used by the new nav. Navigates up to this route if it already exists, noops otherwise.
 */
export const createNavUpToScreen = (payload: _NavUpToScreenPayload): NavUpToScreenPayload => ({
  payload,
  type: navUpToScreen,
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
 * TODO for this whole json. replace all these actions with a cleaned up version
 */
export const createSwitchRouteDef = (payload: _SwitchRouteDefPayload): SwitchRouteDefPayload => ({
  payload,
  type: switchRouteDef,
})
export const createNavigateAppend = (payload: _NavigateAppendPayload): NavigateAppendPayload => ({
  payload,
  type: navigateAppend,
})
export const createNavigateTo = (payload: _NavigateToPayload): NavigateToPayload => ({
  payload,
  type: navigateTo,
})
export const createNavigateUp = (payload: _NavigateUpPayload = Object.freeze({})): NavigateUpPayload => ({
  payload,
  type: navigateUp,
})
export const createPutActionIfOnPath = (payload: _PutActionIfOnPathPayload): PutActionIfOnPathPayload => ({
  payload,
  type: putActionIfOnPath,
})
export const createSwitchTo = (payload: _SwitchToPayload): SwitchToPayload => ({payload, type: switchTo})

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
export type NavigateToPayload = {readonly payload: _NavigateToPayload; readonly type: typeof navigateTo}
export type NavigateUpPayload = {readonly payload: _NavigateUpPayload; readonly type: typeof navigateUp}
export type PutActionIfOnPathPayload = {
  readonly payload: _PutActionIfOnPathPayload
  readonly type: typeof putActionIfOnPath
}
export type ResetStackPayload = {readonly payload: _ResetStackPayload; readonly type: typeof resetStack}
export type SwitchRouteDefPayload = {
  readonly payload: _SwitchRouteDefPayload
  readonly type: typeof switchRouteDef
}
export type SwitchTabPayload = {readonly payload: _SwitchTabPayload; readonly type: typeof switchTab}
export type SwitchToPayload = {readonly payload: _SwitchToPayload; readonly type: typeof switchTo}

// All Actions
// prettier-ignore
export type Actions =
  | ClearModalsPayload
  | NavUpToScreenPayload
  | NavigateAppendPayload
  | NavigateToPayload
  | NavigateUpPayload
  | PutActionIfOnPathPayload
  | ResetStackPayload
  | SwitchRouteDefPayload
  | SwitchTabPayload
  | SwitchToPayload
  | {type: 'common:resetStore', payload: null}
