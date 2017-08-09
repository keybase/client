// @flow
import * as Constants from '../constants/unlock-folders'
import HiddenString from '../util/hidden-string'
import engine from '../engine'
import type {
  ToPaperKeyInput,
  OnBackFromPaperKey,
  CheckPaperKey,
  Finish,
  Waiting,
  RegisterRekeyListenerAction,
  NewRekeyPopupAction,
} from '../constants/unlock-folders'
import type {TypedAsyncAction, AsyncAction, Dispatch} from '../constants/types/flux'
import {
  delegateUiCtlRegisterRekeyUIRpcPromise,
  loginPaperKeySubmitRpcPromise,
  rekeyShowPendingRekeyStatusRpcPromise,
  rekeyRekeyStatusFinishRpcPromise,
} from '../constants/types/flow-types'

export function toPaperKeyInput(): ToPaperKeyInput {
  return {type: Constants.toPaperKeyInput, payload: {}}
}

export function onBackFromPaperKey(): OnBackFromPaperKey {
  return {type: Constants.onBackFromPaperKey, payload: {}}
}

function waiting(currentlyWaiting: boolean): Waiting {
  return {type: Constants.waiting, payload: currentlyWaiting}
}

export function checkPaperKey(paperKey: HiddenString): TypedAsyncAction<CheckPaperKey | Waiting> {
  return dispatch => {
    loginPaperKeySubmitRpcPromise({
      param: {paperPhrase: paperKey.stringValue()},
      waitingHandler: isWaiting => {
        dispatch(waiting(isWaiting))
      },
    })
      .then(() => {
        dispatch({type: Constants.checkPaperKey, payload: {success: true}})
      })
      .catch(err => {
        dispatch(({type: Constants.checkPaperKey, error: true, payload: {error: err.message}}: CheckPaperKey))
      })
  }
}

export function finish(): Finish {
  return {type: Constants.finish, payload: {}}
}

export function openDialog(): AsyncAction {
  return dispatch => {
    rekeyShowPendingRekeyStatusRpcPromise()
  }
}

export function close(): AsyncAction {
  return (dispatch, getState) => {
    rekeyRekeyStatusFinishRpcPromise()
    dispatch({type: Constants.close, payload: {}})
  }
}

export function registerRekeyListener(): (dispatch: Dispatch) => void {
  return dispatch => {
    engine().listenOnConnect('registerRekeyUI', () => {
      delegateUiCtlRegisterRekeyUIRpcPromise()
        .then(response => {
          console.log('Registered rekey ui')
        })
        .catch(error => {
          console.warn('error in registering rekey ui: ', error)
        })
    })

    // we get this with sessionID == 0 if we call openDialog
    engine().setIncomingHandler('keybase.1.rekeyUI.refresh', (params, response) =>
      refreshHandler(params, response, dispatch)
    )

    // else we get this also as part of delegateRekeyUI
    engine().setIncomingHandler('keybase.1.rekeyUI.delegateRekeyUI', (param: any, response: ?Object) => {
      // Dangling, never gets closed
      const session = engine().createSession(
        {
          'keybase.1.rekeyUI.refresh': (params, response) => refreshHandler(params, response, dispatch),
          'keybase.1.rekeyUI.rekeySendEvent': () => {}, // ignored debug call from daemon
        },
        null,
        null,
        true
      )
      response && response.result(session.id)
    })

    dispatch(({type: Constants.registerRekeyListener, payload: {started: true}}: RegisterRekeyListenerAction))
  }
}

const refreshHandler = ({sessionID, problemSetDevices}, response, dispatch) => {
  console.log('Asked for rekey')
  dispatch(
    ({
      type: Constants.newRekeyPopup,
      payload: {
        devices: problemSetDevices.devices || [],
        sessionID,
        problemSet: problemSetDevices.problemSet,
      },
    }: NewRekeyPopupAction)
  )
  response && response.result()
}
