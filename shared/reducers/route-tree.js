// @flow
import * as I from 'immutable'
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/route-tree'
import {
  InvalidRouteError,
  getPath,
  pathToString,
  routeSetProps,
  routeNavigate,
  routeSetState,
  routeClear,
  checkRouteState,
} from '../route-tree'
import {isValidInitialTabString} from '../constants/tabs'

// This makes an empty one which isn't really allowed, we always init it before anything really happens
const initialState = Constants.makeState()
// So lets actually use the initial routeDef we get
let firstRouteDef

function computeLoggedInUserNavigated(navigationSource: Constants.NavigationSource, newSelectedTab: ?string) {
  const validNavigationSource = navigationSource === 'user' || navigationSource === 'initial-restore'
  if (!validNavigationSource) {
    return false
  }
  return isValidInitialTabString(newSelectedTab)
}

function loggedInUserNavigatedReducer(loggedInUserNavigated, newSelectedTab, action) {
  const newLoggedInUserNavigated = (function() {
    switch (action.type) {
      case CommonConstants.resetStore:
        return false

      case Constants.navigateTo:
        return (
          loggedInUserNavigated ||
          computeLoggedInUserNavigated(action.payload.navigationSource, newSelectedTab)
        )

      case Constants.switchTo:
      case Constants.navigateAppend:
      case Constants.navigateUp:
        return loggedInUserNavigated || computeLoggedInUserNavigated('user', newSelectedTab)

      default:
        return loggedInUserNavigated
    }
  })()
  if (loggedInUserNavigated !== newLoggedInUserNavigated) {
    console.log(
      '[RouteState] route changed changed from',
      loggedInUserNavigated,
      'to',
      newLoggedInUserNavigated,
      '; action: ',
      action,
      ', selected tab:',
      newSelectedTab
    )
  }
  return newLoggedInUserNavigated
}

function routeDefReducer(routeDef, action) {
  switch (action.type) {
    case Constants.setRouteDef:
      if (!firstRouteDef) {
        // Store the first route def set
        firstRouteDef = action.payload.routeDef
      }
      return action.payload.routeDef

    default:
      return routeDef
  }
}

function routeStateReducer(routeDef, routeState, action) {
  switch (action.type) {
    case CommonConstants.resetStore:
      // $FlowIssue
      return routeSetProps(routeDef, null, [])

    case Constants.setRouteDef: {
      return routeNavigate(action.payload.routeDef, routeState, getPath(routeState))
    }

    case Constants.switchTo:
      // $FlowIssue
      return routeSetProps(routeDef, routeState, action.payload.path, action.payload.parentPath)

    case Constants.navigateTo:
      // $FlowIssue
      return routeNavigate(routeDef, routeState, action.payload.path, action.payload.parentPath)

    case Constants.navigateAppend: {
      const parentPath = I.List(action.payload.parentPath)

      // Determine the current path to append to, optionally as a sub-path of
      // parentPath.
      let basePath = getPath(routeState, parentPath)
      if (basePath.size < parentPath.size) {
        // It's possible the current path is not as deep as the specified
        // parentPath. If so, just use parentPath.
        basePath = parentPath
      }
      // $FlowIssue
      return routeNavigate(routeDef, routeState, action.payload.path, basePath)
    }

    case Constants.navigateUp: {
      const path = getPath(routeState)
      // $FlowIssue
      return routeNavigate(routeDef, routeState, path.skipLast(1))
    }

    case Constants.setRouteState:
      // $FlowIssue
      return routeSetState(routeDef, routeState, action.payload.path, action.payload.partialState)

    case Constants.resetRoute:
      return routeClear(routeState, action.payload.path)

    default:
      return routeState
  }
}

export default function routeTreeReducer(
  state: Constants.State = initialState,
  action: any
): Constants.State {
  let {loggedInUserNavigated, routeDef, routeState} = state
  if (action.type === CommonConstants.resetStore) {
    routeDef = firstRouteDef || initialState
    // $FlowIssue
    routeState = routeSetProps(routeDef, null, [])
  }

  let newLoggedInUserNavigated
  let newRouteDef
  let newRouteState
  try {
    newRouteDef = routeDefReducer(routeDef, action)
    newRouteState = routeStateReducer(routeDef, routeState, action)
    newLoggedInUserNavigated = loggedInUserNavigatedReducer(
      loggedInUserNavigated,
      newRouteState && newRouteState.selected,
      action
    )
  } catch (err) {
    if (action.type === Constants.setRouteDef && err instanceof InvalidRouteError) {
      console.warn(
        'New route tree mismatches current state. Not updating (please reload manually if needed).'
      )
    } else {
      console.error(
        `Attempt to perform ${action.type} on ${pathToString(getPath(routeState))} raised exception: ${err}. Aborting.`
      )
    }
    return state
  }

  if (
    !I.is(loggedInUserNavigated, newLoggedInUserNavigated) ||
    !I.is(routeDef, newRouteDef) ||
    !I.is(routeState, newRouteState)
  ) {
    // If we changed something, sanity check new state for errors.
    // $FlowIssue
    const routeError = checkRouteState(newLoggedInUserNavigated, newRouteDef, newRouteState)
    if (routeError) {
      console.error(
        `Attempt to perform ${action.type} on ${pathToString(getPath(routeState))} would result in invalid routeTree state: "${routeError}". Aborting.`
      )
      return state
    }
  }

  return state.merge({
    loggedInUserNavigated: newLoggedInUserNavigated,
    // $FlowIssue
    routeDef: newRouteDef,
    routeState: newRouteState,
  })
}
