/* @flow */

import * as Constants from '../constants/pinentry'
import engine from '../engine'

import type {GUIEntryFeatures, GUIEntryArg} from '../constants/types/flow-types'
import type {NewPinentryAction, RegisterPinentryListenerAction} from '../constants/pinentry'

import type {Dispatch} from '../constants/types/flux'
import {constants} from '../constants/types/keybase_v1'

// TODO: there has to be a better way.
const uglySessionIDResponseMapper: {[key: number]: Function} = {}

export function registerPinentryListener (): (dispatch: Dispatch) => void {
  return dispatch => {
    engine.listenOnConnect(() => {
      engine.rpc('delegateUiCtl.registerSecretUI', {}, {}, (error, response) => {
        if (error != null) {
          console.error('error in registering secret ui: ', error)
        } else {
          console.log('Registered secret ui')
        }
      })
    })

    dispatch(({
      type: Constants.registerPinentryListener,
      payload: {started: true}
    }: RegisterPinentryListenerAction))

    const pinentryListeners = pinentryListenersCreator(dispatch)
    Object.keys(pinentryListeners).forEach(
      k => engine.listenGeneralIncomingRpc(k, pinentryListeners[k])
    )
  }
}

export function onSubmit (sessionID: number, passphrase: string, features: GUIEntryFeatures): (dispatch: Dispatch) => void {
  let result = {passphrase: passphrase}
  for (const feature in features) {
    result[feature] = features[feature]
  }
  return dispatch => {
    dispatch({type: Constants.onSubmit, payload: {sessionID}})
    uglyResponse(sessionID, result)
  }
}

export function onCancel (sessionID: number): (dipatch: Dispatch) => void {
  return dispatch => {
    dispatch({type: Constants.onCancel, payload: {sessionID}})
    uglyResponse(sessionID, null, {
      code: constants.StatusCode.sccanceled,
      desc: 'Input canceled'
    })
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

function pinentryListenersCreator (dispatch: Dispatch) {
  return {
    'keybase.1.secretUi.getPassphrase': (payload: {pinentry: GUIEntryArg, sessionID: number}, response) => {
      console.log('Asked for passphrase')

      const {prompt, submitLabel, cancelLabel, windowTitle, retryLabel, features} = payload.pinentry
      const sessionID = payload.sessionID

      dispatch(({
        type: Constants.newPinentry,
        payload: {
          sessionID,
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
