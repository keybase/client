// @flow
import {StackActions, NavigationActions} from '@react-navigation/core'
import shallowEqual from 'shallowequal'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Constants from '../constants/router2'
import {modalRoutes} from './routes'

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
      const sa = [StackActions.push({params: undefined, routeName: 'tabs.peopleTab'})]

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

      // switch the switch and do a reset of the stack
      return sa.length
        ? [switchStack, StackActions.reset({actions: sa, index: sa.length - 1})]
        : [switchStack]
    }
    case RouteTreeGen.clearModals:
      const path = Constants._getVisiblePathForNavigator(navigation.state)
      const actions = []
      path.reverse().some(p => {
        if (modalRoutes[p.routeName]) {
          actions.push(StackActions.pop())
          return false
        }
        return true
      })
      return actions
    case RouteTreeGen.navigateUp:
      return [StackActions.pop()]
  }
}
