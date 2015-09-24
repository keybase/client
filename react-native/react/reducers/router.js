'use strict'

import * as loginTypes from '../constants/loginActionTypes'
import * as routerTypes from '../constants/routerActionTypes'
import Immutable from 'immutable'

function createRouterState (uri, history) {
  // TODO(mm): when we have a splash screen set it here.
  // history is android's back button
  return Immutable.Map({
    uri: parseUri(uri),
    history: Immutable.List(history.map(parseUri))
  })
}

const initialState = createRouterState(['nav'], [])

function pushIfTailIsDifferent (thing, stack) {
  // TODO: fix this equality check.
  console.log('Maybe pushing', thing, 'onto', stack)
  if (Immutable.is(stack.last(), thing)) {
    return stack.push(thing)
  }
  return stack
}

// A path can either be a string or an object with the key path and extra arguments
function parsePath (path) {
  if (typeof path === 'string') {
    return Immutable.Map({path})
  } else if (Immutable.Map.isMap(path)) {
    return path
  }
  return Immutable.Map(path)
}

// A path can either be a string or an object with the key path and extra arguments
function parseUri (uri) {
  if (Immutable.List.isList(uri)) {
    return uri
  }
  if (uri.length === 0 || uri[0] !== 'root') {
    uri.unshift('root')
  }

  return Immutable.List(uri.map(parsePath))
}

module.exports = function (state = initialState, action) {
  console.log('action in router', action)
  const stateWithHistory = state.update('history', pushIfTailIsDifferent.bind(null, state.get('uri')))
  switch (action.type) {
    // TODO(MM): change the history so if we go up to something that is already in the history,
    // or a child of it
    // we get rid of everything after it
    case routerTypes.NAVIGATE_UP:
      return state.update('uri', (uri) => uri.count() > 1 ? uri.pop() : uri)
    case routerTypes.NAVIGATE:
      return stateWithHistory.set('uri', parseUri(action.uri))
    case routerTypes.NAVIGATE_APPEND:
      return stateWithHistory.update('uri', (uri) => uri.push(parsePath(action.topRoute)))
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
      return stateWithHistory.set('uri', parseUri(['root']))
    default:
      return state
  }
}

module.exports.createRouterState = createRouterState
