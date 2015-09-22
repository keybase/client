'use strict'

import * as loginTypes from '../constants/loginActionTypes'
import * as routerTypes from '../constants/routerActionTypes'

const initialState = {
  uri: ["home"],
  // TODO(mm): when we have a splash screen set it here.
  // history is android's back button
  history: [["home"]]
}

function pushIfTailIsDifferent (stack, thing) {
  // TODO: fix this equality check.
  console.log("Maybe pushing", thing, "onto", stack)
  if (stack[stack.length - 1].join('|') !== thing.join('|')){
    stack.push(thing)
    return stack
  }
  return stack
}

export default function (state = initialState, action) {
  console.log('action in router', action)
  // TODO: use immutable js
  const originalHistory = state.history.slice(0);
  state.history = pushIfTailIsDifferent(state.history.slice(0),state.uri.slice(0))
  switch (action.type) {
    // TODO(MM): change the history so if we go up to something that is already in the history,
    // or a child of it
    // we get rid of everything after it
    case routerTypes.NAVIGATE_UP:
      if (state.uri.length > 1) {
        state.uri.pop()
      }
      return {
        ...state,
        history: originalHistory
      }
    case routerTypes.NAVIGATE:
      return {
        ...state,
        uri: action.uri
      }
    case routerTypes.NAVIGATE_APPEND:
      state.uri.push(action.topRoute)
      return {...state}
    case loginTypes.START_LOGIN:
      return {
        ...state,
        uri: ["login","loginform"]
      }
    case loginTypes.ASK_USER_PASS:
      return {
        ...state,
        uri: ["login","loginform"]
      }
    case loginTypes.SUBMIT_USER_PASS:
      return {
        ...state,
        uri: ["login","loginform"]
      }
    case loginTypes.ASK_DEVICE_NAME:
      return {
        ...state,
        uri: ["login","device-prompt"]
      }
    case loginTypes.SUBMIT_DEVICE_NAME:
      return {
        ...state,
        uri: ["login","device-prompt"]
      }
    case loginTypes.ASK_DEVICE_SIGNER:
      return {
        ...state,
        uri: ["login","device-signer"]
      }
    case loginTypes.SUBMIT_DEVICE_SIGNER:
      return {
        ...state,
        uri: ["login","device-signer"]
      }
    case loginTypes.SHOW_SECRET_WORDS:
      return {
        ...state,
        uri: ["login","show-secret-words"]
      }
    case loginTypes.LOGGED_IN:
      return {
        ...state,
        uri: ["home"]
      }
    default:
      return state
  }
}
