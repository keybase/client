'use strict'

const types = require('../constants/loginActionTypes')
const engine = require('../engine')

module.exports.startLogin = function () {
  return {
    type: types.START_LOGIN
  }
}

module.exports.submitUserPass = function (username, passphrase, storeSecret) {
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
      'keybase.1.logUi.log': (param, response) => {
        console.log(param, response)
        response.result()
      },
      'keybase.1.locksmithUi.kexStatus': (param, response) => {
        console.log(param, response)
        response.result()
      }
    }

    engine.rpc('login.loginWithPassphrase', param, incomingMap, (error, response) => {
      if (error) {
        console.log(error)

        dispatch({
          type: types.ASK_USER_PASS,
          error
        })
      } else {
        dispatch({
          type: types.LOGGED_IN
        })
      }
    })
  }
}

module.exports.submitDeviceName = function (name, response) {
  return function (dispatch) {
    dispatch({
      type: types.SUBMIT_DEVICE_NAME
    })

    response.result(name)
  }
}

module.exports.submitDeviceSigner = function (result, response) {
  return function (dispatch) {
    dispatch({
      type: types.SUBMIT_DEVICE_SIGNER
    })

    response.result(result)
  }
}

module.exports.showedSecretWords = function (response) {
  return function (dispatch) {
    response.result()
  }
}
