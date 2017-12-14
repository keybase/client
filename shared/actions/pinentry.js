// @flow
import logger from '../logger'
import * as PinentryGen from '../actions/pinentry-gen'
import * as RPCTypes from '../constants/types/flow-types'
import engine from '../engine'
import type {AsyncAction} from '../constants/types/flux'

const uglySessionIDResponseMapper: {[key: number]: any} = {}

export function registerPinentryListener(): AsyncAction {
  return dispatch => {
    engine().listenOnConnect('registerSecretUI', () => {
      RPCTypes.delegateUiCtlRegisterSecretUIRpcPromise()
        .then(response => {
          logger.info('Registered secret ui')
        })
        .catch(error => {
          logger.warn('error in registering secret ui: ', error)
        })
    })

    dispatch(PinentryGen.createRegisterPinentryListener({started: true}))

    engine().setIncomingHandler('keybase.1.secretUi.getPassphrase', (payload, response) => {
      logger.info('Asked for passphrase')

      const {prompt, submitLabel, cancelLabel, windowTitle, retryLabel, features, type} = payload.pinentry
      const sessionID = payload.sessionID

      dispatch(
        PinentryGen.createNewPinentry({
          cancelLabel,
          features,
          prompt,
          retryLabel,
          sessionID,
          submitLabel,
          type,
          windowTitle,
        })
      )

      uglySessionIDResponseMapper[sessionID] = response
    })
  }
}

export function onSubmit(
  sessionID: number,
  passphrase: string,
  features: RPCTypes.GUIEntryFeatures
): AsyncAction {
  let result = {passphrase: passphrase}
  for (const feature in features) {
    result[feature] = features[feature]
  }
  return dispatch => {
    dispatch(PinentryGen.createOnSubmit({sessionID}))
    uglyResponse(sessionID, result)
  }
}

export function onCancel(sessionID: number): AsyncAction {
  return dispatch => {
    dispatch(PinentryGen.createOnCancel({sessionID}))
    uglyResponse(sessionID, null, {
      code: RPCTypes.constantsStatusCode.scinputcanceled,
      desc: 'Input canceled',
    })
  }
}

function uglyResponse(sessionID: number, result: any, err: ?any): void {
  const response = uglySessionIDResponseMapper[sessionID]
  if (response == null) {
    logger.info('lost response reference')
    return
  }

  if (err != null) {
    response.error(err)
  } else {
    response.result(result)
  }

  delete uglySessionIDResponseMapper[sessionID]
}
