'use strict'

import * as types from '../constants/login-action-types'
import engine from '../engine'

export function startLogin () {
  return {
    type: types.START_LOGIN
  }
}

export function submitUserPass (username, passphrase, storeSecret) {
  return function (dispatch) {
    dispatch({
      type: types.SUBMIT_USER_PASS
    })

    const param = {
      username,
      passphrase,
      storeSecret,
      error: null
    }

    const incomingMap = {
      'keybase.1.locksmithUi.promptDeviceName': (param, response) => {
        dispatch({
          type: types.ASK_DEVICE_NAME,
          response
        })
      },
      'keybase.1.locksmithUi.selectSigner': (param, response) => {
        dispatch({
          type: types.ASK_DEVICE_SIGNER,
          param,
          response
        })
      },
      'keybase.1.locksmithUi.displaySecretWords': ({secret: secretWords}, response) => {
        dispatch({
          type: types.SHOW_SECRET_WORDS,
          secretWords,
          response
        })
      },
      'keybase.1.locksmithUi.deviceNameTaken': ({name}, response) => {
        response.result()
        dispatch({
          type: types.DEVICE_NAME_TAKEN,
          name
        })
      },
      'keybase.1.logUi.log': (param, response) => {
        console.log(param, response)
        response.result()
      },
      'keybase.1.locksmithUi.kexStatus': (param, response) => {
        console.log(param, response)
        response.result()
      },
      'keybase.1.locksmithUi.displayProvisionSuccess': (param, response) => {
        response.result()
      }
    }

    engine.rpc('login.loginWithPassphrase', param, incomingMap, (error, response) => {
      if (error) {
        console.log(error)

        dispatch({
          type: types.ASK_USER_PASS,
          error: error ? error.desc : null
        })
      } else {
        dispatch({
          type: types.LOGGED_IN
        })
      }
    })
  }
}

export function submitDeviceName (name, response) {
  return function (dispatch) {
    dispatch({
      type: types.SUBMIT_DEVICE_NAME
    })

    response.result(name)
  }
}

export function submitDeviceSigner (result, response) {
  return function (dispatch) {
    dispatch({
      type: types.SUBMIT_DEVICE_SIGNER
    })

    response.result(result)
  }
}

export function showedSecretWords (response) {
  return function (dispatch) {
    response.result()
  }
}

export function logout () {
  return function (dispatch) {
    engine.rpc('login.logout', {}, {}, (error, response) => {
      if (error) {
        console.log(error)
      } else {
        // TODO something else
        dispatch(startLogin())
      }
    })
  }
}

export function autoLogin () {
  return function (dispatch) {
    engine.rpc('login.loginWithPrompt', {}, {}, (error, status) => {
      if (error) {
        console.log(error)
      } else {
        dispatch({
          type: types.LOGGED_IN
        })
      }
    })
  }
}
