/* @flow */
import * as Constants from '../../constants/login'
import {isMobile} from '../../constants/platform'
import {navigateTo, routeAppend} from '../router'
import engine from '../../engine'
import enums from '../../constants/types/keybase-v1'
import SelectOtherDevice from '../../login/register/select-other-device'
import UsernameOrEmail from '../../login/register/username-or-email'
// import GPGMissingPinentry from '../../login/register/gpg-missing-pinentry'
// import GPGSign from '../../login/register/gpg-sign'
import Passphrase from '../../login/register/passphrase'
import PaperKey from '../../login/register/paper-key'
import CodePage from '../../login/register/code-page'
import SetPublicName from '../../login/register/set-public-name'
import {switchTab} from '../tabbed-router'
import {devicesTab, loginTab} from '../../constants/tabs'
import {loadDevices} from '../devices'
import {defaultModeForDeviceRoles, qrGenerate} from './provision-helpers'
import {getCurrentStatus} from '../config'
import type {Dispatch, GetState, AsyncAction, TypedAction} from '../../constants/types/flux'
import type {incomingCallMapType, login_recoverAccountFromEmailAddress_rpc,
  login_login_rpc, login_logout_rpc, device_deviceAdd_rpc, login_getConfiguredAccounts_rpc} from '../../constants/types/flow-types'
import {overrideLoggedInTab, setupCancelLogin} from '../../local-debug'
import type {DeviceRole} from '../../constants/login'

let currentLoginSessionID = null

export function navBasedOnLoginState () :AsyncAction {
  return (dispatch, getState) => {
    const {config: {status}} = getState()

    // No status?
    if (!status || !Object.keys(status).length) {
      dispatch(navigateTo([], loginTab))
      dispatch(switchTab(loginTab))
    } else {
      if (status.loggedIn) { // logged in
        if (overrideLoggedInTab) {
          console.log('Loading overridden logged in tab')
          dispatch(switchTab(overrideLoggedInTab))
        } else {
          dispatch(switchTab(devicesTab))
        }
      } else if (status.registered) { // relogging in
        dispatch(getAccounts())
        dispatch(navigateTo(['login'], loginTab))
        dispatch(switchTab(loginTab))
      } else { // no idea
        dispatch(navigateTo([], loginTab))
        dispatch(switchTab(loginTab))
      }
    }
  }
}

function getAccounts (): AsyncAction {
  return dispatch => {
    const params: login_getConfiguredAccounts_rpc = {
      method: 'login.getConfiguredAccounts',
      param: {},
      incomingCallMap: {},
      callback: (error, accounts) => {
        if (error) {
          dispatch({type: Constants.configuredAccounts, error: true, payload: error})
        } else {
          dispatch({type: Constants.configuredAccounts, payload: {accounts}})
        }
      }
    }
    engine.rpc(params)
  }
}

export function login (): AsyncAction {
  return (dispatch, getState) => {
    if (__DEV__) {
      setupCancelLogin(() => dispatch(cancelLogin()))
    }

    const deviceType = isMobile ? 'mobile' : 'desktop'
    const incomingMap = makeKex2IncomingMap(dispatch, getState)
    const params : login_login_rpc = {
      method: 'login.login',
      param: {
        deviceType,
        usernameOrEmail: '',
        clientType: enums.login.ClientType.gui
      },
      incomingCallMap: incomingMap,
      callback: (error, response) => {
        currentLoginSessionID = null
        if (error) {
          dispatch({
            type: Constants.loginDone,
            error: true,
            payload: error
          })
        } else {
          dispatch({
            type: Constants.loginDone,
            error: false,
            payload: undefined
          })

          dispatch(loadDevices())
          dispatch(navBasedOnLoginState())
        }
      }
    }

    currentLoginSessionID = engine.rpc(params)
  }
}

export function doneRegistering (): TypedAction<'login:doneRegistering', void, void> {
  // this has to be undefined for flow to match it to void
  return {type: Constants.doneRegistering, payload: undefined}
}

function setCodePageOtherDeviceRole (otherDeviceRole: DeviceRole) : AsyncAction {
  return (dispatch, getState) => {
    const store = getState().login.codePage
    dispatch(setCodePageMode(defaultModeForDeviceRoles(store.myDeviceRole, otherDeviceRole, false)))
    dispatch({type: Constants.setOtherDeviceCodeState, payload: otherDeviceRole})
  }
}

function generateQRCode (dispatch: Dispatch, getState: GetState) {
  const store = getState().login.codePage
  const goodMode = store.mode === Constants.codePageModeShowCode

  if (goodMode && !store.qrCode && store.textCode) {
    dispatch({type: Constants.setQRCode, payload: qrGenerate(store.textCode)})
  }
}

function setCodePageMode (mode) : AsyncAction {
  return (dispatch, getState) => {
    const store = getState().login.codePage

    generateQRCode(dispatch, getState)

    if (store.mode === mode) {
      return // already in this mode
    }

    dispatch({type: Constants.setCodeMode, payload: mode})
  }
}

function setCameraBrokenMode (broken) : AsyncAction {
  return (dispatch, getState) => {
    dispatch({type: Constants.cameraBrokenMode, payload: broken})

    const root = getState().login.codePage
    dispatch(setCodePageMode(defaultModeForDeviceRoles(root.myDeviceRole, root.otherDeviceRole, broken)))
  }
}

export function updateForgotPasswordEmail (email: string) : TypedAction<'login:actionUpdateForgotPasswordEmailAddress', string, void> {
  return {type: Constants.actionUpdateForgotPasswordEmailAddress, payload: email}
}

export function submitForgotPassword () : AsyncAction {
  return (dispatch, getState) => {
    dispatch({type: Constants.actionSetForgotPasswordSubmitting, payload: undefined})

    const params : login_recoverAccountFromEmailAddress_rpc = {
      method: 'login.recoverAccountFromEmailAddress',
      param: {email: getState().login.forgotPasswordEmailAddress},
      incomingCallMap: {},
      callback: (error, response) => {
        if (error) {
          dispatch({
            type: Constants.actionForgotPasswordDone,
            payload: error,
            error: true
          })
        } else {
          dispatch({
            type: Constants.actionForgotPasswordDone,
            payload: undefined,
            error: false
          })
        }
      }
    }

    engine.rpc(params)
  }
}

export function autoLogin () : AsyncAction {
  return dispatch => {
    const params : login_login_rpc = {
      method: 'login.login',
      param: {
        deviceType: isMobile ? 'mobile' : 'desktop',
        usernameOrEmail: '',
        clientType: enums.login.ClientType.gui
      },
      incomingCallMap: {
        'keybase.1.loginUi.getEmailOrUsername': (_, response) => {
          response.error({
            code: enums.constants.StatusCode.scnoui,
            desc: 'Attempting auto login'
          })
        }
      },
      callback: (error, status) => {
        if (error) {
          console.log(error)
          dispatch({type: Constants.loginDone, error: true, payload: error})
        } else {
          dispatch({type: Constants.loginDone, payload: status})
          dispatch(navBasedOnLoginState())
        }
      }
    }
    engine.rpc(params)
  }
}

export function relogin (user: string, passphrase: string, store: boolean) : AsyncAction {
  return dispatch => {
    const params : login_login_rpc = {
      method: 'login.login',
      param: {
        deviceType: isMobile ? 'mobile' : 'desktop',
        usernameOrEmail: user,
        clientType: enums.login.ClientType.gui
      },
      incomingCallMap: {
        'keybase.1.secretUi.getPassphrase': ({pinentry: {type}}, response) => {
          response.result({
            passphrase,
            storeSecret: store
          })
        }
      },
      callback: (error, status) => {
        if (error) {
          console.log(error)
          dispatch({type: Constants.loginDone, error: true, payload: error})
        } else {
          dispatch({type: Constants.loginDone, payload: status})
          dispatch(navBasedOnLoginState())
        }
      }
    }
    engine.rpc(params)
  }
}

export function logout () : AsyncAction {
  return dispatch => {
    const params : login_logout_rpc = {
      method: 'login.logout',
      param: {},
      incomingCallMap: {},
      callback: (error, response) => {
        if (error) {
          console.log(error)
        } else {
          dispatch(logoutDone())
        }
      }
    }
    engine.rpc(params)
  }
}

export function logoutDone () : AsyncAction {
  // We've logged out, let's check our current status
  return (dispatch, getState) => {
    dispatch({type: Constants.logoutDone, payload: undefined})

    dispatch(switchTab(loginTab))
    dispatch(navBasedOnLoginState())
    dispatch(getCurrentStatus())
  }
}

function askForCodePage (cb) : AsyncAction {
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

export function cancelLogin () : AsyncAction {
  return (dispatch, getState) => {
    dispatch(navBasedOnLoginState())
    if (currentLoginSessionID) {
      engine.cancelRPC(currentLoginSessionID)
      currentLoginSessionID = null
    }
  }
}

export function addANewDevice () : AsyncAction {
  return (dispatch, getState) => {
    const incomingMap = makeKex2IncomingMap(dispatch, getState)
    const params : device_deviceAdd_rpc = {
      method: 'device.deviceAdd',
      param: {},
      incomingCallMap: incomingMap,
      callback: (error, response) => {
        console.log(error)
      }
    }
    engine.rpc(params)
  }
}

function makeKex2IncomingMap (dispatch, getState) : incomingCallMapType {
  return {
    'keybase.1.loginUi.getEmailOrUsername': (param, response) => {
      const props = {
        onSubmit: usernameOrEmail => response.result(usernameOrEmail)
      }

      dispatch(routeAppend({
        parseRoute: {componentAtTop: {component: UsernameOrEmail, props}}
      }))
    },
    'keybase.1.provisionUi.chooseDevice': ({devices}, response) => {
      const props = {
        devices,
        onSelect: deviceID => {
          const type: DeviceRole = devices[devices.findIndex(d => d.deviceID === deviceID)].type
          const role = {
            mobile: Constants.codePageDeviceRoleExistingPhone,
            computer: Constants.codePageDeviceRoleExistingComputer
          }[type]
          dispatch(setCodePageOtherDeviceRole(role))
          response.result(deviceID)
        },
        onWont: () => response.result('')
      }

      dispatch(routeAppend({
        parseRoute: {componentAtTop: {component: SelectOtherDevice, props}}
      }))
    },
    'keybase.1.secretUi.getPassphrase': ({pinentry: {type}}, response) => {
      switch (type) {
        case enums.secretUi.PassphraseType.paperKey: {
          const props = {
            mapStateToProps: state => state.login,
            onSubmit: passphrase => response.result({
              passphrase,
              storeSecret: false
            })
          }

          dispatch(routeAppend({
            parseRoute: {componentAtTop: {component: PaperKey, props}}
          }))
          break
        }
        case enums.secretUi.PassphraseType.passPhrase: {
          const props = {
            onSubmit: passphrase => response.result({
              passphrase,
              storeSecret: false
            })
          }

          dispatch(routeAppend({
            parseRoute: {componentAtTop: {component: Passphrase, props}}
          }))
          break
        }
        default:
          response.error({
            code: enums.constants.StatusCode.scnotfound,
            desc: 'Unknown getPassphrase type'
          })
      }
    },
    'keybase.1.provisionUi.DisplayAndPromptSecret': ({phrase, secret}, response) => {
      dispatch({type: Constants.setTextCode, payload: phrase})
      generateQRCode(dispatch, getState)
      dispatch(askForCodePage(phrase => { response.result({phrase, secret: null}) }))
    },
    'keybase.1.provisionUi.PromptNewDeviceName': ({existingDevices}, response) => {
      dispatch({
        type: Constants.actionAskDeviceName,
        payload: {
          existingDevices,
          onSubmit: deviceName => {
            response.result(deviceName)
          }
        }
      })

      dispatch(routeAppend({
        parseRoute: {
          componentAtTop: {
            component: SetPublicName,
            props: {mapStateToProps: state => state.login.deviceName}
          }
        }
      }))
    },
    'keybase.1.provisionUi.ProvisioneeSuccess': (param, response) => {
      response.result()
    },
    'keybase.1.provisionUi.ProvisionerSuccess': (param, response) => {
      response.result()

      dispatch(navBasedOnLoginState())
    },
    'keybase.1.provisionUi.DisplaySecretExchanged': (param, response) => {
      response.result()
    }
  }
}
