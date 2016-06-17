/* @flow */
import React from 'react'
import * as Constants from '../../constants/login'
import * as CommonConstants from '../../constants/common'
import {bindActionCreators} from 'redux'
import {isMobile} from '../../constants/platform'
import {navigateTo, routeAppend, navigateUp} from '../router'
import engine from '../../engine'
import type {responseError} from '../../engine'
import {Common, constants, provisionUi, passphraseCommon} from '../../constants/types/keybase-v1'
import ExistingDevice from '../../devices/existing-device'
import SelectOtherDevice from '../../login/register/select-other-device'
import UsernameOrEmail from '../../login/register/username-or-email'
// import GPGMissingPinentry from '../../login/register/gpg-missing-pinentry'
import GPGSign from '../../login/register/gpg-sign'
import Passphrase from '../../login/register/passphrase'
import PaperKey from '../../login/register/paper-key'
import CodePage from '../../login/register/code-page'
import Error from '../../login/register/error'
import SetPublicName from '../../login/register/set-public-name'
import SuccessRender from '../../login/signup/success/index.render'
import {switchTab} from '../tabbed-router'
import {devicesTab, loginTab} from '../../constants/tabs'
import {loadDevices} from '../devices'
import {defaultModeForDeviceRoles, qrGenerate} from './provision-helpers'
import {bootstrap} from '../config'
import {Map} from 'immutable'

import type {DeviceType} from '../../constants/types/more'
import type {Dispatch, GetState, AsyncAction, TypedAction} from '../../constants/types/flux'
import type {
  incomingCallMapType,
  loginRecoverAccountFromEmailAddressRpc,
  loginLoginRpc,
  loginLogoutRpc,
  deviceDeviceAddRpc,
  loginGetConfiguredAccountsRpc,
  loginClearStoredSecretRpc
} from '../../constants/types/flow-types'
import {overrideLoggedInTab} from '../../local-debug'
import type {DeviceRole} from '../../constants/login'
import HiddenString from '../../util/hidden-string'
import openURL from '../../util/open-url'

const InputCancelError = {desc: 'Cancel Login', code: constants.StatusCode.scinputcanceled}

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
    const params: loginGetConfiguredAccountsRpc = {
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
        const deviceType: DeviceType = isMobile ? 'mobile' : 'desktop'
        const onBack = response => { dispatch(cancelLogin(response)) }
        const onProvisionerSuccess = () => { dispatch(navBasedOnLoginState()) }
        const incomingMap = makeKex2IncomingMap(dispatch, getState, onBack, onProvisionerSuccess)
        const params : loginLoginRpc = {
          ...makeWaitingHandler(dispatch),
          method: 'login.login',
          param: {
            deviceType,
            usernameOrEmail: usernameOrEmail,
            clientType: Common.ClientType.gui
          },
          incomingCallMap: incomingMap,
          callback: (error, response) => {
            if (error) {
              dispatch({
                type: Constants.loginDone,
                error: true,
                payload: error
              })

              if (!(error.raw && error.raw.code === InputCancelError.code)) {
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
    // We can either be a newDevice or an existingDevice.  Here in the login
    // flow, let's set ourselves to be a newDevice.  If we were in the Devices
    // tab flow, we'd want the opposite.
    dispatch({
      type: Constants.setMyDeviceCodeState,
      payload:
        isMobile ? Constants.codePageDeviceRoleNewPhone : Constants.codePageDeviceRoleNewComputer
    })
    // We ask for user since the login will auto login with the last user which we don't always want
    dispatch(routeAppend({parseRoute: {componentAtTop: {component: UsernameOrEmail, props}}}))
  }
}

export function setRevokedSelf (revoked: string) {
  return {type: Constants.setRevokedSelf, payload: revoked}
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

    const params : loginRecoverAccountFromEmailAddressRpc = {
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
    const deviceType: DeviceType = isMobile ? 'mobile' : 'desktop'
    const params : loginLoginRpc = {
      ...makeWaitingHandler(dispatch),
      method: 'login.login',
      param: {
        deviceType,
        usernameOrEmail: '',
        clientType: login.ClientType.gui
      },
      incomingCallMap: {
        'keybase.1.loginUi.getEmailOrUsername': (_, response) => {
          response.error({
            code: constants.StatusCode.scnoui,
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
    const deviceType: DeviceType = isMobile ? 'mobile' : 'desktop'
    const params : loginLoginRpc = {
      ...makeWaitingHandler(dispatch),
      method: 'login.login',
      param: {
        deviceType,
        usernameOrEmail: user,
        clientType: Common.ClientType.gui
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
    const params : loginLogoutRpc = {
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

export function saveInKeychainChanged (username: string, saveInKeychain: bool) : AsyncAction {
  return (dispatch, getState) => {
    if (saveInKeychain) {
      return
    }

    const params: loginClearStoredSecretRpc = {
      method: 'login.clearStoredSecret',
      param: {
        username
      },
      incomingCallMap: {},
      callback: error => { error && console.log(error) }
    }
    engine.rpc(params)
  }
}

function askForCodePage (cb, onBack) : AsyncAction {
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
      onBack: onBack,
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
      engine.cancelRPC(response, InputCancelError)
    }
  }
}

export function addNewPhone () : AsyncAction {
  return addNewDevice(Constants.codePageDeviceRoleNewPhone)
}

export function addNewComputer () : AsyncAction {
  return addNewDevice(Constants.codePageDeviceRoleNewComputer)
}

export function addNewPaperKey () : AsyncAction {
  return routeAppend('genPaperKey')
}

function addNewDevice (kind: DeviceRole) : AsyncAction {
  return (dispatch, getState) => {
    // We can either be a newDevice or an existingDevice.  Here in the add a
    // device flow, let's set ourselves to be a existingDevice.  If login()
    // starts in the future, it'll set us back to being a newDevice then.
    dispatch({
      type: Constants.setMyDeviceCodeState,
      payload:
        isMobile ? Constants.codePageDeviceRoleExistingPhone : Constants.codePageDeviceRoleExistingComputer
    })

    const onBack = response => {
      dispatch(loadDevices())
      dispatch(navigateUp(devicesTab, Map({path: 'root'})))
      if (response) {
        engine.cancelRPC(response, InputCancelError)
      }
    }

    const incomingMap = makeKex2IncomingMap(dispatch, getState, onBack, onBack)
    incomingMap['keybase.1.provisionUi.chooseDeviceType'] = ({sessionID}, response) => {
      let deviceType = {
        [Constants.codePageDeviceRoleNewComputer]: provisionUi.DeviceType.desktop,
        [Constants.codePageDeviceRoleNewPhone]: provisionUi.DeviceType.mobile
      }[kind]

      dispatch(setCodePageOtherDeviceRole(kind))
      response.result(deviceType)
    }

    const params : deviceDeviceAddRpc = {
      ...makeWaitingHandler(dispatch),
      method: 'device.deviceAdd',
      param: {},
      incomingCallMap: incomingMap,
      callback: (ignoredError, response) => {
        onBack()
      }
    }
    engine.rpc(params)
  }
}

export function openAccountResetPage () : AsyncAction {
  return () => {
    openURL('https://keybase.io/#password-reset')
  }
}

type SimpleCB = () => void
function makeKex2IncomingMap (dispatch, getState, onBack: SimpleCB, onProvisionerSuccess: SimpleCB) : incomingCallMapType {
  function appendRouteElement (element: React$Element) {
    dispatch(routeAppend({parseRoute: {componentAtTop: {element}}}))
  }

  let username = null

  return {
    'keybase.1.loginUi.getEmailOrUsername': (param, response) => {
      appendRouteElement((
        <UsernameOrEmail
          onSubmit={usernameOrEmail => {
            username = usernameOrEmail
            response.result(usernameOrEmail)
          }}
          onBack={() => onBack(response)} />))
    },
    'keybase.1.provisionUi.chooseDevice': ({devices}, response) => {
      appendRouteElement((
        <SelectOtherDevice
          devices={devices}
          onSelect={deviceID => {
            const type: DeviceRole = devices[devices.findIndex(d => d.deviceID === deviceID)].type
            const role = ({
              mobile: Constants.codePageDeviceRoleExistingPhone,
              desktop: Constants.codePageDeviceRoleExistingComputer
            }: {[key: DeviceType]: string})[type]
            dispatch(setCodePageOtherDeviceRole(role))
            response.result(deviceID)
          }}
          onWont={() => response.result('')}
          onBack={() => onBack(response)} />))
    },
    'keybase.1.secretUi.getPassphrase': ({pinentry: {type, prompt, username, retryLabel}}, response) => {
      switch (type) {
        case passphraseCommon.PassphraseType.paperKey:
          appendRouteElement((
            <PaperKey
              mapStateToProps={state => ({})}
              onSubmit={(passphrase: string) => { response.result({passphrase, storeSecret: false}) }} // eslint-disable-line arrow-parens
              onBack={() => onBack(response)}
              error={retryLabel} />))
          break
        case passphraseCommon.PassphraseType.passPhrase:
          appendRouteElement((
            <Passphrase
              prompt={prompt}
              onSubmit={passphrase => response.result({
                passphrase,
                storeSecret: false
              })}
              onBack={() => onBack(response)}
              error={retryLabel}
              username={username} />))
          break
        default:
          response.error({
            code: constants.StatusCode.scnotfound,
            desc: 'Unknown getPassphrase type'
          })
      }
    },
    'keybase.1.provisionUi.DisplayAndPromptSecret': ({phrase, secret}, response) => {
      dispatch({type: Constants.setTextCode, payload: phrase})
      generateQRCode(dispatch, getState)
      dispatch(askForCodePage(phrase => { response.result({phrase, secret: null}) }, () => onBack(response)))
    },
    'keybase.1.provisionUi.chooseDeviceType': ({sessionID, kind}, response) => {
      const store = getState().login.codePage
      appendRouteElement((
        <ExistingDevice
          myDeviceRole={store.myDeviceRole}
          onSubmit={kind => {
            let deviceType
            switch (kind) {
              case Constants.codePageDeviceRoleNewComputer:
                deviceType = provisionUi.DeviceType.desktop
                break
              case Constants.codePageDeviceRoleNewPhone:
                deviceType = provisionUi.DeviceType.mobile
                break
              default:
                console.warn(`DeviceType not recognized: ${kind}`)
                return
            }
            dispatch(setCodePageOtherDeviceRole(kind))
            response.result(deviceType)
          }}

          onBack={() => onBack(response)} />))
    },
    'keybase.1.provisionUi.PromptNewDeviceName': ({existingDevices, errorMessage}, response) => {
      appendRouteElement((
        <SetPublicName
          existingDevices={existingDevices}
          deviceNameError={errorMessage}
          onSubmit={deviceName => { response.result(deviceName) }}
          onBack={() => onBack(response)} />))
    },
    'keybase.1.provisionUi.chooseGPGMethod': (param, response) => {
      appendRouteElement((
        <GPGSign
          onSubmit={exportKey => response.result(exportKey ? provisionUi.GPGMethod.gpgImport : provisionUi.GPGMethod.gpgSign)}
          onBack={() => onBack(response)} />))
    },
    'keybase.1.loginUi.displayPrimaryPaperKey': ({sessionID, phrase}, response) => {
      appendRouteElement((
        <SuccessRender
          paperkey={new HiddenString(phrase)}
          onFinish={() => { response.result() }}
          onBack={() => onBack(response)}
          title={"Your new paper key!"} />))
    },
    'keybase.1.provisionUi.ProvisioneeSuccess': (param, response) => {
      response.result()
    },
    'keybase.1.provisionUi.ProvisionerSuccess': (param, response) => {
      response.result()
      onProvisionerSuccess()
    },
    'keybase.1.provisionUi.DisplaySecretExchanged': (param, response) => {
      response.result()
    }
  }
}
