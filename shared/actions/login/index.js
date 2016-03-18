/* @flow */
import * as Constants from '../../constants/login'
import * as CommonConstants from '../../constants/common'
import {bindActionCreators} from 'redux'
import {isMobile} from '../../constants/platform'
import {navigateTo, routeAppend} from '../router'
import engine, {isRPCCancelError} from '../../engine'
import type {responseError} from '../../engine'
import enums from '../../constants/types/keybase-v1'
import SelectOtherDevice from '../../login/register/select-other-device'
import UsernameOrEmail from '../../login/register/username-or-email'
// import GPGMissingPinentry from '../../login/register/gpg-missing-pinentry'
import GPGSign from '../../login/register/gpg-sign'
import Passphrase from '../../login/register/passphrase'
import PaperKey from '../../login/register/paper-key'
import CodePage from '../../login/register/code-page'
import Error from '../../login/register/error'
import SetPublicName from '../../login/register/set-public-name'
import {switchTab} from '../tabbed-router'
import {devicesTab, loginTab} from '../../constants/tabs'
import {loadDevices} from '../devices'
import {defaultModeForDeviceRoles, qrGenerate} from './provision-helpers'
import {bootstrap} from '../config'
import type {Dispatch, GetState, AsyncAction, TypedAction} from '../../constants/types/flux'
import type {incomingCallMapType, login_recoverAccountFromEmailAddress_rpc,
  login_login_rpc, login_logout_rpc, device_deviceAdd_rpc, login_getConfiguredAccounts_rpc} from '../../constants/types/flow-types'
import {overrideLoggedInTab} from '../../local-debug'
import type {DeviceRole} from '../../constants/login'
import openURL from '../../util/open-url'

function makeWaitingHandler (dispatch: Dispatch): {waitingHandler: (waiting: boolean) => void} {
  return {
    waitingHandler: bindActionCreators(waitingForResponse, dispatch)
  }
}

function waitingForResponse (waiting: boolean) : TypedAction<'login:waitingForResponse', boolean, void> {
  return {
    type: Constants.waitingForResponse,
    payload: waiting
  }
}

export function navBasedOnLoginState () :AsyncAction {
  return (dispatch, getState) => {
    const {config: {status, extendedConfig}} = getState()

    // No status?
    if (!status || !Object.keys(status).length || !extendedConfig || !Object.keys(extendedConfig).length ||
      !extendedConfig.device) { // Not provisioned?
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
      ...makeWaitingHandler(dispatch),
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
    const props = {
      onBack: () => dispatch(cancelLogin()),
      onSubmit: usernameOrEmail => {
        const deviceType = isMobile ? 'mobile' : 'desktop'
        const incomingMap = makeKex2IncomingMap(dispatch, getState)
        const params : login_login_rpc = {
          ...makeWaitingHandler(dispatch),
          method: 'login.login',
          param: {
            deviceType,
            usernameOrEmail: usernameOrEmail,
            clientType: enums.login.ClientType.gui
          },
          incomingCallMap: incomingMap,
          callback: (error, response) => {
            if (error) {
              dispatch({
                type: Constants.loginDone,
                error: true,
                payload: error
              })

              if (!isRPCCancelError(error)) {
                dispatch(routeAppend({
                  parseRoute: {componentAtTop: {component: Error, props: {
                    error,
                    onBack: () => dispatch(cancelLogin())
                  }}}
                }))
              }
            } else {
              dispatch({
                type: Constants.loginDone,
                error: false,
                payload: undefined
              })

              dispatch(loadDevices())
              dispatch(bootstrap())
            }
          }
        }

        engine.rpc(params)
      }
    }
    // We ask for user since the login will auto login with the last user which we don't always want
    dispatch(routeAppend({parseRoute: {componentAtTop: {component: UsernameOrEmail, props}}}))
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
      ...makeWaitingHandler(dispatch),
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
      ...makeWaitingHandler(dispatch),
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
      ...makeWaitingHandler(dispatch),
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
      ...makeWaitingHandler(dispatch),
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
    dispatch({type: CommonConstants.resetStore, payload: undefined})

    dispatch(switchTab(loginTab))
    dispatch(navBasedOnLoginState())
    dispatch(bootstrap())
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

function cancelLogin (response: ?responseError) : AsyncAction {
  return (dispatch, getState) => {
    dispatch(navBasedOnLoginState())
    if (response) {
      engine.cancelRPC(response)
    }
  }
}

export function addANewDevice () : AsyncAction {
  return (dispatch, getState) => {
    const incomingMap = makeKex2IncomingMap(dispatch, getState)
    const params : device_deviceAdd_rpc = {
      ...makeWaitingHandler(dispatch),
      method: 'device.deviceAdd',
      param: {},
      incomingCallMap: incomingMap,
      callback: (error, response) => { console.log(error) }
    }
    engine.rpc(params)
  }
}

export function openAccountResetPage () : AsyncAction {
  return () => {
    openURL('https://keybase.io/#password-reset')
  }
}

function makeKex2IncomingMap (dispatch, getState) : incomingCallMapType {
  function appendRoute (component: any, props: Object) {
    dispatch(routeAppend({
      parseRoute: {
        componentAtTop: {
          component, props
        }
      }
    }))
  }

  return {
    'keybase.1.loginUi.getEmailOrUsername': (param, response) => {
      appendRoute(UsernameOrEmail, {
        onSubmit: usernameOrEmail => response.result(usernameOrEmail),
        onBack: () => dispatch(cancelLogin(response))
      })
    },
    'keybase.1.provisionUi.chooseDevice': ({devices}, response) => {
      appendRoute(SelectOtherDevice, {
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
        onWont: () => response.result(''),
        onBack: () => dispatch(cancelLogin(response))
      })
    },
    'keybase.1.secretUi.getPassphrase': ({pinentry: {type, prompt, retryLabel}}, response) => {
      switch (type) {
        case enums.secretUi.PassphraseType.paperKey: {
          appendRoute(PaperKey, {
            mapStateToProps: state => state.login,
            onSubmit: passphrase => response.result({
              passphrase,
              storeSecret: false
            }),
            onBack: () => dispatch(cancelLogin(response)),
            error: retryLabel
          })
          break
        }
        case enums.secretUi.PassphraseType.passPhrase: {
          appendRoute(Passphrase, {
            prompt,
            onSubmit: passphrase => response.result({
              passphrase,
              storeSecret: false
            }),
            onBack: () => dispatch(cancelLogin(response)),
            error: retryLabel
          })
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
    'keybase.1.provisionUi.PromptNewDeviceName': ({existingDevices, errorMessage}, response) => {
      appendRoute(SetPublicName, {
        existingDevices,
        deviceNameError: errorMessage,
        onSubmit: deviceName => { response.result(deviceName) },
        onBack: () => dispatch(cancelLogin(response))
      })
    },
    'keybase.1.provisionUi.chooseGPGMethod': (param, response) => {
      appendRoute(GPGSign, {
        onSubmit: exportKey => response.result(exportKey ? enums.provisionUi.GPGMethod.gpgImport : enums.provisionUi.GPGMethod.gpgSign),
        onBack: () => dispatch(cancelLogin(response))
      })
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
