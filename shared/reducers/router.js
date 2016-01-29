/* @flow */

import * as RouterConstants from '../constants/router'
import Immutable, {List, Map} from 'immutable'
import * as LoginConstants from '../constants/login'

export type URI = List<Map<string, string>>
type History = List<URI>

export type RouterState = MapADT2<'uri', URI, 'history', History> // eslint-disable-line no-undef

const initialState: RouterState = createRouterState(['nav'], [])

export function createRouterState (uri: Array<string>, history: Array<Array<string>>): RouterState {
  return Map({
    uri: parseUri(uri),
    history: List(history.map(parseUri))
  })
}

function pushIfTailIsDifferent (thing, stack) {
  if (Immutable.is(stack.last(), thing)) {
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
function parseUri (uri) {
  if (List.isList(uri)) {
    return uri
  }
  if (uri.length === 0 || uri[0] !== 'root') {
    uri.unshift('root')
  }

  return List(uri.map(parsePath))
}

export default function (state: RouterState = initialState, action: any): RouterState {
  const stateWithHistory = state.update('history', pushIfTailIsDifferent.bind(null, state.get('uri')))
  switch (action.type) {
    // TODO(MM): change the history so if we go up to something that is already in the history,
    // or a child of it
    // we get rid of everything after it
    case RouterConstants.navigateUp:
      return state.update('uri', uri => uri.count() > 1 ? uri.pop() : uri)
    case RouterConstants.navigateBack:
      const lastUri = state.get('history').last() || parseUri([])
      return state.update('history', history => history.count() > 1 ? history.pop() : parseUri([]))
        .set('uri', lastUri)
    case RouterConstants.navigate:
      return stateWithHistory.set('uri', parseUri(action.payload))
    case RouterConstants.navigateAppend:
      if (action.payload.constructor === Array) {
        return stateWithHistory.update('uri', uri => uri.concat(action.payload.map(parsePath)))
      }
      return stateWithHistory.update('uri', uri => uri.push(parsePath(action.payload)))
    case LoginConstants.needsLogin:
      return state.set('uri', parseUri(['login']))
    case LoginConstants.needsRegistering:
      return state.set('uri', parseUri(['register']))
    default:
      return state
  }
}
