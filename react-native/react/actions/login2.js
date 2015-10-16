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

function defaultModeForRoles (myRole, otherRole) {
  switch (myRole + otherRole) {
    case Constants.codePageRoleExistingComputer + Constants.codePageRoleNewComputer:
      return Constants.codePageModeEnterText
    case Constants.codePageRoleNewComputer + Constants.codePageRoleExistingComputer:
      return Constants.codePageModeShowText

    case Constants.codePageRoleExistingComputer + Constants.codePageRoleNewPhone:
      return Constants.codePageModeShowCode
    case Constants.codePageRoleNewPhone + Constants.codePageRoleExistingComputer:
      return Constants.codePageModeScanCode

    case Constants.codePageRoleExistingPhone + Constants.codePageRoleNewComputer:
      return Constants.codePageModeScanCode
    case Constants.codePageRoleNewComputer + Constants.codePageRoleExistingPhone:
      return Constants.codePageModeShowCode

    case Constants.codePageRoleExistingPhone + Constants.codePageRoleNewPhone:
      return Constants.codePageModeScanCode
    case Constants.codePageRoleNewPhone + Constants.codePageRoleExistingPhone:
      return Constants.codePageModeShowCode
  }
  return null
}

export function setCodePageRoles (myRole, otherRole) {
  return function (dispatch) {
    dispatch(setCodePageMode(defaultModeForRoles(myRole, otherRole)))
    dispatch({
      type: Constants.setCodeState,
      myRole,
      otherRole
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
