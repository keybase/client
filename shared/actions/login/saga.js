// @flow
// Look at this doc: https://goo.gl/7B6p4H

import * as CommonConstants from '../../constants/common'
import * as Constants from '../../constants/login'
import * as DeviceConstants from '../../constants/devices'
import * as Types from '../../constants/types/flow-types'
import * as Creators from './creators'
import HiddenString from '../../util/hidden-string'
import engine from '../../engine'
import {RPCError} from '../../util/errors'
import {bootstrap, setInitialTab, getExtendedStatus, setInitialLink} from '../config'
import {appLink} from '../app'
import {defaultModeForDeviceRoles} from './provision-helpers'
import openURL from '../../util/open-url'
import {loginTab, profileTab, isValidInitialTab} from '../../constants/tabs'
import {isMobile} from '../../constants/platform'
import {load as loadDevices, setWaiting as setDevicesWaiting, devicesTabLocation} from '../devices'
import {deletePushTokenSaga} from '../push'
import {configurePush} from '../push/creators'
import {pathSelector, navigateTo, navigateAppend} from '../route-tree'
import {overrideLoggedInTab} from '../../local-debug'
import {toDeviceType} from '../../constants/types/more'
import {call, put, take, race, select} from 'redux-saga/effects'
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
    Types.loginGetConfiguredAccountsRpc({
      ...makeWaitingHandler(dispatch),
      callback: (error, accounts) => {
        if (error) {
          dispatch({
            error: true,
            payload: error,
            type: Constants.configuredAccounts,
          })
          reject(error)
          return
        }
        dispatch({payload: {accounts}, type: Constants.configuredAccounts})
        resolve()
      },
    })
  })

function sagaWaitingDecorator(saga) {
  return function*(...args) {
    yield put(Creators.waitingForResponse(false))
    yield call(saga, ...args)
    yield put(Creators.waitingForResponse(true))
  }
}

function clearWaitingDecorator(saga) {
  return function*(...args) {
    yield call(saga, ...args)
    yield put(Creators.waitingForResponse(false))
  }
}

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

function* navBasedOnLoginState() {
  const selector = ({
    config: {loggedIn, registered, initialTab, initialLink, launchedViaPush},
    login: {justDeletedSelf, loginError},
  }: TypedState) => ({
    loggedIn,
    registered,
    initialTab,
    initialLink,
    justDeletedSelf,
    launchedViaPush,
    loginError,
  })

  const {
    loggedIn,
    registered,
    initialTab,
    initialLink,
    justDeletedSelf,
    launchedViaPush,
    loginError,
  } = yield select(selector)

  if (justDeletedSelf) {
    yield put(navigateTo([loginTab]))
  } else if (loggedIn) {
    if (overrideLoggedInTab) {
      console.log('Loading overridden logged in tab')
      yield put(navigateTo([overrideLoggedInTab]))
    } else if (initialLink) {
      yield put(setInitialLink(null))
      yield put(appLink(initialLink))
    } else if (initialTab && isValidInitialTab(initialTab)) {
      // only do this once
      yield put(setInitialTab(null))
      if (!launchedViaPush) {
        yield put(navigateTo([initialTab]))
      }
    } else {
      yield put(navigateTo([profileTab]))
    }
  } else if (registered) {
    // relogging in
    yield [put.resolve(getExtendedStatus()), put.resolve(getAccounts())]
    yield put(navigateTo(['login'], [loginTab]))
  } else if (loginError) {
    // show error on login screen
    yield put(navigateTo(['login'], [loginTab]))
  } else {
    // no idea
    yield put(navigateTo([loginTab]))
  }
}

const kex2Sagas = (onBackSaga, provisionerSuccessSaga, finishedSaga) => {
  const onBackSagaDecorated = clearWaitingDecorator(onBackSaga)
  return {
    'keybase.1.gpgUi.selectKey': sagaWaitingDecorator(selectKeySaga),
    'keybase.1.loginUi.displayPrimaryPaperKey': sagaWaitingDecorator(
      displayPrimaryPaperKeySaga(onBackSagaDecorated)
    ),
    'keybase.1.loginUi.getEmailOrUsername': sagaWaitingDecorator(
      getEmailOrUsernameSaga(onBackSagaDecorated)
    ),
    'keybase.1.provisionUi.DisplayAndPromptSecret': sagaWaitingDecorator(
      displayAndPromptSecretSaga(onBackSagaDecorated)
    ),
    'keybase.1.provisionUi.DisplaySecretExchanged': sagaWaitingDecorator(passthroughResponseSaga),
    'keybase.1.provisionUi.PromptNewDeviceName': sagaWaitingDecorator(
      promptNewDeviceNameSaga(onBackSagaDecorated)
    ),
    'keybase.1.provisionUi.ProvisioneeSuccess': sagaWaitingDecorator(passthroughResponseSaga),
    'keybase.1.provisionUi.ProvisionerSuccess': sagaWaitingDecorator(provisionerSuccessSaga),
    'keybase.1.provisionUi.chooseDevice': sagaWaitingDecorator(
      chooseDeviceSaga(onBackSagaDecorated)
    ),
    'keybase.1.provisionUi.chooseGPGMethod': sagaWaitingDecorator(
      chooseGPGMethodSaga(onBackSagaDecorated)
    ),
    'keybase.1.secretUi.getPassphrase': sagaWaitingDecorator(
      getPassphraseSaga(onBackSagaDecorated)
    ),
    finished: clearWaitingDecorator(finishedSaga),
  }
}

function* cancelLogin(response) {
  yield call(navBasedOnLoginState)
  if (response) {
    const engineInst = yield call(engine)
    yield put(Creators.waitingForResponse(true))
    yield call([engine, engineInst.cancelRPC], response, InputCancelError)
    yield put(Creators.waitingForResponse(false))
  }
}

function result(response, ...args) {
  return call([response, response.result], ...args)
}

function* resultWithWaiting(response, ...args) {
  yield put(Creators.waitingForResponse(true))
  yield result(response, ...args)
  yield put(Creators.waitingForResponse(false))
}

function respondError(response, ...args) {
  return call([response, response.error], ...args)
}

function* selectKeySaga({response}) {
  yield respondError(
    response,
    new RPCError('Not supported in GUI', Types.ConstantsStatusCode.sckeynotfound)
  )
}

const displayPrimaryPaperKeySaga = onBackSaga =>
  function*({params: {phrase}, response}) {
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

    const {onBack, onFinish} = yield race({
      onBack: take(Constants.onBack),
      onFinish: take(Constants.onFinish),
    })

    if (onBack) {
      yield call(onBackSaga, response)
    } else if (onFinish) {
      yield call(resultWithWaiting, response)
    }
  }

const getEmailOrUsernameSaga = onBackSaga =>
  function*({response}) {
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

    const {onBack, onSubmit} = yield race({
      onBack: take(Constants.onBack),
      onSubmit: take(Constants.submitUsernameOrEmail),
    })

    if (onBack) {
      yield call(onBackSaga, response)
    } else if (onSubmit) {
      const usernameOrEmail = onSubmit.payload.usernameOrEmail
      if (!usernameOrEmail) {
        console.error('no email')
      }
      yield call(resultWithWaiting, response, usernameOrEmail)
    }
  }

function* passthroughResponseSaga({response}) {
  yield call(resultWithWaiting, response)
}

// TODO type this
type DisplayAndPromptSecretArgs = any
const displayAndPromptSecretSaga = onBackSaga =>
  function*({params: {phrase, previousErr}, response}: DisplayAndPromptSecretArgs) {
    yield put(Creators.setTextCode(phrase, previousErr))
    yield call(generateQRCode)

    // If we have an error, we're already on the right page.
    if (!previousErr) {
      yield put(navigateAppend(['codePage']))
    }

    const {textEntered, qrScanned, onBack} = yield race({
      onBack: take(Constants.onBack),
      qrScanned: take(Constants.qrScanned),
      textEntered: take(Constants.provisionTextCodeEntered),
    })

    if (onBack) {
      yield call(onBackSaga, response)
    } else if (qrScanned || textEntered) {
      const phrase = qrScanned ? qrScanned.payload.phrase : textEntered.payload.phrase
      yield call(resultWithWaiting, response, {phrase, secret: null})
    }
  }

const promptNewDeviceNameSaga = onBackSaga =>
  function*({params: {existingDevices, errorMessage}, response}) {
    yield put(
      navigateAppend(
        [
          {
            props: {
              deviceNameError: errorMessage,
              existingDevices,
              onBack: () => onBack(response),
              onSubmit: deviceName => {
                response.result(deviceName)
              },
            },
            selected: 'setPublicName',
          },
        ],
        [loginTab, 'login']
      )
    )

    const {onBack, onSubmit} = yield race({
      onBack: take(Constants.onBack),
      onSubmit: take(Constants.submitDeviceName),
    })

    if (onBack) {
      yield call(onBackSaga, response)
    } else if (onSubmit) {
      yield call(resultWithWaiting, response, onSubmit.payload.deviceName)
    }
  }

function* provisionerSuccessInLoginSaga({response}) {
  yield call(resultWithWaiting, response)
  yield call(navBasedOnLoginState)
}

// TODO change types in flow-types to generate this
const chooseDeviceSaga = onBackSaga =>
  function*({
    params: {devices},
    response,
  }: {
    params: {devices: Array<Types.Device>},
    response: any,
  }) {
    yield put(
      navigateAppend(
        [
          {
            props: {devices},
            selected: 'selectOtherDevice',
          },
        ],
        [loginTab, 'login']
      )
    )

    const {onBack, onWont, onSelect} = yield race({
      onBack: take(Constants.onBack),
      onWont: take(Constants.onWont),
      onSelect: take(Constants.selectDeviceId),
    })

    if (onBack) {
      yield call(onBackSaga, response)
    } else if (onWont) {
      yield call(resultWithWaiting, response, '')
    } else if (onSelect) {
      const deviceID = onSelect.payload.deviceId
      const device = (devices || []).find(d => d.deviceID === deviceID)
      if (device) {
        const role = ({
          desktop: Constants.codePageDeviceRoleExistingComputer,
          mobile: Constants.codePageDeviceRoleExistingPhone,
        }: {[key: DeviceType]: DeviceRole})[toDeviceType(device.type)]
        yield call(setCodePageOtherDeviceRole, role)
        yield call(resultWithWaiting, response, deviceID)
      }
    }
  }

const chooseGPGMethodSaga = onBackSaga =>
  function*({response}) {
    yield put(navigateAppend(['gpgSign'], [loginTab, 'login']))

    const {onBack, onSubmit} = yield race({
      onBack: take(Constants.onBack),
      onSubmit: take(Constants.chooseGPGMethod),
    })

    if (onBack) {
      yield call(onBackSaga, response)
    } else if (onSubmit) {
      const exportKey = onSubmit.payload.exportKey
      yield call(
        resultWithWaiting,
        response,
        exportKey ? Types.ProvisionUiGPGMethod.gpgImport : Types.ProvisionUiGPGMethod.gpgSign
      )
    }
  }

const getPassphraseSaga = onBackSaga =>
  function*({params: {pinentry: {type, prompt, username, retryLabel}}, response}) {
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
        response.error(
          new RPCError('Unknown getPassphrase type', Types.ConstantsStatusCode.scnotfound)
        )
        return
    }

    const {onBack, onSubmit} = yield race({
      onBack: take(Constants.onBack),
      onSubmit: take(Constants.submitPassphrase),
    })

    if (onBack) {
      yield call(onBackSaga, response)
    } else if (onSubmit) {
      const passphrase = onSubmit.payload.passphrase.stringValue()
      // TODO why is store secret always false?
      const storeSecret = onSubmit.payload.storeSecret
      yield call(resultWithWaiting, response, {passphrase, storeSecret})
    }
  }

function loginRpc(channelConfig, usernameOrEmail) {
  return Types.loginLoginRpcChannelMapOld(channelConfig, {
    param: {
      deviceType,
      usernameOrEmail,
      clientType: Types.CommonClientType.guiMain,
    },
  })
}

function addDeviceRpc(channelConfig) {
  return Types.deviceDeviceAddRpcChannelMapOld(channelConfig, {})
}

function* finishLoginSaga({error, params}) {
  if (error) {
    console.log(error)
    yield put(Creators.loginDone(error))
  } else {
    yield put(Creators.loginDone())
  }
  yield call(navBasedOnLoginState)
}

function* loginFlowSaga(usernameOrEmail) {
  const loginSagas = kex2Sagas(cancelLogin, provisionerSuccessInLoginSaga, finishLoginSaga)
  const catchError = function*() {
    yield call(cancelLogin)
  }

  const channelConfig = Saga.singleFixedChannelConfig(Object.keys(loginSagas))
  const loginChanMap = yield call(loginRpc, channelConfig, usernameOrEmail)

  // Returns an Array<Task>
  // If there are any unexpected errors let's cancel the login. The error will be shown as a global error
  yield Saga.mapSagasToChanMap(
    (c, saga) => Saga.safeTakeLatestWithCatch(c, catchError, saga),
    loginSagas,
    loginChanMap
  )
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
      isMobile
        ? Constants.codePageDeviceRoleExistingPhone
        : Constants.codePageDeviceRoleExistingComputer
    )
  )
}

function* startLoginSaga() {
  yield put(navigateAppend(['usernameOrEmail'], [loginTab, 'login']))

  yield call(initalizeMyCodeStateForLogin)

  const {onBack, onSubmit} = yield race({
    onBack: take(Constants.onBack),
    onSubmit: take(Constants.submitUsernameOrEmail),
  })

  if (onBack) {
    yield call(cancelLogin)
  } else if (onSubmit) {
    const usernameOrEmail = onSubmit.payload.usernameOrEmail
    yield call(loginFlowSaga, usernameOrEmail)
  }
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

function* loginSuccess() {
  yield put(Creators.loginDone())
  yield put(configurePush())
  yield put(loadDevices())
  yield put(bootstrap())
}

function* addNewDeviceSaga({payload: {role}}: DeviceConstants.AddNewDevice) {
  yield put(setDevicesWaiting(true))
  yield call(initalizeMyCodeStateForAddingADevice)

  const onBackSaga = function*(response) {
    yield put(loadDevices())
    yield put(navigateTo(devicesTabLocation))
    if (response) {
      const engineInst = yield call(engine)
      yield call([engine, engineInst.cancelRPC], response, InputCancelError)
    }
  }

  const finishedSaga = function*() {
    yield call(onBackSaga)
  }

  const chooseDeviceTypeSaga = function*({response}) {
    const deviceTypeMap: {[key: string]: any} = {
      [Constants.codePageDeviceRoleNewComputer]: Types.CommonDeviceType.desktop,
      [Constants.codePageDeviceRoleNewPhone]: Types.CommonDeviceType.mobile,
    }
    const deviceType = deviceTypeMap[role]

    yield call(setCodePageOtherDeviceRole, role)
    yield call(resultWithWaiting, response, deviceType)
  }

  const addDeviceSagas = {
    ...kex2Sagas(onBackSaga, onBackSaga, finishedSaga),
    'keybase.1.provisionUi.chooseDeviceType': chooseDeviceTypeSaga,
  }

  const channelConfig = Saga.singleFixedChannelConfig(Object.keys(addDeviceSagas))
  const addDeviceChanMap = yield call(addDeviceRpc, channelConfig)

  // Returns an Array<Task>
  yield Saga.mapSagasToChanMap(
    (c, saga) => Saga.safeTakeLatestWithCatch(c, finishedSaga, saga),
    addDeviceSagas,
    addDeviceChanMap
  )

  yield put(setDevicesWaiting(false))
}

function* reloginSaga({payload: {usernameOrEmail, passphrase}}: Constants.Relogin) {
  const chanMap = Types.loginLoginProvisionedDeviceRpcChannelMap(
    ['keybase.1.secretUi.getPassphrase', 'finished'],
    {param: {noPassphrasePrompt: false, username: usernameOrEmail}}
  )

  while (true) {
    const incoming = yield chanMap.race()
    if (incoming.getPassphrase) {
      const {response} = (incoming.getPassphrase: any)
      response.result({passphrase: passphrase.stringValue(), storeSecret: true})
    } else if (incoming.finished) {
      const {error} = (incoming.finished: any)
      if (error) {
        const message = error.toString()
        yield put(Creators.loginDone({message}))
        if (error.desc === 'No device provisioned locally for this user') {
          yield put(Creators.setLoginFromRevokedDevice(message))
          yield put(navigateTo([loginTab]))
        }
      } else {
        yield call(loginSuccess)
      }
      break
    }
  }
}

function* openAccountResetPageSaga() {
  yield call(openURL, 'https://keybase.io/#password-reset')
}

function* logoutDoneSaga() {
  yield put({payload: undefined, type: CommonConstants.resetStore})

  yield call(navBasedOnLoginState)
  yield put(bootstrap())
}

function* logoutSaga() {
  yield call(deletePushTokenSaga)

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
  yield Saga.safeTakeLatest(Constants.navBasedOnLoginState, navBasedOnLoginState)
  yield Saga.safeTakeLatest(Constants.logoutDone, logoutDoneSaga)
  yield Saga.safeTakeLatest(Constants.logout, logoutSaga)
  yield Saga.safeTakeLatest('device:addNewDevice', addNewDeviceSaga)
}

export default loginSaga
