/* @flow */
'use strict'
// Tab Nav Reducer.
// This expands the router to work on multiple tabs.
// The router works just as before except this layer
// sits on top and dispatches messages to the correct tab's router.

import Immutable from 'immutable'
import routerReducer, { createRouterState } from './router'
import {STARTUP_TAB, FOLDER_TAB, CHAT_TAB, PEOPLE_TAB, DEVICES_TAB, MORE_TAB} from '../constants/tabs'
import * as actionTypes from '../constants/tabbed-router-action-types'
// $FlowFixMe ignore this import for now
import * as LocalDebug from '../local-debug'
import * as LoginConstants from '../constants/login2'

import type { RouterState } from './router'

type TabName = STARTUP_TAB | FOLDER_TAB | CHAT_TAB | PEOPLE_TAB | DEVICES_TAB | MORE_TAB
type TabbedRouterState = MapADT2<'tabs', Immutable.Map<TabName, RouterState>, 'activeTab', TabName> // eslint-disable-line no-undef

const emptyRouterState: RouterState = LocalDebug.overrideRouterState ? LocalDebug.overrideRouterState : createRouterState([], [])

const initialState: TabbedRouterState = Immutable.fromJS({
  // a map from tab name to router obj
  tabs: {
    // $FlowIssue flow doesn't support computed keys
    [STARTUP_TAB]: emptyRouterState,
    // $FlowIssue flow doesn't support computed keys
    [FOLDER_TAB]: emptyRouterState,
    // $FlowIssue flow doesn't support computed keys
    [CHAT_TAB]: emptyRouterState,
    // $FlowIssue flow doesn't support computed keys
    [PEOPLE_TAB]: emptyRouterState,
    // $FlowIssue flow doesn't support computed keys
    [DEVICES_TAB]: emptyRouterState,
    // $FlowIssue flow doesn't support computed keys
    [MORE_TAB]: emptyRouterState
  },
  activeTab: LocalDebug.overrideActiveTab ? LocalDebug.overrideActiveTab : MORE_TAB
})

export default function (state: TabbedRouterState = initialState, action: any): TabbedRouterState {
  switch (action.type) {
    case actionTypes.SWITCH_TAB:
      return state.set('activeTab', action.tabName)
    case LoginConstants.loginDone:
      return state.set('activeTab', FOLDER_TAB)
    case LoginConstants.logoutDone:
      return state.set('activeTab', STARTUP_TAB)
    case LoginConstants.needsLogin:
    case LoginConstants.needsRegistering:
      // TODO set the active tab to be STARTUP_TAB here.
      // see: https://github.com/keybase/client/pull/1202#issuecomment-150346720
      return state.set('activeTab', MORE_TAB).updateIn(['tabs', STARTUP_TAB], (routerState) => routerReducer(routerState, action))
    default:
      return state.updateIn(['tabs', state.get('activeTab')], (routerState) => routerReducer(routerState, action))
  }
}
