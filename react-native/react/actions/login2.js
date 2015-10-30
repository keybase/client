'use strict'

import * as Constants from '../constants/login2'
import QRCodeGen from 'qrcode-generator'
import { navigateTo, routeAppend } from './router'
import engine from '../engine'
import enums from '../keybase_v1'
import UserPass from '../login2/register/user-pass'
import PaperKey from '../login2/register/paper-key'
import SetPublicName from '../login2/register/set-public-name'

import { switchTab } from './tabbed-router'
import { DEVICES_TAB } from '../constants/tabs'

export function login (username, passphrase) {
  return dispatch => {
    dispatch({
      type: Constants.login
    })

    const param = {
      username,
      passphrase,
      storeSecret: true,
      error: null
    }

    const incomingMap = {
      'keybase.1.logUi.log': (param, response) => {
        console.log(param, response)
        response.result()
      }
    }

    engine.rpc('login.loginWithPassphrase', param, incomingMap, (error, response) => {
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
  return (dispatch, getState) => {
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

  return dispatch => {
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
  return (dispatch, getState) => {
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
  return (dispatch, getState) => {
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
  return dispatch => {
    // TODO send to go to verify
    console.log('QR Scanned: ', code)
    dispatch(navigateTo([]))
  }
}

export function textEntered (code) {
  return dispatch => {
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
  return (dispatch, getState) => {
    dispatch({
      type: Constants.cameraBrokenMode,
      broken
    })

    const root = getState().login2.codePage
    dispatch(setCodePageMode(defaultModeForDeviceRoles(root.myDeviceRole, root.otherDeviceRole, broken)))
  }
}

export function updateForgotPasswordEmail (email) {
  return {
    type: Constants.actionUpdateForgotPasswordEmailAddress,
    email
  }
}

export function submitForgotPassword () {
  return (dispatch, getState) => {
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
  return dispatch => {
    engine.rpc('login.loginWithPrompt', {}, {}, (error, status) => {
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
  return dispatch => {
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

// Show a user/pass screen, call cb(user, passphrase) when done
// title/subTitle to customize the screen
export function askForUserPass (title, subTitle, cb, hidePass = false) {
  return (dispatch) => {
    dispatch(routeAppend({
      parseRoute: {
        componentAtTop: {
          component: UserPass,
          mapStateToProps: state => state.login2.userPass,
          props: {
            title,
            subTitle,
            hidePass,
            onSubmit: (username, passphrase) => {
              dispatch({
                type: Constants.actionSetUserPass,
                username,
                passphrase
              })

              cb()
            }
          }
        }
      }
    }))
  }
}

export function askForPaperKey (cb) {
  return (dispatch) => {
    dispatch(routeAppend({
      parseRoute: {
        componentAtTop: {
          component: PaperKey,
          mapStateToProps: state => state.login2,
          props: {
            onSubmit: (paperKey) => { cb(paperKey) }
          }
        }
      }
    }))
  }
}

// Show a device naming page, call cb(deviceName) when done
// existing devices are blacklisted
export function askForDeviceName (existingDevices, cb) {
  return (dispatch) => {
    dispatch({
      type: Constants.actionAskDeviceName,
      existingDevices,
      onSubmit: (deviceName) => {
        dispatch({
          type: Constants.actionSetDeviceName,
          deviceName
        })

        cb()
      }
    })

    dispatch(routeAppend({
      parseRoute: {
        componentAtTop: {
          component: SetPublicName,
          mapStateToProps: state => state.login2.deviceName
        }
      }
    }))
  }
}

export function registerWithUserPass () {
  return (dispatch, getState) => {
    const title = 'Registering with your Keybase passphrase'
    const subTitle = 'lorem ipsum lorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsum'
    const provisionMethod = enums.provisionUi.ProvisionMethod.passphrase
    startLoginFlow(dispatch, getState, provisionMethod, title, subTitle, Constants.actionRegisteredWithUserPass)
  }
}

export function registerWithPaperKey () {
  return (dispatch, getState) => {
    const title = 'Registering with your paperkey requires your username'
    const subTitle = 'Different lorem ipsum lorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsum'
    const provisionMethod = enums.provisionUi.ProvisionMethod.paperKey
    startLoginFlow(dispatch, getState, provisionMethod, title, subTitle, Constants.actionRegisteredWithPaperKey)
  }
}

function startLoginFlow (dispatch, getState, provisionMethod, userPassTitle, userPassSubtitle, successType) {
  const incomingMap = {
    'keybase.1.provisionUi.chooseProvisioningMethod': (param, response) => {
      response.result(provisionMethod)
    },
    // TODO remove this when KEX2 supports not asking for this
    'keybase.1.loginUi.getEmailOrUsername': (param, response) => {
      dispatch(askForUserPass(userPassTitle, userPassSubtitle, () => {
        const { username } = getState().login2.userPass
        response.result(username)
      }, true))
    },
    'keybase.1.secretUi.getPaperKeyPassphrase': (param, response) => {
      dispatch(askForPaperKey((paperKey) => {
        response.result(paperKey)
      }))
    },
    'keybase.1.secretUi.getKeybasePassphrase': (param, response) => {
      const { passphrase } = getState().login2.userPass
      response.result(passphrase)
    },
    'keybase.1.provisionUi.PromptNewDeviceName': (param, response) => {
      const { existingDevices } = param
      dispatch(askForDeviceName(existingDevices, () => {
        const { deviceName } = getState().login2.deviceName
        response.result(deviceName)
      }))
    },
    'keybase.1.logUi.log': (param, response) => {
      console.log(param)
      response.result()
    },
    'keybase.1.provisionUi.ProvisioneeSuccess': (param, response) => {
      response.result()
    }
  }

  const mobile = true // TODO desktop also
  const deviceType = mobile ? 'mobile' : 'desktop'

  engine.rpc('login.xLogin', {deviceType}, incomingMap, (error, response) => {
    dispatch({
      type: successType,
      error: !!error,
      payload: error || null
    })

    dispatch(switchTab(DEVICES_TAB))
  })
}
