import * as Constants from '../constants/provision'
import * as LoginConstants from '../constants/login'
import * as ConfigConstants from '../constants/config'
import * as RouteTreeGen from './route-tree-gen'
import * as DevicesGen from './devices-gen'
import * as ProvisionGen from './provision-gen'
import * as WaitingGen from './waiting-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Saga from '../util/saga'
import * as Tabs from '../constants/tabs'
import logger from '../logger'
import {isMobile} from '../constants/platform'
import HiddenString from '../util/hidden-string'
import * as Container from '../constants/reducer'
import {devicesTab as settingsDevicesTab} from '../constants/settings'

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
  | 'keybase.1.provisionUi.chooseDeviceType'
  | 'keybase.1.provisionUi.chooseGPGMethod'
  | 'keybase.1.provisionUi.switchToGPGSignOK'
  | 'keybase.1.secretUi.getPassphrase'

const ignoreCallback = (_: any) => {}

type CustomParam<T extends ValidCallback> = RPCTypes.MessageTypes[T]['inParam']
type CustomResp<T extends ValidCallback> = {
  error: RPCTypes.IncomingErrorCallback
  result: (res: RPCTypes.MessageTypes[T]['outParam']) => void
}

// The provisioning flow is very stateful so we use a class to handle bookkeeping
// We only allow one manager to be alive at a time
// Can be made for a regular provision or if we're adding a device
class ProvisioningManager {
  static singleton: ProvisioningManager | undefined
  static getSingleton = (): ProvisioningManager => {
    if (!ProvisioningManager.singleton) {
      throw new Error('No ProvisioningManager')
    }
    return ProvisioningManager.singleton
  }
  private stashedResponse: {[K in ValidCallback]?: CustomResp<K>} = {}
  private addingANewDevice: boolean
  private done: boolean = false
  private canceled: boolean = false

  _testing = () => ({
    stashedResponse: this.stashedResponse,
  })

  constructor(addingANewDevice: boolean, _: 'ONLY_CALL_THIS_FROM_HELPER') {
    this.addingANewDevice = addingANewDevice
    ProvisioningManager.singleton = this
  }

  isCanceled = () => this.canceled

  setDone = (reason: string) => {
    logger.info('ProvisioningManager.done', reason)
    this.done = true
  }

  checkNoStashedResponses = () => {
    if (Object.keys(this.stashedResponse).length) {
      logger.info('Extra responses?', Object.keys(this.stashedResponse))
    }
  }

  // Choosing a device to use to provision
  chooseDeviceHandler = (
    params: CustomParam<'keybase.1.provisionUi.chooseDevice'>,
    response: CustomResp<'keybase.1.provisionUi.chooseDevice'>
  ) => {
    if (this.done) {
      logger.info('ProvisioningManager done, yet chooseDeviceHandler called')
      return
    }
    this.checkNoStashedResponses()
    this.stashedResponse['keybase.1.provisionUi.chooseDevice'] = response
    return Saga.put(
      ProvisionGen.createShowDeviceListPage({
        devices: (params.devices ?? []).map(d => Constants.rpcDeviceToDevice(d)),
      })
    )
  }

  submitDeviceSelect = (state: Container.TypedState) => {
    if (this.done) {
      logger.info('ProvisioningManager done, yet submitDeviceSelect called')
      return
    }
    const response = this.stashedResponse['keybase.1.provisionUi.chooseDevice']
    this.stashedResponse = {}
    if (!response || !response.result) {
      throw new Error('Tried to submit a device choice but missing callback')
    }

    if (!state.provision.codePageOtherDevice.id) {
      response.error()
      throw new Error('Tried to submit a device choice but missing device in store')
    }

    response.result(state.provision.codePageOtherDevice.id)
  }

  // Telling the daemon the other device type when adding a new device
  chooseDeviceTypeHandler = (
    _: CustomParam<'keybase.1.provisionUi.chooseDeviceType'>,
    response: CustomResp<'keybase.1.provisionUi.chooseDeviceType'>
  ) => {
    if (this.done) {
      logger.info('ProvisioningManager done, yet chooseDeviceTypeHandler called')
      return
    }
    return Saga.callUntyped(function*() {
      const state: Container.TypedState = yield* Saga.selectState()
      switch (state.provision.codePageOtherDevice.type) {
        case 'mobile':
          response.result(RPCTypes.DeviceType.mobile)
          break
        case 'desktop':
          response.result(RPCTypes.DeviceType.desktop)
          break
        default:
          response.error()
          throw new Error(
            'Tried to add a device but of unknown type' + state.provision.codePageOtherDevice.type
          )
      }
    })
  }

  // Choosing a name for this new device
  promptNewDeviceNameHandler = (
    params: CustomParam<'keybase.1.provisionUi.PromptNewDeviceName'>,
    response: CustomResp<'keybase.1.provisionUi.PromptNewDeviceName'>
  ) => {
    if (this.done) {
      logger.info('ProvisioningManager done, yet promptNewDeviceNameHandler called')
      return
    }
    this.checkNoStashedResponses()
    this.stashedResponse['keybase.1.provisionUi.PromptNewDeviceName'] = response
    return Saga.put(
      ProvisionGen.createShowNewDeviceNamePage({
        error: params.errorMessage ? new HiddenString(params.errorMessage) : null,
        existingDevices: params.existingDevices ?? [],
      })
    )
  }

  submitDeviceName = (state: Container.TypedState) => {
    if (this.done) {
      logger.info('ProvisioningManager done, yet submitDeviceName called')
      return
    }

    // local error, ignore
    if (state.provision.error.stringValue()) {
      return
    }

    const response = this.stashedResponse['keybase.1.provisionUi.PromptNewDeviceName']
    this.stashedResponse = {}
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
    params: CustomParam<'keybase.1.provisionUi.DisplayAndPromptSecret'>,
    response: CustomResp<'keybase.1.provisionUi.DisplayAndPromptSecret'>
  ) => {
    if (this.done) {
      logger.info('ProvisioningManager done, yet displayAndPromptSecretHandler called')
      return
    }
    this.checkNoStashedResponses()
    this.stashedResponse['keybase.1.provisionUi.DisplayAndPromptSecret'] = response
    return Saga.put(
      ProvisionGen.createShowCodePage({
        code: new HiddenString(params.phrase),
        error: params.previousErr ? new HiddenString(params.previousErr) : null,
      })
    )
  }

  submitTextCode = (state: Container.TypedState) => {
    if (this.done) {
      logger.info('ProvisioningManager done, yet submitTextCode called')
      return
    }
    // local error, ignore
    if (state.provision.error.stringValue()) {
      return
    }

    const response = this.stashedResponse['keybase.1.provisionUi.DisplayAndPromptSecret']
    this.stashedResponse = {}
    if (!response || !response.result) {
      throw new Error('Tried to submit a code but missing callback')
    }

    if (!state.provision.codePageOutgoingTextCode.stringValue()) {
      // actually submit so we get an error plumbed back
      response.result({phrase: 'invalid', secret: null as any})
      throw new Error('Tried to submit a code but missing in store')
    }

    response.result({phrase: state.provision.codePageOutgoingTextCode.stringValue(), secret: null as any})
  }

  // Trying to use gpg flow
  chooseGPGMethodHandler = (
    _: CustomParam<'keybase.1.provisionUi.chooseGPGMethod'>,
    response: CustomResp<'keybase.1.provisionUi.chooseGPGMethod'>
  ) => {
    if (this.done) {
      logger.info('ProvisioningManager done, yet chooseGPGMethodHandler called')
      return
    }
    this.checkNoStashedResponses()
    this.stashedResponse['keybase.1.provisionUi.chooseGPGMethod'] = response
    return Saga.put(ProvisionGen.createShowGPGPage())
  }

  submitGPGMethod = (state: Container.TypedState, action: ProvisionGen.SubmitGPGMethodPayload) => {
    if (this.done) {
      logger.info('ProvisioningManager done, yet submitGPGMethod called')
      return
    }
    // local error, ignore
    if (state.provision.error.stringValue()) {
      return
    }

    const response = this.stashedResponse['keybase.1.provisionUi.chooseGPGMethod']
    this.stashedResponse = {}
    if (!response || !response.result) {
      throw new Error('Tried to submit gpg export but missing callback')
    }

    response.result(action.payload.exportKey ? RPCTypes.GPGMethod.gpgImport : RPCTypes.GPGMethod.gpgSign)
  }

  switchToGPGSignOKHandler = (
    params: CustomParam<'keybase.1.provisionUi.switchToGPGSignOK'>,
    response: CustomResp<'keybase.1.provisionUi.switchToGPGSignOK'>
  ) => {
    if (this.done) {
      logger.info('ProvisioningManager done, yet switchToGPGSignOKHandler called')
      return
    }
    this.checkNoStashedResponses()
    this.stashedResponse['keybase.1.provisionUi.switchToGPGSignOK'] = response
    return Saga.all([
      Saga.put(ProvisionGen.createSwitchToGPGSignOnly({importError: params.importError})),
      Saga.put(ProvisionGen.createShowGPGPage()),
    ])
  }

  submitGPGSignOK = (action: ProvisionGen.SubmitGPGSignOKPayload) => {
    if (this.done) {
      logger.info('ProvisioningManager done, yet submitGPGSignOK called')
      return
    }
    const response = this.stashedResponse['keybase.1.provisionUi.switchToGPGSignOK']
    this.stashedResponse = {}
    if (!response || !response.result) {
      throw new Error('Tried to respond to gpg sign ok but missing callback')
    }

    response.result(action.payload.accepted)
  }

  // User has an uploaded key so we can use a password OR they selected a paperkey
  getPasswordHandler = (
    params: CustomParam<'keybase.1.secretUi.getPassphrase'>,
    response: CustomResp<'keybase.1.secretUi.getPassphrase'>
  ) => {
    if (this.done) {
      logger.info('ProvisioningManager done, yet getPasswordHandler called')
      return
    }
    this.checkNoStashedResponses()
    this.stashedResponse['keybase.1.secretUi.getPassphrase'] = response

    // Service asking us again due to an error?
    const error =
      params.pinentry.retryLabel === LoginConstants.invalidPasswordErrorString
        ? 'Incorrect password.'
        : params.pinentry.retryLabel

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
    if (this.done) {
      logger.info('ProvisioningManager done, yet submitPasswordOrPaperkey called')
      return
    }
    // local error, ignore
    if (state.provision.error.stringValue()) {
      return
    }

    const response = this.stashedResponse['keybase.1.secretUi.getPassphrase']
    this.stashedResponse = {}
    if (!response || !response.result) {
      throw new Error('Tried to submit password but missing callback')
    }

    const password =
      action.type === ProvisionGen.submitPassword
        ? action.payload.password.stringValue()
        : action.payload.paperkey.stringValue()

    response.result({passphrase: password, storeSecret: false})
  }

  displaySecretExchanged = (_params: CustomParam<'keybase.1.provisionUi.DisplaySecretExchanged'>) => {
    // special case, we actually aren't waiting when we get this so our count goes negative. This is very unusual and a one-off
    return Saga.put(
      WaitingGen.createBatchChangeWaiting({changes: [{increment: true, key: Constants.waitingKey}]})
    )
  }

  getCustomResponseIncomingCallMap = () =>
    this.addingANewDevice
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
    this.addingANewDevice
      ? {
          'keybase.1.provisionUi.DisplaySecretExchanged': this.displaySecretExchanged,
          'keybase.1.provisionUi.ProvisioneeSuccess': ignoreCallback,
          'keybase.1.provisionUi.ProvisionerSuccess': ignoreCallback,
        }
      : {
          'keybase.1.loginUi.displayPrimaryPaperKey': ignoreCallback,
          'keybase.1.provisionUi.DisplaySecretExchanged': this.displaySecretExchanged,
          'keybase.1.provisionUi.ProvisioneeSuccess': ignoreCallback,
          'keybase.1.provisionUi.ProvisionerSuccess': ignoreCallback,
        }

  showCodePage = () =>
    RouteTreeGen.createNavigateAppend({
      path: ['codePage'],
      replace: true,
    })

  maybeCancelProvision = () => {
    logger.info('ProvisioningManager.maybeCancelProvision')
    if (this.done) {
      logger.info('But provisioning is already done, nothing to do')
      return false
    } else if (this.canceled) {
      // Unexpected - that means cancel action was called multiple times.
      logger.warn('But provisioning is already canceled')
      return false
    }

    Object.keys(this.stashedResponse).forEach(key => {
      logger.info('ProvisioningManager - canceling ongoing stashed response')
      Constants.cancelOnCallback(null, (this.stashedResponse as any)[key])
    })
    this.stashedResponse = {}
    this.canceled = true
    return true
  }
}

const makeProvisioningManager = (addingANewDevice: boolean): ProvisioningManager =>
  new ProvisioningManager(addingANewDevice, 'ONLY_CALL_THIS_FROM_HELPER')

/**
 * We are starting the provisioning process. This is largely controlled by the daemon. We get a callback to show various
 * screens and we stash the result object so we can show the screen. When the submit on that screen is done we find the stashedReponse and respond and wait
 */
function* startProvisioning(state: Container.TypedState) {
  yield Saga.put(WaitingGen.createClearWaiting({key: Constants.waitingKey}))
  const manager = makeProvisioningManager(false)
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
        doUserSwitch: true,
        paperKey: '',
        username: username,
      },
      waitingKey: Constants.waitingKey,
    })
    ProvisioningManager.getSingleton().setDone('provision call done w/ success')
  } catch (finalError) {
    manager.setDone(
      'startProvisioning call done w/ error ' + (finalError ? finalError.message : ' unknown error')
    )

    if (ProvisioningManager.getSingleton() !== manager) {
      // Another provisioning session has started while this one was active.
      // This is not desired and is an indication of a problem somewhere else.
      logger.error(
        `Provision.startProvisioning error, and ProvisioningManager has changed: ${finalError.message}`
      )
      return
    }

    if (Constants.errorCausedByUsCanceling(finalError) && manager.isCanceled()) {
      // After cancelling the RPC we are going to get "input canceled" error.
      return
    }

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
  } finally {
    yield Saga.put(WaitingGen.createClearWaiting({key: Constants.waitingKey}))
    yield Saga.put(ProvisionGen.createProvisionDone())
  }
}

function* addNewDevice() {
  // Make a new handler each time.
  yield Saga.put(WaitingGen.createClearWaiting({key: Constants.waitingKey}))
  const manager = makeProvisioningManager(true)
  try {
    yield RPCTypes.deviceDeviceAddRpcSaga({
      customResponseIncomingCallMap: ProvisioningManager.getSingleton().getCustomResponseIncomingCallMap(),
      incomingCallMap: ProvisioningManager.getSingleton().getIncomingCallMap(),
      params: undefined,
      waitingKey: Constants.waitingKey,
    })
    ProvisioningManager.getSingleton().setDone('add device success')
    // Now refresh and nav back
    yield Saga.put(DevicesGen.createLoad())
    yield Saga.put(RouteTreeGen.createNavigateAppend({path: devicesRoot}))
    yield Saga.put(RouteTreeGen.createClearModals())
  } catch (finalError) {
    manager.setDone('addNewDevice call done w/ error ' + (finalError ? finalError.message : ' unknown error'))

    if (ProvisioningManager.getSingleton() !== manager) {
      // Another provisioning session has started while this one was active.
      // This is not desired and is an indication of a problem somewhere else.
      logger.error(`Provision.addNewDevice error, and ProvisioningManager has changed: ${finalError.message}`)
      return
    }

    if (Constants.errorCausedByUsCanceling(finalError) && manager.isCanceled()) {
      // After cancelling the RPC we are going to get "input canceled" error.
      return
    }

    yield Saga.put(ProvisionGen.createShowFinalErrorPage({finalError, fromDeviceAdd: true}))
    logger.error(`Provision -> Add device error: ${finalError.message}`)
  } finally {
    yield Saga.put(WaitingGen.createClearWaiting({key: Constants.waitingKey}))
    yield Saga.put(ProvisionGen.createProvisionDone())
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
const submitGPGSignOK = (action: ProvisionGen.SubmitGPGSignOKPayload) =>
  ProvisioningManager.getSingleton().submitGPGSignOK(action)
const submitPasswordOrPaperkey = (
  state: Container.TypedState,
  action: ProvisionGen.SubmitPasswordPayload | ProvisionGen.SubmitPaperkeyPayload
) => ProvisioningManager.getSingleton().submitPasswordOrPaperkey(state, action)
const maybeCancelProvision = () => {
  ProvisioningManager.getSingleton().maybeCancelProvision()
}

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

const showFinalErrorPage = (action: ProvisionGen.ShowFinalErrorPagePayload) => {
  const parentPath = action.payload.fromDeviceAdd ? devicesRoot : ['login']
  const replace = !action.payload.fromDeviceAdd
  const path = ['error']
  return [
    ...(action.payload.fromDeviceAdd ? [RouteTreeGen.createClearModals()] : []),
    RouteTreeGen.createNavigateAppend({path: [...parentPath, ...path], replace}),
  ]
}

const showUsernameEmailPage = async (
  state: Container.TypedState,
  action: ProvisionGen.StartProvisionPayload
) => {
  // If we're logged in, we're coming from the user switcher; log out first to prevent the service from getting out of sync with the GUI about our logged-in-ness
  if (state.config.loggedIn) {
    await RPCTypes.loginLogoutRpcPromise(
      {force: false, keepSecrets: true},
      ConfigConstants.loginAsOtherUserWaitingKey
    )
  }
  return RouteTreeGen.createNavigateAppend({
    path: [{props: {fromReset: action.payload.fromReset}, selected: 'username'}],
  })
}

const forgotUsername = async (action: ProvisionGen.ForgotUsernamePayload) => {
  if (action.payload.email) {
    try {
      await RPCTypes.accountRecoverUsernameWithEmailRpcPromise(
        {email: action.payload.email},
        Constants.forgotUsernameWaitingKey
      )
      return ProvisionGen.createForgotUsernameResult({result: 'success'})
    } catch (error) {
      return ProvisionGen.createForgotUsernameResult({
        result: Constants.decodeForgotUsernameError(error),
      })
    }
  }
  if (action.payload.phone) {
    try {
      await RPCTypes.accountRecoverUsernameWithPhoneRpcPromise(
        {phone: action.payload.phone},
        Constants.forgotUsernameWaitingKey
      )
      return ProvisionGen.createForgotUsernameResult({result: 'success'})
    } catch (error) {
      return ProvisionGen.createForgotUsernameResult({
        result: Constants.decodeForgotUsernameError(error),
      })
    }
  }

  return null
}

function* backToDeviceList(_: Container.TypedState, action: ProvisionGen.BackToDeviceListPayload) {
  const cancelled = ProvisioningManager.getSingleton().maybeCancelProvision()
  if (cancelled) {
    // must wait for previous session to close
    yield Saga.take(ProvisionGen.provisionDone)
  }
  yield Saga.put(ProvisionGen.createSubmitUsername({username: action.payload.username}))
}

function* provisionSaga() {
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
  yield* Saga.chainAction(ProvisionGen.submitGPGSignOK, submitGPGSignOK)
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
  yield* Saga.chainAction(ProvisionGen.showFinalErrorPage, showFinalErrorPage)
  yield* Saga.chainAction(ProvisionGen.forgotUsername, forgotUsername)

  yield* Saga.chainAction2(ProvisionGen.cancelProvision, maybeCancelProvision)
  yield* Saga.chainGenerator(ProvisionGen.backToDeviceList, backToDeviceList)
}

export const _testing: any = {
  makeProvisioningManager,
  maybeCancelProvision,
}

export default provisionSaga
