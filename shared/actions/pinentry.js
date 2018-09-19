// @flow
import logger from '../logger'
import * as ConfigGen from '../actions/config-gen'
import * as PinentryGen from '../actions/pinentry-gen'
import * as Saga from '../util/saga'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import engine from '../engine'

// We keep track of sessionID to response objects since this is initiated by the daemon
const sessionIDToResponse: {[key: string]: any} = {}

function setupEngineListeners() {
  engine().actionOnConnect('registerSecretUI', () => {
    RPCTypes.delegateUiCtlRegisterSecretUIRpcPromise()
      .then(response => {
        logger.info('Registered secret ui')
      })
      .catch(error => {
        logger.warn('error in registering secret ui: ', error)
      })
  })

  engine().setIncomingCallMap({
    'keybase.1.secretUi.getPassphrase': (param, response) => {
      logger.info('Asked for passphrase')
      const {prompt, submitLabel, cancelLabel, windowTitle, retryLabel, features, type} = param.pinentry
      const {sessionID} = param

      // Stash response
      sessionIDToResponse[String(sessionID)] = response

      return Saga.put(
        PinentryGen.createNewPinentry({
          cancelLabel,
          prompt,
          retryLabel,
          sessionID,
          showTyping: features.showTyping,
          submitLabel,
          type,
          windowTitle,
        })
      )
    },
  })
}

function _onNewPinentry(action: PinentryGen.NewPinentryPayload) {
  return Saga.put(
    PinentryGen.createReplaceEntity({
      entities: I.Map([[action.payload.sessionID, action.payload]]),
      keyPath: ['sessionIDToPinentry'],
    })
  )
}

function _onSubmit(action: PinentryGen.OnSubmitPayload) {
  const {sessionID, passphrase} = action.payload
  _respond(sessionID, {passphrase})
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
  yield Saga.safeTakeEveryPure(PinentryGen.onSubmit, _onSubmit)
  yield Saga.safeTakeEveryPure(PinentryGen.onCancel, _onCancel)
  yield Saga.safeTakeEveryPure(PinentryGen.newPinentry, _onNewPinentry)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)
}

export default pinentrySaga
