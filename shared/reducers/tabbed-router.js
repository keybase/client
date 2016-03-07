/* @flow */
// Tab Nav Reducer.
// This expands the router to work on multiple tabs.
// The router works just as before except this layer
// sits on top and dispatches messages to the correct tab's router.

import Immutable from 'immutable'
import {subReducer as routerReducer, createRouterState} from './router'
import {startupTab, folderTab, chatTab, peopleTab, devicesTab, moreTab, loginTab} from '../constants/tabs'
import * as Constants from '../constants/tabbed-router'
import * as RouterConstants from '../constants/router'
import {initTabbedRouterState} from '../local-debug'
import type {RouterState} from './router'

type TabName = startupTab | folderTab | chatTab | peopleTab | devicesTab | moreTab | loginTab
type TabbedRouterState = MapADT2<'tabs', Immutable.Map<TabName, RouterState>, 'activeTab', TabName> // eslint-disable-line no-undef

const emptyRouterState: RouterState = createRouterState([], [])

const initialState: TabbedRouterState = Immutable.fromJS(initTabbedRouterState({
  // a map from tab name to router obj
  tabs: {
    [startupTab]: emptyRouterState,
    [folderTab]: emptyRouterState,
    [chatTab]: emptyRouterState,
    [peopleTab]: emptyRouterState,
    [devicesTab]: emptyRouterState,
    [moreTab]: emptyRouterState,
    [loginTab]: emptyRouterState
  },
  activeTab: loginTab
}))

export default function (state: TabbedRouterState = initialState, action: any): TabbedRouterState {
  switch (action.type) {
    case Constants.switchTab:
      return state.set('activeTab', action.payload)
    case RouterConstants.navigateUp:
    case RouterConstants.navigateBack:
    case RouterConstants.navigate:
    case RouterConstants.navigateAppend:
      let tab = state.get('activeTab')

      if (action.payload && action.payload.tab) {
        tab = action.payload.tab
      }

      return state.updateIn(['tabs', tab], routerState => routerReducer(routerState, action))
    default:
      return state
  }
}
