'use strict'

import * as states from '../constants/loginStates'
import * as types from '../constants/loginActionTypes'

const initialState = {
  loginState: states.ASK_USER_PASS,
  loggedIn: false,
  username: null,
  passphrase: null,
  storeSecret: true,
  deviceName: null,
  waitingForServer: false,
  secretWords: null,
  response: null,
  error: null
}

export default function (state = initialState, action) {
  console.log('login to action', action)
  switch (action.type) {
    case types.START_LOGIN:
      return {
        ...state,
        loginState: states.ASK_USER_PASS,
        waitingForServer: false
      }
    case types.ASK_USER_PASS:
      return {
        ...state,
        error: action.error,
        loginState: states.ASK_USER_PASS,
        waitingForServer: false
      }
    case types.SUBMIT_USER_PASS:
      return {
        ...state,
        error: null,
        loginState: states.ASK_USER_PASS,
        waitingForServer: true
      }
    case types.ASK_DEVICE_NAME:
      return {
        ...state,
        error: action.error,
        loginState: states.ASK_DEVICE_NAME,
        response: action.response,
        waitingForServer: false
      }
    case types.SUBMIT_DEVICE_NAME:
      return {
        ...state,
        loginState: states.ASK_DEVICE_NAME,
        response: action.response,
        waitingForServer: true
      }
    case types.ASK_DEVICE_SIGNER:
      return {
        ...state,
        error: action.error,
        loginState: states.ASK_DEVICE_SIGNER,
        response: action.response,
        signers: action.param,
        waitingForServer: false
      }
    case types.SUBMIT_DEVICE_SIGNER:
      return {
        ...state,
        loginState: states.ASK_DEVICE_SIGNER,
        response: action.response,
        waitingForServer: true
      }
    case types.SHOW_SECRET_WORDS:
      return {
        ...state,
        loginState: states.SHOW_SECRET_WORDS,
        response: action.response,
        secretWords: action.secretWords,
        waitingForServer: false
      }
    case types.LOGGED_IN:
      return {
        ...state,
        loginState: states.LOGGED_IN
      }
    case types.DEVICE_NAME_TAKEN:
      return {
        ...state,
        error: `${action.name} is already in use, please choose another name`
      }

    default:
      return state
  }
}
