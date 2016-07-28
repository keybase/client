// @flow
import * as CommonConstants from '../constants/common'
import * as Constants from '../constants/router'
import type {TabbedRouterState, RouterState, URI} from '../constants/router'
import {initTabbedRouterState} from '../local-debug'
import {is, List, Map, Record, fromJS} from 'immutable'
import {profileTab, startupTab, folderTab, chatTab, peopleTab, devicesTab, settingsTab, loginTab} from '../constants/tabs'

const RouterStateRecord = Record({uri: List(), history: List()})
const routerInitialState: RouterState = createRouterState(['nav'], [])

function createRouterState (uri: Array<string>, history: Array<Array<string>>): RouterState {
  return new RouterStateRecord({
    uri: parseUri(uri),
    history: List(history.map(parseUri)),
  })
}

function pushIfTailIsDifferent (thing, stack) {
  if (is(stack.last(), thing)) {
    return stack
  }
  return stack.push(thing)
}

// A path can either be a string or an object with the key path and extra arguments
function parsePath (path) {
  if (typeof path === 'string') {
    return Map({path})
  } else if (Map.isMap(path)) {
    return path
  }
  return Map(path)
}

// A path can either be a string or an object with the key path and extra arguments
function parseUri (uri: any): URI {
  if (List.isList(uri)) {
    return uri
  }
  if (uri.length === 0 || uri[0] !== 'root') {
    uri.unshift('root')
  }

  return List(uri.map(parsePath))
}

// This is called by the tabbed reducer, not the global reducer
function routerReducer (state: RouterState = routerInitialState, action: any): RouterState {
  const stateWithHistory = state.update('history', pushIfTailIsDifferent.bind(null, state.get('uri')))
  switch (action.type) {
    // TODO(MM): change the history so if we go up to something that is already in the history,
    // or a child of it
    // we get rid of everything after it
    case Constants.navigateUp:
      const uri = state.get('uri')
      if (uri.count() > 1) {
        if (action.payload.till) {
          let current = uri
          while (current.count() > 0 && !is(current.last(), action.payload.till)) {
            current = current.pop()
          }

          if (current.count()) {
            return state.set('uri', current)
          } else {
            console.warn(`Navigate till unfound: ${action.payload.till}`)
            return state
          }
        } else {
          return state.set('uri', uri.pop())
        }
      }
      return state
    case Constants.navigateBack:
      const lastUri = state.get('history').last() || parseUri([])
      return state.update('history', history => history.pop()).set('uri', lastUri)
    case Constants.navigate:
      return stateWithHistory.set('uri', parseUri(action.payload.uri))
    case Constants.navigateAppend:
      if (action.payload.route.constructor === Array) {
        return stateWithHistory.update('uri', uri => uri.concat(action.payload.route.map(parsePath)))
      }
      return stateWithHistory.update('uri', uri => uri.push(parsePath(action.payload.route)))
    default:
      return state
  }
}

const emptyRouterState: RouterState = createRouterState([], [])

function initialStateFn (): TabbedRouterState {
  let init = {
    // a map from tab name to router obj
    tabs: {
      [profileTab]: emptyRouterState,
      [startupTab]: emptyRouterState,
      [folderTab]: emptyRouterState,
      [chatTab]: emptyRouterState,
      [peopleTab]: emptyRouterState,
      [devicesTab]: emptyRouterState,
      [settingsTab]: emptyRouterState,
      [loginTab]: emptyRouterState,
    },
    activeTab: loginTab,
  }

  let ts = initTabbedRouterState()
  Object.keys(ts).forEach(tab => { init[tab] = createRouterState(ts[tab], []) })
  return fromJS(init)
}

const initialState: TabbedRouterState = initialStateFn()

export default function (state: TabbedRouterState = initialState, action: any): TabbedRouterState {
  switch (action.type) {
    case CommonConstants.resetStore:
      return initialStateFn()

    case Constants.switchTab:
      return state.set('activeTab', action.payload)
    case Constants.navigateUp:
    case Constants.navigateBack:
    case Constants.navigate:
    case Constants.navigateAppend:
      let tab = state.get('activeTab')

      if (action.payload && action.payload.tab) {
        tab = action.payload.tab
      }

      return state.updateIn(['tabs', tab], routerState => routerReducer(routerState, action))
    default:
      return state
  }
}
