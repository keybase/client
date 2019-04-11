// @flow
import {StackActions, NavigationActions} from '@react-navigation/core'
import shallowEqual from 'shallowequal'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Constants from '../constants/router2'
import {modalRoutes, routes} from './routes'
import logger from '../logger'

const getNumModals = navigation => {
  const path = Constants._getModalStackForNavigator(navigation.state)
  let numModals = 0
  path.reverse().some(p => {
    if (modalRoutes[p.routeName]) {
      numModals++
      return false
    }
    return true
  })
  return numModals
}

// Helper to convert old route tree actions to new actions. Likely goes away as we make
// actual routing actions (or make RouteTreeGen append/up the only action)
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
      const path = Constants._getVisiblePathForNavigator(navigation.state)
      const visible = path[path.length - 1]
      if (visible) {
        if (routeName === visible.routeName && shallowEqual(visible.params, params)) {
          console.log('Skipping append dupe')
          return
        }
      }

      if (action.payload.replace) {
        return [StackActions.replace({params, routeName})]
      }

      return [StackActions.push({params, routeName})]
    }
    case RouteTreeGen.switchRouteDef: {
      // used to tell if its the login one or app one. this will all change when we deprecate the old routing
      const routeName = action.payload.routeDef.defaultSelected === 'tabs.loginTab' ? 'loggedOut' : 'loggedIn'
      const switchStack = NavigationActions.navigate({params: undefined, routeName})

      // You're logged out
      if (routeName === 'loggedOut') {
        return [switchStack]
      }

      // When we restore state we want the following stacks
      // [People, TheLastTabYouWereOn, MaybeAConversationIfTheLastTabYouWereOnIsChat]
      let sa = [StackActions.push({params: undefined, routeName: 'tabs.peopleTab'})]

      if (action.payload.path) {
        const p = action.payload.path.last
          ? action.payload.path.last()
          : action.payload.path[action.payload.path.length - 1]

        // a chat, we want people/inbox/chat
        if (p === 'chatConversation') {
          sa.push(StackActions.push({params: undefined, routeName: 'tabs.chatTab'}))
          sa.push(StackActions.push({params: undefined, routeName: 'chatConversation'}))
        } else if (p !== 'tabs.peopleTab') {
          sa.push(StackActions.push({params: undefined, routeName: p}))
        }
      }

      // validate sa
      if (!sa.every(a => routes[a.routeName])) {
        logger.error('Invalid route found, bailing on push', sa)
        sa = []
      }

      // switch the switch and do a reset of the stack
      return sa.length
        ? // MUST pass undefined as key else it won't work correctly
          [switchStack, StackActions.reset({actions: sa, index: sa.length - 1, key: undefined})]
        : [switchStack]
    }
    case RouteTreeGen.clearModals: {
      const numModals = getNumModals(navigation)
      return numModals ? [StackActions.pop({n: numModals})] : []
    }
    case RouteTreeGen.navigateUp:
      return [StackActions.pop()]
    case RouteTreeGen.navUpToScreen: {
      const fullPath = Constants._getFullRouteForNavigator(navigation.state)
      const popActions = []
      const isInStack = fullPath.reverse().some(r => {
        if (r.routeName === action.payload.routeName) {
          return true
        }
        popActions.push(StackActions.pop())
        return false
      })
      return isInStack ? popActions : []
    }
  }
}
