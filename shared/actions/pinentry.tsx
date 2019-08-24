import logger from '../logger'
import * as EngineGen from '../actions/engine-gen-gen'
import * as PinentryGen from '../actions/pinentry-gen'
import * as Constants from '../constants/login'
import * as Saga from '../util/saga'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import {getEngine} from '../engine/require'

// stash response while we show the pinentry. The old code kept a map of this but this likely never worked. it seems like
// core sends 0 over and over so it just gets stomped anyways. I have a larger change that removes this kind of flow but
// its not worth implementing now
let _response: EngineGen.Keybase1SecretUiGetPassphrasePayload['payload']['response'] | null = null

const onConnect = async () => {
  try {
    await RPCTypes.delegateUiCtlRegisterSecretUIRpcPromise()
    logger.info('Registered secret ui')
  } catch (error) {
    logger.warn('error in registering secret ui: ', error)
  }
}

const onGetPassword = (_: Container.TypedState, action: EngineGen.Keybase1SecretUiGetPassphrasePayload) => {
  logger.info('Asked for password')
  const {pinentry} = action.payload.params
  const {prompt, submitLabel, cancelLabel, windowTitle, features, type} = pinentry
  const retryLabel =
    pinentry.retryLabel === Constants.invalidPasswordErrorString ? 'Incorrect password.' : pinentry.retryLabel

  // Stash response
  _response = action.payload.response

  return PinentryGen.createNewPinentry({
    cancelLabel,
    prompt,
    retryLabel,
    sessionID: 0,
    showTyping: features.showTyping,
    submitLabel,
    type,
    windowTitle,
  })
}

const onNewPinentry = (_: Container.TypedState, action: PinentryGen.NewPinentryPayload) =>
  PinentryGen.createReplaceEntity({
    entities: I.Map([[action.payload.sessionID, action.payload]]),
    keyPath: ['sessionIDToPinentry'],
  })

const onSubmit = (_: Container.TypedState, action: PinentryGen.OnSubmitPayload) => {
  const {password} = action.payload
  if (_response) {
    // @ts-ignore this seems wrong
    _response.result({passphrase: password})
    _response = null
  }

  return PinentryGen.createDeleteEntity({
    ids: [action.payload.sessionID],
    keyPath: ['sessionIDToPinentry'],
  })
}

const onCancel = (_: Container.TypedState, action: PinentryGen.OnCancelPayload) => {
  if (_response) {
    _response.error({code: RPCTypes.StatusCode.scinputcanceled, desc: 'Input canceled'})
    _response = null
  }
  return PinentryGen.createDeleteEntity({
    ids: [action.payload.sessionID],
    keyPath: ['sessionIDToPinentry'],
  })
}

function* pinentrySaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(PinentryGen.onSubmit, onSubmit)
  yield* Saga.chainAction2(PinentryGen.onCancel, onCancel)
  yield* Saga.chainAction2(PinentryGen.newPinentry, onNewPinentry)
  getEngine().registerCustomResponse('keybase.1.secretUi.getPassphrase')
  yield* Saga.chainAction2(EngineGen.keybase1SecretUiGetPassphrase, onGetPassword)
  yield* Saga.chainAction2(EngineGen.connected, onConnect)
}

export default pinentrySaga
