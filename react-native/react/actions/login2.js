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
  return function (dispatch) {
    switch (mode) {
      case Constants.codePageModeShowText:
        dispatch({
          type: Constants.setTextCode,
          // TODO need this from go
          text: 'TODO TEMP:' + Math.floor(Math.random() * 99999)
        })
        dispatch(startCodeGenCountdown(mode))
    }
  }
}

export function setCodePageMode (mode) {
  resetCountdown()

  return function (dispatch) {
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

export function qrGenerate () {
  return function (dispatch) {
    dispatch({
      type: Constants.qrGenerate
    })

    const qr = QRCodeGen(10, 'L')
    qr.addData(this.state.code)
    qr.make()
    let tag = qr.createImgTag(10)
    const [ , src, , ] = tag.split(' ')
    const [ , qrCode ] = src.split('\"')

    dispatch({
      type: Constants.qrGenerated,
      qrCode
    })
  }
}
