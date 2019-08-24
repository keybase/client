import * as Constants from '../constants/provision'
import * as RouteTreeGen from './route-tree-gen'
import * as DevicesGen from './devices-gen'
import * as ProvisionGen from './provision-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as Tabs from '../constants/tabs'
import logger from '../logger'
import {isMobile} from '../constants/platform'
import HiddenString from '../util/hidden-string'
import * as Container from '../constants/reducer'
import {devicesTab as settingsDevicesTab} from '../constants/settings'
import flags from '../util/feature-flags'

const devicesRoot = isMobile ? [Tabs.settingsTab, settingsDevicesTab] : [Tabs.devicesTab, 'devicesRoot']

type ValidCallback =
  | 'keybase.1.gpgUi.selectKey'
  | 'keybase.1.loginUi.displayPrimaryPaperKey'
  | 'keybase.1.loginUi.getEmailOrUsername'
  | 'keybase.1.provisionUi.DisplayAndPromptSecret'
  | 'keybase.1.provisionUi.DisplaySecretExchanged'
  | 'keybase.1.provisionUi.PromptNewDeviceName'
  | 'keybase.1.provisionUi.ProvisioneeSuccess'
  | 'keybase.1.provisionUi.ProvisionerSuccess'
  | 'keybase.1.provisionUi.chooseDevice'
  | 'keybase.1.provisionUi.chooseGPGMethod'
  | 'keybase.1.provisionUi.switchToGPGSignOK'
  | 'keybase.1.secretUi.getPassphrase'

const ignoreCallback = (_: any) => {}

// The provisioning flow is very stateful so we use a class to handle bookkeeping
// We only allow one manager to be alive at a time
// Can be made for a regular provision or if we're adding a device
class ProvisioningManager {
  static singleton: ProvisioningManager | null = null
  static getSingleton = (): ProvisioningManager => {
    if (!ProvisioningManager.singleton) {
      throw new Error('No ProvisioningManager')
    }
    return ProvisioningManager.singleton
  }
  _stashedResponse: any = null
  _stashedResponseKey: ValidCallback | null = null
  _addingANewDevice: boolean
  _done: boolean = false

  constructor(addingANewDevice: boolean, _: 'ONLY_CALL_THIS_FROM_HELPER') {
    this._addingANewDevice = addingANewDevice
    ProvisioningManager.singleton = this
  }

  done = (reason: string) => {
    logger.info('ProvisioningManager.done', reason)
    this._done = true
  }

  _stashResponse = (key: ValidCallback, response: any) => {
    this._stashedResponse = response
    this._stashedResponseKey = key
  }

  _getAndClearResponse = (key: ValidCallback) => {
    if (this._stashedResponseKey !== key) {
      logger.info('ProvisioningManager._getAndClearResponse error', key, this._stashedResponseKey)
      throw new Error(`Invalid response key used wants: ${key} has: ${this._stashedResponseKey || ''}`)
    }
    logger.info('ProvisioningManager._getAndClearResponse success', key)
    const response = this._stashedResponse
    this._stashedResponse = null
    return response
  }

  // Choosing a device to use to provision
  chooseDeviceHandler = (params, response) => {
    if (this._done) {
      logger.info('ProvisioningManager done, yet chooseDeviceHandler called')
      return
    }
    this._stashResponse('keybase.1.provisionUi.chooseDevice', response)
    return Saga.put(
      ProvisionGen.createShowDeviceListPage({
        devices: (params.devices || []).map(d => Constants.rpcDeviceToDevice(d)),
      })
    )
  }

  submitDeviceSelect = state => {
    if (this._done) {
      logger.info('ProvisioningManager done, yet submitDeviceSelect called')
      return
    }
    const response = this._getAndClearResponse('keybase.1.provisionUi.chooseDevice')
    if (!response || !response.result) {
      throw new Error('Tried to submit a device choice but missing callback')
    }

    if (!state.provision.codePageOtherDeviceId) {
      response.error()
      throw new Error('Tried to submit a device choice but missing device in store')
    }

    response.result(state.provision.codePageOtherDeviceId)
  }

  // Telling the daemon the other device type when adding a new device
  chooseDeviceTypeHandler = (_, response) => {
    if (this._done) {
      logger.info('ProvisioningManager done, yet chooseDeviceTypeHandler called')
      return
    }
    return Saga.callUntyped(function*() {
      const state: Container.TypedState = yield* Saga.selectState()
      let type
      switch (state.provision.codePageOtherDeviceType) {
        case 'mobile':
          type = RPCTypes.DeviceType.mobile
          break
        case 'desktop':
          type = RPCTypes.DeviceType.desktop
          break
        default:
          response.error()
          throw new Error(
            'Tried to add a device but of unknown type' + state.provision.codePageOtherDeviceType
          )
      }

      response.result(type)
    })
  }

  // Choosing a name for this new device
  promptNewDeviceNameHandler = (params, response) => {
    if (this._done) {
      logger.info('ProvisioningManager done, yet promptNewDeviceNameHandler called')
      return
    }
    this._stashResponse('keybase.1.provisionUi.PromptNewDeviceName', response)
    return Saga.put(
      ProvisionGen.createShowNewDeviceNamePage({
        error: params.errorMessage ? new HiddenString(params.errorMessage) : null,
        existingDevices: params.existingDevices || [],
      })
    )
  }

  submitDeviceName = (state: Container.TypedState) => {
    if (this._done) {
      logger.info('ProvisioningManager done, yet submitDeviceName called')
      return
    }

    // local error, ignore
    if (state.provision.error.stringValue()) {
      return
    }

    const response = this._getAndClearResponse('keybase.1.provisionUi.PromptNewDeviceName')
    if (!response || !response.result) {
      throw new Error('Tried to submit a device name but missing callback')
    }

    if (!state.provision.deviceName) {
      response.error()
      throw new Error('Tried to submit a device name but missing in store')
    }

    response.result(state.provision.deviceName)
  }

  // We now need to exchange a secret sentence. Either side can move the process forward
  displayAndPromptSecretHandler = (params, response) => {
    if (this._done) {
      logger.info('ProvisioningManager done, yet displayAndPromptSecretHandler called')
      return
    }
    this._stashResponse('keybase.1.provisionUi.DisplayAndPromptSecret', response)
    return Saga.put(
      ProvisionGen.createShowCodePage({
        code: new HiddenString(params.phrase),
        error: params.previousErr ? new HiddenString(params.previousErr) : null,
      })
    )
  }

  submitTextCode = (state: Container.TypedState) => {
    if (this._done) {
      logger.info('ProvisioningManager done, yet submitTextCode called')
      return
    }
    // local error, ignore
    if (state.provision.error.stringValue()) {
      return
    }

    const response = this._getAndClearResponse('keybase.1.provisionUi.DisplayAndPromptSecret')
    if (!response || !response.result) {
      throw new Error('Tried to submit a code but missing callback')
    }

    if (!state.provision.codePageOutgoingTextCode.stringValue()) {
      response.error()
      throw new Error('Tried to submit a code but missing in store')
    }

    response.result({code: null, phrase: state.provision.codePageOutgoingTextCode.stringValue()})
  }

  // Trying to use gpg flow
  chooseGPGMethodHandler = (_, response) => {
    if (this._done) {
      logger.info('ProvisioningManager done, yet chooseGPGMethodHandler called')
      return
    }
    this._stashResponse('keybase.1.provisionUi.chooseGPGMethod', response)
    return Saga.put(ProvisionGen.createShowGPGPage())
  }

  submitGPGMethod = (state, action) => {
    if (this._done) {
      logger.info('ProvisioningManager done, yet submitGPGMethod called')
      return
    }
    // local error, ignore
    if (state.provision.error.stringValue()) {
      return
    }

    const response = this._getAndClearResponse('keybase.1.provisionUi.chooseGPGMethod')
    if (!response || !response.result) {
      throw new Error('Tried to submit gpg export but missing callback')
    }

    response.result(action.payload.exportKey ? RPCTypes.GPGMethod.gpgImport : RPCTypes.GPGMethod.gpgSign)
  }

  switchToGPGSignOKHandler = (params, response) => {
    if (this._done) {
      logger.info('ProvisioningManager done, yet switchToGPGSignOKHandler called')
      return
    }
    this._stashResponse('keybase.1.provisionUi.switchToGPGSignOK', response)
    return Saga.all([
      Saga.put(ProvisionGen.createSwitchToGPGSignOnly({importError: params.importError})),
      Saga.put(ProvisionGen.createShowGPGPage()),
    ])
  }

  submitGPGSignOK = (_, action) => {
    if (this._done) {
      logger.info('ProvisioningManager done, yet submitGPGSignOK called')
      return
    }
    const response = this._getAndClearResponse('keybase.1.provisionUi.switchToGPGSignOK')
    if (!response || !response.result) {
      throw new Error('Tried to respond to gpg sign ok but missing callback')
    }

    response.result(action.payload.accepted)
  }

  // User has an uploaded key so we can use a password OR they selected a paperkey
  getPasswordHandler = (params, response) => {
    if (this._done) {
      logger.info('ProvisioningManager done, yet getPasswordHandler called')
      return
    }
    this._stashResponse('keybase.1.secretUi.getPassphrase', response)

    let error = ''
    // Service asking us again due to an error?
    if (params.pinentry.retryLabel) {
      error = params.pinentry.retryLabel
    }

    switch (params.pinentry.type) {
      case RPCTypes.PassphraseType.passPhrase:
        return Saga.put(ProvisionGen.createShowPasswordPage({error: error ? new HiddenString(error) : null}))
      case RPCTypes.PassphraseType.paperKey:
        return Saga.put(ProvisionGen.createShowPaperkeyPage({error: error ? new HiddenString(error) : null}))
      default:
        throw new Error('Got confused about password entry. Please send a log to us!')
    }
  }
  submitPasswordOrPaperkey = (
    state: Container.TypedState,
    action: ProvisionGen.SubmitPasswordPayload | ProvisionGen.SubmitPaperkeyPayload
  ) => {
    if (this._done) {
      logger.info('ProvisioningManager done, yet submitPasswordOrPaperkey called')
      return
    }
    // local error, ignore
    if (state.provision.error.stringValue()) {
      return
    }

    const response = this._getAndClearResponse('keybase.1.secretUi.getPassphrase')
    if (!response || !response.result) {
      throw new Error('Tried to submit password but missing callback')
    }

    const password =
      action.type === ProvisionGen.submitPassword
        ? action.payload.password.stringValue()
        : action.payload.paperkey.stringValue()

    response.result({passphrase: password, storeSecret: false})
  }

  getCustomResponseIncomingCallMap = () =>
    this._addingANewDevice
      ? {
          'keybase.1.provisionUi.DisplayAndPromptSecret': this.displayAndPromptSecretHandler,
          'keybase.1.provisionUi.chooseDeviceType': this.chooseDeviceTypeHandler,
        }
      : {
          'keybase.1.gpgUi.selectKey': Constants.cancelOnCallback,
          'keybase.1.loginUi.getEmailOrUsername': Constants.cancelOnCallback,
          'keybase.1.provisionUi.DisplayAndPromptSecret': this.displayAndPromptSecretHandler,
          'keybase.1.provisionUi.PromptNewDeviceName': this.promptNewDeviceNameHandler,
          'keybase.1.provisionUi.chooseDevice': this.chooseDeviceHandler,
          'keybase.1.provisionUi.chooseGPGMethod': this.chooseGPGMethodHandler,
          'keybase.1.provisionUi.switchToGPGSignOK': this.switchToGPGSignOKHandler,
          'keybase.1.secretUi.getPassphrase': this.getPasswordHandler,
        }

  getIncomingCallMap = () =>
    this._addingANewDevice
      ? {
          'keybase.1.provisionUi.DisplaySecretExchanged': ignoreCallback,
          'keybase.1.provisionUi.ProvisioneeSuccess': ignoreCallback,
          'keybase.1.provisionUi.ProvisionerSuccess': ignoreCallback,
        }
      : {
          'keybase.1.loginUi.displayPrimaryPaperKey': ignoreCallback,
          'keybase.1.provisionUi.DisplaySecretExchanged': ignoreCallback,
          'keybase.1.provisionUi.ProvisioneeSuccess': ignoreCallback,
          'keybase.1.provisionUi.ProvisionerSuccess': ignoreCallback,
        }

  showCodePage = () =>
    RouteTreeGen.createNavigateAppend({
      path: ['codePage'],
      replace: true,
    })

  maybeCancelProvision = () => {
    // TODO fix
    // let root = state.routeTree.routeState && state.routeTree.routeState.selected
    // let onDevicesTab = root === devicesRoot[0]
    // let onLoginTab = root === Tabs.loginTab
    // const path = Router2Constants.getFullRoute().map(p => p.routeName)
    // onDevicesTab = path.includes(devicesRoot[0])
    // onLoginTab = path.includes('login')
    // const doingDeviceAdd = this._addingANewDevice && onDevicesTab
    // const doingProvision = !this._addingANewDevice && onLoginTab
    // if (doingDeviceAdd || doingProvision) {
    // // cancel if we're waiting on anything
    // const response = this._stashedResponse
    // if (response) {
    // Constants.cancelOnCallback(null, response)
    // }
    // this._stashedResponse = null
    // this._stashedResponseKey = null
    // // clear errors always, and nav to root if we actually canceled something
    // return [
    // ProvisionGen.createProvisionError({error: new HiddenString('')}),
    // response &&
    // RouteTreeGen.createNavigateTo({
    // parentPath: [],
    // path: doingDeviceAdd ? devicesRoot : ['login'],
    // }),
    // ]
    // }
  }
}

const makeProvisioningManager = (addingANewDevice: boolean): ProvisioningManager =>
  new ProvisioningManager(addingANewDevice, 'ONLY_CALL_THIS_FROM_HELPER')

/**
 * We are starting the provisioning process. This is largely controlled by the daemon. We get a callback to show various
 * screens and we stash the result object so we can show the screen. When the submit on that screen is done we find the stashedReponse and respond and wait
 */
function* startProvisioning(state: Container.TypedState) {
  makeProvisioningManager(false)
  try {
    const username = state.provision.username
    if (!username) {
      return
    }

    yield RPCTypes.loginLoginRpcSaga({
      customResponseIncomingCallMap: ProvisioningManager.getSingleton().getCustomResponseIncomingCallMap(),
      incomingCallMap: ProvisioningManager.getSingleton().getIncomingCallMap(),
      params: {
        clientType: RPCTypes.ClientType.guiMain,
        deviceName: '',
        deviceType: isMobile ? 'mobile' : 'desktop',
        doUserSwitch: flags.fastAccountSwitch,
        paperKey: '',
        username: username,
      },
      waitingKey: Constants.waitingKey,
    })
    ProvisioningManager.getSingleton().done('provision call done w/ success')
  } catch (finalError) {
    ProvisioningManager.getSingleton().done(
      'provision call done w/ error' + finalError ? finalError.message : ' unknown error'
    )
    // If it's a non-existent username or invalid, allow the opportunity to
    // correct it right there on the page.
    switch (finalError.code) {
      case RPCTypes.StatusCode.scnotfound:
      case RPCTypes.StatusCode.scbadusername:
        yield Saga.put(ProvisionGen.createShowInlineError({inlineError: finalError}))
        break
      default:
        yield Saga.put(ProvisionGen.createShowFinalErrorPage({finalError, fromDeviceAdd: false}))
        break
    }
  }
}

function* addNewDevice() {
  // Make a new handler each time just in case
  makeProvisioningManager(true)
  try {
    yield RPCTypes.deviceDeviceAddRpcSaga({
      customResponseIncomingCallMap: ProvisioningManager.getSingleton().getCustomResponseIncomingCallMap(),
      incomingCallMap: ProvisioningManager.getSingleton().getIncomingCallMap(),
      params: undefined,
      waitingKey: Constants.waitingKey,
    })
    ProvisioningManager.getSingleton().done('add device success')
    // Now refresh and nav back
    yield Saga.put(DevicesGen.createLoad())
    yield Saga.put(RouteTreeGen.createNavigateAppend({path: devicesRoot}))
    yield Saga.put(RouteTreeGen.createClearModals())
  } catch (finalError) {
    ProvisioningManager.getSingleton().done(finalError.message)

    yield Saga.put(ProvisionGen.createShowFinalErrorPage({finalError, fromDeviceAdd: true}))
    logger.error(`Provision -> Add device error: ${finalError.message}`)
  }
}

// We delegate these actions to the manager
const submitDeviceSelect = (state: Container.TypedState) =>
  ProvisioningManager.getSingleton().submitDeviceSelect(state)
const submitDeviceName = (state: Container.TypedState) =>
  ProvisioningManager.getSingleton().submitDeviceName(state)
const submitTextCode = (state: Container.TypedState) =>
  ProvisioningManager.getSingleton().submitTextCode(state)
const submitGPGMethod = (state: Container.TypedState, action: ProvisionGen.SubmitGPGMethodPayload) =>
  ProvisioningManager.getSingleton().submitGPGMethod(state, action)
const submitGPGSignOK = (state: Container.TypedState, action: ProvisionGen.SubmitGPGSignOKPayload) =>
  ProvisioningManager.getSingleton().submitGPGSignOK(state, action)
const submitPasswordOrPaperkey = (
  state: Container.TypedState,
  action: ProvisionGen.SubmitPasswordPayload | ProvisionGen.SubmitPaperkeyPayload
) => ProvisioningManager.getSingleton().submitPasswordOrPaperkey(state, action)
const maybeCancelProvision = () => ProvisioningManager.getSingleton().maybeCancelProvision()

const showDeviceListPage = (state: Container.TypedState) =>
  !state.provision.error.stringValue() &&
  RouteTreeGen.createNavigateAppend({path: ['selectOtherDevice'], replace: true})

const showNewDeviceNamePage = (state: Container.TypedState) =>
  !state.provision.error.stringValue() &&
  RouteTreeGen.createNavigateAppend({
    path: ['setPublicName'],
    replace: true,
  })

const showCodePage = (state: Container.TypedState) =>
  !state.provision.error.stringValue() && ProvisioningManager.getSingleton().showCodePage()

const showGPGPage = (state: Container.TypedState) =>
  !state.provision.error.stringValue() &&
  RouteTreeGen.createNavigateAppend({path: ['gpgSign'], replace: true})

const showPasswordPage = (state: Container.TypedState) =>
  !state.provision.error.stringValue() &&
  RouteTreeGen.createNavigateAppend({path: ['password'], replace: true})

const showPaperkeyPage = (state: Container.TypedState) =>
  !state.provision.error.stringValue() &&
  RouteTreeGen.createNavigateAppend({path: ['paperkey'], replace: true})

const showFinalErrorPage = (state: Container.TypedState, action: ProvisionGen.ShowFinalErrorPagePayload) => {
  const parentPath = action.payload.fromDeviceAdd ? devicesRoot : ['login']
  let path: Array<string>
  if (state.provision.finalError && !Constants.errorCausedByUsCanceling(state.provision.finalError)) {
    path = ['error']
  } else {
    path = []
  }

  return RouteTreeGen.createNavigateAppend({path: [...parentPath, ...path], replace: true})
}

const showUsernameEmailPage = () => RouteTreeGen.createNavigateAppend({path: ['username']})

const forgotUsername = (_: Container.TypedState, action: ProvisionGen.ForgotUsernamePayload) =>
  RPCTypes.accountRecoverUsernameWithEmailRpcPromise(
    {email: action.payload.email},
    Constants.forgotUsernameWaitingKey
  )
    .then(() => ProvisionGen.createForgotUsernameResult({result: 'success'}))
    .catch(error =>
      ProvisionGen.createForgotUsernameResult({
        result: Constants.decodeForgotUsernameError(error),
      })
    )

function* provisionSaga(): Saga.SagaGenerator<any, any> {
  // Always ensure we have one live
  makeProvisioningManager(false)

  // Start provision
  yield* Saga.chainGenerator<ProvisionGen.SubmitUsernamePayload>(
    ProvisionGen.submitUsername,
    startProvisioning
  )
  yield* Saga.chainGenerator<ProvisionGen.AddNewDevicePayload>(ProvisionGen.addNewDevice, addNewDevice)

  // Submits
  yield* Saga.chainAction2(ProvisionGen.submitDeviceSelect, submitDeviceSelect)
  yield* Saga.chainAction2(ProvisionGen.submitDeviceName, submitDeviceName)
  yield* Saga.chainAction2(ProvisionGen.submitTextCode, submitTextCode)
  yield* Saga.chainAction2(ProvisionGen.submitGPGMethod, submitGPGMethod)
  yield* Saga.chainAction2(ProvisionGen.submitGPGSignOK, submitGPGSignOK)
  yield* Saga.chainAction2(
    [ProvisionGen.submitPassword, ProvisionGen.submitPaperkey],
    submitPasswordOrPaperkey
  )

  // Screens
  yield* Saga.chainAction2(ProvisionGen.startProvision, showUsernameEmailPage)
  yield* Saga.chainAction2(ProvisionGen.showDeviceListPage, showDeviceListPage)
  yield* Saga.chainAction2(ProvisionGen.showNewDeviceNamePage, showNewDeviceNamePage)
  yield* Saga.chainAction2(ProvisionGen.showCodePage, showCodePage)
  yield* Saga.chainAction2(ProvisionGen.showGPGPage, showGPGPage)
  yield* Saga.chainAction2(ProvisionGen.showPasswordPage, showPasswordPage)
  yield* Saga.chainAction2(ProvisionGen.showPaperkeyPage, showPaperkeyPage)
  yield* Saga.chainAction2(ProvisionGen.showFinalErrorPage, showFinalErrorPage)
  yield* Saga.chainAction2(ProvisionGen.forgotUsername, forgotUsername)
}

export const _testing = {
  makeProvisioningManager,
  maybeCancelProvision,
}

export default provisionSaga
