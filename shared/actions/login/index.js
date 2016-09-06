// @flow
import * as CommonConstants from '../../constants/common'
import * as Constants from '../../constants/login'
import HiddenString from '../../util/hidden-string'
import React from 'react'
import engine from '../../engine'
import openURL from '../../util/open-url'
import type {DeviceRole} from '../../constants/login'
import type {DeviceType} from '../../constants/types/more'
import type {Dispatch, GetState, AsyncAction, TypedAction, Action} from '../../constants/types/flux'
import type {incomingCallMapType, DeviceType as RPCDeviceType} from '../../constants/types/flow-types'
import type {ResponseType} from '../../engine'
import {Map} from 'immutable'
import {bindActionCreators} from 'redux'
import {bootstrap} from '../config'
import {defaultModeForDeviceRoles, qrGenerate} from './provision-helpers'
import {devicesTab, loginTab} from '../../constants/tabs'
import {isMobile} from '../../constants/platform'
import {loadDevices} from '../devices'
import {loginRecoverAccountFromEmailAddressRpc, loginLoginRpc, loginLogoutRpc,
  deviceDeviceAddRpc, loginGetConfiguredAccountsRpc, CommonClientType,
  ConstantsStatusCode, ProvisionUiGPGMethod, ProvisionUiDeviceType,
  PassphraseCommonPassphraseType,
} from '../../constants/types/flow-types'
import {navigateTo, routeAppend, navigateUp, switchTab} from '../router'
import {overrideLoggedInTab} from '../../local-debug'

const InputCancelError = {desc: 'Cancel Login', code: ConstantsStatusCode.scinputcanceled}

function makeWaitingHandler (dispatch: Dispatch): {waitingHandler: (waiting: boolean) => void} {
  return {
    waitingHandler: bindActionCreators(waitingForResponse, dispatch),
  }
}

function waitingForResponse (waiting: boolean) : TypedAction<'login:waitingForResponse', boolean, void> {
  return {
    type: Constants.waitingForResponse,
    payload: waiting,
  }
}

export function navBasedOnLoginState (): AsyncAction {
  return (dispatch, getState) => {
    const {config: {status, extendedConfig}} = getState()

    // No status?
    if (!status || !Object.keys(status).length || !extendedConfig || !Object.keys(extendedConfig).length ||
      !extendedConfig.defaultDeviceID) { // Not provisioned?
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
    loginGetConfiguredAccountsRpc({
      ...makeWaitingHandler(dispatch),
      callback: (error, accounts) => {
        if (error) {
          dispatch({type: Constants.configuredAccounts, error: true, payload: error})
        } else {
          dispatch({type: Constants.configuredAccounts, payload: {accounts}})
        }
      },
    })
  }
}

export function login (): AsyncAction {
  // See FIXME about HMR at the bottom of this file
  const UsernameOrEmail = require('../../login/register/username-or-email').default
  const Error = require('../../login/register/error').default
  return (dispatch, getState) => {
    const props = {
      onBack: () => dispatch(cancelLogin()),
      onSubmit: usernameOrEmail => {
        const deviceType: DeviceType = isMobile ? 'mobile' : 'desktop'
        const onBack = response => { dispatch(cancelLogin(response)) }
        const onProvisionerSuccess = () => { dispatch(navBasedOnLoginState()) }
        const incomingCallMap = makeKex2IncomingMap(dispatch, getState, onBack, onProvisionerSuccess)
        loginLoginRpc({
          ...makeWaitingHandler(dispatch),
          param: {
            deviceType,
            usernameOrEmail: usernameOrEmail,
            clientType: CommonClientType.gui,
          },
          incomingCallMap,
          callback: (error, response) => {
            if (error) {
              dispatch({
                type: Constants.loginDone,
                error: true,
                payload: error,
              })

              if (!(error.code === InputCancelError.code)) {
                dispatch(routeAppend({
                  parseRoute: {
                    componentAtTop: {
                      component: Error,
                      props: {error, onBack: () => dispatch(cancelLogin())}}},
                }))
              }
            } else {
              dispatch({
                type: Constants.loginDone,
                error: false,
                payload: undefined,
              })

              dispatch(loadDevices())
              dispatch(bootstrap())
            }
          },
        })
      },
    }
    // We can either be a newDevice or an existingDevice.  Here in the login
    // flow, let's set ourselves to be a newDevice.  If we were in the Devices
    // tab flow, we'd want the opposite.
    dispatch({
      type: Constants.setMyDeviceCodeState,
      payload:
        isMobile ? Constants.codePageDeviceRoleNewPhone : Constants.codePageDeviceRoleNewComputer,
    })
    // We ask for user since the login will auto login with the last user which we don't always want
    dispatch(routeAppend({parseRoute: {componentAtTop: {component: UsernameOrEmail, props}}}))
  }
}

export function setRevokedSelf (revoked: string) {
  return {type: Constants.setRevokedSelf, payload: revoked}
}

export function setLoginFromRevokedDevice (error: string) {
  return {type: Constants.setLoginFromRevokedDevice, payload: error}
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
    dispatch({type: Constants.setQRCode, payload: {qrCode: new HiddenString(qrGenerate(store.textCode.stringValue()))}})
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

    loginRecoverAccountFromEmailAddressRpc({
      ...makeWaitingHandler(dispatch),
      param: {email: getState().login.forgotPasswordEmailAddress},
      callback: (error, response) => {
        if (error) {
          dispatch({
            type: Constants.actionForgotPasswordDone,
            payload: error,
            error: true,
          })
        } else {
          dispatch({
            type: Constants.actionForgotPasswordDone,
            payload: undefined,
            error: false,
          })
        }
      },
    })
  }
}

export function autoLogin () : AsyncAction {
  return dispatch => {
    const deviceType: DeviceType = isMobile ? 'mobile' : 'desktop'
    loginLoginRpc({
      ...makeWaitingHandler(dispatch),
      param: {
        deviceType,
        usernameOrEmail: '',
        clientType: login.ClientType.gui,
      },
      incomingCallMap: {
        'keybase.1.loginUi.getEmailOrUsername': (_, response) => {
          response.error({
            code: ConstantsStatusCode.scnoui,
            desc: 'Attempting auto login',
          })
        },
      },
      callback: (error, status) => {
        if (error) {
          console.log(error)
          dispatch({type: Constants.loginDone, error: true, payload: error})
        } else {
          dispatch({type: Constants.loginDone, payload: status})
          dispatch(navBasedOnLoginState())
        }
      },
    })
  }
}

export function relogin (user: string, passphrase: string) : AsyncAction {
  return dispatch => {
    const deviceType: DeviceType = isMobile ? 'mobile' : 'desktop'
    loginLoginRpc({
      ...makeWaitingHandler(dispatch),
      param: {
        deviceType,
        usernameOrEmail: user,
        clientType: CommonClientType.gui,
      },
      incomingCallMap: {
        'keybase.1.secretUi.getPassphrase': ({pinentry: {type}}, response) => {
          response.result({
            passphrase,
            storeSecret: true,
          })
        },
        'keybase.1.provisionUi.chooseDevice': ({devices}, response) => {
          const message = 'This device is no longer provisioned.'
          response.error({
            code: ConstantsStatusCode.scgeneric,
            desc: message,
          })
          dispatch({
            type: Constants.loginDone,
            error: true,
            payload: {message},
          })
          dispatch(setLoginFromRevokedDevice(message))
          dispatch(navigateTo([], loginTab))
          dispatch(switchTab(loginTab))
        },
      },
      callback: (error, status) => {
        if (error) {
          console.log(error)
          dispatch({type: Constants.loginDone, error: true, payload: error})
        } else {
          dispatch({type: Constants.loginDone, payload: status})
          dispatch(navBasedOnLoginState())
        }
      },
    })
  }
}

export function logout () : AsyncAction {
  return dispatch => {
    loginLogoutRpc({
      ...makeWaitingHandler(dispatch),
      callback: (error, response) => {
        if (error) {
          console.log(error)
        } else {
          dispatch(logoutDone())
        }
      },
    })
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

function cancelLogin (response: ?ResponseType) : AsyncAction {
  return (dispatch, getState) => {
    dispatch(navBasedOnLoginState())
    if (response) {
      engine().cancelRPC(response, InputCancelError)
    }
  }
}

export function addNewPhone () : AsyncAction {
  return addNewDevice(Constants.codePageDeviceRoleNewPhone)
}

export function addNewComputer () : AsyncAction {
  return addNewDevice(Constants.codePageDeviceRoleNewComputer)
}

export function addNewPaperKey () : Action {
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
        isMobile ? Constants.codePageDeviceRoleExistingPhone : Constants.codePageDeviceRoleExistingComputer,
    })

    const onBack = response => {
      dispatch(loadDevices())
      dispatch(navigateUp(devicesTab, Map({path: 'root'})))
      if (response) {
        engine().cancelRPC(response, InputCancelError)
      }
    }

    const incomingCallMap = makeKex2IncomingMap(dispatch, getState, onBack, onBack)
    incomingCallMap['keybase.1.provisionUi.chooseDeviceType'] = ({sessionID}, response: {result: (type: RPCDeviceType) => void}) => {
      const deviceTypeMap: {[key: string]: any} = {
        [Constants.codePageDeviceRoleNewComputer]: ProvisionUiDeviceType.desktop,
        [Constants.codePageDeviceRoleNewPhone]: ProvisionUiDeviceType.mobile,
      }
      let deviceType = deviceTypeMap[kind]

      dispatch(setCodePageOtherDeviceRole(kind))
      response.result(deviceType)
    }

    deviceDeviceAddRpc({
      ...makeWaitingHandler(dispatch),
      incomingCallMap,
      callback: (ignoredError, response) => {
        onBack()
      },
    })
  }
}

export function openAccountResetPage () : AsyncAction {
  return () => {
    openURL('https://keybase.io/#password-reset')
  }
}

type SimpleCB = () => void
function makeKex2IncomingMap (dispatch, getState, onBack: SimpleCB, onProvisionerSuccess: SimpleCB) : incomingCallMapType {
  function appendRouteElement (element: React$Element<any>) {
    dispatch(routeAppend({parseRoute: {componentAtTop: {element}}}))
  }

  // FIXME (mbg): The above usage of React components in the action code causes
  // a module dependency which prevents HMR. We can't hot reload action code,
  // so when these views (or more likely, their subcomponents from
  // common-adapters) change, HMR is unable to update the tree. We can band-aid
  // this by dynamically requiring these views as below, but they probably
  // won't hot reload properly until we decouple these action effects from the
  // view class implementations.
  const SelectOtherDevice = require('../../login/register/select-other-device').default
  const UsernameOrEmail = require('../../login/register/username-or-email').default
  const GPGSign = require('../../login/register/gpg-sign').default
  const Passphrase = require('../../login/register/passphrase').default
  const PaperKey = require('../../login/register/paper-key').default
  const CodePage = require('../../login/register/code-page').default
  const SetPublicName = require('../../login/register/set-public-name').default
  const SuccessRender = require('../../login/signup/success/index.render').default

  function askForCodePage (cb, onBack) : AsyncAction {
    return dispatch => {
      const mapStateToProps = state => {
        const {
          mode, codeCountDown, textCode, qrCode,
          myDeviceRole, otherDeviceRole, cameraBrokenMode,
        } = state.login.codePage
        return {
          mode,
          codeCountDown,
          textCode: textCode ? textCode.stringValue() : '',
          qrCode: qrCode ? qrCode.stringValue() : '',
          myDeviceRole,
          otherDeviceRole,
          cameraBrokenMode,
        }
      }

      const props = {
        mapStateToProps,
        onBack: onBack,
        setCodePageMode: mode => dispatch(setCodePageMode(mode)),
        qrScanned: code => cb(code.data),
        setCameraBrokenMode: broken => dispatch(setCameraBrokenMode(broken)),
        textEntered: text => cb(text),
        doneRegistering: () => dispatch(doneRegistering()),
      }

      dispatch(routeAppend({
        parseRoute: {
          componentAtTop: {component: CodePage, props},
        },
      }))
    }
  }

  return {
    'keybase.1.loginUi.getEmailOrUsername': (param, response) => {
      appendRouteElement((
        <UsernameOrEmail
          onSubmit={usernameOrEmail => response.result(usernameOrEmail)}
          onBack={() => onBack(response)} />))
    },
    'keybase.1.provisionUi.chooseDevice': ({devices}, response) => {
      appendRouteElement((
        <SelectOtherDevice
          devices={devices}
          onSelect={deviceID => {
            // $FlowIssue
            const type: DeviceType = (devices || []).find(d => d.deviceID === deviceID).type
            const role = ({
              mobile: Constants.codePageDeviceRoleExistingPhone,
              desktop: Constants.codePageDeviceRoleExistingComputer,
            }: {[key: DeviceType]: DeviceRole})[type]
            dispatch(setCodePageOtherDeviceRole(role))
            response.result(deviceID)
          }}
          onWont={() => response.result('')}
          onBack={() => onBack(response)} />))
    },
    'keybase.1.secretUi.getPassphrase': ({pinentry: {type, prompt, username, retryLabel}}, response) => {
      switch (type) {
        case PassphraseCommonPassphraseType.paperKey:
          appendRouteElement((
            <PaperKey
              mapStateToProps={state => ({})}
              onSubmit={(passphrase: string) => { response.result({passphrase, storeSecret: false}) }}
              onBack={() => onBack(response)}
              error={retryLabel} />))
          break
        case PassphraseCommonPassphraseType.passPhrase:
          appendRouteElement((
            <Passphrase
              prompt={prompt}
              onSubmit={passphrase => response.result({
                passphrase,
                storeSecret: false,
              })}
              onBack={() => onBack(response)}
              error={retryLabel}
              username={username} />))
          break
        default:
          response.error({
            code: ConstantsStatusCode.scnotfound,
            desc: 'Unknown getPassphrase type',
          })
      }
    },
    'keybase.1.provisionUi.DisplayAndPromptSecret': ({phrase, secret}, response) => {
      dispatch({type: Constants.setTextCode, payload: {textCode: new HiddenString(phrase)}})
      generateQRCode(dispatch, getState)
      dispatch(askForCodePage(phrase => { response.result({phrase, secret: null}) }, () => onBack(response)))
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
          onSubmit={exportKey => response.result(exportKey ? ProvisionUiGPGMethod.gpgImport : ProvisionUiGPGMethod.gpgSign)}
          onBack={() => onBack(response)} />))
    },
    'keybase.1.loginUi.displayPrimaryPaperKey': ({sessionID, phrase}, response) => {
      appendRouteElement((
        <SuccessRender
          paperkey={new HiddenString(phrase)}
          waiting={false}
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
    },
  }
}
