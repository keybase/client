// @flow
// TODO deprecate eventually and use RouteTreeGen directly
import * as I from 'immutable'
import * as Saga from '../util/saga'
import * as RouteTreeGen from './route-tree-gen'
import {getPath} from '../route-tree'

import type {RouteDefParams, Path, PropsPath} from '../route-tree'
import type {TypedState} from '../constants/reducer'

export function pathSelector(state: TypedState, parentPath?: Path): I.List<string> {
  return getPath(state.routeTree.routeState, parentPath)
}

// Set the tree of route definitions. Dispatched at initialization
// time.
export const setInitialRouteDef = (routeDef: RouteDefParams) =>
  RouteTreeGen.createSetInitialRouteDef({routeDef})

// Update the tree of route definitions.  Dispatched when route
// definitions update through HMR.
export const refreshRouteDef = (loginRouteTree: RouteDefParams, appRouteTree: RouteDefParams) =>
  RouteTreeGen.createRefreshRouteDef({appRouteTree, loginRouteTree})

// Switch the tree of route definitions. Dispatched when switching
// from logged out to logged in and vice versa.
export const switchRouteDef = (routeDef: RouteDefParams, path?: Path) =>
  RouteTreeGen.createSwitchRouteDef({path, routeDef})

// Switch to a new path, restoring the subpath it was previously on. E.g.:
//
//   (starting on /settings/invites)
//   navigate({selected: 'folders'})
//   => /folders
//   switchTo('settings')
//   => /settings/invites
//
// If parentPath is provided, the path will be switched to relative to
// parentPath without navigating to it.
export const switchTo = (path: Path, parentPath?: Path) => RouteTreeGen.createSwitchTo({path, parentPath})

// Navigate to a new absolute path. E.g.:
//
//   navigateTo({selected: 'foo', props: {prop1: 'hello'}}, {selected: 'bar', props: {prop2: 'world'}})
//   => /foo?prop1=hello/bar?prop2=world
//
// You can also specify path names as strings. This will select the name
// without changing props:
//
//    (starting on /foo?prop1=hello/bar?prop2=world)
//    navigateTo('foo', {selected: 'bar'})
//    => /foo?prop1=hello/bar
//
// If parentPath is provided, the path will be navigated to relative to
// parentPath without navigating to it.
export const navigateTo = (path: PropsPath<any>, parentPath?: ?Path) =>
  RouteTreeGen.createNavigateTo({path, parentPath})

// Navigate to a path relative to the current path.
// If parentPath is provided, the path will be appended relative to parentPath
// without navigating to it.
export const navigateAppend = (path: PropsPath<any>, parentPath?: Path) =>
  RouteTreeGen.createNavigateAppend({path, parentPath})

// Navigate one step up from the current path.
export const navigateUp = () => RouteTreeGen.createNavigateUp()

// Do a navigate action if the path is still what is expected
export const putActionIfOnPath = (expectedPath: Path, otherAction: any, parentPath?: Path) =>
  RouteTreeGen.createPutActionIfOnPath({expectedPath, otherAction, parentPath})

// Update the state object of a route at a specified path.
export const setRouteState = (
  path: Path,
  partialState: {} | ((oldState: I.Map<string, any>) => I.Map<string, any>)
) => RouteTreeGen.createSetRouteState({partialState, path})

// Reset the props and state for a subtree.
export const resetRoute = (path: Path) => RouteTreeGen.createResetRoute({path})

function* _putActionIfOnPath({payload: {otherAction, expectedPath, parentPath}}) {
  const state: TypedState = yield Saga.select()
  const currentPath = pathSelector(state, parentPath)
  if (I.is(I.List(expectedPath), currentPath)) {
    yield Saga.put(otherAction)
  }
}

function* routeSaga(): any {
  yield Saga.safeTakeEvery(RouteTreeGen.putActionIfOnPath, _putActionIfOnPath)
}

export default routeSaga
