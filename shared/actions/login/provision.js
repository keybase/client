// @flow
import * as Constants from '../../constants/login'
import * as LoginGen from '../login-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import * as RouteTree from '../route-tree'
import * as Tabs from '../../constants/tabs'
import {isMobile} from '../../constants/platform'
import {type TypedState} from '../../constants/reducer'
import {niceError} from '../../util/errors'

// function* selectKeySaga() {
// return EngineRpc.rpcError(new RPCError('Not supported in GUI', RPCTypes.constantsStatusCode.sckeynotfound))
// }

// const displayPrimaryPaperKeySaga = onBackSaga =>
// function*({phrase}) {
// yield Saga.put(
// navigateAppend(
// [
// {
// props: {
// paperkey: new HiddenString(phrase),
// title: 'Your new paper key!',
// waiting: false,
// },
// selected: 'success',
// },
// ],
// [loginTab, 'login']
// )
// )

// const {onBack, navUp, onFinish} = (yield Saga.race({
// navUp: Saga.take(RouteConstants.navigateUp),
// onBack: Saga.take(LoginGen.onBack),
// onFinish: Saga.take(LoginGen.onFinish),
// }): {
// onBack: ?LoginGen.OnBackPayload,
// navUp: ?RouteTypes.NavigateUp,
// onFinish: ?LoginGen.OnFinishPayload,
// })
// if (onBack || navUp) {
// yield Saga.call(onBackSaga)
// return EngineRpc.rpcCancel(InputCancelError)
// } else if (onFinish) {
// return EngineRpc.rpcResult()
// }
// }

// const getEmailOrUsernameSaga = onBackSaga =>
// function*() {
// yield Saga.put(
// navigateAppend(
// [
// {
// props: {},
// selected: 'usernameOrEmail',
// },
// ],
// [loginTab, 'login']
// )
// )

// const {onBack, navUp, onSubmit} = (yield Saga.race({
// navUp: Saga.take(RouteConstants.navigateUp),
// onBack: Saga.take(LoginGen.onBack),
// onSubmit: Saga.take(LoginGen.submitUsernameOrEmail),
// }): {
// onBack: ?LoginGen.OnBackPayload,
// navUp: ?RouteTypes.NavigateUp,
// onSubmit: ?LoginGen.SubmitUsernameOrEmailPayload,
// })
// if (onBack || navUp) {
// yield Saga.call(onBackSaga)
// return EngineRpc.rpcCancel(InputCancelError)
// } else if (onSubmit) {
// const {usernameOrEmail} = onSubmit.payload
// if (!usernameOrEmail) {
// logger.error('no email')
// }
// return EngineRpc.rpcResult(usernameOrEmail)
// }
// }

// // TODO type this
// type DisplayAndPromptSecretArgs = any
// const displayAndPromptSecretSaga = onBackSaga =>
// function*({phrase, previousErr}: DisplayAndPromptSecretArgs) {
// // TODO handl err
// yield Saga.put(
// LoginGen.createSetTextCode({
// textCode: new HiddenString(phrase),
// // codePageEnterCodeErrorText: previousErr,
// })
// )

// // If we have an error, we're already on the right page.
// if (!previousErr) {
// yield Saga.put(navigateAppend(['codePage']))
// }

// const {textEntered, qrScanned, onBack, navUp} = (yield Saga.race({
// navUp: Saga.take(RouteConstants.navigateUp),
// onBack: Saga.take(LoginGen.onBack),
// qrScanned: Saga.take(LoginGen.qrScanned),
// textEntered: Saga.take(LoginGen.provisionTextCodeEntered),
// }): {
// onBack: ?LoginGen.OnBackPayload,
// navUp: ?RouteTypes.NavigateUp,
// qrScanned: ?LoginGen.QrScannedPayload,
// textEntered: ?LoginGen.ProvisionTextCodeEnteredPayload,
// })
// if (onBack || navUp) {
// yield Saga.call(onBackSaga)
// return EngineRpc.rpcCancel(InputCancelError)
// } else if (qrScanned) {
// const phrase: HiddenString = qrScanned.payload.phrase
// return EngineRpc.rpcResult({phrase: phrase.stringValue(), secret: null})
// } else if (textEntered) {
// const phrase: HiddenString = textEntered.payload.phrase
// return EngineRpc.rpcResult({phrase: phrase.stringValue(), secret: null})
// }
// }

// const promptNewDeviceNameSaga = onBackSaga =>
// function*({existingDevices, errorMessage}) {
// if (errorMessage) {
// yield Saga.put(LoginGen.createSetDevicenameError({error: errorMessage}))
// } else {
// yield Saga.put(
// navigateAppend([{props: {existingDevices}, selected: 'setPublicName'}], [loginTab, 'login'])
// )
// }

// const {onBack, navUp, onSubmit} = (yield Saga.race({
// navUp: Saga.take(RouteConstants.navigateUp),
// onBack: Saga.take(LoginGen.onBack),
// onSubmit: Saga.take(LoginGen.submitDeviceName),
// }): {
// onBack: ?LoginGen.OnBackPayload,
// navUp: ?RouteTypes.NavigateUp,
// onSubmit: ?LoginGen.SubmitDeviceNamePayload,
// })
// if (onBack || navUp) {
// yield Saga.put(LoginGen.createSetDevicenameError({error: ''}))
// yield Saga.call(onBackSaga)
// return EngineRpc.rpcCancel(InputCancelError)
// } else if (onSubmit) {
// const {deviceName} = onSubmit.payload
// yield Saga.put(LoginGen.createSetDevicenameError({error: ''}))
// return EngineRpc.rpcResult(deviceName)
// }
// }

// const onChooseDevice = (params: ProvisionUiChooseDeviceRpcParam, result, state) => {
// yield Saga.put(
// navigateAppend(
// [{props: {canSelectNoDevice, devices}, selected: 'selectOtherDevice'}],
// [loginTab, 'login']
// )
// )
// const {onBack, navUp, onWont, onSelect} = (yield Saga.race({
// navUp: Saga.take(RouteConstants.navigateUp),
// onBack: Saga.take(LoginGen.onBack),
// onSelect: Saga.take(LoginGen.selectDeviceId),
// onWont: Saga.take(LoginGen.onWont),
// }): {
// onBack: ?LoginGen.OnBackPayload,
// navUp: ?RouteTypes.NavigateUp,
// onWont: ?LoginGen.OnWontPayload,
// onSelect: ?LoginGen.SelectDeviceIdPayload,
// })
// if (onBack || navUp) {
// yield Saga.call(onBackSaga)
// return EngineRpc.rpcCancel(InputCancelError)
// } else if (onWont) {
// return EngineRpc.rpcResult('')
// } else if (onSelect) {
// const deviceID = onSelect.payload.deviceId
// const device = (devices || []).find(d => d.deviceID === deviceID)
// if (device) {
// const role = ({
// desktop: Constants.codePageDeviceRoleExistingComputer,
// mobile: Constants.codePageDeviceRoleExistingPhone,
// }: {[key: DevicesTypes.DeviceType]: Types.DeviceRole})[DevicesTypes.stringToDeviceType(device.type)]
// if (role) {
// yield Saga.call(setCodePageOtherDeviceRole, role)
// }
// return EngineRpc.rpcResult(deviceID)
// }
// }
// }

// const chooseGPGMethodSaga = onBackSaga =>
// function*() {
// yield Saga.put(navigateAppend(['gpgSign'], [loginTab, 'login']))

// const {onBack, navUp, onSubmit} = (yield Saga.race({
// navUp: Saga.take(RouteConstants.navigateUp),
// onBack: Saga.take(LoginGen.onBack),
// onSubmit: Saga.take(LoginGen.chooseGPGMethod),
// }): {
// onBack: ?LoginGen.OnBackPayload,
// navUp: ?RouteTypes.NavigateUp,
// onSubmit: ?LoginGen.ChooseGPGMethodPayload,
// })
// if (onBack || navUp) {
// yield Saga.call(onBackSaga)
// return EngineRpc.rpcCancel(InputCancelError)
// } else if (onSubmit) {
// const exportKey = onSubmit.payload.exportKey

// return EngineRpc.rpcResult(
// exportKey ? RPCTypes.provisionUiGPGMethod.gpgImport : RPCTypes.provisionUiGPGMethod.gpgSign
// )
// }
// }

// const defaultGetPassphraseSaga = onBackSaga =>
// function*({pinentry: {type, prompt, username, retryLabel}}) {
// switch (type) {
// case RPCTypes.passphraseCommonPassphraseType.paperKey:
// const destination = {
// props: {
// error: retryLabel,
// },
// selected: 'paperkey',
// }

// const state: TypedState = yield Saga.select()
// const currentPath = pathSelector(state)
// if (currentPath.last() === 'paperkey') {
// yield Saga.put(navigateTo(currentPath.pop().push(destination)))
// } else {
// yield Saga.put(navigateAppend([destination], [loginTab, 'login']))
// }
// break
// case RPCTypes.passphraseCommonPassphraseType.passPhrase:
// yield Saga.put(
// navigateAppend(
// [
// {
// props: {
// error: retryLabel,
// prompt,
// username,
// },
// selected: 'passphrase',
// },
// ],
// [loginTab, 'login']
// )
// )
// break
// default:
// return EngineRpc.rpcError(
// new RPCError('Unknown getPassphrase type', RPCTypes.constantsStatusCode.scnotfound)
// )
// }

// const {onBack, navUp, onSubmit} = (yield Saga.race({
// navUp: Saga.take(RouteConstants.navigateUp),
// onBack: Saga.take(LoginGen.onBack),
// onSubmit: Saga.take(LoginGen.submitPassphrase),
// }): {
// onBack: ?LoginGen.OnBackPayload,
// navUp: ?RouteTypes.NavigateUp,
// onSubmit: ?LoginGen.SubmitPassphrasePayload,
// })
// if (onBack || navUp) {
// yield Saga.call(onBackSaga)
// return EngineRpc.rpcCancel(InputCancelError)
// } else if (onSubmit) {
// const passphrase = onSubmit.payload.passphrase.stringValue()
// return EngineRpc.rpcResult({passphrase, storeSecret: false})
// }
// }

// function* handleProvisioningError(error): Generator<any, void, any> {
// yield Saga.put(LoginGen.createProvisioningError({error}))
// yield Saga.put(
// navigateAppend(
// [
// {
// props: {
// error,
// },
// selected: 'error',
// },
// ],
// [loginTab, 'login']
// )
// )
// yield Saga.race({onBack: Saga.take(LoginGen.onBack), navUp: Saga.take(RouteConstants.navigateUp)})
// yield Saga.call(navigateToLoginRoot)
// }

// function* loginFlowSaga(usernameOrEmail, passphrase): Generator<any, void, any> {
// // If there is passphrase, use that.
// const passphraseEntered = passphrase && passphrase.stringValue && passphrase.stringValue() !== ''
// const passphraseSaga = passphraseEntered
// ? onBackSaga => () =>
// EngineRpc.rpcResult({
// passphrase: passphrase ? passphrase.stringValue() : 'NEVER HAPPENS',
// storeSecret: false,
// })
// : defaultGetPassphraseSaga

// const loginSagas = kex2Sagas(navigateToLoginRoot, EngineRpc.passthroughResponseSaga, passphraseSaga)

// const loginRpcCall = new EngineRpc.EngineRpcCall(
// loginSagas,
// RPCTypes.loginLoginRpcChannelMap,
// 'loginRpc',
// {
// clientType: RPCTypes.commonClientType.guiMain,
// deviceType,
// usernameOrEmail,
// },
// true // finished error should cancel
// )

// try {
// const result = yield Saga.call(loginRpcCall.run)

// if (EngineRpc.isFinished(result)) {
// const {error} = result.payload

// if (error) {
// logger.debug('login call error', error)
// if (error.code === RPCTypes.constantsStatusCode.scbadloginpassword) {
// // Stay on the login form
// yield Saga.put(LoginGen.createLoginError({error: 'Looks like a bad passphrase.'}))
// } else {
// // Show the error on the error page
// yield Saga.call(handleProvisioningError, error)
// }
// } else {
// yield Saga.call(navBasedOnLoginAndInitialState)
// }
// } else if (result === EngineRpc.BailedEarly) {
// logger.debug('Bailed early')
// yield Saga.put(navigateTo(['login'], [loginTab]))
// } else {
// yield Saga.put(navigateTo(['login'], [loginTab]))
// }
// } catch (error) {
// yield Saga.call(handleProvisioningError, error)
// logger.debug('error in loginRPC:', error)
// }
// }

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

const provisionDeviceSelect = (state: TypedState) => {
  const response = provisioningManager.getAndClearResponse('keybase.1.provisionUi.chooseDevice')
  if (!response || !response.result) {
    throw new Error('Tried to submit a device name but missing callback')
  }

  if (!state.login.provisionSelectedDevice) {
    response.error()
    throw new Error('Tried to submit a device name but missing device in store')
  }
  response.result(state.login.provisionSelectedDevice.id)
}

const provisionNewName = (state: TypedState) => {
  // const nameTakenError = nameTaken
  // ? `The device name: '${deviceName}' is already taken. You can't reuse device names, even revoked ones, for security reasons. Otherwise, someone who stole one of your devices could cause a lot of confusion.`
  // : null
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
      const usernameOrEmail = state.login.provisionUsernameOrEmail
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

      yield RPCTypes.loginLoginRpcSaga({
        // cancel if we get any of these callbacks, we're logging in, not provisioning
        incomingCallMap: {
          'keybase.1.gpgUi.selectKey': cancelOnCallback,
          'keybase.1.loginUi.displayPrimaryPaperKey': ignoreCallback,
          'keybase.1.loginUi.getEmailOrUsername': cancelOnCallback,
          'keybase.1.provisionUi.DisplayAndPromptSecret': cancelOnCallback,
          'keybase.1.provisionUi.DisplaySecretExchanged': ignoreCallback,
          'keybase.1.provisionUi.PromptNewDeviceName': (
            params: RPCTypes.ProvisionUiPromptNewDeviceNameRpcParam,
            response,
            state
          ) => {
            provisioningManager.stashResponse('keybase.1.provisionUi.PromptNewDeviceName', response)
            return Saga.put(
              LoginGen.createShowNewDeviceName({
                error: params.errorMessage,
                existingDevices: params.existingDevices || [],
              })
            )
          },
          'keybase.1.provisionUi.ProvisioneeSuccess': ignoreCallback,
          'keybase.1.provisionUi.ProvisionerSuccess': ignoreCallback,
          'keybase.1.provisionUi.chooseDevice': (
            params: RPCTypes.ProvisionUiChooseDeviceRpcParam,
            response,
            state
          ) => {
            provisioningManager.stashResponse('keybase.1.provisionUi.chooseDevice', response)
            return Saga.put(
              LoginGen.createShowDeviceList({
                canSelectNoDevice: params.canSelectNoDevice,
                devices: (params.devices || []).map(d => Constants.rpcDeviceToDevice(d)),
              })
            )
          },
          'keybase.1.provisionUi.chooseGPGMethod': cancelOnCallback,
          'keybase.1.secretUi.getPassphrase': cancelOnCallback,
        },
        params: {
          clientType: RPCTypes.commonClientType.guiMain,
          deviceType: isMobile ? 'mobile' : 'desktop',
          usernameOrEmail,
        },
        waitingKey: Constants.waitingKey,
      })
    } catch (e) {
      yield Saga.put(LoginGen.createLoginError({error: niceError(e)}))
    }
  })

const showDeviceList = () =>
  Saga.put(RouteTree.navigateAppend(['selectOtherDevice'], [Tabs.loginTab, 'login']))

const showNewDeviceName = () =>
  Saga.put(RouteTree.navigateAppend(['setPublicName'], [Tabs.loginTab, 'login']))

function* provisionSaga(): Saga.SagaGenerator<any, any> {
  // Start provision
  yield Saga.safeTakeEveryPureSimple(LoginGen.submitUsernameOrEmail, startProvisioning)

  // Submits
  yield Saga.safeTakeEveryPureSimple(LoginGen.provisionDeviceSelect, provisionDeviceSelect)

  // Screens
  yield Saga.safeTakeEveryPureSimple(LoginGen.showDeviceList, showDeviceList)
  yield Saga.safeTakeEveryPureSimple(LoginGen.showNewDeviceName, showNewDeviceName)

  // TODO
  // yield Saga.safeTakeLatest(LoginGen.addNewDevice, _addNewDevice)
}

export default provisionSaga
