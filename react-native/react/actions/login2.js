'use strict'

import * as Constants from '../constants/login2'
import QRCodeGen from 'qrcode-generator'
import { appendRouteOnUnchanged, navigateTo } from './router'
import engine from '../engine'

export function login (username, passphrase) {
  return function (dispatch) {
    dispatch({
      type: Constants.login
    })

    const param = {
      username,
      passphrase,
      error: null
    }

    const incomingMap = {
      'keybase.1.logUi.log': (param, response) => {
        console.log(param, response)
        response.result()
      }
    }

    engine.rpc('login.login', param, incomingMap, (error, response) => {
      if (error) {
        console.log(error)
      }

      dispatch({
        type: Constants.loginDone,
        error: !!error,
        payload: error || response
      })
    })
  }
}

export function doneRegistering () {
  resetCountdown()
  return {
    type: Constants.doneRegistering
  }
}

export function defaultModeForDeviceRoles (myDeviceRole, otherDeviceRole, brokenMode) {
  switch (myDeviceRole + otherDeviceRole) {
    case Constants.codePageDeviceRoleExistingComputer + Constants.codePageDeviceRoleNewComputer:
      return Constants.codePageModeEnterText
    case Constants.codePageDeviceRoleNewComputer + Constants.codePageDeviceRoleExistingComputer:
      return Constants.codePageModeShowText

    case Constants.codePageDeviceRoleExistingComputer + Constants.codePageDeviceRoleNewPhone:
      return Constants.codePageModeShowCode
    case Constants.codePageDeviceRoleNewPhone + Constants.codePageDeviceRoleExistingComputer:
      return Constants.codePageModeScanCode

    case Constants.codePageDeviceRoleExistingPhone + Constants.codePageDeviceRoleNewComputer:
      return Constants.codePageModeScanCode
    case Constants.codePageDeviceRoleNewComputer + Constants.codePageDeviceRoleExistingPhone:
      return Constants.codePageModeShowCode

    case Constants.codePageDeviceRoleExistingPhone + Constants.codePageDeviceRoleNewPhone:
      return brokenMode ? Constants.codePageModeShowText : Constants.codePageModeShowCode
    case Constants.codePageDeviceRoleNewPhone + Constants.codePageDeviceRoleExistingPhone:
      return brokenMode ? Constants.codePageModeEnterText : Constants.codePageModeScanCode
  }
  return null
}

export function setCodePageOtherDeviceRole (otherDeviceRole) {
  return function (dispatch, getState) {
    const store = getState().login2.codePage
    dispatch(setCodePageMode(defaultModeForDeviceRoles(store.myDeviceRole, otherDeviceRole, false)))
    dispatch({
      type: Constants.setOtherDeviceCodeState,
      otherDeviceRole
    })
  }
}

let timerId = null
function resetCountdown () {
  clearInterval(timerId)
  timerId = null
}

// Count down until 0, then make a new code
function startCodeGenCountdown (mode) {
  let countDown = Constants.countDownTime

  return function (dispatch) {
    resetCountdown()
    timerId = setInterval(() => {
      countDown -= 1

      if (countDown <= 0) {
        dispatch(startCodeGen(mode))
      } else {
        dispatch({
          type: Constants.setCountdown,
          countDown
        })
      }
    }, 1000)

    dispatch({
      type: Constants.setCountdown,
      countDown
    })
  }
}

export function startCodeGen (mode) {
  // TEMP this needs to come from go
  const code = 'TODO TEMP:' + Math.floor(Math.random() * 99999)

  // The text representation and the QR code are the same (those map to a bits of a key in go)
  return function (dispatch, getState) {
    const store = getState().login2.codePage
    switch (mode) {
      case Constants.codePageModeShowText:
        if (store.codeCountDown && store.textCode) {
          return // still have a valid code
        }

        dispatch({
          type: Constants.setTextCode,
          // TODO need this from go
          text: code
        })
        dispatch(startCodeGenCountdown(mode))
        break
      case Constants.codePageModeShowCode:
        if (store.codeCountDown && store.qrCode) {
          return // still have a valid code
        }

        dispatch({
          type: Constants.setQRCode,
          qrCode: qrGenerate(code)
        })
        dispatch(startCodeGenCountdown(mode))
        break
    }
  }
}

export function setCodePageMode (mode) {
  return function (dispatch, getState) {
    if (getState().login2.codePage.mode === mode) {
      return // already in this mode
    }

    dispatch(startCodeGen(mode))

    dispatch({
      type: Constants.setCodeMode,
      mode
    })
  }
}

export function qrScanned (code) {
  return function (dispatch) {
    // TODO send to go to verify
    console.log('QR Scanned: ', code)
    dispatch(navigateTo([]))
  }
}

export function textEntered (code) {
  return function (dispatch) {
    // TODO send to go to verify
    console.log('Text entered: ', code)
    dispatch(navigateTo([]))
  }
}

function qrGenerate (code) {
  const qr = QRCodeGen(10, 'L')
  qr.addData(code)
  qr.make()
  let tag = qr.createImgTag(10)
  const [ , src, , ] = tag.split(' ')
  const [ , qrCode ] = src.split('\"')
  return qrCode
}

export function setCameraBrokenMode (broken) {
  return function (dispatch, getState) {
    dispatch({
      type: Constants.cameraBrokenMode,
      broken
    })

    const root = getState().login2.codePage
    dispatch(setCodePageMode(defaultModeForDeviceRoles(root.myDeviceRole, root.otherDeviceRole, broken)))
  }
}

export function registerSubmitUserPass (username, passphrase) {
  return appendRouteOnUnchanged((dispatch, getState, maybeRoute) => {
    dispatch({
      type: Constants.actionRegisterUserPassSubmit,
      username,
      passphrase
    })

    // TODO make call to backend
    setTimeout(() => {
      const error = null

      dispatch({
        type: Constants.actionRegisterUserPassDone,
        error
      })

      if (!error) {
        maybeRoute('regSetPublicName')
      }
    }, 1000)
  })
}

export function updateForgotPasswordEmail (email) {
  return {
    type: Constants.actionUpdateForgotPasswordEmailAddress,
    email
  }
}

export function submitForgotPassword () {
  return function (dispatch, getState) {
    dispatch({
      type: Constants.actionSetForgotPasswordSubmitting
    })

    engine.rpc('login.recoverAccountFromEmailAddress', {email: getState().login2.forgotPasswordEmailAddress}, {}, (error, response) => {
      dispatch({
        type: Constants.actionForgotPasswordDone,
        error
      })
    })
  }
}

export function autoLogin () {
  return function (dispatch) {
    engine.rpc('login.login', {}, {}, (error, status) => {
      if (error) {
        console.log(error)
      } else {
        dispatch({
          type: Constants.loginDone,
          payload: status
        })
      }
    })
  }
}

export function logout () {
  return function (dispatch) {
    engine.rpc('login.logout', {}, {}, (error, response) => {
      if (error) {
        console.log(error)
      } else {
        dispatch({
          type: Constants.logoutDone
        })
      }
    })
  }
}

export function setDeviceName (name) {
  return function (dispatch) {
    // TODO integrate
    setTimeout(() => {
      const error = false

      if (error) {
        dispatch({
          type: Constants.deviceNameSet,
          error: true,
          payload: error
        })
      } else {
        dispatch({
          type: Constants.deviceNameSet
        })

        // TODO multiple things do this, what do we do next? individual reducers?
      }
    }, 1000)
  }
}
