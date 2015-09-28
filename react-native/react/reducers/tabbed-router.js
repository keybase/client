'use strict'
// Tab Nav Reducer.
// This expands the router to work on multiple tabs.
// The router works just as before except this layer
// sits on top and dispatches messages to the correct tab's router.

import Immutable from 'immutable'
import routerReducer, { createRouterState } from './router'
import {FOLDER_TAB, CHAT_TAB, PEOPLE_TAB, DEVICES_TAB, MORE_TAB} from '../constants/tabs'
import * as actionTypes from '../constants/tabbedRouterActionTypes'

const emptyRouterState = createRouterState([], [])

// TODO(mm) add type annotations
const initialState = Immutable.fromJS({
  // a map from tab name to router obj
  tabs: {
    [FOLDER_TAB]: emptyRouterState,
    [CHAT_TAB]: emptyRouterState,
    [PEOPLE_TAB]: emptyRouterState,
    [DEVICES_TAB]: emptyRouterState,
    [MORE_TAB]: emptyRouterState
  },
  activeTab: MORE_TAB
})

export default function (state = initialState, action) {
  switch (action.type) {
    case actionTypes.SWITCH_TAB:
      return state.set('activeTab', action.tabName)
    default:
      return state.updateIn(['tabs', state.get('activeTab')], (routerState) => routerReducer(routerState, action))
  }
}
