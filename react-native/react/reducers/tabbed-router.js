'use strict'
// Tab Nav Reducer.
// This expands the router to work on multiple tabs.
// The router works just as before except this layer
// sits on top and dispatches messages to the correct tab's router.

const Immutable = require('immutable')
const routerReducer = require('./router')
const {FOLDER_TAB, CHAT_TAB, PEOPLE_TAB, DEVICES_TAB, MORE_TAB} = require('../constants/tabs')
const actionTypes = require('../constants/tabbedRouterActionTypes')

const emptyRouterState = routerReducer.createRouterState([], [])

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

module.exports = function (state = initialState, action) {
  switch (action.type) {
    case actionTypes.SWITCH_TAB:
      return state.set('activeTab',action.tabName)
    default:
      return state.updateIn(['tabs', state.get('activeTab')], (routerState) => routerReducer(routerState, action))
  }
}
