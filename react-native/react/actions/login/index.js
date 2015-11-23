import * as Constants from '../../constants/login'
import {isMobile} from '../../constants/platform'
import {navigateTo, routeAppend, getCurrentURI, getCurrentTab} from '../router'
import engine from '../../engine'
import enums from '../../constants/types/keybase_v1'
import UserPass from '../../login/register/user-pass'
import PaperKey from '../../login/register/paper-key'
import CodePage from '../../login/register/code-page'
import ExistingDevice from '../../login/register/existing-device'
import SetPublicName from '../../login/register/set-public-name'
import {switchTab} from '../tabbed-router'
import {devicesTab} from '../../constants/tabs'
import {loadDevices} from '../devices'
import {defaultModeForDeviceRoles, qrGenerate} from './provision-helpers'

export function login () {
  return (dispatch, getState) => {
    startLoginFlow(dispatch, getState, enums.provisionUi.ProvisionMethod.device, 'Keybase username', 'lorem ipsum', Constants.loginDone)
  }
}

export function doneRegistering () {
  return {type: Constants.doneRegistering}
}

function setCodePageOtherDeviceRole (otherDeviceRole) {
  return (dispatch, getState) => {
    const store = getState().login.codePage
    dispatch(setCodePageMode(defaultModeForDeviceRoles(store.myDeviceRole, otherDeviceRole, false)))
    dispatch({type: Constants.setOtherDeviceCodeState, payload: otherDeviceRole})
  }
}

function generateQRCode (dispatch, getState) {
  const store = getState().login.codePage
  const goodMode = store.mode === Constants.codePageModeShowCode || store.mode === Constants.codePageModeShowCodeOrEnterText

  if (goodMode && !store.qrCode && store.textCode) {
    dispatch({type: Constants.setQRCode, payload: qrGenerate(store.textCode)})
  }
}

function setCodePageMode (mode) {
  return (dispatch, getState) => {
    const store = getState().login.codePage

    generateQRCode(dispatch, getState)

    if (store.mode === mode) {
      return // already in this mode
    }

    dispatch({type: Constants.setCodeMode, payload: mode})
  }
}

function setCameraBrokenMode (broken) {
  return (dispatch, getState) => {
    dispatch({type: Constants.cameraBrokenMode, payload: broken})

    const root = getState().login.codePage
    dispatch(setCodePageMode(defaultModeForDeviceRoles(root.myDeviceRole, root.otherDeviceRole, broken)))
  }
}

export function updateForgotPasswordEmail (email) {
  return {type: Constants.actionUpdateForgotPasswordEmailAddress, payload: email}
}

export function submitForgotPassword () {
  return (dispatch, getState) => {
    dispatch({type: Constants.actionSetForgotPasswordSubmitting})

    engine.rpc('login.recoverAccountFromEmailAddress', {email: getState().login.forgotPasswordEmailAddress}, {}, (error, response) => {
      dispatch({
        type: Constants.actionForgotPasswordDone,
        payload: error,
        error: !!error
      })
    })
  }
}

export function autoLogin () {
  return dispatch => {
    engine.rpc('login.login', {}, {}, (error, status) => {
      if (error) {
        console.log(error)
      } else {
        dispatch({type: Constants.loginDone, payload: status})
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
        dispatch({type: Constants.logoutDone})
      }
    })
  }
}

// Show a user/pass screen, call cb() when done
// title/subTitle to customize the screen
function askForUserPass (title, subTitle, cb) {
  return dispatch => {
    const props = {
      title,
      subTitle,
      mapStateToProps: state => state.login.userPass,
      onSubmit: (username, passphrase) => {
        dispatch({type: Constants.actionSetUserPass, payload: {username, passphrase}})
        cb()
      }
    }

    dispatch(routeAppend({
      parseRoute: {
        componentAtTop: {component: UserPass, props}
      }
    }))
  }
}

function askForPaperKey (cb) {
  return dispatch => {
    const props = {
      mapStateToProps: state => state.login,
      onSubmit: paperKey => { cb(paperKey) }
    }

    dispatch(routeAppend({
      parseRoute: {
        componentAtTop: {component: PaperKey, props}
      }
    }))
  }
}

// Show a device naming page, call cb() when done
// existing devices are blacklisted
function askForDeviceName (existingDevices, cb) {
  return dispatch => {
    dispatch({
      type: Constants.actionAskDeviceName,
      payload: {
        existingDevices,
        onSubmit: deviceName => {
          dispatch({type: Constants.actionSetDeviceName, payload: deviceName})
          cb()
        }
      }
    })

    dispatch(routeAppend({
      parseRoute: {
        componentAtTop: {
          component: SetPublicName,
          props: {
            mapStateToProps: state => state.login.deviceName
          }
        }
      }
    }))
  }
}

function askForOtherDeviceType (cb) {
  return dispatch => {
    const props = {
      mapStateToProps: state => state.login.codePage,
      onSubmit: otherDeviceRole => { cb(otherDeviceRole) }
    }

    dispatch(routeAppend({
      parseRoute: {
        componentAtTop: {component: ExistingDevice, props}
      }
    }))
  }
}

function askForCodePage (cb) {
  return dispatch => {
    const mapStateToProps = state => {
      const {
        mode, codeCountDown, textCode, qrCode,
        myDeviceRole, otherDeviceRole, cameraBrokenMode
      } = state.login.codePage
      return {
        mode,
        codeCountDown,
        textCode,
        qrCode,
        myDeviceRole,
        otherDeviceRole,
        cameraBrokenMode
      }
    }

    const props = {
      mapStateToProps,
      setCodePageMode: mode => dispatch(setCodePageMode(mode)),
      qrScanned: code => cb(code.data),
      setCameraBrokenMode: broken => dispatch(setCameraBrokenMode(broken)),
      textEntered: text => cb(text),
      doneRegistering: () => dispatch(doneRegistering())
    }

    dispatch(routeAppend({
      parseRoute: {
        componentAtTop: {component: CodePage, props}
      }
    }))
  }
}

export function registerWithExistingDevice () {
  return (dispatch, getState) => {
    const provisionMethod = enums.provisionUi.ProvisionMethod.device
    startLoginFlow(dispatch, getState, provisionMethod, null, null, Constants.actionRegisteredWithExistingDevice)
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
  const deviceType = isMobile ? 'mobile' : 'desktop'
  const incomingMap = makeKex2IncomingMap(dispatch, getState, provisionMethod, userPassTitle, userPassSubtitle)

  engine.rpc('login.login', {deviceType}, incomingMap, (error, response) => {
    dispatch({
      type: successType,
      error: !!error,
      payload: error || null
    })

    if (!error) {
      dispatch(navigateTo([]))
      dispatch(loadDevices())
      dispatch(switchTab(devicesTab))
    }
  })
}

export function addANewDevice () {
  return (dispatch, getState) => {
    const provisionMethod = enums.provisionUi.ProvisionMethod.device
    const userPassTitle = 'Registering a new device requires your Keybase username and passphrase'
    const userPassSubtitle = 'reggy lorem ipsum lorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsum'
    const incomingMap = makeKex2IncomingMap(dispatch, getState, provisionMethod, userPassTitle, userPassSubtitle)

    engine.rpc('device.deviceAdd', {}, incomingMap, (error, response) => {
      console.log(error)
    })
  }
}

function makeKex2IncomingMap (dispatch, getState, provisionMethod, userPassTitle, userPassSubtitle) {
  return {
    'keybase.1.provisionUi.chooseProvisioningMethod': (param, response) => {
      response.result(provisionMethod)
    },
    'keybase.1.loginUi.getEmailOrUsername': (param, response) => {
      const {username} = getState().login.userPass
      if (!username) {
        dispatch(askForUserPass(userPassTitle, userPassSubtitle, () => {
          const {username} = getState().login.userPass
          response.result(username)
        }))
      } else {
        response.result(username)
      }
    },
    'keybase.1.secretUi.getPaperKeyPassphrase': (param, response) => {
      dispatch(askForPaperKey(paperKey => {
        response.result(paperKey)
      }))
    },
    'keybase.1.secretUi.getKeybasePassphrase': (param, response) => {
      const {passphrase} = getState().login.userPass
      if (!passphrase) {
        dispatch(askForUserPass(userPassTitle, userPassSubtitle, () => {
          const {passphrase} = getState().login.userPass
          response.result({passphrase, storeSecret: false})
        }))
      } else {
        response.result({passphrase, storeSecret: false})
      }
    },
    'keybase.1.secretUi.getSecret': (param, response) => {
      const {passphrase} = getState().login.userPass
      if (!passphrase) {
        dispatch(askForUserPass(userPassTitle, userPassSubtitle, () => {
          const {passphrase} = getState().login.userPass
          response.result({
            text: passphrase,
            canceled: false,
            storeSecret: true
          })
        }))
      } else {
        response.result({
          text: passphrase,
          canceled: false,
          storeSecret: true
        })
      }
    },
    'keybase.1.provisionUi.PromptNewDeviceName': (param, response) => {
      const {existingDevices} = param
      dispatch(askForDeviceName(existingDevices, () => {
        const {deviceName} = getState().login.deviceName
        response.result(deviceName)
      }))
    },
    'keybase.1.logUi.log': (param, response) => {
      console.log(param)
      response.result()
    },
    'keybase.1.provisionUi.ProvisioneeSuccess': (param, response) => {
      response.result()
    },
    'keybase.1.provisionUi.ProvisionerSuccess': (param, response) => {
      response.result()
      const uri = getCurrentURI(getState()).last()

      const onDevicesTab = getCurrentTab(getState()) === devicesTab
      const onCodePage = uri && uri.getIn(['parseRoute']) &&
        uri.getIn(['parseRoute']).componentAtTop && uri.getIn(['parseRoute']).componentAtTop.component === CodePage

      if (onDevicesTab && onCodePage) {
        dispatch(navigateTo([]))
        dispatch(loadDevices())
      }
    },
    'keybase.1.provisionUi.chooseDeviceType': (param, response) => {
      dispatch(askForOtherDeviceType(type => {
        const typeMap = {
          [Constants.codePageDeviceRoleExistingPhone]: enums.provisionUi.DeviceType.mobile,
          [Constants.codePageDeviceRoleExistingComputer]: enums.provisionUi.DeviceType.desktop
        }

        dispatch(setCodePageOtherDeviceRole(type))
        response.result(typeMap[type])
      }))
    },
    'keybase.1.provisionUi.DisplayAndPromptSecret': ({phrase, secret}, response) => {
      dispatch({type: Constants.setTextCode, payload: phrase})
      generateQRCode(dispatch, getState)
      dispatch(askForCodePage(phrase => { response.result({phrase}) }))
    },
    'keybase.1.provisionUi.DisplaySecretExchanged': (param, response) => {
      response.result()
    }
  }
}
