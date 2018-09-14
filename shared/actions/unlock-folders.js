// @flow
import logger from '../logger'
import * as UnlockFoldersGen from './unlock-folders-gen'
import * as ConfigGen from './config-gen'
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

const setupEngineListeners = () => {
  engine().actionOnConnect('registerRekeyUI', () => {
    RPCTypes.delegateUiCtlRegisterRekeyUIRpcPromise()
      .then(response => {
        logger.info('Registered rekey ui')
      })
      .catch(error => {
        logger.warn('error in registering rekey ui: ')
        logger.debug('error in registering rekey ui: ', error)
      })
  })

  const dispatch = engine().deprecatedGetDispatch()

  // we get this with sessionID == 0 if we call openDialog
  engine().setCustomResponseIncomingCallMap({
    'keybase.1.rekeyUI.delegateRekeyUI': (_, response) => {
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
    },
  })
  engine().setIncomingCallMap({
    // else we get this also as part of delegateRekeyUI
    'keybase.1.rekeyUI.refresh': ({sessionID, problemSetDevices}) => {
      logger.info('Asked for rekey')
      return Saga.put(
        UnlockFoldersGen.createNewRekeyPopup({
          devices: problemSetDevices.devices || [],
          problemSet: problemSetDevices.problemSet,
          sessionID,
        })
      )
    },
  })
}

function* unlockFoldersSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEvery(UnlockFoldersGen.checkPaperKey, _checkPaperKey)
  yield Saga.safeTakeEveryPure(UnlockFoldersGen.closePopup, _closePopup)
  yield Saga.safeTakeEveryPure(UnlockFoldersGen.openPopup, _openPopup)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupEngineListeners)
}

export default unlockFoldersSaga
