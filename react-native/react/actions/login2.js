'use strict'

import * as Constants from '../constants/login2'
import QRCodeGen from 'qrcode-generator'
import { navigateTo } from './router'

export function welcomeSubmitUserPass (username, passphrase) {
  return {
    type: Constants.actionSubmitUserPass,
    username,
    passphrase
  }
}

function defaultModeForDeviceRoles (myDeviceRole, otherDeviceRole) {
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
      return Constants.codePageModeScanCode
    case Constants.codePageDeviceRoleNewPhone + Constants.codePageDeviceRoleExistingPhone:
      return Constants.codePageModeShowCode
  }
  return null
}

export function setCodePageDeviceRoles (myDeviceRole, otherDeviceRole) {
  return function (dispatch) {
    dispatch(setCodePageMode(defaultModeForDeviceRoles(myDeviceRole, otherDeviceRole)))
    dispatch({
      type: Constants.setCodeState,
      myDeviceRole,
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
  return {
    type: Constants.cameraBrokenMode,
    broken
  }
}

