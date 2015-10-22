'use strict'
// Tab Nav Reducer.
// This expands the router to work on multiple tabs.
// The router works just as before except this layer
// sits on top and dispatches messages to the correct tab's router.

import Immutable from 'immutable'
import routerReducer, { createRouterState } from './router'
import {STARTUP_TAB, FOLDER_TAB, CHAT_TAB, PEOPLE_TAB, DEVICES_TAB, MORE_TAB} from '../constants/tabs'
import * as actionTypes from '../constants/tabbed-router-action-types'
import * as LocalDebug from '../local-debug'
import * as LoginConstants from '../constants/login2'

const emptyRouterState = LocalDebug.overrideRouterState ? LocalDebug.overrideRouterState : createRouterState([], [])

const initialState = Immutable.fromJS({
  // a map from tab name to router obj
  tabs: {
    [STARTUP_TAB]: emptyRouterState,
    [FOLDER_TAB]: emptyRouterState,
    [CHAT_TAB]: emptyRouterState,
    [PEOPLE_TAB]: emptyRouterState,
    [DEVICES_TAB]: emptyRouterState,
    [MORE_TAB]: emptyRouterState
  },
  activeTab: LocalDebug.overrideActiveTab ? LocalDebug.overrideActiveTab : MORE_TAB
})

export default function (state = initialState, action) {
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
