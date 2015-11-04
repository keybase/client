/* @flow */
'use strict'

import * as loginTypes from '../constants/login-action-types'
import * as routerTypes from '../constants/router-action-types'
import Immutable, {List, Map} from 'immutable'
// $FlowFixMe ignore this import for now
import * as localDebug from '../local-debug'
import * as LoginConstants from '../constants/login2'

export type URI = List<Map<string, string>>
type History = List<URI>

export type RouterState = MapADT2<'uri', URI, 'history', History> // eslint-disable-line no-undef

const initialState: RouterState = createRouterState(['nav'], [])

export function createRouterState (uri: Array<string>, history: Array<Array<string>>) {
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
    case routerTypes.NAVIGATE_UP:
      return state.update('uri', (uri) => uri.count() > 1 ? uri.pop() : uri)
    case routerTypes.NAVIGATE_BACK:
      const lastUri = state.get('history').last() || parseUri([])
      return state.update('history', (history) => history.count() > 1 ? history.pop() : parseUri([]))
        .set('uri', lastUri)
    case routerTypes.NAVIGATE:
      return stateWithHistory.set('uri', parseUri(action.uri))
    case routerTypes.NAVIGATE_APPEND:
      if (action.topRoute.constructor === Array) {
        return stateWithHistory.update('uri', (uri) => uri.concat(action.topRoute.map(parsePath)))
      }
      return stateWithHistory.update('uri', (uri) => uri.push(parsePath(action.topRoute)))
    case LoginConstants.needsLogin:
      return state.set('uri', parseUri(['login']))
    case LoginConstants.needsRegistering:
      return state.set('uri', parseUri(['register']))
    // TODO(mm) remove these and replace them with NAVIGATE's
    case loginTypes.START_LOGIN:
      return stateWithHistory.set('uri', parseUri(['login', 'loginform']))
    case loginTypes.ASK_USER_PASS:
      return stateWithHistory.set('uri', parseUri(['login', 'loginform']))
    case loginTypes.SUBMIT_USER_PASS:
      return stateWithHistory.set('uri', parseUri(['login', 'loginform']))
    case loginTypes.ASK_DEVICE_NAME:
      return stateWithHistory.set('uri', parseUri(['login', 'device-prompt']))
    case loginTypes.SUBMIT_DEVICE_NAME:
      return stateWithHistory.set('uri', parseUri(['login', 'device-prompt']))
    case loginTypes.ASK_DEVICE_SIGNER:
      return stateWithHistory.set('uri', parseUri(['login', 'device-signer']))
    case loginTypes.SUBMIT_DEVICE_SIGNER:
      return stateWithHistory.set('uri', parseUri(['login', 'device-signer']))
    case loginTypes.SHOW_SECRET_WORDS:
      return stateWithHistory.set('uri', parseUri(['login', 'show-secret-words']))
    case loginTypes.LOGGED_IN:
      if (localDebug.skipLoginRouteToRoot) {
        return state
      }
      return stateWithHistory.set('uri', parseUri(['root']))
    default:
      return state
  }
}
