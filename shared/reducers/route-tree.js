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
import {isValidInitialTab} from '../constants/tabs'

const initialState = Constants.State()

function loggedInUserNavigatedReducer(loggedInUserNavigated, action) {
  const newLoggedInUserNavigated = (function() {
    switch (action.type) {
      case CommonConstants.resetStore:
        return false

      case Constants.switchTo:
        return true

      case Constants.navigateTo:
        const payload = action.payload
        const navigationSource: Constants.NavigationSource = payload.navigationSource
        const validNavigationSource = navigationSource === 'user' || navigationSource === 'initial-restore'
        const validTab = !payload.parentPath && payload.path.length >= 1 && isValidInitialTab(payload.path[0])
        return loggedInUserNavigated || (validNavigationSource && validTab)

      case Constants.navigateAppend:
        return true

      case Constants.navigateUp:
        return true

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
      action
    )
  }
  return newLoggedInUserNavigated
}

function routeDefReducer(routeDef, action) {
  switch (action.type) {
    case Constants.setRouteDef:
      return action.payload.routeDef

    default:
      return routeDef
  }
}

function routeStateReducer(routeDef, routeState, action) {
  switch (action.type) {
    case CommonConstants.resetStore:
      return routeSetProps(routeDef, null, [])

    case Constants.setRouteDef: {
      return routeNavigate(action.payload.routeDef, routeState, getPath(routeState))
    }

    case Constants.switchTo:
      return routeSetProps(routeDef, routeState, action.payload.path, action.payload.parentPath)

    case Constants.navigateTo:
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
      return routeNavigate(routeDef, routeState, action.payload.path, basePath)
    }

    case Constants.navigateUp: {
      const path = getPath(routeState)
      return routeNavigate(routeDef, routeState, path.skipLast(1))
    }

    case Constants.setRouteState:
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

  let newLoggedInUserNavigated
  let newRouteDef
  let newRouteState
  try {
    newLoggedInUserNavigated = loggedInUserNavigatedReducer(loggedInUserNavigated, action)
    newRouteDef = routeDefReducer(routeDef, action)
    newRouteState = routeStateReducer(routeDef, routeState, action)
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
    routeDef: newRouteDef,
    routeState: newRouteState,
  })
}
