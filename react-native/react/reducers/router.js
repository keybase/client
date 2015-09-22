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
  if (stack[stack.length - 1] === thing){
    return stack.push(thing);
  }
  return stack
}

export default function (state = initialState, action) {
  console.log('action in router', action)
  state.history = pushIfTailIsDifferent(state.history,state.uri)
  switch (action.type) {
    case routerTypes.NAVIGATE:
      return {
        ...state,
        uri: action.uri
      }
    case routerTypes.NAVIGATE_APPEND:
      state.uri.push(action.topRoute)
      return {
        ...state
      }
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
