// @flow
import * as CommonConstants from '../../constants/common'
import * as Constants from '../../constants/login'
import HiddenString from '../../util/hidden-string'
import engine from '../../engine'
import openURL from '../../util/open-url'
import {RPCError} from '../../util/errors'
import {bootstrap} from '../config'
import {defaultModeForDeviceRoles, qrGenerate} from './provision-helpers'
import {devicesTab, loginTab, profileTab} from '../../constants/tabs'
import {isMobile} from '../../constants/platform'
import {loadDevices} from '../devices'
import {loginRecoverAccountFromEmailAddressRpc, loginLoginRpc, loginLogoutRpc,
  deviceDeviceAddRpc, loginGetConfiguredAccountsRpc, CommonClientType,
  ConstantsStatusCode, ProvisionUiGPGMethod, CommonDeviceType,
  PassphraseCommonPassphraseType,
  loginLoginProvisionedDeviceRpc,
} from '../../constants/types/flow-types'
import {navigateTo, navigateAppend} from '../route-tree'
import {overrideLoggedInTab} from '../../local-debug'

import type {DeviceRole} from '../../constants/login'
import type {DeviceType} from '../../constants/types/more'
import type {Dispatch, GetState, AsyncAction, TypedAction, Action} from '../../constants/types/flux'
import type {ResponseType} from '../../engine'
import type {incomingCallMapType, DeviceType as RPCDeviceType} from '../../constants/types/flow-types'

module.hot && module.hot.accept(() => {
  console.log('accepted update in actions/login')
})

const InputCancelError = {code: ConstantsStatusCode.scinputcanceled, desc: 'Cancel Login'}

function makeWaitingHandler (dispatch: Dispatch): {waitingHandler: (waiting: boolean) => void} {
  return {
    waitingHandler: (waiting: boolean) => { dispatch(waitingForResponse(waiting)) },
  }
}

function waitingForResponse (waiting: boolean) : TypedAction<'login:waitingForResponse', boolean, void> {
  return {
    payload: waiting,
    type: Constants.waitingForResponse,
  }
}

export function navBasedOnLoginState (): AsyncAction {
  return (dispatch, getState) => {
    const {config: {status, extendedConfig}, login: {justDeletedSelf}} = getState()

    // No status?
    if (!status || !Object.keys(status).length || !extendedConfig || !Object.keys(extendedConfig).length ||
      !extendedConfig.defaultDeviceID || justDeletedSelf) { // Not provisioned?
      dispatch(navigateTo([loginTab]))
    } else {
      if (status.loggedIn) { // logged in
        if (overrideLoggedInTab) {
          console.log('Loading overridden logged in tab')
          dispatch(navigateTo([overrideLoggedInTab]))
        } else {
          dispatch(navigateTo([profileTab]))
        }
      } else if (status.registered) { // relogging in
        dispatch(getAccounts())
        dispatch(navigateTo(['login'], [loginTab]))
      } else { // no idea
        dispatch(navigateTo([loginTab]))
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
          dispatch({error: true, payload: error, type: Constants.configuredAccounts})
        } else {
          dispatch({payload: {accounts}, type: Constants.configuredAccounts})
        }
      },
    })
  }
}

export function login (): AsyncAction {
  // See FIXME about HMR at the bottom of this file
  return (dispatch, getState) => {
    function loginSubmit (usernameOrEmail: string) {
      const deviceType: DeviceType = isMobile ? 'mobile' : 'desktop'
      const onBack = response => { dispatch(cancelLogin(response)) }
      const onProvisionerSuccess = () => { dispatch(navBasedOnLoginState()) }
      const incomingCallMap = makeKex2IncomingMap(dispatch, getState, onBack, onProvisionerSuccess)
      loginLoginRpc({
        ...makeWaitingHandler(dispatch),
        callback: (error, response) => {
          if (error) {
            dispatch({
              error: true,
              payload: error,
              type: Constants.loginDone,
            })

            if (error.code !== InputCancelError.code) {
              dispatch(navigateAppend([{
                props: {
                  error,
                  onBack: () => dispatch(cancelLogin()),
                },
                selected: 'error',
              }], [loginTab, 'login']))
            }
          } else {
            dispatch(loginSuccess())
          }
        },
        incomingCallMap,
        param: {
          clientType: CommonClientType.gui,
          deviceType,
          usernameOrEmail: usernameOrEmail,
        },
      })
    }

    // We can either be a newDevice or an existingDevice.  Here in the login
    // flow, let's set ourselves to be a newDevice.  If we were in the Devices
    // tab flow, we'd want the opposite.
    dispatch({
      payload:
        isMobile ? Constants.codePageDeviceRoleNewPhone : Constants.codePageDeviceRoleNewComputer,
      type: Constants.setMyDeviceCodeState,
    })
    // We ask for user since the login will auto login with the last user which we don't always want
    dispatch(navigateAppend([{
      props: {
        onBack: () => dispatch(cancelLogin()),
        onSubmit: loginSubmit,
      },
      selected: 'usernameOrEmail',
    }], [loginTab, 'login']))
  }
}

export function setRevokedSelf (revoked: string) {
  return {payload: revoked, type: Constants.setRevokedSelf}
}

export function setDeletedSelf (deletedUsername: string) {
  return {payload: deletedUsername, type: Constants.setDeletedSelf}
}

export function setLoginFromRevokedDevice (error: string) {
  return {payload: error, type: Constants.setLoginFromRevokedDevice}
}

export function doneRegistering (): TypedAction<'login:doneRegistering', void, void> {
  // this has to be undefined for flow to match it to void
  return {payload: undefined, type: Constants.doneRegistering}
}

function setCodePageOtherDeviceRole (otherDeviceRole: DeviceRole) : AsyncAction {
  return (dispatch, getState) => {
    const store = getState().login.codePage
    if (store.myDeviceRole == null) {
      console.warn("my device role is null, can't setCodePageOtherDeviceRole. Bailing")
      return
    }
    dispatch(setCodePageMode(defaultModeForDeviceRoles(store.myDeviceRole, otherDeviceRole, false)))
    dispatch({payload: otherDeviceRole, type: Constants.setOtherDeviceCodeState})
  }
}

function generateQRCode (dispatch: Dispatch, getState: GetState) {
  const store = getState().login.codePage

  if (!store.qrCode && store.textCode) {
    dispatch({payload: {qrCode: new HiddenString(qrGenerate(store.textCode.stringValue()))}, type: Constants.setQRCode})
  }
}

function setCodePageMode (mode) : AsyncAction {
  return (dispatch, getState) => {
    const store = getState().login.codePage

    generateQRCode(dispatch, getState)

    if (store.mode === mode) {
      return // already in this mode
    }

    dispatch({payload: mode, type: Constants.setCodeMode})
  }
}

function setCameraBrokenMode (broken) : AsyncAction {
  return (dispatch, getState) => {
    dispatch({payload: broken, type: Constants.cameraBrokenMode})

    const root = getState().login.codePage
    if (root.myDeviceRole == null) {
      console.warn("my device role is null, can't setCameraBrokenMode. Bailing")
      return
    }

    if (root.otherDeviceRole == null) {
      console.warn("other device role is null, can't setCameraBrokenMode. Bailing")
      return
    }

    dispatch(setCodePageMode(defaultModeForDeviceRoles(root.myDeviceRole, root.otherDeviceRole, broken)))
  }
}

export function updateForgotPasswordEmail (email: string) : TypedAction<'login:actionUpdateForgotPasswordEmailAddress', string, void> {
  return {payload: email, type: Constants.actionUpdateForgotPasswordEmailAddress}
}

export function submitForgotPassword () : AsyncAction {
  return (dispatch, getState) => {
    dispatch({payload: undefined, type: Constants.actionSetForgotPasswordSubmitting})

    loginRecoverAccountFromEmailAddressRpc({
      ...makeWaitingHandler(dispatch),
      callback: (error, response) => {
        if (error) {
          dispatch({
            error: true,
            payload: error,
            type: Constants.actionForgotPasswordDone,
          })
        } else {
          dispatch({
            error: false,
            payload: undefined,
            type: Constants.actionForgotPasswordDone,
          })
        }
      },
      param: {email: getState().login.forgotPasswordEmailAddress},
    })
  }
}

function loginSuccess (): AsyncAction {
  return dispatch => {
    dispatch({payload: undefined, type: Constants.loginDone})
    dispatch(loadDevices())
    dispatch(bootstrap())
  }
}

export function relogin (username: string, passphrase: string) : AsyncAction {
  return dispatch => {
    loginLoginProvisionedDeviceRpc({
      ...makeWaitingHandler(dispatch),
      callback: (error, status) => {
        if (error) {
          const message = 'This device is no longer provisioned.'
          dispatch({
            error: true,
            payload: {message},
            type: Constants.loginDone,
          })
          dispatch(setLoginFromRevokedDevice(message))
          dispatch(navigateTo([loginTab]))
        } else {
          dispatch(loginSuccess())
        }
      },
      incomingCallMap: {
        'keybase.1.secretUi.getPassphrase': ({pinentry: {type}}, response) => {
          response.result({
            passphrase,
            storeSecret: true,
          })
        },
      },
      param: {
        noPassphrasePrompt: false,
        username,
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
    dispatch({payload: undefined, type: Constants.logoutDone})
    dispatch({payload: undefined, type: CommonConstants.resetStore})

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
  return navigateTo([devicesTab, 'genPaperKey'])
}

function addNewDevice (kind: DeviceRole) : AsyncAction {
  return (dispatch, getState) => {
    // We can either be a newDevice or an existingDevice.  Here in the add a
    // device flow, let's set ourselves to be a existingDevice.  If login()
    // starts in the future, it'll set us back to being a newDevice then.
    dispatch({
      payload:
        isMobile ? Constants.codePageDeviceRoleExistingPhone : Constants.codePageDeviceRoleExistingComputer,
      type: Constants.setMyDeviceCodeState,
    })

    const onBack = response => {
      dispatch(loadDevices())
      dispatch(navigateTo([devicesTab]))
      if (response) {
        engine().cancelRPC(response, InputCancelError)
      }
    }

    const incomingCallMap = makeKex2IncomingMap(dispatch, getState, onBack, onBack)
    incomingCallMap['keybase.1.provisionUi.chooseDeviceType'] = ({sessionID}, response: {result: (type: RPCDeviceType) => void}) => {
      const deviceTypeMap: {[key: string]: any} = {
        [Constants.codePageDeviceRoleNewComputer]: CommonDeviceType.desktop,
        [Constants.codePageDeviceRoleNewPhone]: CommonDeviceType.mobile,
      }
      let deviceType = deviceTypeMap[kind]

      dispatch(setCodePageOtherDeviceRole(kind))
      response.result(deviceType)
    }

    deviceDeviceAddRpc({
      ...makeWaitingHandler(dispatch),
      callback: (ignoredError, response) => {
        onBack()
      },
      incomingCallMap,
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
  // FIXME (mbg): The above usage of React components in the action code causes
  // a module dependency which prevents HMR. We can't hot reload action code,
  // so when these views (or more likely, their subcomponents from
  // common-adapters) change, HMR is unable to update the tree. We can band-aid
  // this by dynamically requiring these views as below, but they probably
  // won't hot reload properly until we decouple these action effects from the
  // view class implementations.

  function askForCodePage (cb, onBack) : AsyncAction {
    return dispatch => {
      const mapStateToProps = state => {
        const {
          mode, codeCountDown, textCode, qrCode,
          myDeviceRole, otherDeviceRole, cameraBrokenMode,
        } = state.login.codePage
        return {
          cameraBrokenMode,
          codeCountDown,
          mode,
          myDeviceRole,
          otherDeviceRole,
          qrCode: qrCode ? qrCode.stringValue() : '',
          textCode: textCode ? textCode.stringValue() : '',
        }
      }

      // This can be appended on either loginTab or devicesTab.
      dispatch(navigateAppend([{
        props: {
          doneRegistering: () => dispatch(doneRegistering()),
          mapStateToProps,
          onBack: onBack,
          qrScanned: code => cb(code.data),
          setCameraBrokenMode: broken => dispatch(setCameraBrokenMode(broken)),
          setCodePageMode: mode => dispatch(setCodePageMode(mode)),
          textEntered: text => cb(text),
        },
        selected: 'codePage',
      }]))
    }
  }

  return {
    'keybase.1.gpgUi.selectKey': (param, response) => {
      response.error(new RPCError('Not supported in GUI', ConstantsStatusCode.sckeynotfound))
    },
    'keybase.1.loginUi.displayPrimaryPaperKey': ({sessionID, phrase}, response) => {
      dispatch(navigateAppend([{
        props: {
          onBack: () => onBack(response),
          onFinish: () => { response.result() },
          paperkey: new HiddenString(phrase),
          title: 'Your new paper key!',
          waiting: false,
        },
        selected: 'success',
      }], [loginTab, 'login']))
    },
    'keybase.1.loginUi.getEmailOrUsername': (param, response) => {
      dispatch(navigateAppend([{
        props: {
          onBack: () => onBack(response),
          onSubmit: usernameOrEmail => response.result(usernameOrEmail),
        },
        selected: 'usernameOrEmail',
      }], [loginTab, 'login']))
    },
    'keybase.1.provisionUi.DisplayAndPromptSecret': ({phrase, secret}, response) => {
      dispatch({payload: {textCode: new HiddenString(phrase)}, type: Constants.setTextCode})
      generateQRCode(dispatch, getState)
      dispatch(askForCodePage(phrase => { response.result({phrase, secret: null}) }, () => onBack(response)))
    },
    'keybase.1.provisionUi.DisplaySecretExchanged': (param, response) => {
      response.result()
    },
    'keybase.1.provisionUi.PromptNewDeviceName': ({existingDevices, errorMessage}, response) => {
      dispatch(navigateAppend([{
        props: {
          deviceNameError: errorMessage,
          existingDevices,
          onBack: () => onBack(response),
          onSubmit: deviceName => { response.result(deviceName) },
        },
        selected: 'setPublicName',
      }], [loginTab, 'login']))
    },
    'keybase.1.provisionUi.ProvisioneeSuccess': (param, response) => {
      response.result()
    },
    'keybase.1.provisionUi.ProvisionerSuccess': (param, response) => {
      response.result()
      onProvisionerSuccess()
    },
    'keybase.1.provisionUi.chooseDevice': ({devices}, response) => {
      dispatch(navigateAppend([{
        props: {
          devices,
          onBack: () => onBack(response),
          onSelect: deviceID => {
            // $FlowIssue
            const type: DeviceType = (devices || []).find(d => d.deviceID === deviceID).type
            const role = ({
              desktop: Constants.codePageDeviceRoleExistingComputer,
              mobile: Constants.codePageDeviceRoleExistingPhone,
            }: {[key: DeviceType]: DeviceRole})[type]
            dispatch(setCodePageOtherDeviceRole(role))
            response.result(deviceID)
          },
          onWont: () => response.result(''),
        },
        selected: 'selectOtherDevice',
      }], [loginTab, 'login']))
    },
    'keybase.1.provisionUi.chooseGPGMethod': (param, response) => {
      dispatch(navigateAppend([{
        props: {
          onBack: () => onBack(response),
          onSubmit: exportKey => response.result(exportKey ? ProvisionUiGPGMethod.gpgImport : ProvisionUiGPGMethod.gpgSign),
        },
        selected: 'gpgSign',
      }], [loginTab, 'login']))
    },
    'keybase.1.secretUi.getPassphrase': ({pinentry: {type, prompt, username, retryLabel}}, response) => {
      switch (type) {
        case PassphraseCommonPassphraseType.paperKey:
          dispatch(navigateAppend([{
            props: {
              error: retryLabel,
              onBack: () => onBack(response),
              onSubmit: (passphrase: string) => { response.result({passphrase, storeSecret: false}) },
            },
            selected: 'paperkey',
          }], [loginTab, 'login']))
          break
        case PassphraseCommonPassphraseType.passPhrase:
          dispatch(navigateAppend([{
            props: {
              error: retryLabel,
              onBack: () => onBack(response),
              onSubmit: passphrase => response.result({
                passphrase,
                storeSecret: false,
              }),
              prompt,
              username,
            },
            selected: 'passphrase',
          }], [loginTab, 'login']))
          break
        default:
          response.error(new RPCError('Unknown getPassphrase type', ConstantsStatusCode.scnotfound))
      }
    },
  }
}
