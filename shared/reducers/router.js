/* @flow */

import * as RouterConstants from '../constants/router'
import {is, List, Map, Record} from 'immutable'
export type URI = List<Map<string, string>>
type History = List<URI>

export type RouterState = MapADT2<'uri', URI, 'history', History> // eslint-disable-line no-undef

const RouterStateRecord = Record({uri: List(), history: List()})
const initialState: RouterState = createRouterState(['nav'], [])

export function createRouterState (uri: Array<string>, history: Array<Array<string>>): RouterState {
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
export function subReducer (state: RouterState = initialState, action: any): RouterState {
  const stateWithHistory = state.update('history', pushIfTailIsDifferent.bind(null, state.get('uri')))
  switch (action.type) {
    // TODO(MM): change the history so if we go up to something that is already in the history,
    // or a child of it
    // we get rid of everything after it
    case RouterConstants.navigateUp:
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
    case RouterConstants.navigateBack:
      const lastUri = state.get('history').last() || parseUri([])
      return state.update('history', history => history.pop()).set('uri', lastUri)
    case RouterConstants.navigate:
      return stateWithHistory.set('uri', parseUri(action.payload.uri))
    case RouterConstants.navigateAppend:
      if (action.payload.route.constructor === Array) {
        return stateWithHistory.update('uri', uri => uri.concat(action.payload.route.map(parsePath)))
      }
      return stateWithHistory.update('uri', uri => uri.push(parsePath(action.payload.route)))
    default:
      return state
  }
}
