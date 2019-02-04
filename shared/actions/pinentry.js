// @flow
import logger from '../logger'
import * as ConfigGen from '../actions/config-gen'
import * as PinentryGen from '../actions/pinentry-gen'
import * as Saga from '../util/saga'
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import engine from '../engine'

// We keep track of sessionID to response objects since this is initiated by the daemon
type IncomingErrorCallback = (?{code?: number, desc?: string}) => void
const sessionIDToResponse: {
  [key: string]: {
    error: IncomingErrorCallback,
    result: ({+passphrase: string, +storeSecret: boolean}) => void,
  },
} = {}

const setupEngineListeners = () => {
  engine().actionOnConnect('registerSecretUI', () => {
    RPCTypes.delegateUiCtlRegisterSecretUIRpcPromise()
      .then(response => {
        logger.info('Registered secret ui')
      })
      .catch(error => {
        logger.warn('error in registering secret ui: ', error)
      })
  })

  engine().setCustomResponseIncomingCallMap({
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

const onNewPinentry = (_, action) =>
  PinentryGen.createReplaceEntity({
    entities: I.Map([[action.payload.sessionID, action.payload]]),
    keyPath: ['sessionIDToPinentry'],
  })

const onSubmit = (_, action) => {
  const {sessionID, passphrase} = action.payload
  _respond(sessionID, {passphrase})
  return PinentryGen.createDeleteEntity({
    ids: [action.payload.sessionID],
    keyPath: ['sessionIDToPinentry'],
  })
}

const onCancel = (_, action) => {
  const {sessionID} = action.payload
  _respond(sessionID, null, {
    code: RPCTypes.constantsStatusCode.scinputcanceled,
    desc: 'Input canceled',
  })
  return PinentryGen.createDeleteEntity({
    ids: [action.payload.sessionID],
    keyPath: ['sessionIDToPinentry'],
  })
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
  yield* Saga.chainAction<PinentryGen.OnSubmitPayload>(PinentryGen.onSubmit, onSubmit)
  yield* Saga.chainAction<PinentryGen.OnCancelPayload>(PinentryGen.onCancel, onCancel)
  yield* Saga.chainAction<PinentryGen.NewPinentryPayload>(PinentryGen.newPinentry, onNewPinentry)
  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )
}

export default pinentrySaga
