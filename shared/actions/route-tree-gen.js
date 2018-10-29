// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/route-tree'
import * as Constants from '../constants/route-tree'
import * as RCConstants from '../route-tree'

// Constants
export const resetStore = 'common:resetStore' // not a part of route-tree but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'route-tree:'
export const navigateAppend = 'route-tree:navigateAppend'
export const navigateTo = 'route-tree:navigateTo'
export const navigateUp = 'route-tree:navigateUp'
export const putActionIfOnPath = 'route-tree:putActionIfOnPath'
export const refreshRouteDef = 'route-tree:refreshRouteDef'
export const resetRoute = 'route-tree:resetRoute'
export const setInitialRouteDef = 'route-tree:setInitialRouteDef'
export const setRouteState = 'route-tree:setRouteState'
export const switchRouteDef = 'route-tree:switchRouteDef'
export const switchTo = 'route-tree:switchTo'

// Payload Types
type _NavigateAppendPayload = $ReadOnly<{|
  path: RCConstants.PropsPath<any>,
  parentPath?: ?RCConstants.Path,
|}>
type _NavigateToPayload = $ReadOnly<{|
  path: RCConstants.PropsPath<any>,
  parentPath?: ?RCConstants.Path,
|}>
type _NavigateUpPayload = void
type _PutActionIfOnPathPayload = $ReadOnly<{|
  expectedPath: RCConstants.Path,
  otherAction: any,
  parentPath?: ?RCConstants.Path,
|}>
type _RefreshRouteDefPayload = $ReadOnly<{|
  loginRouteTree: RCConstants.RouteDefParams,
  appRouteTree: RCConstants.RouteDefParams,
|}>
type _ResetRoutePayload = $ReadOnly<{|path: RCConstants.Path|}>
type _SetInitialRouteDefPayload = $ReadOnly<{|routeDef: RCConstants.RouteDefParams|}>
type _SetRouteStatePayload = $ReadOnly<{|
  path: RCConstants.Path,
  partialState: {} | ((oldState: I.Map<string, any>) => I.Map<string, any>),
|}>
type _SwitchRouteDefPayload = $ReadOnly<{|
  routeDef: RCConstants.RouteDefParams,
  path?: ?RCConstants.Path,
|}>
type _SwitchToPayload = $ReadOnly<{|
  path: RCConstants.Path,
  parentPath?: ?RCConstants.Path,
|}>

// Action Creators
/**
 * Set the tree of route definitions. Dispatched at initialization time.
 */
export const createSetInitialRouteDef = (payload: _SetInitialRouteDefPayload) => ({payload, type: setInitialRouteDef})
export const createNavigateAppend = (payload: _NavigateAppendPayload) => ({payload, type: navigateAppend})
export const createNavigateTo = (payload: _NavigateToPayload) => ({payload, type: navigateTo})
export const createNavigateUp = (payload: _NavigateUpPayload) => ({payload, type: navigateUp})
export const createPutActionIfOnPath = (payload: _PutActionIfOnPathPayload) => ({payload, type: putActionIfOnPath})
export const createRefreshRouteDef = (payload: _RefreshRouteDefPayload) => ({payload, type: refreshRouteDef})
export const createResetRoute = (payload: _ResetRoutePayload) => ({payload, type: resetRoute})
export const createSetRouteState = (payload: _SetRouteStatePayload) => ({payload, type: setRouteState})
export const createSwitchRouteDef = (payload: _SwitchRouteDefPayload) => ({payload, type: switchRouteDef})
export const createSwitchTo = (payload: _SwitchToPayload) => ({payload, type: switchTo})

// Action Payloads
export type NavigateAppendPayload = $Call<typeof createNavigateAppend, _NavigateAppendPayload>
export type NavigateToPayload = $Call<typeof createNavigateTo, _NavigateToPayload>
export type NavigateUpPayload = $Call<typeof createNavigateUp, _NavigateUpPayload>
export type PutActionIfOnPathPayload = $Call<typeof createPutActionIfOnPath, _PutActionIfOnPathPayload>
export type RefreshRouteDefPayload = $Call<typeof createRefreshRouteDef, _RefreshRouteDefPayload>
export type ResetRoutePayload = $Call<typeof createResetRoute, _ResetRoutePayload>
export type SetInitialRouteDefPayload = $Call<typeof createSetInitialRouteDef, _SetInitialRouteDefPayload>
export type SetRouteStatePayload = $Call<typeof createSetRouteState, _SetRouteStatePayload>
export type SwitchRouteDefPayload = $Call<typeof createSwitchRouteDef, _SwitchRouteDefPayload>
export type SwitchToPayload = $Call<typeof createSwitchTo, _SwitchToPayload>

// All Actions
// prettier-ignore
export type Actions =
  | NavigateAppendPayload
  | NavigateToPayload
  | NavigateUpPayload
  | PutActionIfOnPathPayload
  | RefreshRouteDefPayload
  | ResetRoutePayload
  | SetInitialRouteDefPayload
  | SetRouteStatePayload
  | SwitchRouteDefPayload
  | SwitchToPayload
  | {type: 'common:resetStore', payload: void}
