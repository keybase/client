// @flow
import logger from '../logger'
import * as EngineGen from '../actions/engine-gen-gen'
import * as PinentryGen from '../actions/pinentry-gen'
import * as Constants from '../constants/login'
import * as Saga from '../util/saga'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import {getEngine} from '../engine/require'

// stash response while we show the pinentry. The old code kept a map of this but this likely never worked. it seems like
// core sends 0 over and over so it just gets stomped anyways. I have a larger change that removes this kind of flow but
// its not worth implementing now
let _response = null

const onConnect = () => {
  RPCTypes.delegateUiCtlRegisterSecretUIRpcPromise()
    .then(response => {
      logger.info('Registered secret ui')
    })
    .catch(error => {
      logger.warn('error in registering secret ui: ', error)
    })
}

const onGetPassword = (state, action) => {
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

const onNewPinentry = (_, action) =>
  PinentryGen.createReplaceEntity({
    entities: I.Map([[action.payload.sessionID, action.payload]]),
    keyPath: ['sessionIDToPinentry'],
  })

const onSubmit = (_, action) => {
  const {password} = action.payload
  if (_response) {
    // $FlowIssue flow is correct in that we need store secret but we weren't sending it before and i don't want to change any existing behavior
    _response.result({passphrase: password})
    _response = null
  }

  return PinentryGen.createDeleteEntity({
    ids: [action.payload.sessionID],
    keyPath: ['sessionIDToPinentry'],
  })
}

const onCancel = (_, action) => {
  if (_response) {
    _response.error({code: RPCTypes.constantsStatusCode.scinputcanceled, desc: 'Input canceled'})
    _response = null
  }
  return PinentryGen.createDeleteEntity({
    ids: [action.payload.sessionID],
    keyPath: ['sessionIDToPinentry'],
  })
}

function* pinentrySaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<PinentryGen.OnSubmitPayload>(PinentryGen.onSubmit, onSubmit)
  yield* Saga.chainAction<PinentryGen.OnCancelPayload>(PinentryGen.onCancel, onCancel)
  yield* Saga.chainAction<PinentryGen.NewPinentryPayload>(PinentryGen.newPinentry, onNewPinentry)
  getEngine().registerCustomResponse('keybase.1.secretUi.getPassphrase')
  yield* Saga.chainAction<EngineGen.Keybase1SecretUiGetPassphrasePayload>(
    EngineGen.keybase1SecretUiGetPassphrase,
    onGetPassword
  )
  yield* Saga.chainAction<EngineGen.ConnectedPayload>(EngineGen.connected, onConnect)
}

export default pinentrySaga
