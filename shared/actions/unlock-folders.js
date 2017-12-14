// @flow
import logger from '../logger'
import * as UnlockFoldersGen from './unlock-folders-gen'
import * as RPCTypes from '../constants/types/flow-types'
import HiddenString from '../util/hidden-string'
import engine from '../engine'

const checkPaperKey = (paperKey: HiddenString) => (dispatch: Dispatch) =>
  RPCTypes.loginPaperKeySubmitRpcPromise({
    paperPhrase: paperKey.stringValue(),
    waitingHandler: waiting => {
      dispatch(UnlockFoldersGen.createWaiting({waiting}))
    },
  })
    .then(() => {
      dispatch(UnlockFoldersGen.createCheckPaperKeyDone())
    })
    .catch(err => {
      dispatch(UnlockFoldersGen.createCheckPaperKeyDoneError({error: err.message}))
    })

const openDialog = () => (dispatch: Dispatch) => RPCTypes.rekeyShowPendingRekeyStatusRpcPromise()

const close = () => (dispatch: Dispatch) => {
  RPCTypes.rekeyRekeyStatusFinishRpcPromise()
  dispatch(UnlockFoldersGen.createCloseDone())
}

const registerRekeyListener = () => (dispatch: Dispatch) => {
  engine().listenOnConnect('registerRekeyUI', () => {
    RPCTypes.delegateUiCtlRegisterRekeyUIRpcPromise()
      .then(response => {
        logger.info('Registered rekey ui')
      })
      .catch(error => {
        logger.warn('error in registering rekey ui: ')
        logger.debug('error in registering rekey ui: ', error)
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
}

const refreshHandler = ({sessionID, problemSetDevices}, response, dispatch) => {
  logger.info('Asked for rekey')
  dispatch(
    UnlockFoldersGen.createNewRekeyPopup({
      devices: problemSetDevices.devices || [],
      sessionID,
      problemSet: problemSetDevices.problemSet,
    })
  )
  response && response.result()
}

export {openDialog, checkPaperKey, close, registerRekeyListener}
