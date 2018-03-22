// @flow
// Look at this doc: https://goo.gl/7B6p4H
import logger from '../logger'
import * as AppGen from './app-gen'
import * as Chat2Gen from './chat2-gen'
import * as ConfigGen from './config-gen'
import * as DevicesTypes from '../constants/types/devices'
import * as DevicesConstants from '../constants/devices'
import * as WaitingGen from './waiting-gen'
import * as DevicesGen from './devices-gen'
import * as LoginGen from './login-gen'
import * as SignupGen from './signup-gen'
import * as ChatTypes from '../constants/types/chat2'
import * as Types from '../constants/types/login'
import * as Constants from '../constants/login'
import * as EngineRpc from '../constants/engine'
import * as RouteTypes from '../constants/types/route-tree'
import * as RouteConstants from '../constants/route-tree'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import HiddenString from '../util/hidden-string'
import openURL from '../util/open-url'
import {RPCError} from '../util/errors'
import {chatTab, loginTab, peopleTab, isValidInitialTab} from '../constants/tabs'
import {deletePushTokenSaga} from './push'
import {getExtendedStatus} from './config'
import {isMobile} from '../constants/platform'
import appRouteTree from '../app/routes-app'
import loginRouteTree from '../app/routes-login'
import {pathSelector, navigateTo, navigateAppend, switchRouteDef} from './route-tree'
import {type InitialState} from '../constants/types/config'
import {type TypedState} from '../constants/reducer'

// Login dips into the routing dep tree, so we need to tell
// webpack that we can still handle updates that propagate to here.
export function setupLoginHMR(cb: () => void) {
  module.hot && module.hot.accept(['../app/routes-app', '../app/routes-login'], cb)
}

const deviceType: DevicesTypes.DeviceType = isMobile ? 'mobile' : 'desktop'
const InputCancelError = {
  code: RPCTypes.constantsStatusCode.scinputcanceled,
  desc: 'Cancel Login',
}

function _generateQRCode(_, state: TypedState) {
  if (state.login.codePageTextCode) {
    return Saga.put(
      LoginGen.createSetQRCode({
        codePageQrCode: new HiddenString(Constants.qrGenerate(state.login.codePageTextCode.stringValue())),
      })
    )
  }
}

function* getAccounts(): Generator<any, void, any> {
  try {
    yield Saga.put(WaitingGen.createIncrementWaiting({key: DevicesConstants.waitingKey}))
    const accounts = yield Saga.call(RPCTypes.loginGetConfiguredAccountsRpcPromise)
    yield Saga.put(LoginGen.createConfiguredAccounts({accounts}))
  } catch (error) {
    yield Saga.put(LoginGen.createConfiguredAccountsError({error}))
  } finally {
    yield Saga.put(WaitingGen.createDecrementWaiting({key: DevicesConstants.waitingKey}))
  }
}

function* setCodePageOtherDeviceRole(codePageOtherDeviceRole: Types.DeviceRole): Generator<any, void, any> {
  const state: TypedState = yield Saga.select()
  if (state.login.codePageMyDeviceRole == null) {
    logger.warn("my device role is null, can't setCodePageOtherDeviceRole. Bailing")
    return
  }

  const codePageMode = Constants.defaultModeForDeviceRoles(
    state.login.codePageMyDeviceRole,
    codePageOtherDeviceRole,
    false
  )
  if (!codePageMode) {
    logger.warn("mode is null!, can't setCodePageMode. Bailing")
    return
  }

  yield Saga.put(LoginGen.createSetCodePageMode({codePageMode}))
  yield Saga.put(LoginGen.createSetOtherDeviceCodeState({codePageOtherDeviceRole}))
}

function* navBasedOnLoginAndInitialState(): Saga.SagaGenerator<any, any> {
  const state = yield Saga.select()
  const {loggedIn, registered, startedDueToPush} = state.config
  // ignore initial state if we're here due to push
  const initialState = startedDueToPush ? null : state.config.initialState
  const {justDeletedSelf, loginError} = state.login
  const {loggedInUserNavigated} = state.routeTree
  logger.info(
    '[RouteState] navBasedOnLoginAndInitialState:',
    loggedIn,
    registered,
    initialState,
    justDeletedSelf,
    loginError,
    loggedInUserNavigated
  )

  // All branches except for when loggedIn is true,
  // loggedInUserNavigated is false, and and initialState is null
  // yield a switchRouteDef action with appRouteTree or
  // loginRouteTree, and must finish by yielding an action which sets
  // state.routeTree.loggedInUserNavigated to true; see
  // loggedInUserNavigatedReducer.
  if (justDeletedSelf) {
    yield Saga.put(switchRouteDef(loginRouteTree))
    yield Saga.put(navigateTo([loginTab]))
  } else if (loggedIn) {
    // If the user has already performed a navigation action, or if
    // we've already applied the initialState, do nothing.
    if (loggedInUserNavigated) {
      return
    }

    yield Saga.put(switchRouteDef(appRouteTree))

    if (initialState) {
      const {url, tab, conversation} = (initialState: InitialState)
      if (url) {
        yield Saga.put(AppGen.createLink({link: url}))
      } else if (tab && isValidInitialTab(tab)) {
        if (tab === chatTab && conversation) {
          yield Saga.put(
            Chat2Gen.createSelectConversation({
              conversationIDKey: ChatTypes.stringToConversationIDKey(conversation),
              reason: 'savedLastState',
            })
          )
          yield Saga.put(
            navigateTo(isMobile ? [chatTab, 'conversation'] : [chatTab], null, 'initial-restore')
          )
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
    yield Saga.put(switchRouteDef(loginRouteTree))
    yield Saga.put.resolve(getExtendedStatus())
    yield Saga.call(getAccounts)
    yield Saga.put(navigateTo(['login'], [loginTab]))
  } else if (loginError) {
    // show error on login screen
    yield Saga.put(switchRouteDef(loginRouteTree))
    yield Saga.put(navigateTo(['login'], [loginTab]))
  } else {
    // no idea
    yield Saga.put(switchRouteDef(loginRouteTree))
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
  const state: TypedState = yield Saga.select()
  const numAccounts = state.login.configuredAccounts ? state.login.configuredAccounts.size : 0
  const route = numAccounts ? ['login'] : []
  yield Saga.put(navigateTo(route, [loginTab]))
}

function* selectKeySaga() {
  return EngineRpc.rpcError(new RPCError('Not supported in GUI', RPCTypes.constantsStatusCode.sckeynotfound))
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
      navUp: Saga.take(RouteConstants.navigateUp),
      onBack: Saga.take(LoginGen.onBack),
      onFinish: Saga.take(LoginGen.onFinish),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteTypes.NavigateUp,
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
      navUp: Saga.take(RouteConstants.navigateUp),
      onBack: Saga.take(LoginGen.onBack),
      onSubmit: Saga.take(LoginGen.submitUsernameOrEmail),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteTypes.NavigateUp,
      onSubmit: ?LoginGen.SubmitUsernameOrEmailPayload,
    })
    if (onBack || navUp) {
      yield Saga.call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (onSubmit) {
      const {usernameOrEmail} = onSubmit.payload
      if (!usernameOrEmail) {
        logger.error('no email')
      }
      return EngineRpc.rpcResult(usernameOrEmail)
    }
  }

// TODO type this
type DisplayAndPromptSecretArgs = any
const displayAndPromptSecretSaga = onBackSaga =>
  function*({phrase, previousErr}: DisplayAndPromptSecretArgs) {
    yield Saga.put(
      LoginGen.createSetTextCode({
        codePageTextCode: new HiddenString(phrase),
        codePageEnterCodeErrorText: previousErr,
      })
    )

    // If we have an error, we're already on the right page.
    if (!previousErr) {
      yield Saga.put(navigateAppend(['codePage']))
    }

    const {textEntered, qrScanned, onBack, navUp} = (yield Saga.race({
      navUp: Saga.take(RouteConstants.navigateUp),
      onBack: Saga.take(LoginGen.onBack),
      qrScanned: Saga.take(LoginGen.qrScanned),
      textEntered: Saga.take(LoginGen.provisionTextCodeEntered),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteTypes.NavigateUp,
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
    yield Saga.put(SignupGen.createSetDeviceNameError({deviceNameError: errorMessage}))
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
      navUp: Saga.take(RouteConstants.navigateUp),
      onBack: Saga.take(LoginGen.onBack),
      onSubmit: Saga.take(LoginGen.submitDeviceName),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteTypes.NavigateUp,
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

// TODO change types in rpc-gen to generate this
const chooseDeviceSaga = onBackSaga =>
  function*({devices, canSelectNoDevice}: {devices: Array<RPCTypes.Device>, canSelectNoDevice: boolean}) {
    yield Saga.put(
      navigateAppend(
        [
          {
            props: {canSelectNoDevice, devices},
            selected: 'selectOtherDevice',
          },
        ],
        [loginTab, 'login']
      )
    )

    const {onBack, navUp, onWont, onSelect} = (yield Saga.race({
      navUp: Saga.take(RouteConstants.navigateUp),
      onBack: Saga.take(LoginGen.onBack),
      onSelect: Saga.take(LoginGen.selectDeviceId),
      onWont: Saga.take(LoginGen.onWont),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteTypes.NavigateUp,
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
        }: {[key: DevicesTypes.DeviceType]: Types.DeviceRole})[DevicesTypes.stringToDeviceType(device.type)]
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
      navUp: Saga.take(RouteConstants.navigateUp),
      onBack: Saga.take(LoginGen.onBack),
      onSubmit: Saga.take(LoginGen.chooseGPGMethod),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteTypes.NavigateUp,
      onSubmit: ?LoginGen.ChooseGPGMethodPayload,
    })
    if (onBack || navUp) {
      yield Saga.call(onBackSaga)
      return EngineRpc.rpcCancel(InputCancelError)
    } else if (onSubmit) {
      const exportKey = onSubmit.payload.exportKey

      return EngineRpc.rpcResult(
        exportKey ? RPCTypes.provisionUiGPGMethod.gpgImport : RPCTypes.provisionUiGPGMethod.gpgSign
      )
    }
  }

const defaultGetPassphraseSaga = onBackSaga =>
  function*({pinentry: {type, prompt, username, retryLabel}}) {
    switch (type) {
      case RPCTypes.passphraseCommonPassphraseType.paperKey:
        const destination = {
          props: {
            error: retryLabel,
          },
          selected: 'paperkey',
        }

        const state: TypedState = yield Saga.select()
        const currentPath = pathSelector(state)
        if (currentPath.last() === 'paperkey') {
          yield Saga.put(navigateTo(currentPath.pop().push(destination)))
        } else {
          yield Saga.put(navigateAppend([destination], [loginTab, 'login']))
        }
        break
      case RPCTypes.passphraseCommonPassphraseType.passPhrase:
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
          new RPCError('Unknown getPassphrase type', RPCTypes.constantsStatusCode.scnotfound)
        )
    }

    const {onBack, navUp, onSubmit} = (yield Saga.race({
      navUp: Saga.take(RouteConstants.navigateUp),
      onBack: Saga.take(LoginGen.onBack),
      onSubmit: Saga.take(LoginGen.submitPassphrase),
    }): {
      onBack: ?LoginGen.OnBackPayload,
      navUp: ?RouteTypes.NavigateUp,
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
  const passphraseEntered = passphrase && passphrase.stringValue && passphrase.stringValue() !== ''
  const passphraseSaga = passphraseEntered
    ? onBackSaga => () =>
        EngineRpc.rpcResult({
          passphrase: passphrase ? passphrase.stringValue() : 'NEVER HAPPENS',
          storeSecret: false,
        })
    : defaultGetPassphraseSaga

  const loginSagas = kex2Sagas(cancelLogin, EngineRpc.passthroughResponseSaga, passphraseSaga)

  const loginRpcCall = new EngineRpc.EngineRpcCall(
    loginSagas,
    RPCTypes.loginLoginRpcChannelMap,
    'loginRpc',
    {
      clientType: RPCTypes.commonClientType.guiMain,
      deviceType,
      usernameOrEmail,
    },
    true // finished error should cancel
  )

  try {
    const result = yield Saga.call(loginRpcCall.run)

    if (EngineRpc.isFinished(result)) {
      const {error} = result.payload

      if (error) {
        logger.debug('login call error', error)
        if (error.code === RPCTypes.constantsStatusCode.scbadloginpassword) {
          // Stay on the login form
          yield Saga.put(LoginGen.createLoginError({error: 'Looks like a bad passphrase.'}))
        } else {
          // Show the error on the error page
          yield Saga.call(handleProvisioningError, error)
        }
      } else {
        yield Saga.call(navBasedOnLoginAndInitialState)
      }
    } else if (result === EngineRpc.BailedEarly) {
      logger.debug('Bailed early')
      yield Saga.put(navigateTo(['login'], [loginTab]))
    } else {
      yield Saga.put(navigateTo(['login'], [loginTab]))
    }
  } catch (error) {
    yield Saga.call(handleProvisioningError, error)
    logger.debug('error in loginRPC:', error)
  }
}

function* initalizeMyCodeStateForLogin(): Generator<any, void, any> {
  // We can either be a newDevice or an existingDevice. Here in the login
  // flow, let's set ourselves to be a newDevice
  yield Saga.put(
    LoginGen.createSetMyDeviceCodeState({
      codePageMyDeviceRole: isMobile
        ? Constants.codePageDeviceRoleNewPhone
        : Constants.codePageDeviceRoleNewComputer,
    })
  )
}

function* initalizeMyCodeStateForAddingADevice(): Generator<any, void, any> {
  // We can either be a newDevice or an existingDevice. Here in the adding a device
  // flow, let's set ourselves to be an existing device
  yield Saga.put(
    LoginGen.createSetMyDeviceCodeState({
      codePageMyDeviceRole: isMobile
        ? Constants.codePageDeviceRoleExistingPhone
        : Constants.codePageDeviceRoleExistingComputer,
    })
  )
}

function* _startLogin() {
  yield Saga.put(LoginGen.createSetRevokedSelf({revoked: ''}))
  yield Saga.put(LoginGen.createSetDeletedSelf({deletedUsername: ''}))
  yield Saga.put(navigateTo(['login', 'usernameOrEmail'], [loginTab]))

  yield Saga.call(initalizeMyCodeStateForLogin)

  const {onBack, navUp, onSubmit} = (yield Saga.race({
    navUp: Saga.take(RouteConstants.navigateUp),
    onBack: Saga.take(LoginGen.onBack),
    onSubmit: Saga.take(LoginGen.submitUsernameOrEmail),
  }): {
    onBack: ?LoginGen.OnBackPayload,
    navUp: ?RouteTypes.NavigateUp,
    onSubmit: ?LoginGen.SubmitUsernameOrEmailPayload,
  })
  if (onBack || navUp) {
    yield Saga.call(cancelLogin)
  } else if (onSubmit) {
    const usernameOrEmail = onSubmit.payload.usernameOrEmail
    yield Saga.call(loginFlowSaga, usernameOrEmail, null)
  }
}

function _relogin({payload: {usernameOrEmail, passphrase}}: LoginGen.ReloginPayload) {
  return Saga.call(Saga.sequentially, [
    Saga.put(LoginGen.createSetRevokedSelf({revoked: ''})),
    Saga.put(LoginGen.createSetDeletedSelf({deletedUsername: ''})),
    Saga.call(Saga.sequentially, [
      Saga.call(initalizeMyCodeStateForLogin),
      Saga.call(loginFlowSaga, usernameOrEmail, passphrase),
    ]),
  ])
}

function _cameraBrokenMode(
  {payload: {codePageCameraBrokenMode}}: LoginGen.SetCameraBrokenModePayload,
  state: TypedState
) {
  if (state.login.codePageMyDeviceRole == null) {
    logger.warn("my device role is null, can't setCameraBrokenMode. Bailing")
    return
  }

  if (state.login.codePageOtherDeviceRole == null) {
    logger.warn("other device role is null, can't setCameraBrokenMode. Bailing")
    return
  }

  const codePageMode = Constants.defaultModeForDeviceRoles(
    state.login.codePageMyDeviceRole,
    state.login.codePageOtherDeviceRole,
    codePageCameraBrokenMode
  )
  if (!codePageMode) {
    logger.warn("mode is null!, can't setCodePageMode. Bailing")
    return
  }
  return Saga.put(LoginGen.createSetCodePageMode({codePageMode}))
}

function* _addNewDevice({payload: {role}}: LoginGen.AddNewDevicePayload) {
  const _deviceTypeMap: {[key: string]: any} = {
    [Constants.codePageDeviceRoleNewComputer]: RPCTypes.commonDeviceType.desktop,
    [Constants.codePageDeviceRoleNewPhone]: RPCTypes.commonDeviceType.mobile,
  }

  yield Saga.put(WaitingGen.createIncrementWaiting({key: DevicesConstants.waitingKey}))
  yield Saga.call(initalizeMyCodeStateForAddingADevice)

  const onBackSaga = function*(): Generator<any, void, any> {
    yield Saga.put(DevicesGen.createDevicesLoad())
    yield Saga.put(navigateTo(DevicesConstants.devicesTabLocation))
  }

  const onSuccessSaga = function*(): Generator<any, any, any> {
    yield Saga.call(onBackSaga)
    return EngineRpc.rpcResult()
  }

  const secretExchangedSaga = function*() {
    yield Saga.put(LoginGen.createClearQRCode())
    return EngineRpc.rpcResult()
  }
  const chooseDeviceTypeSaga = function*() {
    const deviceType = _deviceTypeMap[role]
    yield Saga.call(setCodePageOtherDeviceRole, role)
    return EngineRpc.rpcResult(deviceType)
  }

  const addDeviceSagas = {
    ...kex2Sagas(onBackSaga, onSuccessSaga),
    'keybase.1.provisionUi.DisplaySecretExchanged': secretExchangedSaga,
    'keybase.1.provisionUi.chooseDeviceType': chooseDeviceTypeSaga,
  }

  const addDeviceRpc = new EngineRpc.EngineRpcCall(
    addDeviceSagas,
    RPCTypes.deviceDeviceAddRpcChannelMap,
    'addDeviceRpc',
    {},
    true // should cancel on finished+error
  )

  yield Saga.call(addDeviceRpc.run)
  yield Saga.call(onBackSaga)

  yield Saga.put(WaitingGen.createDecrementWaiting({key: DevicesConstants.waitingKey}))
}

function _openAccountResetPageSaga() {
  return Saga.call(openURL, 'https://keybase.io/#password-reset')
}

function _logoutDone() {
  return Saga.all([
    Saga.put({payload: undefined, type: LoginGen.resetStore}),
    Saga.call(navBasedOnLoginAndInitialState),
    Saga.put(ConfigGen.createBootstrap({})),
  ])
}

function* _logout() {
  yield Saga.all([Saga.call(deletePushTokenSaga), Saga.put(ConfigGen.createClearRouteState())])

  yield Saga.put(LoginGen.createWaitingForResponse({waiting: true}))
  const chanMap = RPCTypes.loginLogoutRpcChannelMap(['finished'], {})
  const incoming = yield chanMap.take('finished')
  yield Saga.put(LoginGen.createWaitingForResponse({waiting: false}))
  if (incoming.error) {
    logger.debug(incoming.error)
  } else {
    yield Saga.put(LoginGen.createLogoutDone())
  }
}

function* loginSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeLatest(LoginGen.startLogin, _startLogin)
  yield Saga.safeTakeEveryPure(LoginGen.setCameraBrokenMode, _cameraBrokenMode)
  yield Saga.safeTakeEveryPure([LoginGen.setCodePageMode, LoginGen.setTextCode], _generateQRCode)
  yield Saga.safeTakeEveryPure(LoginGen.relogin, _relogin)
  yield Saga.safeTakeEveryPure(LoginGen.openAccountResetPage, _openAccountResetPageSaga)
  yield Saga.safeTakeLatest(LoginGen.navBasedOnLoginAndInitialState, navBasedOnLoginAndInitialState)
  yield Saga.safeTakeEveryPure(LoginGen.logoutDone, _logoutDone)
  yield Saga.safeTakeLatest(LoginGen.logout, _logout)
  yield Saga.safeTakeLatest(LoginGen.addNewDevice, _addNewDevice)
}

export default loginSaga
