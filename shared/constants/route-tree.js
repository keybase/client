// @flow
import type {TypedAction} from '../constants/types/flux'
import type {RouteDefNode, Path, PropsPath} from '../route-tree'

export const setRouteDef = 'routeTree:setRouteDef'
export type SetRouteDef = TypedAction<'routeTree:setRouteDef', {routeDef: RouteDefNode}, {}>

export const switchTo = 'routeTree:switchTo'
export type SwitchTo = TypedAction<'routeTree:switchTo', {path: Path, parentPath: ?Path}, {}>

export const navigateTo = 'routeTree:navigateTo'
export type NavigateTo = TypedAction<'routeTree:navigateTo', {path: PropsPath, parentPath: ?Path}, {}>

export const navigateAppend = 'routeTree:navigateAppend'
export type NavigateAppend = TypedAction<'routeTree:navigateAppend', {path: PropsPath, parentPath: ?Path}, {}>

export const navigateUp = 'routeTree:navigateUp'
export type NavigateUp = TypedAction<'routeTree:navigateUp', null, {}>

export const setRouteState = 'routeTree:setRouteState'
export type SetRouteState = TypedAction<'routeTree:setRouteState', {path: Path, partialState: {}}, {}>

export const resetRoute = 'routeTree:resetRoute'
export type ResetRoute = TypedAction<'routeTree:resetRoute', {path: Path}, {}>
