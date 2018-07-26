// @flow
import * as Constants from '../constants/provision'
import * as RouteConstants from '../constants/route-tree'
import * as DevicesGen from './devices-gen'
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
import type {CommonResponseHandler} from '../engine/types'

const devicesRoot = isMobile ? [Tabs.settingsTab, settingsDevicesTab] : [Tabs.devicesTab]

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
  | 'keybase.1.secretUi.getPassphrase'

const cancelOnCallback = (_: any, response: CommonResponseHandler, __: any) => {
  response.error({code: RPCTypes.constantsStatusCode.scgeneric, desc: Constants.cancelDesc})
}
const ignoreCallback = (_: any, __: any) => {}

// The provisioning flow is very stateful so we use a class to handle bookkeeping
// We only allow one manager to be alive at a time
// Can be made for a regular provision or if we're adding a device
class ProvisioningManager {
  static singleton: ?ProvisioningManager = null
  static getSingleton = (): ProvisioningManager => {
    if (!ProvisioningManager.singleton) {
      throw new Error('No ProvisioningManager')
    }
    return ProvisioningManager.singleton
  }
  _stashedResponse = null
  _stashedResponseKey: ?ValidCallback = null
  _addingANewDevice: boolean

  constructor(addingANewDevice: boolean, onlyCallThisFromTheHelper: 'ONLY_CALL_THIS_FROM_HELPER') {
    this._addingANewDevice = addingANewDevice
    ProvisioningManager.singleton = this
  }

  _stashResponse = (key: ValidCallback, response: any) => {
    this._stashedResponse = response
    this._stashedResponseKey = key
  }

  _getAndClearResponse = (key: ValidCallback) => {
    if (this._stashedResponseKey !== key) {
      throw new Error(`Invalid response key used wants: ${key} has: ${this._stashedResponseKey || ''}`)
    }
    const response = this._stashedResponse
    this._stashedResponse = null
    return response
  }

  // Choosing a device to use to provision
  chooseDeviceHandler = (
    params: RPCTypes.ProvisionUiChooseDeviceRpcParam,
    response: CommonResponseHandler,
    state: TypedState
  ) => {
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
  chooseDeviceTypeHandler = (
    params: RPCTypes.ProvisionUiChooseDeviceTypeRpcParam,
    response: CommonResponseHandler,
    state: TypedState
  ) => {
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
  promptNewDeviceNameHandler = (
    params: RPCTypes.ProvisionUiPromptNewDeviceNameRpcParam,
    response: CommonResponseHandler,
    state: TypedState
  ) => {
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
    response: CommonResponseHandler,
    state: TypedState
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

    if (!state.provision.codePageOutgoingTextCode.stringValue()) {
      response.error()
      throw new Error('Tried to submit a code but missing in store')
    }

    response.result({code: null, phrase: state.provision.codePageOutgoingTextCode.stringValue()})
  }

  // Trying to use gpg flow
  chooseGPGMethodHandler = (
    params: RPCTypes.ProvisionUiChooseGPGMethodRpcParam,
    response: CommonResponseHandler,
    state: TypedState
  ) => {
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
  getPassphraseHandler = (
    params: RPCTypes.SecretUiGetPassphraseRpcParam,
    response: CommonResponseHandler,
    state: TypedState
  ) => {
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

  maybeCancelProvision = (state: TypedState) => {
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
      // clear errors
      return Saga.put(ProvisionGen.createProvisionError({error: new HiddenString('')}))
    }
  }
}

const makeProvisioningManager = (addingANewDevice: boolean): ProvisioningManager =>
  new ProvisioningManager(addingANewDevice, 'ONLY_CALL_THIS_FROM_HELPER')

/**
 * We are starting the provisioning process. This is largely controlled by the daemon. We get a callback to show various
 * screens and we stash the result object so we can show the screen. When the submit on that screen is done we find the stashedReponse and respond and wait
 */
const startProvisioning = (state: TypedState) =>
  Saga.call(function*() {
    makeProvisioningManager(false)
    try {
      const usernameOrEmail = state.provision.usernameOrEmail
      if (!usernameOrEmail) {
        return
      }

      yield RPCTypes.loginLoginRpcSaga({
        incomingCallMap: ProvisioningManager.getSingleton().getIncomingCallMap(),
        params: {
          clientType: RPCTypes.commonClientType.guiMain,
          deviceType: isMobile ? 'mobile' : 'desktop',
          usernameOrEmail,
        },
        waitingKey: Constants.waitingKey,
      })
    } catch (finalError) {
      yield Saga.put(ProvisionGen.createShowFinalErrorPage({finalError}))
    }
  })

const addNewDevice = (state: TypedState) =>
  Saga.call(function*() {
    // Make a new handler each time just in case
    makeProvisioningManager(true)
    try {
      yield RPCTypes.deviceDeviceAddRpcSaga({
        incomingCallMap: ProvisioningManager.getSingleton().getIncomingCallMap(),
        params: undefined,
        waitingKey: Constants.waitingKey,
      })
      // Now refresh and nav back
      yield Saga.put(DevicesGen.createLoad())
      yield Saga.put(RouteTree.navigateTo([], devicesRoot))
    } catch (e) {
      // If we're canceling then ignore the error
      if (e.desc !== Constants.cancelDesc) {
        yield Saga.put(ProvisionGen.createProvisionError({error: new HiddenString(niceError(e))}))
      }
    }
  })

// We delegate these actions to the manager
const submitDeviceSelect = (state: TypedState) => ProvisioningManager.getSingleton().submitDeviceSelect(state)
const submitDeviceName = (state: TypedState) => ProvisioningManager.getSingleton().submitDeviceName(state)
const submitTextCode = (state: TypedState) => ProvisioningManager.getSingleton().submitTextCode(state)
const submitGPGMethod = (state: TypedState, action: ProvisionGen.SubmitGPGMethodPayload) =>
  ProvisioningManager.getSingleton().submitGPGMethod(state, action)
const submitPassphraseOrPaperkey = (
  state: TypedState,
  action: ProvisionGen.SubmitPassphrasePayload | ProvisionGen.SubmitPaperkeyPayload
) => ProvisioningManager.getSingleton().submitPassphraseOrPaperkey(state, action)
const maybeCancelProvision = (state: TypedState) =>
  ProvisioningManager.getSingleton().maybeCancelProvision(state)

const showDeviceListPage = (state: TypedState) =>
  !state.provision.error.stringValue() &&
  Saga.put(RouteTree.navigateAppend(['selectOtherDevice'], [Tabs.loginTab, 'login']))

const showNewDeviceNamePage = (state: TypedState) =>
  !state.provision.error.stringValue() &&
  Saga.put(RouteTree.navigateAppend(['setPublicName'], [Tabs.loginTab, 'login']))

const showCodePage = (state: TypedState) =>
  !state.provision.error.stringValue() && ProvisioningManager.getSingleton().showCodePage()

const showGPGPage = (state: TypedState) =>
  !state.provision.error.stringValue() &&
  Saga.put(RouteTree.navigateAppend(['gpgSign'], [Tabs.loginTab, 'login']))

const showPassphrasePage = (state: TypedState) =>
  !state.provision.error.stringValue() &&
  Saga.put(RouteTree.navigateAppend(['passphrase'], [Tabs.loginTab, 'login']))

const showPaperkeyPage = (state: TypedState) =>
  !state.provision.error.stringValue() &&
  Saga.put(RouteTree.navigateAppend(['paperkey'], [Tabs.loginTab, 'login']))

const showFinalErrorPage = (state: TypedState) => {
  if (state.provision.finalError && state.provision.finalError.desc !== Constants.cancelDesc) {
    return Saga.put(RouteTree.navigateAppend(['error'], [Tabs.loginTab, 'login']))
  } else {
    return Saga.put(RouteTree.navigateTo([], [Tabs.loginTab, 'login']))
  }
}

const showUsernameEmailPage = () =>
  Saga.put(RouteTree.navigateTo(['login', 'usernameOrEmail'], [Tabs.loginTab]))

function* provisionSaga(): Saga.SagaGenerator<any, any> {
  // Always ensure we have one live
  makeProvisioningManager(false)

  // Start provision
  yield Saga.actionToAction(ProvisionGen.submitUsernameOrEmail, startProvisioning)
  yield Saga.actionToAction(ProvisionGen.addNewDevice, addNewDevice)

  // Submits
  yield Saga.actionToAction(ProvisionGen.submitDeviceSelect, submitDeviceSelect)
  yield Saga.actionToAction(ProvisionGen.submitDeviceName, submitDeviceName)
  yield Saga.actionToAction(ProvisionGen.submitTextCode, submitTextCode)
  yield Saga.actionToAction(ProvisionGen.submitGPGMethod, submitGPGMethod)
  yield Saga.actionToAction(
    [ProvisionGen.submitPassphrase, ProvisionGen.submitPaperkey],
    submitPassphraseOrPaperkey
  )

  // Screens
  yield Saga.actionToAction(ProvisionGen.startProvision, showUsernameEmailPage)
  yield Saga.actionToAction(ProvisionGen.showDeviceListPage, showDeviceListPage)
  yield Saga.actionToAction(ProvisionGen.showNewDeviceNamePage, showNewDeviceNamePage)
  yield Saga.actionToAction(ProvisionGen.showCodePage, showCodePage)
  yield Saga.actionToAction(ProvisionGen.showGPGPage, showGPGPage)
  yield Saga.actionToAction(ProvisionGen.showPassphrasePage, showPassphrasePage)
  yield Saga.actionToAction(ProvisionGen.showPaperkeyPage, showPaperkeyPage)
  yield Saga.actionToAction(ProvisionGen.showFinalErrorPage, showFinalErrorPage)

  yield Saga.actionToAction(RouteConstants.navigateUp, maybeCancelProvision)
}

export const _testing = {
  makeProvisioningManager,
  maybeCancelProvision,
}

export default provisionSaga
