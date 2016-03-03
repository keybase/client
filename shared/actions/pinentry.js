/* @flow */

import * as Constants from '../constants/pinentry'
import engine from '../engine'

import type {GUIEntryFeatures, incomingCallMapType, delegateUiCtl_registerSecretUI_rpc} from '../constants/types/flow-types'
import type {NewPinentryAction, RegisterPinentryListenerAction} from '../constants/pinentry'

import type {Dispatch, AsyncAction} from '../constants/types/flux'
import typeof Engine from '../engine'
import {constants} from '../constants/types/keybase-v1'

const uglySessionIDResponseMapper: {[key: number]: any} = {}

export function registerPinentryListener (): AsyncAction {
  return dispatch => {
    engine.listenOnConnect('registerSecretUI', () => {
      const params: delegateUiCtl_registerSecretUI_rpc = {
        method: 'delegateUiCtl.registerSecretUI',
        param: {},
        incomingCallMap: {},
        callback: (error, response) => {
          if (error != null) {
            console.error('error in registering secret ui: ', error)
          } else {
            console.log('Registered secret ui')
          }
        }
      }

      engine.rpc(params)
    })

    dispatch(({
      type: Constants.registerPinentryListener,
      payload: {started: true}
    }: RegisterPinentryListenerAction))

    const pinentryListeners = pinentryListenersCreator(dispatch)
    engine.listenGeneralIncomingRpc(pinentryListeners)
  }
}

export function onSubmit (sessionID: number, passphrase: string, features: GUIEntryFeatures): AsyncAction {
  let result = {passphrase: passphrase}
  for (const feature in features) {
    result[feature] = features[feature]
  }
  return dispatch => {
    dispatch({type: Constants.onSubmit, payload: {sessionID}})
    uglyResponse(sessionID, result)
  }
}

export function onCancel (sessionID: number, engine: Engine): AsyncAction {
  return (dispatch, getState) => {
    dispatch({type: Constants.onCancel, payload: {sessionID}})
    const {seqid} = getState().pinentry.pinentryStates[sessionID]
    engine.rpcResponse(sessionID, seqid, {
      code: constants.StatusCode.scinputcanceled,
      desc: 'Input canceled'
    }, true)
    // uglyResponse(sessionID, null, {
      // code: constants.StatusCode.scinputcanceled,
      // desc: 'Input canceled'
    // })
  }
}

function uglyResponse (sessionID: number, result: any, err: ?any): void {
  const response = uglySessionIDResponseMapper[sessionID]
  if (response == null) {
    console.log('lost response reference')
    return
  }

  if (err != null) {
    response.error(err)
  } else {
    response.result(result)
  }

  delete uglySessionIDResponseMapper[sessionID]
}

function pinentryListenersCreator (dispatch: Dispatch): incomingCallMapType {
  return {
    'keybase.1.secretUi.getPassphrase': (payload, response) => {
      console.log('Asked for passphrase', payload)

      const {prompt, submitLabel, cancelLabel, windowTitle, retryLabel, features} = payload.pinentry
      const sessionID = payload.sessionID
      const seqid = response.seqid

      dispatch(({
        type: Constants.newPinentry,
        payload: {
          sessionID,
          seqid,
          features,
          prompt,
          submitLabel,
          cancelLabel,
          windowTitle,
          retryLabel
        }
      }: NewPinentryAction))

      uglySessionIDResponseMapper[sessionID] = response
    }
  }
}
