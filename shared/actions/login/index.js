// @flow
import * as CommonConstants from '../../constants/common'
import * as Constants from '../../constants/login'
import HiddenString from '../../util/hidden-string'
import engine from '../../engine'
import openURL from '../../util/open-url'
import type {DeviceRole} from '../../constants/login'
import type {DeviceType} from '../../constants/types/more'
import type {Dispatch, GetState, AsyncAction, TypedAction, Action} from '../../constants/types/flux'
import type {incomingCallMapType, DeviceType as RPCDeviceType} from '../../constants/types/flow-types'
import type {ResponseType} from '../../engine'
import {bootstrap} from '../config'
import {defaultModeForDeviceRoles, qrGenerate} from './provision-helpers'
import {devicesTab, loginTab} from '../../constants/tabs'
import {isMobile} from '../../constants/platform'
import {loadDevices} from '../devices'
import {loginRecoverAccountFromEmailAddressRpc, loginLoginRpc, loginLogoutRpc,
  deviceDeviceAddRpc, loginGetConfiguredAccountsRpc, CommonClientType,
  ConstantsStatusCode, ProvisionUiGPGMethod, CommonDeviceType,
  PassphraseCommonPassphraseType,
} from '../../constants/types/flow-types'
import {navigateTo, navigateAppend} from '../route-tree'
import {overrideLoggedInTab} from '../../local-debug'
import {RPCError} from '../../util/errors'

module.hot && module.hot.accept(() => {
  console.log('accepted update in actions/login')
})

const InputCancelError = {desc: 'Cancel Login', code: ConstantsStatusCode.scinputcanceled}

function makeWaitingHandler (dispatch: Dispatch): {waitingHandler: (waiting: boolean) => void} {
  return {
    waitingHandler: (waiting: boolean) => { dispatch(waitingForResponse(waiting)) },
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
          dispatch(navigateTo([devicesTab]))
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
  return (dispatch, getState) => {
    function loginSubmit (usernameOrEmail: string) {
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

            if (error.code !== InputCancelError.code) {
              dispatch(navigateAppend([{
                selected: 'error',
                error,
                onBack: () => dispatch(cancelLogin()),
              }], [loginTab, 'login']))
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
    dispatch(navigateAppend([{
      selected: 'usernameOrEmail',
      onBack: () => dispatch(cancelLogin()),
      onSubmit: loginSubmit,
    }], [loginTab, 'login']))
  }
}

export function setRevokedSelf (revoked: string) {
  return {type: Constants.setRevokedSelf, payload: revoked}
}

export function setDeletedSelf (deletedUsername: string) {
  return {type: Constants.setDeletedSelf, payload: deletedUsername}
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
    if (store.myDeviceRole == null) {
      console.warn("my device role is null, can't setCodePageOtherDeviceRole. Bailing")
      return
    }
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
          response.error(new RPCError('Attempting auto login', ConstantsStatusCode.scnoui))
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
          response.error(new RPCError(message, ConstantsStatusCode.scgeneric))
          dispatch({
            type: Constants.loginDone,
            error: true,
            payload: {message},
          })
          dispatch(setLoginFromRevokedDevice(message))
          dispatch(navigateTo([loginTab]))
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
      type: Constants.setMyDeviceCodeState,
      payload:
        isMobile ? Constants.codePageDeviceRoleExistingPhone : Constants.codePageDeviceRoleExistingComputer,
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
          mode,
          codeCountDown,
          textCode: textCode ? textCode.stringValue() : '',
          qrCode: qrCode ? qrCode.stringValue() : '',
          myDeviceRole,
          otherDeviceRole,
          cameraBrokenMode,
        }
      }

      dispatch(navigateAppend([{
        selected: 'codePage',
        mapStateToProps,
        onBack: onBack,
        setCodePageMode: mode => dispatch(setCodePageMode(mode)),
        qrScanned: code => cb(code.data),
        setCameraBrokenMode: broken => dispatch(setCameraBrokenMode(broken)),
        textEntered: text => cb(text),
        doneRegistering: () => dispatch(doneRegistering()),
      }]))
    }
  }

  return {
    'keybase.1.loginUi.getEmailOrUsername': (param, response) => {
      dispatch(navigateAppend([{
        selected: 'usernameOrEmail',
        onSubmit: usernameOrEmail => response.result(usernameOrEmail),
        onBack: () => onBack(response),
      }], [loginTab, 'login']))
    },
    'keybase.1.provisionUi.chooseDevice': ({devices}, response) => {
      dispatch(navigateAppend([{
        selected: 'selectOtherDevice',
        devices,
        onSelect: deviceID => {
          // $FlowIssue
          const type: DeviceType = (devices || []).find(d => d.deviceID === deviceID).type
          const role = ({
            mobile: Constants.codePageDeviceRoleExistingPhone,
            desktop: Constants.codePageDeviceRoleExistingComputer,
          }: {[key: DeviceType]: DeviceRole})[type]
          dispatch(setCodePageOtherDeviceRole(role))
          response.result(deviceID)
        },
        onWont: () => response.result(''),
        onBack: () => onBack(response),
      }], [loginTab, 'login']))
    },
    'keybase.1.secretUi.getPassphrase': ({pinentry: {type, prompt, username, retryLabel}}, response) => {
      switch (type) {
        case PassphraseCommonPassphraseType.paperKey:
          dispatch(navigateAppend([{
            selected: 'paperkey',
            onSubmit: (passphrase: string) => { response.result({passphrase, storeSecret: false}) },
            onBack: () => onBack(response),
            error: retryLabel,
          }], [loginTab, 'login']))
          break
        case PassphraseCommonPassphraseType.passPhrase:
          dispatch(navigateAppend([{
            selected: 'passphrase',
            prompt,
            onSubmit: passphrase => response.result({
              passphrase,
              storeSecret: false,
            }),
            onBack: () => onBack(response),
            error: retryLabel,
            username,
          }], [loginTab, 'login']))
          break
        default:
          response.error(new RPCError('Unknown getPassphrase type', ConstantsStatusCode.scnotfound))
      }
    },
    'keybase.1.provisionUi.DisplayAndPromptSecret': ({phrase, secret}, response) => {
      dispatch({type: Constants.setTextCode, payload: {textCode: new HiddenString(phrase)}})
      generateQRCode(dispatch, getState)
      dispatch(askForCodePage(phrase => { response.result({phrase, secret: null}) }, () => onBack(response)))
    },
    'keybase.1.provisionUi.PromptNewDeviceName': ({existingDevices, errorMessage}, response) => {
      dispatch(navigateAppend([{
        selected: 'setPublicName',
        existingDevices,
        deviceNameError: errorMessage,
        onSubmit: deviceName => { response.result(deviceName) },
        onBack: () => onBack(response),
      }], [loginTab, 'login']))
    },
    'keybase.1.provisionUi.chooseGPGMethod': (param, response) => {
      dispatch(navigateAppend([{
        selected: 'gpgSign',
        onSubmit: exportKey => response.result(exportKey ? ProvisionUiGPGMethod.gpgImport : ProvisionUiGPGMethod.gpgSign),
        onBack: () => onBack(response),
      }], [loginTab, 'login']))
    },
    'keybase.1.loginUi.displayPrimaryPaperKey': ({sessionID, phrase}, response) => {
      dispatch(navigateAppend([{
        selected: 'success',
        paperKey: new HiddenString(phrase),
        waiting: false,
        onFinish: () => { response.result() },
        onBack: () => onBack(response),
        title: 'Your new paper key!',
      }], [loginTab, 'login']))
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
    'keybase.1.gpgUi.selectKey': (param, response) => {
      response.error(new RPCError('Not supported in GUI', ConstantsStatusCode.sckeynotfound))
    },
  }
}
