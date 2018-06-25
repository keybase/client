// @flow
import logger from '../logger'
import * as UnlockFoldersGen from './unlock-folders-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import engine from '../engine'

function* _checkPaperKey(action: UnlockFoldersGen.CheckPaperKeyPayload) {
  const {paperKey} = action.payload
  yield Saga.put(UnlockFoldersGen.createWaiting({waiting: true}))
  try {
    yield Saga.call(RPCTypes.loginPaperKeySubmitRpcPromise, {paperPhrase: paperKey})
    yield Saga.put(UnlockFoldersGen.createCheckPaperKeyDone())
  } catch (e) {
    yield Saga.put(UnlockFoldersGen.createCheckPaperKeyDoneError({error: e.message}))
  } finally {
    yield Saga.put(UnlockFoldersGen.createWaiting({waiting: false}))
  }
}

const _openPopup = () => {
  RPCTypes.rekeyShowPendingRekeyStatusRpcPromise()
}

const _closePopup = () => {
  RPCTypes.rekeyRekeyStatusFinishRpcPromise()
  return Saga.put(UnlockFoldersGen.createCloseDone())
}

function _registerRekeyListener() {
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
  engine().setIncomingActionCreators(
    'keybase.1.rekeyUI.refresh',
    ({sessionID, problemSetDevices}, response) => {
      logger.info('Asked for rekey')
      response && response.result()
      return [
        UnlockFoldersGen.createNewRekeyPopup({
          devices: problemSetDevices.devices || [],
          problemSet: problemSetDevices.problemSet,
          sessionID,
        }),
      ]
    }
  )

  // else we get this also as part of delegateRekeyUI
  engine().setIncomingActionCreators('keybase.1.rekeyUI.delegateRekeyUI', (_, response, dispatch) => {
    // Dangling, never gets closed
    const session = engine().createSession({
      dangling: true,
      incomingCallMap: {
        'keybase.1.rekeyUI.refresh': ({sessionID, problemSetDevices}, response) => {
          dispatch(
            UnlockFoldersGen.createNewRekeyPopup({
              devices: problemSetDevices.devices || [],
              problemSet: problemSetDevices.problemSet,
              sessionID,
            })
          )
        },
        'keybase.1.rekeyUI.rekeySendEvent': () => {}, // ignored debug call from daemon
      },
    })
    response && response.result(session.id)
  })
}

function* unlockFoldersSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(UnlockFoldersGen.checkPaperKey, _checkPaperKey)
  yield Saga.safeTakeEveryPure(UnlockFoldersGen.closePopup, _closePopup)
  yield Saga.safeTakeEveryPure(UnlockFoldersGen.openPopup, _openPopup)
  yield Saga.safeTakeEveryPure(UnlockFoldersGen.registerRekeyListener, _registerRekeyListener)
}

export default unlockFoldersSaga
