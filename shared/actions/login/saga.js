// @flow
// Look at this doc: https://goo.gl/7B6p4H

import * as CommonConstants from '../../constants/common'
import * as RouteConstants from '../../constants/route-tree'
import * as Constants from '../../constants/login'
import * as DeviceConstants from '../../constants/devices'
import * as Types from '../../constants/types/flow-types'
import * as Creators from './creators'
import * as EngineRpc from '../engine/helper'
import HiddenString from '../../util/hidden-string'
import {RPCError} from '../../util/errors'
import {bootstrap, clearRouteState, getExtendedStatus} from '../config'
import {appLink} from '../app'
import {defaultModeForDeviceRoles} from './provision-helpers'
import openURL from '../../util/open-url'
import type {InitialState} from '../../constants/config'
import {chatTab, loginTab, peopleTab, isValidInitialTab} from '../../constants/tabs'
import {isMobile} from '../../constants/platform'
import {load as loadDevices, setWaiting as setDevicesWaiting, devicesTabLocation} from '../devices'
import {setDeviceNameError} from '../signup'
import {deletePushTokenSaga} from '../push'
import {selectConversation} from '../chat/creators'
import {pathSelector, navigateTo, navigateAppend} from '../route-tree'
import {overrideLoggedInTab} from '../../local-debug'
import {toDeviceType} from '../../constants/types/more'
import {all, call, put, take, race, select} from 'redux-saga/effects'
import * as Saga from '../../util/saga'

import type {DeviceRole} from '../../constants/login'
import type {DeviceType} from '../../constants/types/more'
import type {Dispatch, AsyncAction} from '../../constants/types/flux'
import type {SagaGenerator, AfterSelect} from '../../constants/types/saga'
import type {TypedState} from '../../constants/reducer'

const deviceType: DeviceType = isMobile ? 'mobile' : 'desktop'
const InputCancelError = {
  code: Types.ConstantsStatusCode.scinputcanceled,
  desc: 'Cancel Login',
}

const codePageSelector = ({login: {codePage}}: TypedState) => codePage

function* generateQRCode() {
  const codePage: AfterSelect<typeof codePageSelector> = yield select(codePageSelector)

  if (codePage.textCode) {
    yield put(Creators.setQRCode(codePage.textCode.stringValue()))
  }
}

// TODO add waiting handlers
// TODO sagaize
const makeWaitingHandler = (dispatch: Dispatch): {waitingHandler: (waiting: boolean) => void} => ({
  waitingHandler: (waiting: boolean) => {
    dispatch(Creators.waitingForResponse(waiting))
  },
})

const getAccounts = (): AsyncAction => dispatch =>
  new Promise((resolve, reject) => {
    Types.loginGetConfiguredAccountsRpcPromise({...makeWaitingHandler(dispatch)})
      .then(accounts => {
        dispatch({payload: {accounts}, type: Constants.configuredAccounts})
        resolve()
      })
      .catch(error => {
        if (error) {
          dispatch({
            error: true,
            payload: error,
            type: Constants.configuredAccounts,
          })
          reject(error)
        }
      })
  })

function* setCodePageOtherDeviceRole(otherDeviceRole: DeviceRole) {
  const codePage: AfterSelect<typeof codePageSelector> = yield select(codePageSelector)
  if (codePage.myDeviceRole == null) {
    console.warn("my device role is null, can't setCodePageOtherDeviceRole. Bailing")
    return
  }

  const mode = defaultModeForDeviceRoles(codePage.myDeviceRole, otherDeviceRole, false)
  if (!mode) {
    console.warn("mode is null!, can't setCodePageMode. Bailing")
    return
  }

  yield put(Creators.setCodePageMode(mode))
  yield put(Creators.setOtherDeviceCodeState(otherDeviceRole))
}

function* navBasedOnLoginAndInitialState(): SagaGenerator<any, any> {
  const selector = ({
    config: {loggedIn, registered, initialState},
    login: {justDeletedSelf, loginError},
    routeTree: {loggedInUserNavigated},
  }: TypedState) => ({
    loggedIn,
    registered,
    initialState,
    justDeletedSelf,
    loginError,
    loggedInUserNavigated,
  })

  const args = yield select(selector)

  console.log('[RouteState] navBasedOnLoginAndInitialState:', args)

  const {loggedIn, registered, initialState, justDeletedSelf, loginError, loggedInUserNavigated} = args

  // All branches except for when loggedIn is true,
  // loggedInUserNavigated is false, and and initialState is null must
  // finish by yielding an action which sets
  // state.routeTree.loggedInUserNavigated to true; see
  // loggedInUserNavigatedReducer.
  if (justDeletedSelf) {
    yield put(navigateTo([loginTab]))
  } else if (loggedIn) {
    // If the user has already performed a navigation action, or if
    // we've already applied the initialState, do nothing.
    if (loggedInUserNavigated) {
      return
    }

    if (overrideLoggedInTab) {
      yield put(navigateTo([overrideLoggedInTab]))
    } else if (initialState) {
      const {url, tab, conversation} = (initialState: InitialState)
      if (url) {
        yield put(appLink(url))
      } else if (tab && isValidInitialTab(tab)) {
        if (tab === chatTab && conversation) {
          yield put(selectConversation(conversation, false))
          yield put(navigateTo([chatTab], null, 'initial-restore'))
        } else {
          yield put(navigateTo([tab], null, 'initial-restore'))
        }
      } else {
        yield put(navigateTo([peopleTab], null, 'initial-restore'))
      }
    } else {
      // If the initial state is not set yet, navigate to the people
      // tab without setting state.routeTree.loggedInUserNavigated to true.
      yield put(navigateTo([peopleTab], null, 'initial-default'))
    }
  } else if (registered) {
    // relogging in
    yield all([put.resolve(getExtendedStatus()), put.resolve(getAccounts())])
    yield put(navigateTo(['login'], [loginTab]))
  } else if (loginError) {
    // show error on login screen
    yield put(navigateTo(['login'], [loginTab]))
  } else {
    // no idea
    yield put(navigateTo([loginTab]))
  }
}

const kex2Sagas = (onBackSaga, provisionerSuccessSaga, getPassphraseSaga = defaultGetPassphraseSaga) => ({
  'keybase.1.gpgUi.selectKey': selectKeySaga,
  'keybase.1.loginUi.displayPrimaryPaperKey': displayPrimaryPaperKeySaga(onBackSaga),
  'keybase.1.loginUi.getEmailOrUsername': getEmailOrUsernameSaga(onBackSaga),
  'keybase.1.provisionUi.DisplayAndPromptSecret': displayAndPromptSecretSaga(onBackSaga),
  'keybase.1.provisionUi.DisplaySecretExchanged': EngineRpc.passthroughResponseSaga,
  'keybase.1.provisionUi.PromptNewDeviceName': promptNewDeviceNameSaga(onBackSaga),
  'keybase.1.provisionUi.ProvisioneeSuccess': EngineRpc.passthroughResponseSaga,
  'keybase.1.provisionUi.ProvisionerSuccess': provisionerSuccessSaga,
  'keybase.1.provisionUi.chooseDevice': chooseDeviceSaga(onBackSaga),
  'keybase.1.provisionUi.chooseGPGMethod': chooseGPGMethodSaga(onBackSaga),
  'keybase.1.secretUi.getPassphrase': getPassphraseSaga(onBackSaga),
})

function* cancelLogin() {
  const getNumAccounts = (state: TypedState) =>
    state.login.configuredAccounts && state.login.configuredAccounts.length
  const numAccounts = yield select(getNumAccounts)

  const route = numAccounts ? ['login'] : []
  yield put(navigateTo(route, [loginTab]))
}

function* selectKeySaga() {
  return EngineRpc.rpcError(new RPCError('Not supported in GUI', Types.ConstantsStatusCode.sckeynotfound))
}

const displayPrimaryPaperKeySaga = onBackSaga =>
  function*({phrase}) {
    yield put(
      navigateAppend(
        [
          {
            props: {
              paperkey: new HiddenString(phrase),
              title: 'Your new paper key!',
              waiting: false,
            },
            selected: 'success',
          },
        ],
        [loginTab, 'login']
      )
    )

    const {onBack, navUp, onFinish} = yield race({
      onBack: take(Constants.onBack),
      navUp: take(RouteConstants.navigateUp),
      onFinish: take(Constants.onFinish),
    })

    if (onBack || navUp) {
      yield call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (onFinish) {
      return EngineRpc.rpcResult()
    }
  }

const getEmailOrUsernameSaga = onBackSaga =>
  function*() {
    yield put(
      navigateAppend(
        [
          {
            props: {},
            selected: 'usernameOrEmail',
          },
        ],
        [loginTab, 'login']
      )
    )

    const {onBack, navUp, onSubmit} = yield race({
      onBack: take(Constants.onBack),
      navUp: take(RouteConstants.navigateUp),
      onSubmit: take(Constants.submitUsernameOrEmail),
    })

    if (onBack || navUp) {
      yield call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (onSubmit) {
      const usernameOrEmail = onSubmit.payload.usernameOrEmail
      if (!usernameOrEmail) {
        console.error('no email')
      }
      return EngineRpc.rpcResult(usernameOrEmail)
    }
  }

// TODO type this
type DisplayAndPromptSecretArgs = any
const displayAndPromptSecretSaga = onBackSaga =>
  function*({phrase, previousErr}: DisplayAndPromptSecretArgs) {
    yield put(Creators.setTextCode(phrase, previousErr))
    yield call(generateQRCode)

    // If we have an error, we're already on the right page.
    if (!previousErr) {
      yield put(navigateAppend(['codePage']))
    }

    const {textEntered, qrScanned, onBack, navUp} = yield race({
      onBack: take(Constants.onBack),
      navUp: take(RouteConstants.navigateUp),
      qrScanned: take(Constants.qrScanned),
      textEntered: take(Constants.provisionTextCodeEntered),
    })

    if (onBack || navUp) {
      yield call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (qrScanned || textEntered) {
      const phrase = qrScanned ? qrScanned.payload.phrase : textEntered.payload.phrase
      return EngineRpc.rpcResult({phrase, secret: null})
    }
  }

const promptNewDeviceNameSaga = onBackSaga =>
  function*({existingDevices, errorMessage}) {
    yield put(setDeviceNameError(errorMessage))
    yield put(
      navigateAppend(
        [
          {
            props: {
              existingDevices,
            },
            selected: 'setPublicName',
          },
        ],
        [loginTab, 'login']
      )
    )

    const {onBack, navUp, onSubmit} = yield race({
      onBack: take(Constants.onBack),
      navUp: take(RouteConstants.navigateUp),
      onSubmit: take(Constants.submitDeviceName),
    })

    if (onBack || navUp) {
      yield call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (onSubmit) {
      return EngineRpc.rpcResult(onSubmit.payload.deviceName)
    }
  }

// TODO change types in flow-types to generate this
const chooseDeviceSaga = onBackSaga =>
  function*({devices, canSelectNoDevice}: {devices: Array<Types.Device>, canSelectNoDevice: boolean}) {
    yield put(
      navigateAppend(
        [
          {
            props: {devices, canSelectNoDevice},
            selected: 'selectOtherDevice',
          },
        ],
        [loginTab, 'login']
      )
    )

    const {onBack, navUp, onWont, onSelect} = yield race({
      onBack: take(Constants.onBack),
      navUp: take(RouteConstants.navigateUp),
      onWont: take(Constants.onWont),
      onSelect: take(Constants.selectDeviceId),
    })

    if (onBack || navUp) {
      yield call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (onWont) {
      return EngineRpc.rpcResult('')
    } else if (onSelect) {
      const deviceID = onSelect.payload.deviceId
      const device = (devices || []).find(d => d.deviceID === deviceID)
      if (device) {
        const role = ({
          desktop: Constants.codePageDeviceRoleExistingComputer,
          mobile: Constants.codePageDeviceRoleExistingPhone,
        }: {[key: DeviceType]: DeviceRole})[toDeviceType(device.type)]
        if (role) {
          yield call(setCodePageOtherDeviceRole, role)
        }
        return EngineRpc.rpcResult(deviceID)
      }
    }
  }

const chooseGPGMethodSaga = onBackSaga =>
  function*() {
    yield put(navigateAppend(['gpgSign'], [loginTab, 'login']))

    const {onBack, navUp, onSubmit} = yield race({
      onBack: take(Constants.onBack),
      navUp: take(RouteConstants.navigateUp),
      onSubmit: take(Constants.chooseGPGMethod),
    })

    if (onBack || navUp) {
      yield call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (onSubmit) {
      const exportKey = onSubmit.payload.exportKey

      return EngineRpc.rpcResult(
        exportKey ? Types.ProvisionUiGPGMethod.gpgImport : Types.ProvisionUiGPGMethod.gpgSign
      )
    }
  }

const defaultGetPassphraseSaga = onBackSaga =>
  function*({pinentry: {type, prompt, username, retryLabel}}) {
    switch (type) {
      case Types.PassphraseCommonPassphraseType.paperKey:
        const destination = {
          props: {
            error: retryLabel,
          },
          selected: 'paperkey',
        }

        const currentPath = yield select(pathSelector)
        if (currentPath.last() === 'paperkey') {
          yield put(navigateTo(currentPath.pop(1).push(destination)))
        } else {
          yield put(navigateAppend([destination], [loginTab, 'login']))
        }
        break
      case Types.PassphraseCommonPassphraseType.passPhrase:
        yield put(
          navigateAppend(
            [
              {
                props: {
                  error: retryLabel,
                  prompt,
                  username,
                },
                selected: 'passphrase',
              },
            ],
            [loginTab, 'login']
          )
        )
        break
      default:
        return EngineRpc.rpcError(
          new RPCError('Unknown getPassphrase type', Types.ConstantsStatusCode.scnotfound)
        )
    }

    const {onBack, navUp, onSubmit} = yield race({
      onBack: take(Constants.onBack),
      navUp: take(RouteConstants.navigateUp),
      onSubmit: take(Constants.submitPassphrase),
    })

    if (onBack || navUp) {
      yield call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (onSubmit) {
      const passphrase = onSubmit.payload.passphrase.stringValue()
      // TODO why is store secret always false?
      const storeSecret = onSubmit.payload.storeSecret
      return EngineRpc.rpcResult({passphrase, storeSecret})
    }
  }

function* handleProvisioningError(error) {
  yield put(Creators.provisioningError(error))
  yield put(
    navigateAppend(
      [
        {
          props: {
            error,
          },
          selected: 'error',
        },
      ],
      [loginTab, 'login']
    )
  )
  yield race({onBack: take(Constants.onBack), navUp: take(RouteConstants.navigateUp)})
  yield call(cancelLogin)
}

function* loginFlowSaga(usernameOrEmail, passphrase) {
  // If there is passphrase, use that.
  const passphraseSaga = passphrase
    ? onBackSaga => () => EngineRpc.rpcResult({passphrase: passphrase.stringValue(), storeSecret: false})
    : defaultGetPassphraseSaga

  const loginSagas = kex2Sagas(cancelLogin, EngineRpc.passthroughResponseSaga, passphraseSaga)

  const loginRpcCall = new EngineRpc.EngineRpcCall(loginSagas, Types.loginLoginRpcChannelMap, 'loginRpc', {
    param: {
      deviceType,
      usernameOrEmail,
      clientType: Types.CommonClientType.guiMain,
    },
  })

  try {
    const result = yield call(loginRpcCall.run)

    if (EngineRpc.isFinished(result)) {
      const {error} = result.payload

      if (error) {
        console.log(error)
        yield call(handleProvisioningError, error)
      } else {
        yield put(Creators.loginDone())
        yield call(navBasedOnLoginAndInitialState)
      }
    } else if (result === EngineRpc.BailedEarly) {
      console.log('Bailed early')
      yield put(navigateTo(['login'], [loginTab]))
    } else {
      yield put(navigateTo(['login'], [loginTab]))
    }
  } catch (error) {
    yield call(handleProvisioningError, error)
    console.log('DEBUG: error in loginRPC:', error)
  }
}

function* initalizeMyCodeStateForLogin() {
  // We can either be a newDevice or an existingDevice. Here in the login
  // flow, let's set ourselves to be a newDevice
  yield put(
    Creators.setMyDeviceCodeState(
      isMobile ? Constants.codePageDeviceRoleNewPhone : Constants.codePageDeviceRoleNewComputer
    )
  )
}

function* initalizeMyCodeStateForAddingADevice() {
  // We can either be a newDevice or an existingDevice. Here in the adding a device
  // flow, let's set ourselves to be an existing device
  yield put(
    Creators.setMyDeviceCodeState(
      isMobile ? Constants.codePageDeviceRoleExistingPhone : Constants.codePageDeviceRoleExistingComputer
    )
  )
}

function* startLoginSaga() {
  yield put(Creators.setLoginFromRevokedDevice(''))
  yield put(Creators.setRevokedSelf(''))
  yield put(Creators.setDeletedSelf(''))
  yield put(navigateTo(['login', 'usernameOrEmail'], [loginTab]))

  yield call(initalizeMyCodeStateForLogin)

  const {onBack, navUp, onSubmit} = yield race({
    onBack: take(Constants.onBack),
    navUp: take(RouteConstants.navigateUp),
    onSubmit: take(Constants.submitUsernameOrEmail),
  })

  if (onBack || navUp) {
    yield call(cancelLogin)
  } else if (onSubmit) {
    const usernameOrEmail = onSubmit.payload.usernameOrEmail
    yield call(loginFlowSaga, usernameOrEmail)
  }
}

function* reloginSaga({payload: {usernameOrEmail, passphrase}}: Constants.Relogin) {
  yield put(Creators.setLoginFromRevokedDevice(''))
  yield put(Creators.setRevokedSelf(''))
  yield put(Creators.setDeletedSelf(''))

  yield call(initalizeMyCodeStateForLogin)
  yield call(loginFlowSaga, usernameOrEmail, passphrase)
}

function* cameraBrokenModeSaga({payload: {broken}}) {
  const codePage: AfterSelect<typeof codePageSelector> = yield select(codePageSelector)
  if (codePage.myDeviceRole == null) {
    console.warn("my device role is null, can't setCameraBrokenMode. Bailing")
    return
  }

  if (codePage.otherDeviceRole == null) {
    console.warn("other device role is null, can't setCameraBrokenMode. Bailing")
    return
  }

  const mode = defaultModeForDeviceRoles(codePage.myDeviceRole, codePage.otherDeviceRole, broken)
  if (!mode) {
    console.warn("mode is null!, can't setCodePageMode. Bailing")
    return
  }
  yield put(Creators.setCodePageMode(mode))
}

const _deviceTypeMap: {[key: string]: any} = {
  [Constants.codePageDeviceRoleNewComputer]: Types.CommonDeviceType.desktop,
  [Constants.codePageDeviceRoleNewPhone]: Types.CommonDeviceType.mobile,
}

function secretExchangedSaga() {
  return function*() {
    yield put(Creators.clearQRCode())
    return EngineRpc.rpcResult()
  }
}

function chooseDeviceTypeSaga(role) {
  return function*() {
    const deviceType = _deviceTypeMap[role]
    yield call(setCodePageOtherDeviceRole, role)
    return EngineRpc.rpcResult(deviceType)
  }
}

function* addNewDeviceSaga({payload: {role}}: DeviceConstants.AddNewDevice) {
  yield put(setDevicesWaiting(true))
  yield call(initalizeMyCodeStateForAddingADevice)

  const onBackSaga = function*() {
    yield put(loadDevices())
    yield put(navigateTo(devicesTabLocation))
  }

  const addDeviceSagas = {
    ...kex2Sagas(onBackSaga, onBackSaga),
    'keybase.1.provisionUi.chooseDeviceType': chooseDeviceTypeSaga(role),
    'keybase.1.provisionUi.DisplaySecretExchanged': secretExchangedSaga(),
  }

  const addDeviceRpc = new EngineRpc.EngineRpcCall(
    addDeviceSagas,
    Types.deviceDeviceAddRpcChannelMap,
    'addDeviceRpc',
    {}
  )

  try {
    yield call(addDeviceRpc.run)
  } catch (error) {
    console.warn('error in adding device')
  }

  yield call(onBackSaga)
  yield put(setDevicesWaiting(false))
}

function* openAccountResetPageSaga() {
  yield call(openURL, 'https://keybase.io/#password-reset')
}

function* logoutDoneSaga() {
  yield put({payload: undefined, type: CommonConstants.resetStore})

  yield call(navBasedOnLoginAndInitialState)
  yield put(bootstrap())
}

function* logoutSaga() {
  yield all([call(deletePushTokenSaga), put(clearRouteState)])

  // Add waiting handler
  const chanMap = Types.loginLogoutRpcChannelMap(['finished'], {})
  const incoming = yield chanMap.take('finished')
  if (incoming.error) {
    console.log(incoming.error)
  } else {
    yield put(Creators.logoutDone())
  }
}

function* loginSaga(): SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(Constants.startLogin, startLoginSaga)
  yield Saga.safeTakeLatest(Constants.cameraBrokenMode, cameraBrokenModeSaga)
  yield Saga.safeTakeLatest(Constants.setCodeMode, generateQRCode)
  yield Saga.safeTakeLatest(Constants.relogin, reloginSaga)
  yield Saga.safeTakeLatest(Constants.openAccountResetPage, openAccountResetPageSaga)
  yield Saga.safeTakeLatest(Constants.navBasedOnLoginAndInitialState, navBasedOnLoginAndInitialState)
  yield Saga.safeTakeLatest(Constants.logoutDone, logoutDoneSaga)
  yield Saga.safeTakeLatest(Constants.logout, logoutSaga)
  yield Saga.safeTakeLatest('device:addNewDevice', addNewDeviceSaga)
}

export default loginSaga
