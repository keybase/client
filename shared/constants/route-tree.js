// @flow
import * as I from 'immutable'

import type {NoErrorTypedAction, TypedAction} from '../constants/types/flux'
import type {RouteDefNode, Path, PropsPath} from '../route-tree'

export const setRouteDef = 'routeTree:setRouteDef'
export type SetRouteDef = NoErrorTypedAction<'routeTree:setRouteDef', {routeDef: RouteDefNode}>

export const switchTo = 'routeTree:switchTo'
export type SwitchTo = NoErrorTypedAction<'routeTree:switchTo', {path: Path, parentPath: ?Path}>

export const navigateTo = 'routeTree:navigateTo'
export type NavigateTo = NoErrorTypedAction<'routeTree:navigateTo', {path: PropsPath<*>, parentPath: ?Path}>

export const navigateAppend = 'routeTree:navigateAppend'
export type NavigateAppend = NoErrorTypedAction<'routeTree:navigateAppend', {path: PropsPath<*>, parentPath: ?Path}>

export const navigateUp = 'routeTree:navigateUp'
export type NavigateUp = NoErrorTypedAction<'routeTree:navigateUp', null>

export const putActionIfOnPath = 'routeTree:putActionIfOnPath'
export type PutActionIfOnPath<T: TypedAction<*, *, *>> = NoErrorTypedAction<'routeTree:putActionIfOnPath', {expectedPath: Path, otherAction: T}>

export const setRouteState = 'routeTree:setRouteState'
export type SetRouteState = NoErrorTypedAction<'routeTree:setRouteState', {path: Path, partialState: {}}>

export const resetRoute = 'routeTree:resetRoute'
export type ResetRoute = NoErrorTypedAction<'routeTree:resetRoute', {path: Path}>

export type NavigateActions = SetRouteDef | SwitchTo | NavigateTo | NavigateAppend | NavigateUp | SetRouteState | ResetRoute

export const State = I.Record({
  routeDef: null,
  routeState: null,
})
