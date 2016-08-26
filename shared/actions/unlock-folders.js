// @flow
import * as Constants from '../constants/unlock-folders'
import HiddenString from '../util/hidden-string'
import engine from '../engine'
import type {ToPaperKeyInput, OnBackFromPaperKey, CheckPaperKey, Finish,
  Waiting, RegisterRekeyListenerAction, NewRekeyPopupAction} from '../constants/unlock-folders'
import type {TypedAsyncAction, AsyncAction, Dispatch} from '../constants/types/flux'
import {createServer} from '../engine/server'
import {delegateUiCtlRegisterRekeyUIRpc, loginPaperKeySubmitRpc, rekeyRekeyStatusFinishRpc,
  rekeyShowPendingRekeyStatusRpc} from '../constants/types/flow-types'

// We need the sessionID of the delegateRekeyUI sessions
let rekeyServer = null

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
    loginPaperKeySubmitRpc({
      param: {paperPhrase: paperKey.stringValue()},
      waitingHandler: isWaiting => { dispatch(waiting(isWaiting)) },
      callback: error => {
        if (error) {
          dispatch(({type: Constants.checkPaperKey, error: true, payload: {error: error.raw.desc}}: CheckPaperKey))
        } else {
          dispatch({type: Constants.checkPaperKey, payload: {success: true}})
        }
      },
    })
  }
}

export function finish (): Finish {
  return {type: Constants.finish, payload: {}}
}

export function openDialog (): AsyncAction {
  return dispatch => {
    const params: rekeyShowPendingRekeyStatusRpc = {
      method: 'rekey.showPendingRekeyStatus',
      callback: null,
    }
    engine().rpc(params)
  }
}

export function close (): AsyncAction {
  return (dispatch, getState) => {
    // waiting for cleanupRPC to get merged in so i can make param / sessionID optional
    // $FlowIssue
    rekeyRekeyStatusFinishRpc({
      param: {sessionID: rekeyServer && rekeyServer.sessionID},
    })
    dispatch({type: Constants.close, payload: {}})
  }
}

export function registerRekeyListener (): (dispatch: Dispatch) => void {
  return dispatch => {
    engine().listenOnConnect('registerRekeyUI', () => {
      delegateUiCtlRegisterRekeyUIRpc({
        callback: (error, response) => {
          if (error != null) {
            console.warn('error in registering rekey ui: ', error)
          } else {
            console.log('Registered rekey ui')
          }
        },
      })
    })

    // we get this with sessionID == 0 if we call openDialog
    engine().listenGeneralIncomingRpc({
      'keybase.1.rekeyUI.refresh': (params, response) => refreshHandler(params, response, dispatch),
    })
    // else we get this also as part of delegateRekeyUI
    rekeyServer = createServer(
      engine,
      'keybase.1.rekeyUI.delegateRekeyUI',
      null,
      () => ({
        'keybase.1.rekeyUI.delegateRekeyUI': (params, response) => { },
        'keybase.1.rekeyUI.refresh': (params, response) => refreshHandler(params, response, dispatch),
      })
    )

    dispatch(({type: Constants.registerRekeyListener, payload: {started: true}}: RegisterRekeyListenerAction))
  }
}

const refreshHandler = ({sessionID, problemSetDevices}, response, dispatch) => {
  console.log('Asked for rekey')
  dispatch(({type: Constants.newRekeyPopup,
    payload: {devices: problemSetDevices.devices || [], sessionID, problemSet: problemSetDevices.problemSet}}: NewRekeyPopupAction))
  response.result()
}
