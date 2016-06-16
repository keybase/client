/* @flow */

import engine from '../engine'
import HiddenString from '../util/hidden-string'
import * as Constants from '../constants/unlock-folders'
import flags from '../util/feature-flags'

import type {TypedAsyncAction, AsyncAction} from '../constants/types/flux'
import type {ToPaperKeyInput, OnBackFromPaperKey, CheckPaperKey, Finish, Waiting,
  RegisterRekeyListenerAction, NewRekeyPopupAction} from '../constants/unlock-folders'
import type {incomingCallMapType, delegateUiCtlRegisterRekeyUIRpc} from '../constants/types/flow-types'
import type {Dispatch} from '../constants/types/flux'

type UglyKeys = 'refresh'

export function toPaperKeyInput (): ToPaperKeyInput {
  return {type: Constants.toPaperKeyInput, payload: {}}
}

export function onBackFromPaperKey (): OnBackFromPaperKey {
  return {type: Constants.onBackFromPaperKey, payload: {}}
}

function waiting (currentlyWaiting: boolean): Waiting {
  return {type: Constants.waiting, payload: currentlyWaiting}
}

export function checkPaperKey (paperKey: HiddenString): TypedAsyncAction<CheckPaperKey | Waiting> {
  return dispatch => {
    // TODO figure out what service request to ask for
    // TODO Use the waiting ability of the engine instead of manually dispatching

    dispatch(waiting(true))
    setTimeout(() => {
      dispatch(waiting(false))
      dispatch({type: Constants.checkPaperKey, payload: {success: true}})
    }, 1e3)
  }
}

export function finish (): Finish {
  return {type: Constants.finish, payload: {}}
}

export function close (): AsyncAction {
  return (dispatch, getState) => {
    dispatch({type: Constants.close, payload: {}})
    uglyResponse('refresh', null)
  }
}

export function registerRekeyListener (): (dispatch: Dispatch) => void {
  return dispatch => {
    engine.listenOnConnect('registerRekeyUI', () => {
      const params: delegateUiCtlRegisterRekeyUIRpc = {
        method: 'delegateUiCtl.registerRekeyUI',
        param: {},
        incomingCallMap: {},
        callback: (error, response) => {
          if (error != null) {
            console.warn('error in registering rekey ui: ', error)
          } else {
            console.log('Registered rekey ui')
          }
        }
      }

      engine.rpc(params)
    })

    dispatch(({type: Constants.registerRekeyListener, payload: {started: true}}: RegisterRekeyListenerAction))

    const rekeyListeners = rekeyListenersCreator(dispatch)
    engine.listenGeneralIncomingRpc(rekeyListeners)
  }
}

function uglyResponse (key: UglyKeys, result: any, err: ?any): void {
  const response = uglySessionIDResponseMapper[key]
  if (response == null) {
    console.log('lost response reference')
    return
  }

  if (err != null) {
    response.error(err)
  } else {
    response.result(result)
  }

  delete uglySessionIDResponseMapper[key]
}

const uglySessionIDResponseMapper: {[key: UglyKeys]: any} = {}

function rekeyListenersCreator (dispatch: Dispatch): incomingCallMapType {
  return {
    'keybase.1.rekeyUI.refresh': ({sessionID, problemSetDevices}, response) => {
      console.log('Asked for rekey')

      // We temporarily filter out paperkeys. If we end up with no devices, don't show the popup
      if (!flags.rekeyPaperkeysEnabled) {
        const showing = problemSetDevices.devices.filter(d => d.type !== 'backup')
        if (!showing.length) {
          response.result()
          return
        }
      }

      dispatch(({type: Constants.newRekeyPopup, payload: {devices: problemSetDevices.devices, sessionID}}: NewRekeyPopupAction))
      uglySessionIDResponseMapper['refresh'] = response
    }
  }
}

