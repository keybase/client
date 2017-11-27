// @flow
// Look at this doc: https://goo.gl/7B6p4H
import * as ConfigGen from '../../actions/config-gen'
import * as LoginGen from '../../actions/login-gen'
import * as Constants from '../../constants/login'
import * as EngineRpc from '../engine/helper'
import * as RouteConstants from '../../constants/route-tree'
import * as Saga from '../../util/saga'
import * as Types from '../../constants/types/flow-types'
import HiddenString from '../../util/hidden-string'
import openURL from '../../util/open-url'
import {RPCError} from '../../util/errors'
import {appLink} from '../app'
import {chatTab, loginTab, peopleTab, isValidInitialTab} from '../../constants/tabs'
import {createSelectConversation} from '../chat-gen'
import {defaultModeForDeviceRoles, qrGenerate} from './provision-helpers'
import {deletePushTokenSaga} from '../push'
import {getExtendedStatus} from '../config'
import {isMobile} from '../../constants/platform'
import {load as loadDevices, setWaiting as setDevicesWaiting, devicesTabLocation} from '../devices'
import {pathSelector, navigateTo, navigateAppend} from '../route-tree'
import {setDeviceNameError} from '../signup'
import {toDeviceType, type DeviceType} from '../../constants/devices'
import {type Dispatch, type AsyncAction} from '../../constants/types/flux'
import {type InitialState} from '../../constants/config'
import {type TypedState} from '../../constants/reducer'

const deviceType: DeviceType = isMobile ? 'mobile' : 'desktop'
const InputCancelError = {
  code: Types.constantsStatusCode.scinputcanceled,
  desc: 'Cancel Login',
}

const codePageSelector = ({login: {codePage}}: TypedState) => codePage

function* generateQRCode(): Generator<any, void, any> {
  const state: TypedState = yield Saga.select()
  const codePage = codePageSelector(state)

  if (codePage.textCode) {
    yield Saga.put(
      LoginGen.createSetQRCode({qrCode: new HiddenString(qrGenerate(codePage.textCode.stringValue()))})
    )
  }
}

// TODO add waiting handlers
// TODO sagaize
const makeWaitingHandler = (dispatch: Dispatch): {waitingHandler: (waiting: boolean) => void} => ({
  waitingHandler: (waiting: boolean) => {
    dispatch(LoginGen.createWaitingForResponse({waiting}))
  },
})

const getAccounts = (): AsyncAction => dispatch =>
  new Promise((resolve, reject) => {
    Types.loginGetConfiguredAccountsRpcPromise({...makeWaitingHandler(dispatch)})
      .then(accounts => {
        dispatch(LoginGen.createConfiguredAccounts({accounts}))
        resolve()
      })
      .catch(error => {
        if (error) {
          dispatch(
            LoginGen.createConfiguredAccountsError({
              error,
            })
          )
          reject(error)
        }
      })
  })

function* setCodePageOtherDeviceRole(otherDeviceRole: Constants.DeviceRole): Generator<any, void, any> {
  const state: TypedState = yield Saga.select()
  const codePage = codePageSelector(state)
  if (codePage.myDeviceRole == null) {
    console.warn("my device role is null, can't setCodePageOtherDeviceRole. Bailing")
    return
  }

  const mode = defaultModeForDeviceRoles(codePage.myDeviceRole, otherDeviceRole, false)
  if (!mode) {
    console.warn("mode is null!, can't setCodePageMode. Bailing")
    return
  }

  yield Saga.put(LoginGen.createSetCodePageMode({mode}))
  yield Saga.put(LoginGen.createSetOtherDeviceCodeState({state: otherDeviceRole}))
}

function* navBasedOnLoginAndInitialState(): Saga.SagaGenerator<any, any> {
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

  const args = yield Saga.select(selector)

  console.log('[RouteState] navBasedOnLoginAndInitialState:', args)

  const {loggedIn, registered, initialState, justDeletedSelf, loginError, loggedInUserNavigated} = args

  // All branches except for when loggedIn is true,
  // loggedInUserNavigated is false, and and initialState is null must
  // finish by yielding an action which sets
  // state.routeTree.loggedInUserNavigated to true; see
  // loggedInUserNavigatedReducer.
  if (justDeletedSelf) {
    yield Saga.put(navigateTo([loginTab]))
  } else if (loggedIn) {
    // If the user has already performed a navigation action, or if
    // we've already applied the initialState, do nothing.
    if (loggedInUserNavigated) {
      return
    }

    if (initialState) {
      const {url, tab, conversation} = (initialState: InitialState)
      if (url) {
        yield Saga.put(appLink(url))
      } else if (tab && isValidInitialTab(tab)) {
        if (tab === chatTab && conversation) {
          yield Saga.put(createSelectConversation({conversationIDKey: conversation}))
          yield Saga.put(navigateTo([chatTab], null, 'initial-restore'))
        } else {
          yield Saga.put(navigateTo([tab], null, 'initial-restore'))
        }
      } else {
        yield Saga.put(navigateTo([peopleTab], null, 'initial-restore'))
      }
    } else {
      // If the initial state is not set yet, navigate to the people
      // tab without setting state.routeTree.loggedInUserNavigated to true.
      yield Saga.put(navigateTo([peopleTab], null, 'initial-default'))
    }
  } else if (registered) {
    // relogging in
    yield Saga.all([Saga.put.resolve(getExtendedStatus()), Saga.put.resolve(getAccounts())])
    yield Saga.put(navigateTo(['login'], [loginTab]))
  } else if (loginError) {
    // show error on login screen
    yield Saga.put(navigateTo(['login'], [loginTab]))
  } else {
    // no idea
    yield Saga.put(navigateTo([loginTab]))
  }
}

const kex2Sagas = (
  onBackSaga: () => Generator<any, void, any>,
  provisionerSuccessSaga,
  getPassphraseSaga = defaultGetPassphraseSaga
) => ({
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

function* cancelLogin(): Generator<any, void, any> {
  const getNumAccounts = (state: TypedState) =>
    state.login.configuredAccounts && state.login.configuredAccounts.length
  const numAccounts = yield Saga.select(getNumAccounts)

  const route = numAccounts ? ['login'] : []
  yield Saga.put(navigateTo(route, [loginTab]))
}

function* selectKeySaga() {
  return EngineRpc.rpcError(new RPCError('Not supported in GUI', Types.constantsStatusCode.sckeynotfound))
}

const displayPrimaryPaperKeySaga = onBackSaga =>
  function*({phrase}) {
    yield Saga.put(
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

    const {onBack, navUp, onFinish} = (yield Saga.race({
      onBack: Saga.take(LoginGen.onBack),
      navUp: Saga.take(RouteConstants.navigateUp),
      onFinish: Saga.take(LoginGen.onFinish),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteConstants.NavigateUp,
      onFinish: ?LoginGen.OnFinishPayload,
    })
    if (onBack || navUp) {
      yield Saga.call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (onFinish) {
      return EngineRpc.rpcResult()
    }
  }

const getEmailOrUsernameSaga = onBackSaga =>
  function*() {
    yield Saga.put(
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

    const {onBack, navUp, onSubmit} = (yield Saga.race({
      onBack: Saga.take(LoginGen.onBack),
      navUp: Saga.take(RouteConstants.navigateUp),
      onSubmit: Saga.take(LoginGen.submitUsernameOrEmail),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteConstants.NavigateUp,
      onSubmit: ?LoginGen.SubmitUsernameOrEmailPayload,
    })
    if (onBack || navUp) {
      yield Saga.call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (onSubmit) {
      const {usernameOrEmail} = onSubmit.payload
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
    yield Saga.put(
      LoginGen.createSetTextCode({textCode: new HiddenString(phrase), enterCodeErrorText: previousErr})
    )
    yield Saga.call(generateQRCode)

    // If we have an error, we're already on the right page.
    if (!previousErr) {
      yield Saga.put(navigateAppend(['codePage']))
    }

    const {textEntered, qrScanned, onBack, navUp} = (yield Saga.race({
      onBack: Saga.take(LoginGen.onBack),
      navUp: Saga.take(RouteConstants.navigateUp),
      qrScanned: Saga.take(LoginGen.qrScanned),
      textEntered: Saga.take(LoginGen.provisionTextCodeEntered),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteConstants.NavigateUp,
      qrScanned: ?LoginGen.QrScannedPayload,
      textEntered: ?LoginGen.ProvisionTextCodeEnteredPayload,
    })
    if (onBack || navUp) {
      yield Saga.call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (qrScanned) {
      const phrase: HiddenString = qrScanned.payload.phrase
      return EngineRpc.rpcResult({phrase: phrase.stringValue(), secret: null})
    } else if (textEntered) {
      const phrase: HiddenString = textEntered.payload.phrase
      return EngineRpc.rpcResult({phrase: phrase.stringValue(), secret: null})
    }
  }

const promptNewDeviceNameSaga = onBackSaga =>
  function*({existingDevices, errorMessage}) {
    yield Saga.put(setDeviceNameError(errorMessage))
    yield Saga.put(
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

    const {onBack, navUp, onSubmit} = (yield Saga.race({
      onBack: Saga.take(LoginGen.onBack),
      navUp: Saga.take(RouteConstants.navigateUp),
      onSubmit: Saga.take(LoginGen.submitDeviceName),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteConstants.NavigateUp,
      onSubmit: ?LoginGen.SubmitDeviceNamePayload,
    })
    if (onBack || navUp) {
      yield Saga.call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (onSubmit) {
      const {deviceName} = onSubmit.payload
      return EngineRpc.rpcResult(deviceName)
    }
  }

// TODO change types in flow-types to generate this
const chooseDeviceSaga = onBackSaga =>
  function*({devices, canSelectNoDevice}: {devices: Array<Types.Device>, canSelectNoDevice: boolean}) {
    yield Saga.put(
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

    const {onBack, navUp, onWont, onSelect} = (yield Saga.race({
      onBack: Saga.take(LoginGen.onBack),
      navUp: Saga.take(RouteConstants.navigateUp),
      onWont: Saga.take(LoginGen.onWont),
      onSelect: Saga.take(LoginGen.selectDeviceId),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteConstants.NavigateUp,
      onWont: ?LoginGen.OnWontPayload,
      onSelect: ?LoginGen.SelectDeviceIdPayload,
    })
    if (onBack || navUp) {
      yield Saga.call(onBackSaga)
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
        }: {[key: DeviceType]: Constants.DeviceRole})[toDeviceType(device.type)]
        if (role) {
          yield Saga.call(setCodePageOtherDeviceRole, role)
        }
        return EngineRpc.rpcResult(deviceID)
      }
    }
  }

const chooseGPGMethodSaga = onBackSaga =>
  function*() {
    yield Saga.put(navigateAppend(['gpgSign'], [loginTab, 'login']))

    const {onBack, navUp, onSubmit} = (yield Saga.race({
      onBack: Saga.take(LoginGen.onBack),
      navUp: Saga.take(RouteConstants.navigateUp),
      onSubmit: Saga.take(LoginGen.chooseGPGMethod),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteConstants.NavigateUp,
      onSubmit: ?LoginGen.ChooseGPGMethodPayload,
    })
    if (onBack || navUp) {
      yield Saga.call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (onSubmit) {
      const exportKey = onSubmit.payload.exportKey

      return EngineRpc.rpcResult(
        exportKey ? Types.provisionUiGPGMethod.gpgImport : Types.provisionUiGPGMethod.gpgSign
      )
    }
  }

const defaultGetPassphraseSaga = onBackSaga =>
  function*({pinentry: {type, prompt, username, retryLabel}}) {
    switch (type) {
      case Types.passphraseCommonPassphraseType.paperKey:
        const destination = {
          props: {
            error: retryLabel,
          },
          selected: 'paperkey',
        }

        const currentPath = yield Saga.select(pathSelector)
        if (currentPath.last() === 'paperkey') {
          yield Saga.put(navigateTo(currentPath.pop(1).push(destination)))
        } else {
          yield Saga.put(navigateAppend([destination], [loginTab, 'login']))
        }
        break
      case Types.passphraseCommonPassphraseType.passPhrase:
        yield Saga.put(
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
          new RPCError('Unknown getPassphrase type', Types.constantsStatusCode.scnotfound)
        )
    }

    const {onBack, navUp, onSubmit} = (yield Saga.race({
      onBack: Saga.take(LoginGen.onBack),
      navUp: Saga.take(RouteConstants.navigateUp),
      onSubmit: Saga.take(LoginGen.submitPassphrase),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteConstants.NavigateUp,
      onSubmit: ?LoginGen.SubmitPassphrasePayload,
    })
    if (onBack || navUp) {
      yield Saga.call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (onSubmit) {
      const passphrase = onSubmit.payload.passphrase.stringValue()
      // TODO why is store secret always false?
      const storeSecret = onSubmit.payload.storeSecret
      return EngineRpc.rpcResult({passphrase, storeSecret})
    }
  }

function* handleProvisioningError(error): Generator<any, void, any> {
  yield Saga.put(LoginGen.createProvisioningError({error}))
  yield Saga.put(
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
  yield Saga.race({onBack: Saga.take(LoginGen.onBack), navUp: Saga.take(RouteConstants.navigateUp)})
  yield Saga.call(cancelLogin)
}

function* loginFlowSaga(usernameOrEmail, passphrase): Generator<any, void, any> {
  // If there is passphrase, use that.
  const passphraseSaga = passphrase
    ? onBackSaga => () =>
        EngineRpc.rpcResult({
          passphrase: passphrase ? passphrase.stringValue() : 'NEVER HAPPENS',
          storeSecret: false,
        })
    : defaultGetPassphraseSaga

  const loginSagas = kex2Sagas(cancelLogin, EngineRpc.passthroughResponseSaga, passphraseSaga)

  const loginRpcCall = new EngineRpc.EngineRpcCall(loginSagas, Types.loginLoginRpcChannelMap, 'loginRpc', {
    param: {
      deviceType,
      usernameOrEmail,
      clientType: Types.commonClientType.guiMain,
    },
  })

  try {
    const result = yield Saga.call(loginRpcCall.run)

    if (EngineRpc.isFinished(result)) {
      const {error} = result.payload

      if (error) {
        console.log(error)
        yield Saga.call(handleProvisioningError, error)
      } else {
        yield Saga.call(navBasedOnLoginAndInitialState)
      }
    } else if (result === EngineRpc.BailedEarly) {
      console.log('Bailed early')
      yield Saga.put(navigateTo(['login'], [loginTab]))
    } else {
      yield Saga.put(navigateTo(['login'], [loginTab]))
    }
  } catch (error) {
    yield Saga.call(handleProvisioningError, error)
    console.log('DEBUG: error in loginRPC:', error)
  }
}

function* initalizeMyCodeStateForLogin(): Generator<any, void, any> {
  // We can either be a newDevice or an existingDevice. Here in the login
  // flow, let's set ourselves to be a newDevice
  yield Saga.put(
    LoginGen.createSetMyDeviceCodeState({
      state: isMobile ? Constants.codePageDeviceRoleNewPhone : Constants.codePageDeviceRoleNewComputer,
    })
  )
}

function* initalizeMyCodeStateForAddingADevice(): Generator<any, void, any> {
  // We can either be a newDevice or an existingDevice. Here in the adding a device
  // flow, let's set ourselves to be an existing device
  yield Saga.put(
    LoginGen.createSetMyDeviceCodeState({
      state: isMobile
        ? Constants.codePageDeviceRoleExistingPhone
        : Constants.codePageDeviceRoleExistingComputer,
    })
  )
}

function* startLoginSaga() {
  yield Saga.put(LoginGen.createSetRevokedSelf({revoked: ''}))
  yield Saga.put(LoginGen.createSetDeletedSelf({deletedUsername: ''}))
  yield Saga.put(navigateTo(['login', 'usernameOrEmail'], [loginTab]))

  yield Saga.call(initalizeMyCodeStateForLogin)

  const {onBack, navUp, onSubmit} = (yield Saga.race({
    onBack: Saga.take(LoginGen.onBack),
    navUp: Saga.take(RouteConstants.navigateUp),
    onSubmit: Saga.take(LoginGen.submitUsernameOrEmail),
  }): {
    onBack: ?LoginGen.OnBackPayload,
    navUp: ?RouteConstants.NavigateUp,
    onSubmit: ?LoginGen.SubmitUsernameOrEmailPayload,
  })
  if (onBack || navUp) {
    yield Saga.call(cancelLogin)
  } else if (onSubmit) {
    const usernameOrEmail = onSubmit.payload.usernameOrEmail
    yield Saga.call(loginFlowSaga, usernameOrEmail, null)
  }
}

function* reloginSaga({payload: {usernameOrEmail, passphrase}}: LoginGen.ReloginPayload) {
  yield Saga.put(LoginGen.createSetRevokedSelf({revoked: ''}))
  yield Saga.put(LoginGen.createSetDeletedSelf({deletedUsername: ''}))

  yield Saga.call(initalizeMyCodeStateForLogin)
  yield Saga.call(loginFlowSaga, usernameOrEmail, passphrase)
}

function* cameraBrokenModeSaga({payload: {broken}}: LoginGen.SetCameraBrokenModePayload) {
  const state: TypedState = yield Saga.select()
  const codePage = codePageSelector(state)
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
  yield Saga.put(LoginGen.createSetCodePageMode({mode}))
}

const _deviceTypeMap: {[key: string]: any} = {
  [Constants.codePageDeviceRoleNewComputer]: Types.commonDeviceType.desktop,
  [Constants.codePageDeviceRoleNewPhone]: Types.commonDeviceType.mobile,
}

function secretExchangedSaga() {
  return function*() {
    yield Saga.put(LoginGen.createClearQRCode())
    return EngineRpc.rpcResult()
  }
}

function chooseDeviceTypeSaga(role) {
  return function*() {
    const deviceType = _deviceTypeMap[role]
    yield Saga.call(setCodePageOtherDeviceRole, role)
    return EngineRpc.rpcResult(deviceType)
  }
}

function* addNewDeviceSaga({payload: {role}}: LoginGen.AddNewDevicePayload) {
  yield Saga.put(setDevicesWaiting(true))
  yield Saga.call(initalizeMyCodeStateForAddingADevice)

  const onBackSaga = function*(): Generator<any, void, any> {
    yield Saga.put(loadDevices())
    yield Saga.put(navigateTo(devicesTabLocation))
  }

  const onSuccessSaga = function*(): Generator<any, any, any> {
    yield Saga.call(onBackSaga)
    return EngineRpc.rpcResult()
  }

  const addDeviceSagas = {
    ...kex2Sagas(onBackSaga, onSuccessSaga),
    'keybase.1.provisionUi.chooseDeviceType': chooseDeviceTypeSaga(role),
    'keybase.1.provisionUi.DisplaySecretExchanged': secretExchangedSaga(),
  }

  const addDeviceRpc = new EngineRpc.EngineRpcCall(
    addDeviceSagas,
    Types.deviceDeviceAddRpcChannelMap,
    'addDeviceRpc',
    {},
    true // should cancel on finished+error
  )

  yield Saga.call(addDeviceRpc.run)
  yield Saga.call(onBackSaga)
  yield Saga.put(setDevicesWaiting(false))
}

function* openAccountResetPageSaga() {
  yield Saga.call(openURL, 'https://keybase.io/#password-reset')
}

function* logoutDoneSaga() {
  yield Saga.put({payload: undefined, type: LoginGen.resetStore})

  yield Saga.call(navBasedOnLoginAndInitialState)
  yield Saga.put(ConfigGen.createBootstrap({}))
}

function* logoutSaga() {
  yield Saga.all([Saga.call(deletePushTokenSaga), Saga.put(ConfigGen.createClearRouteState())])

  // Add waiting handler
  const chanMap = Types.loginLogoutRpcChannelMap(['finished'], {})
  const incoming = yield chanMap.take('finished')
  if (incoming.error) {
    console.log(incoming.error)
  } else {
    yield Saga.put(LoginGen.createLogoutDone())
  }
}

function* loginSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(LoginGen.startLogin, startLoginSaga)
  yield Saga.safeTakeLatest(LoginGen.setCameraBrokenMode, cameraBrokenModeSaga)
  yield Saga.safeTakeLatest(LoginGen.setCodePageMode, generateQRCode)
  yield Saga.safeTakeLatest(LoginGen.relogin, reloginSaga)
  yield Saga.safeTakeLatest(LoginGen.openAccountResetPage, openAccountResetPageSaga)
  yield Saga.safeTakeLatest(LoginGen.navBasedOnLoginAndInitialState, navBasedOnLoginAndInitialState)
  yield Saga.safeTakeLatest(LoginGen.logoutDone, logoutDoneSaga)
  yield Saga.safeTakeLatest(LoginGen.logout, logoutSaga)
  yield Saga.safeTakeLatest(LoginGen.addNewDevice, addNewDeviceSaga)
}

export default loginSaga
