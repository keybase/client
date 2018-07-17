// @flow
import * as Constants from '../constants/provision'
import * as RouteConstants from '../constants/route-tree'
import * as RouteTypes from '../constants/types/route-tree'
import * as DevicesGen from './devices-gen'
import * as WaitingGen from './waiting-gen'
import * as ProvisionGen from './provision-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as RouteTree from './route-tree'
import * as Tabs from '../constants/tabs'
import {isMobile} from '../constants/platform'
import HiddenString from '../util/hidden-string'
import {type TypedState} from '../constants/reducer'
import {niceError} from '../util/errors'
import {devicesTab as settingsDevicesTab} from '../constants/settings'

const devicesRoot = isMobile ? [Tabs.settingsTab, settingsDevicesTab] : [Tabs.devicesTab]

type ValidCallbacks =
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
  | 'keybase.1.secretUi.getPassphrase'

const cancelDesc = 'Canceling RPC'

const cancelOnCallback = (_, response, __) => {
  response.error({code: RPCTypes.constantsStatusCode.scgeneric, desc: cancelDesc})
}
const ignoreCallback = (_, __) => {}

// The provisioning flow is very stateful so we use a class to handle bookkeeping
// We only allow one manager to be alive at a time
// Can be made for a regular provision or if we're adding a device
class ProvisioningManager {
  _stashedResponse = null
  _stashedResponseKey: ?ValidCallbacks = null
  _addingANewDevice: boolean

  constructor(addingANewDevice: boolean) {
    this._addingANewDevice = addingANewDevice
  }

  _stashResponse = (key: ValidCallbacks, response: any) => {
    this._stashedResponse = response
    this._stashedResponseKey = key
  }

  _getAndClearResponse = (key: ValidCallbacks) => {
    if (this._stashedResponseKey !== key) {
      throw new Error(`Invalid response key used wants: ${key} has: ${this._stashedResponseKey || ''}`)
    }
    const response = this._stashedResponse
    this._stashedResponse = null
    return response
  }

  // Choosing a device to use to provision
  chooseDeviceHandler = (params: RPCTypes.ProvisionUiChooseDeviceRpcParam, response, state) => {
    this._stashResponse('keybase.1.provisionUi.chooseDevice', response)
    return Saga.put(
      ProvisionGen.createShowDeviceListPage({
        devices: (params.devices || []).map(d => Constants.rpcDeviceToDevice(d)),
      })
    )
  }

  submitDeviceSelect = (state: TypedState) => {
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
  chooseDeviceTypeHandler = (params: RPCTypes.ProvisionUiChooseDeviceTypeRpcParam, response, state) => {
    let type
    switch (state.provision.codePageOtherDeviceType) {
      case 'mobile':
        type = RPCTypes.commonDeviceType.mobile
        break
      case 'desktop':
        type = RPCTypes.commonDeviceType.desktop
        break
      default:
        response.error()
        throw new Error('Tried to add a device but of unknown type' + state.provision.codePageOtherDeviceType)
    }

    response.result(type)
  }

  // Choosing a name for this new device
  promptNewDeviceNameHandler = (params: RPCTypes.ProvisionUiPromptNewDeviceNameRpcParam, response, state) => {
    this._stashResponse('keybase.1.provisionUi.PromptNewDeviceName', response)
    return Saga.put(
      ProvisionGen.createShowNewDeviceNamePage({
        error: params.errorMessage ? new HiddenString(params.errorMessage) : null,
        existingDevices: params.existingDevices || [],
      })
    )
  }

  submitDeviceName = (state: TypedState) => {
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
  displayAndPromptSecretHandler = (
    params: RPCTypes.ProvisionUiDisplayAndPromptSecretRpcParam,
    response,
    state
  ) => {
    this._stashResponse('keybase.1.provisionUi.DisplayAndPromptSecret', response)
    return Saga.put(
      ProvisionGen.createShowCodePage({
        code: new HiddenString(params.phrase),
        error: params.previousErr ? new HiddenString(params.previousErr) : null,
      })
    )
  }

  submitTextCode = (state: TypedState) => {
    // local error, ignore
    if (state.provision.error.stringValue()) {
      return
    }

    const response = this._getAndClearResponse('keybase.1.provisionUi.DisplayAndPromptSecret')
    if (!response || !response.result) {
      throw new Error('Tried to submit a code but missing callback')
    }

    if (!state.provision.codePageTextCode.stringValue()) {
      response.error()
      throw new Error('Tried to submit a code but missing in store')
    }

    response.result({code: null, phrase: state.provision.codePageTextCode.stringValue()})
  }

  // Trying to use gpg flow
  chooseGPGMethodHandler = (params: RPCTypes.ProvisionUiChooseGPGMethodRpcParam, response, state) => {
    this._stashResponse('keybase.1.provisionUi.chooseGPGMethod', response)
    return Saga.put(ProvisionGen.createShowGPGPage())
  }
  submitGPGMethod = (state: TypedState, action: ProvisionGen.SubmitGPGMethodPayload) => {
    // local error, ignore
    if (state.provision.error.stringValue()) {
      return
    }

    const response = this._getAndClearResponse('keybase.1.provisionUi.chooseGPGMethod')
    if (!response || !response.result) {
      throw new Error('Tried to submit gpg export but missing callback')
    }

    response.result(
      action.payload.exportKey
        ? RPCTypes.provisionUiGPGMethod.gpgImport
        : RPCTypes.provisionUiGPGMethod.gpgSign
    )
  }

  // User has an uploaded key so we can use a passphrase OR they selected a paperkey
  getPassphraseHandler = (params: RPCTypes.SecretUiGetPassphraseRpcParam, response, state) => {
    this._stashResponse('keybase.1.secretUi.getPassphrase', response)

    let error = ''
    // Service asking us again due to an error?
    if (params.pinentry.retryLabel) {
      error = params.pinentry.retryLabel
    }

    switch (params.pinentry.type) {
      case RPCTypes.passphraseCommonPassphraseType.passPhrase:
        return Saga.put(
          ProvisionGen.createShowPassphrasePage({error: error ? new HiddenString(error) : null})
        )
      case RPCTypes.passphraseCommonPassphraseType.paperKey:
        return Saga.put(ProvisionGen.createShowPaperkeyPage({error: error ? new HiddenString(error) : null}))
      default:
        throw new Error('Got confused about passphrase entry. Please send a log to us!')
    }
  }
  submitPassphraseOrPaperkey = (
    state: TypedState,
    action: ProvisionGen.SubmitPassphrasePayload | ProvisionGen.SubmitPaperkeyPayload
  ) => {
    // local error, ignore
    if (state.provision.error.stringValue()) {
      return
    }

    const response = this._getAndClearResponse('keybase.1.secretUi.getPassphrase')
    if (!response || !response.result) {
      throw new Error('Tried to submit passphrase but missing callback')
    }

    const passphrase =
      action.type === ProvisionGen.submitPassphrase
        ? action.payload.passphrase.stringValue()
        : action.payload.paperkey.stringValue()

    response.result({passphrase, storeSecret: false})
  }

  getIncomingCallMap = () =>
    this._addingANewDevice
      ? {
          'keybase.1.provisionUi.DisplayAndPromptSecret': this.displayAndPromptSecretHandler,
          'keybase.1.provisionUi.DisplaySecretExchanged': ignoreCallback,
          'keybase.1.provisionUi.ProvisioneeSuccess': ignoreCallback,
          'keybase.1.provisionUi.ProvisionerSuccess': ignoreCallback,
          'keybase.1.provisionUi.chooseDeviceType': this.chooseDeviceTypeHandler,
        }
      : {
          'keybase.1.gpgUi.selectKey': cancelOnCallback,
          'keybase.1.loginUi.displayPrimaryPaperKey': ignoreCallback,
          'keybase.1.loginUi.getEmailOrUsername': cancelOnCallback,
          'keybase.1.provisionUi.DisplayAndPromptSecret': this.displayAndPromptSecretHandler,
          'keybase.1.provisionUi.DisplaySecretExchanged': ignoreCallback,
          'keybase.1.provisionUi.PromptNewDeviceName': this.promptNewDeviceNameHandler,
          'keybase.1.provisionUi.ProvisioneeSuccess': ignoreCallback,
          'keybase.1.provisionUi.ProvisionerSuccess': ignoreCallback,
          'keybase.1.provisionUi.chooseDevice': this.chooseDeviceHandler,
          'keybase.1.provisionUi.chooseGPGMethod': this.chooseGPGMethodHandler,
          'keybase.1.secretUi.getPassphrase': this.getPassphraseHandler,
        }

  showCodePage = () =>
    this._addingANewDevice
      ? Saga.put(RouteTree.navigateAppend(['codePage'], devicesRoot))
      : Saga.put(RouteTree.navigateAppend(['codePage'], [Tabs.loginTab, 'login']))

  maybeCancelProvision = (state: TypedState, action: RouteTypes.NavigateUp) => {
    // We're not waiting on anything
    if (!this._stashedResponse) {
      return
    }

    const root = state.routeTree.routeState && state.routeTree.routeState.selected
    const response = this._stashedResponse

    if (
      (this._addingANewDevice && root === devicesRoot[0]) ||
      (!this._addingANewDevice && root === Tabs.loginTab)
    ) {
      cancelOnCallback(null, response, null)
      this._stashedResponse = null
      this._stashedResponseKey = null
    }
  }
}

// Never let this be null to help flow
let theProvisioningManager = new ProvisioningManager(false)

/**
 * We are starting the provisioning process. This is largely controlled by the daemon. We get a callback to show various
 * screens and we stash the result object so we can show the screen. When the submit on that screen is done we find the stashedReponse and respond and wait
 */
const startProvisioning = (state: TypedState) =>
  Saga.call(function*() {
    theProvisioningManager = new ProvisioningManager(false)
    try {
      const usernameOrEmail = state.provision.usernameOrEmail
      if (!usernameOrEmail) {
        return
      }

      yield RPCTypes.loginLoginRpcSaga({
        incomingCallMap: theProvisioningManager.getIncomingCallMap(),
        params: {
          clientType: RPCTypes.commonClientType.guiMain,
          deviceType: isMobile ? 'mobile' : 'desktop',
          usernameOrEmail,
        },
        waitingKey: Constants.waitingKey,
      })
    } catch (finalError) {
      // If we're canceling then ignore the error
      if (finalError.desc !== cancelDesc) {
        yield Saga.put(ProvisionGen.createShowFinalErrorPage({finalError}))
      }
    }
  })

const addNewDevice = (state: TypedState) =>
  Saga.call(function*() {
    // Make a new handler each time just in case
    theProvisioningManager = new ProvisioningManager(true)
    try {
      yield RPCTypes.deviceDeviceAddRpcSaga({
        incomingCallMap: theProvisioningManager.getIncomingCallMap(),
        params: undefined,
        waitingKey: Constants.waitingKey,
      })
      // Now refresh and nav back
      yield Saga.put(DevicesGen.createDevicesLoad())
      yield Saga.put(RouteTree.navigateTo([], devicesRoot))
    } catch (e) {
      // If we're canceling then ignore the error
      if (e.desc !== cancelDesc) {
        yield Saga.put(ProvisionGen.createProvisionError({error: new HiddenString(niceError(e))}))
      }
    }
  })

// We delegate these actions to the manager
const submitDeviceSelect = (state: TypedState) => theProvisioningManager.submitDeviceSelect(state)
const submitDeviceName = (state: TypedState) => theProvisioningManager.submitDeviceName(state)
const submitTextCode = (state: TypedState) => theProvisioningManager.submitTextCode(state)
const submitGPGMethod = (state: TypedState, action: ProvisionGen.SubmitGPGMethodPayload) =>
  theProvisioningManager.submitGPGMethod(state, action)
const submitPassphraseOrPaperkey = (
  state: TypedState,
  action: ProvisionGen.SubmitPassphrasePayload | ProvisionGen.SubmitPaperkeyPayload
) => theProvisioningManager.submitPassphraseOrPaperkey(state, action)
const maybeCancelProvision = (state: TypedState, action: RouteTypes.NavigateUp) =>
  theProvisioningManager.maybeCancelProvision(state, action)

const showDeviceListPage = (state: TypedState) =>
  !state.provision.error.stringValue() &&
  Saga.put(RouteTree.navigateAppend(['selectOtherDevice'], [Tabs.loginTab, 'login']))

const showNewDeviceNamePage = (state: TypedState) =>
  !state.provision.error.stringValue() &&
  Saga.put(RouteTree.navigateAppend(['setPublicName'], [Tabs.loginTab, 'login']))

const showCodePage = (state: TypedState) =>
  !state.provision.error.stringValue() && theProvisioningManager.showCodePage()

const showGPGPage = (state: TypedState) =>
  !state.provision.error.stringValue() &&
  Saga.put(RouteTree.navigateAppend(['gpgSign'], [Tabs.loginTab, 'login']))

const showPassphrasePage = (state: TypedState) =>
  !state.provision.error.stringValue() &&
  Saga.put(RouteTree.navigateAppend(['passphrase'], [Tabs.loginTab, 'login']))

const showPaperkeyPage = (state: TypedState) =>
  !state.provision.error.stringValue() &&
  Saga.put(RouteTree.navigateAppend(['paperkey'], [Tabs.loginTab, 'login']))

const showFinalErrorPage = (state: TypedState) =>
  state.provision.finalError && Saga.put(RouteTree.navigateAppend(['error'], [Tabs.loginTab, 'login']))

function* provisionSaga(): Saga.SagaGenerator<any, any> {
  // Start provision
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.submitUsernameOrEmail, startProvisioning)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.addNewDevice, addNewDevice)

  // Submits
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.submitDeviceSelect, submitDeviceSelect)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.submitDeviceName, submitDeviceName)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.submitTextCode, submitTextCode)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.submitGPGMethod, submitGPGMethod)
  yield Saga.safeTakeEveryPureSimple(
    [ProvisionGen.submitPassphrase, ProvisionGen.submitPaperkey],
    submitPassphraseOrPaperkey
  )

  // Screens
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.showDeviceListPage, showDeviceListPage)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.showNewDeviceNamePage, showNewDeviceNamePage)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.showCodePage, showCodePage)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.showGPGPage, showGPGPage)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.showPassphrasePage, showPassphrasePage)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.showPaperkeyPage, showPaperkeyPage)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.showFinalErrorPage, showFinalErrorPage)

  yield Saga.safeTakeEveryPureSimple(RouteConstants.navigateUp, maybeCancelProvision)
}

export default provisionSaga
