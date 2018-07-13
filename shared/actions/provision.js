// @flow
import * as Constants from '../constants/provision'
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

// The provisioning flow is very stateful so we keep that state here.
class ProvisioningManager {
  _stashedResponse = null
  _stashedResponseKey: ?ValidCallbacks = null

  stashResponse = (key: ValidCallbacks, response: any) => {
    this._stashedResponse = response
    this._stashedResponseKey = key
  }

  getAndClearResponse = (key: ValidCallbacks) => {
    if (this._stashedResponseKey !== key) {
      throw new Error(`Invalid response key used wants: ${key} has: ${this._stashedResponseKey || ''}`)
    }
    const response = this._stashedResponse
    this._stashedResponse = null
    return response
  }
}

let provisioningManager = new ProvisioningManager()

// Choosing a device to use to provision
const chooseDeviceHandler = (params: RPCTypes.ProvisionUiChooseDeviceRpcParam, response, state) => {
  provisioningManager.stashResponse('keybase.1.provisionUi.chooseDevice', response)
  return Saga.put(
    ProvisionGen.createShowDeviceListPage({
      canSelectNoDevice: params.canSelectNoDevice,
      devices: (params.devices || []).map(d => Constants.rpcDeviceToDevice(d)),
    })
  )
}
const submitProvisionDeviceSelect = (state: TypedState) => {
  const response = provisioningManager.getAndClearResponse('keybase.1.provisionUi.chooseDevice')
  if (!response || !response.result) {
    throw new Error('Tried to submit a device choice but missing callback')
  }

  if (!state.provision.selectedDevice) {
    response.error()
    throw new Error('Tried to submit a device choice but missing device in store')
  }

  response.result(state.provision.selectedDevice.id)
}

// Choosing a name for this new device
const promptNewDeviceNameHandler = (
  params: RPCTypes.ProvisionUiPromptNewDeviceNameRpcParam,
  response,
  state
) => {
  provisioningManager.stashResponse('keybase.1.provisionUi.PromptNewDeviceName', response)
  return Saga.put(
    ProvisionGen.createShowNewDeviceNamePage({
      error: params.errorMessage ? new HiddenString(params.errorMessage) : null,
      existingDevices: params.existingDevices || [],
    })
  )
}
const submitProvisionDeviceName = (state: TypedState) => {
  // local error, ignore
  if (state.provision.error) {
    return
  }

  const response = provisioningManager.getAndClearResponse('keybase.1.provisionUi.PromptNewDeviceName')
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
const displayAndPromptSecretHandler = (
  params: RPCTypes.ProvisionUiDisplayAndPromptSecretRpcParam,
  response,
  state
) => {
  provisioningManager.stashResponse('keybase.1.provisionUi.DisplayAndPromptSecret', response)
  return Saga.put(
    ProvisionGen.createShowCodePage({
      code: new HiddenString(params.phrase),
      error: params.previousErr ? new HiddenString(params.previousErr) : null,
    })
  )
}
const submitProvisionTextCode = (state: TypedState) => {
  // local error, ignore
  if (state.provision.error) {
    return
  }

  const response = provisioningManager.getAndClearResponse('keybase.1.provisionUi.DisplayAndPromptSecret')
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
const chooseGPGMethodHandler = (params: RPCTypes.ProvisionUiChooseGPGMethodRpcParam, response, state) => {
  provisioningManager.stashResponse('keybase.1.provisionUi.chooseGPGMethod', response)
  return Saga.put(ProvisionGen.createShowGPGPage())
}
const submitProvisionGPGMethod = (
  state: TypedState,
  action: ProvisionGen.SubmitProvisionGPGMethodPayload
) => {
  // local error, ignore
  if (state.provision.error) {
    return
  }

  const response = provisioningManager.getAndClearResponse('keybase.1.provisionUi.chooseGPGMethod')
  if (!response || !response.result) {
    throw new Error('Tried to submit gpg export but missing callback')
  }

  response.result(
    action.payload.exportKey ? RPCTypes.provisionUiGPGMethod.gpgImport : RPCTypes.provisionUiGPGMethod.gpgSign
  )
}

// User has an uploaded key so we can use a passphrase
const getPassphraseHandler = (params: RPCTypes.SecretUiGetPassphraseRpcParam, response, state) => {
  provisioningManager.stashResponse('keybase.1.secretUi.getPassphrase', response)

  if (params.pinentry.type === RPCTypes.passphraseCommonPassphraseType.passPhrase) {
    let error = ''
    // Service asking us again due to a bad passphrase?
    if (params.pinentry.retryLabel) {
      error = params.pinentry.retryLabel
    }

    return Saga.put(ProvisionGen.createShowPassphrasePage({error: error ? new HiddenString(error) : null}))
  } else {
    throw new Error('Got confused about passphrase entry. Please send a log to us!')
  }
}
const submitProvisionPassphrase = (
  state: TypedState,
  action: ProvisionGen.SubmitProvisionPassphrasePayload
) => {
  // local error, ignore
  if (state.provision.error) {
    return
  }

  const response = provisioningManager.getAndClearResponse('keybase.1.secretUi.getPassphrase')
  if (!response || !response.result) {
    throw new Error('Tried to submit passphrase but missing callback')
  }

  response.result({passphrase: action.payload.passphrase.stringValue(), storeSecret: false})
}

/**
 * We are starting the provisioning process. This is largely controlled by the daemon. We get a callback to show various
 * screens and we stash the result object so we can show the screen. When the submit on that screen is done we find the stashedReponse and respond and wait
 */
const startProvisioning = (state: TypedState) =>
  Saga.call(function*() {
    // Make a new handler each time just in case
    provisioningManager = new ProvisioningManager()

    try {
      const usernameOrEmail = state.provision.usernameOrEmail
      if (!usernameOrEmail) {
        return
      }

      const cancelOnCallback = (params, response, state) => {
        response.error({
          code: RPCTypes.constantsStatusCode.scgeneric,
          desc: 'Canceling RPC',
        })
      }
      const ignoreCallback = (params, state) => {}

      // We don't want the waiting key to be positive during this whole process so we do a decrement first so its not going 1,2,1,2,1,2
      yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.waitingKey}))

      yield RPCTypes.loginLoginRpcSaga({
        // cancel if we get any of these callbacks, we're logging in, not provisioning
        incomingCallMap: {
          'keybase.1.gpgUi.selectKey': cancelOnCallback,
          'keybase.1.loginUi.displayPrimaryPaperKey': ignoreCallback,
          'keybase.1.loginUi.getEmailOrUsername': cancelOnCallback,
          'keybase.1.provisionUi.DisplayAndPromptSecret': displayAndPromptSecretHandler,
          'keybase.1.provisionUi.DisplaySecretExchanged': ignoreCallback,
          'keybase.1.provisionUi.PromptNewDeviceName': promptNewDeviceNameHandler,
          'keybase.1.provisionUi.ProvisioneeSuccess': ignoreCallback,
          'keybase.1.provisionUi.ProvisionerSuccess': ignoreCallback,
          'keybase.1.provisionUi.chooseDevice': chooseDeviceHandler,
          // TODO test this
          'keybase.1.provisionUi.chooseGPGMethod': chooseGPGMethodHandler,
          'keybase.1.secretUi.getPassphrase': getPassphraseHandler,
        },
        params: {
          clientType: RPCTypes.commonClientType.guiMain,
          deviceType: isMobile ? 'mobile' : 'desktop',
          usernameOrEmail,
        },
        waitingKey: Constants.waitingKey,
      })
    } catch (e) {
      yield Saga.put(ProvisionGen.createProvisionError({error: new HiddenString(niceError(e))}))
    } finally {
      // Reset us to zero
      yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.waitingKey}))
    }
  })

const showDeviceListPage = (state: TypedState) =>
  !state.provision.error &&
  Saga.put(RouteTree.navigateAppend(['selectOtherDevice'], [Tabs.loginTab, 'login']))

const showNewDeviceNamePage = (state: TypedState) =>
  !state.provision.error && Saga.put(RouteTree.navigateAppend(['setPublicName'], [Tabs.loginTab, 'login']))

const showCodePage = (state: TypedState) =>
  !state.provision.error && Saga.put(RouteTree.navigateAppend(['codePage'], [Tabs.loginTab, 'login']))

const showGPGPage = (state: TypedState) =>
  !state.provision.error && Saga.put(RouteTree.navigateAppend(['gpgSign'], [Tabs.loginTab, 'login']))

const showPassphrasePage = (state: TypedState) =>
  !state.provision.error && Saga.put(RouteTree.navigateAppend(['passphrase'], [Tabs.loginTab, 'login']))

function* provisionSaga(): Saga.SagaGenerator<any, any> {
  // Start provision
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.submitUsernameOrEmail, startProvisioning)

  // Submits
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.submitProvisionDeviceSelect, submitProvisionDeviceSelect)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.submitProvisionDeviceName, submitProvisionDeviceName)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.submitProvisionTextCode, submitProvisionTextCode)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.submitProvisionGPGMethod, submitProvisionGPGMethod)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.submitProvisionPassphrase, submitProvisionPassphrase)

  // Screens
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.showDeviceListPage, showDeviceListPage)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.showNewDeviceNamePage, showNewDeviceNamePage)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.showCodePage, showCodePage)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.showGPGPage, showGPGPage)
  yield Saga.safeTakeEveryPureSimple(ProvisionGen.showPassphrasePage, showPassphrasePage)

  // TODO
  // yield Saga.safeTakeLatest(ProvisionGen.addNewDevice, _addNewDevice)
}

export default provisionSaga
