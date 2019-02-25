// @flow
// TODO use waiting key
import logger from '../logger'
import * as UnlockFoldersGen from './unlock-folders-gen'
import * as EngineGen from './engine-gen-gen'
import * as ConfigGen from './config-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import engine from '../engine'

function* checkPaperKey(_, action) {
  const {paperKey} = action.payload
  yield Saga.put(UnlockFoldersGen.createWaiting({waiting: true}))
  try {
    yield* Saga.callPromise(RPCTypes.loginPaperKeySubmitRpcPromise, {paperPhrase: paperKey})
    yield Saga.put(UnlockFoldersGen.createCheckPaperKeyDone())
  } catch (e) {
    yield Saga.put(UnlockFoldersGen.createCheckPaperKeyDoneError({error: e.message}))
  } finally {
    yield Saga.put(UnlockFoldersGen.createWaiting({waiting: false}))
  }
}

const openPopup = () => {
  RPCTypes.rekeyShowPendingRekeyStatusRpcPromise()
}

const closePopup = () => {
  RPCTypes.rekeyRekeyStatusFinishRpcPromise()
  return UnlockFoldersGen.createCloseDone()
}

const refresh = (_, action) => {
  const {problemSetDevices} = action.payload.params
  // $ForceType may or may not be here, unclear and this flow is very rare so really hard to test
  const sessionID = action.payload.params.sessionID
  logger.info('Asked for rekey')
  return UnlockFoldersGen.createNewRekeyPopup({
    devices: problemSetDevices.devices || [],
    problemSet: problemSetDevices.problemSet,
    sessionID,
  })
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
}

function* unlockFoldersSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainGenerator<UnlockFoldersGen.CheckPaperKeyPayload>(
    UnlockFoldersGen.checkPaperKey,
    checkPaperKey
  )
  yield* Saga.chainAction<UnlockFoldersGen.ClosePopupPayload>(UnlockFoldersGen.closePopup, closePopup)
  yield* Saga.chainAction<UnlockFoldersGen.OpenPopupPayload>(UnlockFoldersGen.openPopup, openPopup)
  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )
  yield* Saga.chainAction<EngineGen.Keybase1RekeyUIRefreshPayload>(EngineGen.keybase1RekeyUIRefresh, refresh)
}

export default unlockFoldersSaga
