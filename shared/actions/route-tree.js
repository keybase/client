// @flow
import * as Constants from '../constants/route-tree'
import type {RouteDefNode, Path, PropsPath} from '../route-tree'
import type {
  SetRouteDef,
  SwitchTo,
  NavigateTo,
  NavigateAppend,
  NavigateUp,
  SetRouteState,
  ResetRoute,
} from '../constants/route-tree'

// Set (or update) the tree of route definitions. Dispatched at initialization
// time and when route definitions update through HMR.
export function setRouteDef (routeDef: RouteDefNode): SetRouteDef {
  return {
    type: Constants.setRouteDef,
    payload: {routeDef},
  }
}

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
export function switchTo (path: Path, parentPath?: Path): SwitchTo {
  return {
    type: Constants.switchTo,
    payload: {path, parentPath},
  }
}

// Navigate to a new absolute path. E.g.:
//
//   navigateTo({selected: 'foo', prop1: 'hello'}, {selected: 'bar', prop2: 'world'})
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
export function navigateTo (path: PropsPath<*>, parentPath?: Path): NavigateTo {
  return {
    type: Constants.navigateTo,
    payload: {path, parentPath},
  }
}

// Navigate to a path relative to the current path.
// If parentPath is provided, the path will be appended relative to parentPath
// without navigating to it.
export function navigateAppend (path: PropsPath<*>, parentPath?: Path): NavigateAppend {
  return {
    type: Constants.navigateAppend,
    payload: {path, parentPath},
  }
}

// Navigate one step up from the current path.
export function navigateUp (): NavigateUp {
  return {
    type: Constants.navigateUp,
    payload: null,
  }
}

// Update the state object of a route at a specified path.
export function setRouteState (path: Path, partialState: {}): SetRouteState {
  return {
    type: Constants.setRouteState,
    payload: {path, partialState},
  }
}

// Reset the props and state for a subtree.
export function resetRoute (path: Path): ResetRoute {
  return {
    type: Constants.resetRoute,
    payload: {path},
  }
}
