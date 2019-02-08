// @flow
import {StackActions, NavigationActions} from '@react-navigation/core'
import shallowEqual from 'shallowequal'
import * as RouteTreeGen from '../actions/route-tree-gen'

const findVisibleRoute = s => {
  if (!s) return null
  if (!s.routes) return s
  const route = s.routes[s.index]
  if (!route) return null
  if (route.routes) return findVisibleRoute(route)
  return route
}
export const oldActionToNewActions = (action: any, navigation: any) => {
  switch (action.type) {
    case RouteTreeGen.navigateTo: // fallthrough
    case RouteTreeGen.switchTo: // fallthrough
    case RouteTreeGen.navigateAppend: {
      if (!navigation) {
        return
      }
      const p = action.payload.path.last
        ? action.payload.path.last()
        : action.payload.path[action.payload.path.length - 1]
      if (!p) {
        return
      }
      let routeName = null
      let params

      if (typeof p === 'string') {
        routeName = p
      } else {
        routeName = p.selected
        params = p.props
      }

      if (!routeName) {
        return
      }
      // don't allow pushing a dupe
      const visible = findVisibleRoute(navigation.state)
      if (visible) {
        if (routeName === visible.routeName && shallowEqual(visible.params, params)) {
          console.log('Skipping append dupe')
          return
        }
      }

      return [StackActions.push({params, routeName})]
    }
    case RouteTreeGen.switchRouteDef: {
      // used to tell if its the login one or app one. this will all go away soon
      const routeName = action.payload.routeDef.defaultSelected === 'tabs:loginTab' ? 'loggedOut' : 'loggedIn'
      const switchStack = [NavigationActions.navigate({params: undefined, routeName})]

      // navving away from default?
      const appendAction = oldActionToNewActions({
        payload: action.payload,
        type: RouteTreeGen.navigateAppend,
      })

      return appendAction ? [...switchStack, ...appendAction] : switchStack
    }
    case RouteTreeGen.navigateUp:
      return [StackActions.pop()]
  }
}
