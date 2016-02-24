/* @flow */
import * as Constants from '../../constants/login'
import {isMobile} from '../../constants/platform'
import {navigateTo, routeAppend} from '../router'
import engine from '../../engine'
import enums from '../../constants/types/keybase-v1'
import SelectOtherDevice from '../../login/register/select-other-device'
import UserPass from '../../login/register/user-pass'
import PaperKey from '../../login/register/paper-key'
import CodePage from '../../login/register/code-page'
import ExistingDevice from '../../login/register/existing-device'
import SetPublicName from '../../login/register/set-public-name'
import {switchTab} from '../tabbed-router'
import {devicesTab, loginTab} from '../../constants/tabs'
import {loadDevices} from '../devices'
import {defaultModeForDeviceRoles, qrGenerate} from './provision-helpers'
import {getCurrentStatus} from '../config'
import type {Dispatch, GetState, AsyncAction, TypedAction} from '../../constants/types/flux'
import type {incomingCallMapType, login_recoverAccountFromEmailAddress_rpc,
  login_login_rpc, login_logout_rpc, device_deviceAdd_rpc, login_getConfiguredAccounts_rpc} from '../../constants/types/flow-types'
import {mobileAppsExist} from '../../util/feature-flags'
import {overrideLoggedInTab} from '../../local-debug'
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
    startLoginFlow(dispatch, getState, enums.provisionUi.ProvisionMethod.device, 'Keybase username', 'lorem ipsum', Constants.loginDone)
  }
}

export function doneRegistering (): TypedAction<'login:doneRegistering', void, void> {
  // this has to be undefined for flow to match it to void
  return {type: Constants.doneRegistering, payload: undefined}
}

function setCodePageOtherDeviceRole (otherDeviceRole) : AsyncAction {
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
        username: '',
        clientType: enums.login.ClientType.gui
      },
      incomingCallMap: {},
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
        username: user,
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

// Show a user/pass screen, call cb() when done
// title/subTitle to customize the screen
function askForUserPass (title, subTitle, cb) : AsyncAction {
  return dispatch => {
    const props = {
      title,
      subTitle,
      mapStateToProps: state => state.login.userPass,
      onSubmit: (username, passphrase) => {
        dispatch({type: Constants.actionSetUserPass, payload: {username, passphrase: passphrase.stringValue()}})
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

function askForPaperKey (cb) : AsyncAction {
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
function askForDeviceName (existingDevices, cb) : AsyncAction {
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

function askForOtherDeviceType (cb) : AsyncAction {
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

export function registerWithExistingDevice () : AsyncAction {
  return (dispatch, getState) => {
    const provisionMethod = enums.provisionUi.ProvisionMethod.device
    startLoginFlow(dispatch, getState, provisionMethod, null, null, Constants.actionRegisteredWithExistingDevice)
  }
}

export function registerWithUserPass () : AsyncAction {
  return (dispatch, getState) => {
    const title = 'Registering with your Keybase passphrase'
    const subTitle = 'lorem ipsum lorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsum'
    const provisionMethod = enums.provisionUi.ProvisionMethod.passphrase
    startLoginFlow(dispatch, getState, provisionMethod, title, subTitle, Constants.actionRegisteredWithUserPass)
  }
}

function TEST_MOCK_SCREEN (dispatch) {
  dispatch(routeAppend({
    parseRoute: {
      componentAtTop: {
        component: SelectOtherDevice,
        props: {}}
    }
  }))
}

export function registerWithPaperKey () : AsyncAction {
  return (dispatch, getState) => {
    if (__DEV__) {
      TEST_MOCK_SCREEN(dispatch)
      return
    }

    const title = 'Registering with your paperkey requires your username'
    const subTitle = 'Different lorem ipsum lorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsum'
    const provisionMethod = enums.provisionUi.ProvisionMethod.paperKey
    startLoginFlow(dispatch, getState, provisionMethod, title, subTitle, Constants.actionRegisteredWithPaperKey)
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

function startLoginFlow (dispatch, getState, provisionMethod, userPassTitle, userPassSubtitle, successType) {
  const deviceType = isMobile ? 'mobile' : 'desktop'
  const incomingMap = makeKex2IncomingMap(dispatch, getState, provisionMethod, userPassTitle, userPassSubtitle)
  const params : login_login_rpc = {
    method: 'login.login',
    param: {
      deviceType,
      username: '',
      clientType: enums.login.ClientType.gui
    },
    incomingCallMap: incomingMap,
    callback: (error, response) => {
      currentLoginSessionID = null
      if (error) {
        dispatch({
          type: successType,
          error: true,
          payload: error
        })
      } else {
        dispatch({
          type: successType,
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

export function addANewDevice () : AsyncAction {
  return (dispatch, getState) => {
    const provisionMethod = enums.provisionUi.ProvisionMethod.device
    const userPassTitle = 'Registering a new device requires your Keybase username and passphrase'
    const userPassSubtitle = 'reggy lorem ipsum lorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsumlorem ipsum'
    const incomingMap = makeKex2IncomingMap(dispatch, getState, provisionMethod, userPassTitle, userPassSubtitle)
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

function makeKex2IncomingMap (dispatch, getState, provisionMethod, userPassTitle, userPassSubtitle) : incomingCallMapType {
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
    'keybase.1.secretUi.getPassphrase': ({pinentry: {type}}, response) => {
      switch (type) {
        case enums.secretUi.PassphraseType.paperKey: {
          dispatch(askForPaperKey(paperKey => {
            response.result({
              passphrase: paperKey,
              storeSecret: false
            })
          }))
          break
        }
        case enums.secretUi.PassphraseType.passPhrase: {
          // TODO
          break
        }
        case enums.secretUi.PassphraseType.verifyPassPhrase: {
          // TODO
          break
        }
        default:
          response.error('Unknown getPassphrase type')
      }
    },
    // 'keybase.1.secretUi.getKeybasePassphrase': (param, response) => {
      // const {passphrase} = getState().login.userPass
      // if (!passphrase) {
        // dispatch(askForUserPass(userPassTitle, userPassSubtitle, () => {
          // const {passphrase} = getState().login.userPass
          // response.result({passphrase: passphrase.stringValue(), storeSecret: false})
        // }))
      // } else {
        // response.result({passphrase, storeSecret: false})
      // }
    // },
    // 'keybase.1.secretUi.getSecret': (param, response) => {
      // const {passphrase} = getState().login.userPass
      // if (!passphrase) {
        // dispatch(askForUserPass(userPassTitle, userPassSubtitle, () => {
          // const {passphrase} = getState().login.userPass
          // response.result({
            // text: passphrase.stringValue(),
            // canceled: false,
            // storeSecret: true
          // })
        // }))
      // } else {
        // response.result({
          // text: passphrase.stringValue(),
          // canceled: false,
          // storeSecret: true
        // })
      // }
    // },
    'keybase.1.provisionUi.PromptNewDeviceName': ({existingDevices}, response) => {
      dispatch(askForDeviceName(existingDevices, () => {
        const {deviceName} = getState().login.deviceName
        response.result(deviceName)
      }))
    },
    'keybase.1.provisionUi.ProvisioneeSuccess': (param, response) => {
      response.result()
    },
    'keybase.1.provisionUi.ProvisionerSuccess': (param, response) => {
      response.result()

      dispatch(navBasedOnLoginState())
    },
    'keybase.1.provisionUi.chooseDeviceType': (param, response) => {
      const onSubmit = type => {
        const typeMap = {
          [Constants.codePageDeviceRoleExistingPhone]: enums.provisionUi.DeviceType.mobile,
          [Constants.codePageDeviceRoleExistingComputer]: enums.provisionUi.DeviceType.desktop
        }

        dispatch(setCodePageOtherDeviceRole(type))
        response.result(typeMap[type])
      }

      if (!mobileAppsExist) {
        onSubmit(Constants.codePageDeviceRoleExistingComputer)
      } else {
        dispatch(askForOtherDeviceType(onSubmit))
      }
    },
    'keybase.1.provisionUi.DisplayAndPromptSecret': ({phrase, secret}, response) => {
      dispatch({type: Constants.setTextCode, payload: phrase})
      generateQRCode(dispatch, getState)
      dispatch(askForCodePage(phrase => { response.result({phrase, secret: null}) }))
    },
    'keybase.1.provisionUi.DisplaySecretExchanged': (param, response) => {
      response.result()
    }
  }
}
