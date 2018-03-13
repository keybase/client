// @flow
import * as I from 'immutable'
import type {NoErrorTypedAction, TypedAction} from './flux'
import type {RouteDefNode, RouteDefParams, Path, PropsPath, RouteStateNode} from '../../route-tree'

export type SetInitialRouteDef = NoErrorTypedAction<
  'routeTree:setInitialRouteDef',
  {routeDef: RouteDefParams}
>

export type RefreshRouteDef = NoErrorTypedAction<
  'routeTree:refreshRouteDef',
  {loginRouteTree: RouteDefParams, appRouteTree: RouteDefParams}
>

export type SwitchRouteDef = NoErrorTypedAction<'routeTree:switchRouteDef', {routeDef: RouteDefParams}>

export type SwitchTo = NoErrorTypedAction<'routeTree:switchTo', {path: Path, parentPath: ?Path}>

export type NavigationSource = 'initial-default' | 'initial-restore' | 'user'
export type NavigateTo = NoErrorTypedAction<
  'routeTree:navigateTo',
  {path: PropsPath<*>, parentPath: ?Path, navigationSource: NavigationSource}
>

export type NavigateAppend = NoErrorTypedAction<
  'routeTree:navigateAppend',
  {path: PropsPath<*>, parentPath: ?Path}
>

export type NavigateUp = NoErrorTypedAction<'routeTree:navigateUp', null>
export type PutActionIfOnPath<T: TypedAction<*, *, *>> = NoErrorTypedAction<
  'routeTree:putActionIfOnPath',
  {expectedPath: Path, parentPath?: Path, otherAction: T}
>
export type SetRouteState = NoErrorTypedAction<'routeTree:setRouteState', {path: Path, partialState: {}}>
export type ResetRoute = NoErrorTypedAction<'routeTree:resetRoute', {path: Path}>
export type NavigateActions =
  | SetInitialRouteDef
  | RefreshRouteDef
  | SwitchRouteDef
  | SwitchTo
  | NavigateTo
  | NavigateAppend
  | NavigateUp
  | SetRouteState
  | ResetRoute

export type _State = {
  loggedInUserNavigated: boolean,
  routeDef: ?RouteDefNode,
  routeState: ?RouteStateNode,
}
export type State = I.RecordOf<_State>
