// @flow
import logger from '../logger'
import * as I from 'immutable'
import * as Constants from '../constants/route-tree'
import * as Types from '../constants/types/route-tree'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {
  getPath,
  pathToString,
  routeSetProps,
  routeNavigate,
  routeSetState,
  routeClear,
  checkRouteState,
  type RouteDefNode,
} from '../route-tree'
import {loginRouteTreeTitle, appRouteTreeTitle} from '../app/route-constants'
import {isValidInitialTabString} from '../constants/tabs'

// This makes an empty one which isn't really allowed, we always init it before anything really happens
const initialState = Constants.makeState()
// So let's actually use the initial routeDef we get
let firstRouteDef: ?RouteDefNode

function loggedInUserNavigatedReducer(loggedInUserNavigated, newSelectedTab, action) {
  const newLoggedInUserNavigated = (function() {
    switch (action.type) {
      case 'common:resetStore':
        return false

      case RouteTreeGen.navigateTo:
        return loggedInUserNavigated || isValidInitialTabString(newSelectedTab)

      case RouteTreeGen.switchTo:
      case RouteTreeGen.navigateAppend:
      case RouteTreeGen.navigateUp:
        return loggedInUserNavigated || isValidInitialTabString(newSelectedTab)

      default:
        return loggedInUserNavigated
    }
  })()
  if (loggedInUserNavigated !== newLoggedInUserNavigated) {
    logger.info(
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

const getCurrentRouteTree = (
  routeDef: ?RouteDefNode,
  action: RouteTreeGen.RefreshRouteDefPayload
): RouteDefNode => {
  let res = action.payload.appRouteTree
  let title = ''
  if (routeDef && routeDef.tags && routeDef.tags.title) {
    title = routeDef.tags.title
  }
  switch (title) {
    case loginRouteTreeTitle:
      res = action.payload.loginRouteTree
      break
    case appRouteTreeTitle:
      res = action.payload.appRouteTree
      break
    default:
      throw new Error(`Current routeDef has unknown title ${title}`)
  }
  // $FlowIssue ReturnType<makeRouteDefNode> is compatible with RouteDefNode
  return res
}

function routeDefReducer(routeDef: ?RouteDefNode, action) {
  switch (action.type) {
    case RouteTreeGen.setInitialRouteDef:
      if (firstRouteDef) {
        logger.error('setInitialRouteDef called more than once')
      } else {
        // Store the first route def set
        firstRouteDef = action.payload.routeDef
      }
      return action.payload.routeDef

    case RouteTreeGen.refreshRouteDef:
      return getCurrentRouteTree(routeDef, action)

    case RouteTreeGen.switchRouteDef:
      return action.payload.routeDef

    default:
      return routeDef
  }
}

function routeStateReducer(routeDef, routeState, action) {
  switch (action.type) {
    case RouteTreeGen.resetStore:
      return routeSetProps(routeDef, null, [])

    case RouteTreeGen.setInitialRouteDef: {
      return routeNavigate(action.payload.routeDef, routeState, getPath(routeState))
    }

    case RouteTreeGen.refreshRouteDef: {
      const currentRouteTree = getCurrentRouteTree(routeDef, action)
      return routeNavigate(currentRouteTree, routeState, getPath(routeState))
    }

    case RouteTreeGen.switchRouteDef: {
      return routeNavigate(action.payload.routeDef, routeState, action.payload.path || [])
    }

    case RouteTreeGen.switchTo:
      return routeSetProps(routeDef, routeState, action.payload.path, action.payload.parentPath)

    case RouteTreeGen.navigateTo:
      return routeNavigate(routeDef, routeState, action.payload.path, action.payload.parentPath)

    case RouteTreeGen.navigateAppend: {
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

    case RouteTreeGen.navigateUp: {
      const path = getPath(routeState)
      return routeNavigate(routeDef, routeState, path.skipLast(1))
    }

    case RouteTreeGen.setRouteState:
      return routeSetState(routeDef, routeState, action.payload.path, action.payload.partialState)

    case RouteTreeGen.resetRoute:
      return routeClear(routeState, action.payload.path)

    default:
      return routeState
  }
}

export default function routeTreeReducer(state: Types.State = initialState, action: any): Types.State {
  let {loggedInUserNavigated, routeDef, routeState} = state
  if (action.type === RouteTreeGen.resetStore) {
    routeDef = firstRouteDef || initialState.routeDef
    routeState = routeSetProps(routeDef, null, [])
  }

  let newLoggedInUserNavigated
  let newRouteDef
  let newRouteState
  try {
    newRouteDef = routeDefReducer(routeDef, action)
    newRouteState = routeStateReducer(newRouteDef, routeState, action)
    newLoggedInUserNavigated = loggedInUserNavigatedReducer(
      loggedInUserNavigated,
      newRouteState && newRouteState.selected,
      action
    )
  } catch (err) {
    if (action.type === RouteTreeGen.refreshRouteDef && err && err.messsage.startsWith('RT:')) {
      logger.warn('New route tree mismatches current state. Not updating (please reload manually if needed).')
    } else {
      logger.error(
        `Attempt to perform ${action.type} on ${pathToString(
          getPath(routeState)
        )} raised exception: ${err}. Aborting.`
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
      logger.error(
        `Attempt to perform ${action.type} on ${pathToString(
          getPath(routeState)
        )} would result in invalid routeTree state: "${routeError}". Aborting.`
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
