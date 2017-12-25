// @flow
import logger from '../logger'
import * as PinentryGen from '../actions/pinentry-gen'
import * as Saga from '../util/saga'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import engine from '../engine'

// We keep track of sessionID to response objects since this is initiated by the daemon
const sessionIDToResponse: {[key: string]: any} = {}

function _setupPinentryHandlers() {
  engine().listenOnConnect('registerSecretUI', () => {
    RPCTypes.delegateUiCtlRegisterSecretUIRpcPromise()
      .then(response => {
        logger.info('Registered secret ui')
      })
      .catch(error => {
        logger.warn('error in registering secret ui: ', error)
      })
  })

  engine().setIncomingActionCreators('keybase.1.secretUi.getPassphrase', (payload, response) => {
    logger.info('Asked for passphrase')
    const {prompt, submitLabel, cancelLabel, windowTitle, retryLabel, features, type} = payload.pinentry
    const {sessionID} = payload

    // Stash response
    sessionIDToResponse[String(sessionID)] = response

    return [
      PinentryGen.createNewPinentry({
        cancelLabel,
        prompt,
        retryLabel,
        sessionID,
        showTyping: features.showTyping,
        submitLabel,
        type,
        windowTitle,
      }),
    ]
  })
}

function _onNewPinentry(action: PinentryGen.NewPinentryPayload) {
  return Saga.put(
    PinentryGen.createReplaceEntity({
      entities: I.Map([[String(action.payload.sessionID), action.payload]]),
      keyPath: ['sessionIDToPinentry'],
    })
  )
}

function _onSubmit(action: PinentryGen.OnSubmitPayload) {
  const {sessionID, passphrase} = action.payload
  _respond(sessionID, {passphrase, storeSecret: false})
  return Saga.put(
    PinentryGen.createDeleteEntity({
      ids: [action.payload.sessionID],
      keyPath: ['sessionIDToPinentry'],
    })
  )
}

function _onCancel(action: PinentryGen.OnCancelPayload) {
  const {sessionID} = action.payload
  _respond(sessionID, null, {
    code: RPCTypes.constantsStatusCode.scinputcanceled,
    desc: 'Input canceled',
  })
  return Saga.put(
    PinentryGen.createDeleteEntity({
      ids: [action.payload.sessionID],
      keyPath: ['sessionIDToPinentry'],
    })
  )
}

function _respond(sessionID: number, result: any, err: ?any): void {
  const sessionKey = String(sessionID)
  const response = sessionIDToResponse[sessionKey]
  if (response == null) {
    logger.info('lost response reference')
    return
  }

  if (err != null) {
    response.error(err)
  } else {
    response.result(result)
  }

  delete sessionIDToResponse[sessionKey]
}

function* pinentrySaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(PinentryGen.registerPinentryListener, _setupPinentryHandlers)
  yield Saga.safeTakeEveryPure(PinentryGen.onSubmit, _onSubmit)
  yield Saga.safeTakeEveryPure(PinentryGen.onCancel, _onCancel)
  yield Saga.safeTakeEveryPure(PinentryGen.newPinentry, _onNewPinentry)
}

export default pinentrySaga
