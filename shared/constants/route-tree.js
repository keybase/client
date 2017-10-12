// @flow
import * as I from 'immutable'

import type {NoErrorTypedAction, TypedAction} from '../constants/types/flux'
import type {RouteDefNode, RouteDefParams, Path, PropsPath, RouteStateNode} from '../route-tree'

export const setRouteDef = 'routeTree:setRouteDef'
export type SetRouteDef = NoErrorTypedAction<'routeTree:setRouteDef', {routeDef: RouteDefParams}>

export const switchTo = 'routeTree:switchTo'
export type SwitchTo = NoErrorTypedAction<'routeTree:switchTo', {path: Path, parentPath: ?Path}>

export type NavigationSource = 'initial-default' | 'initial-restore' | 'user'

export const navigateTo = 'routeTree:navigateTo'
export type NavigateTo = NoErrorTypedAction<
  'routeTree:navigateTo',
  {path: PropsPath<*>, parentPath: ?Path, navigationSource: NavigationSource}
>

export const navigateAppend = 'routeTree:navigateAppend'
export type NavigateAppend = NoErrorTypedAction<
  'routeTree:navigateAppend',
  {path: PropsPath<*>, parentPath: ?Path}
>

export const navigateUp = 'routeTree:navigateUp'
export type NavigateUp = NoErrorTypedAction<'routeTree:navigateUp', null>

export const putActionIfOnPath = 'routeTree:putActionIfOnPath'
export type PutActionIfOnPath<T: TypedAction<*, *, *>> = NoErrorTypedAction<
  'routeTree:putActionIfOnPath',
  {expectedPath: Path, parentPath?: Path, otherAction: T}
>

export const setRouteState = 'routeTree:setRouteState'
export type SetRouteState = NoErrorTypedAction<'routeTree:setRouteState', {path: Path, partialState: {}}>

export const resetRoute = 'routeTree:resetRoute'
export type ResetRoute = NoErrorTypedAction<'routeTree:resetRoute', {path: Path}>

export type NavigateActions =
  | SetRouteDef
  | SwitchTo
  | NavigateTo
  | NavigateAppend
  | NavigateUp
  | SetRouteState
  | ResetRoute

type _State = {
  loggedInUserNavigated: boolean,
  routeDef: ?RouteDefNode,
  routeState: ?RouteStateNode,
}
export type State = I.RecordOf<_State>
export const makeState: I.RecordFactory<_State> = I.Record({
  loggedInUserNavigated: false,
  routeDef: null,
  routeState: null,
})
