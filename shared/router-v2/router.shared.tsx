import {StackActions, NavigationActions} from '@react-navigation/core'
import shallowEqual from 'shallowequal'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Constants from '../constants/router2'
import * as Tabs from '../constants/tabs'
import {modalRoutes, routes, tabRoots} from './routes'
import logger from '../logger'
import {getActiveKey} from './util'

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

export const mobileTabs = [Tabs.peopleTab, Tabs.chatTab, Tabs.fsTab, Tabs.teamsTab, Tabs.settingsTab]
export const desktopTabs = [
  Tabs.peopleTab,
  Tabs.chatTab,
  Tabs.fsTab,
  Tabs.teamsTab,
  Tabs.walletsTab,
  Tabs.gitTab,
  Tabs.devicesTab,
  Tabs.settingsTab,
]

// Helper to convert old route tree actions to new actions. Likely goes away as we make
// actual routing actions (or make RouteTreeGen append/up the only action)
export const oldActionToNewActions = (action: any, navigation: any, allowAppendDupe?: boolean) => {
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

      const path = Constants._getVisiblePathForNavigator(navigation.state)
      const visible = path[path.length - 1]
      if (visible) {
        if (!allowAppendDupe && routeName === visible.routeName && shallowEqual(visible.params, params)) {
          console.log('Skipping append dupe')
          return
        }
      }

      if (action.payload.fromKey) {
        const {fromKey} = action.payload
        const activeKey = getActiveKey(navigation.state)
        if (fromKey !== activeKey) {
          logger.warn('Skipping append on wrong screen')
          return
        }
      }

      if (action.payload.replace) {
        return [StackActions.replace({params, routeName})]
      }

      return [StackActions.push({params, routeName})]
    }
    case RouteTreeGen.switchTab: {
      return [NavigationActions.navigate({routeName: action.payload.tab})]
    }
    case RouteTreeGen.switchRouteDef: {
      // used to tell if its the login one or app one. this will all change when we deprecate the old routing
      const routeName = action.payload.loggedIn ? 'loggedIn' : 'loggedOut'

      // You're logged out
      if (routeName === 'loggedOut') {
        return [NavigationActions.navigate({params: undefined, routeName: 'loggedOut'})]
      }

      // When we restore state we want the following stacks
      let sa = [NavigationActions.navigate({params: undefined, routeName: 'loggedIn'})]

      if (action.payload.path) {
        const p = action.payload.path.last
          ? action.payload.path.last()
          : action.payload.path[action.payload.path.length - 1]

        sa.push(NavigationActions.navigate({params: undefined, routeName: p}))
      }

      // validate sa
      if (
        !sa.every(
          a => a.routeName === 'loggedIn' || !!routes[a.routeName] || mobileTabs.includes(a.routeName)
        )
      ) {
        logger.error('Invalid route found, bailing on push', sa)
        sa = []
      }

      return sa
    }
    case RouteTreeGen.clearModals: {
      const numModals = getNumModals(navigation)
      return numModals ? [StackActions.pop({n: numModals})] : []
    }
    case RouteTreeGen.navigateUp:
      return [NavigationActions.back({key: action.payload.fromKey})]
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
    case RouteTreeGen.resetStack: {
      // TODO check for append dupes within these
      const actions = action.payload.actions.reduce(
        (arr, a) => [...arr, ...(oldActionToNewActions(a, navigation, true) || [])],
        [StackActions.push({routeName: tabRoots[action.payload.tab]})]
      )
      return [
        StackActions.reset({
          actions,
          index: action.payload.index,
          key: action.payload.tab,
        }),
      ]
    }
  }
}
