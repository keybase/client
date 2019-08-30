// TODO use waiting key
import logger from '../logger'
import * as UnlockFoldersGen from './unlock-folders-gen'
import * as EngineGen from './engine-gen-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Container from '../util/container'
import {getEngine} from '../engine/require'

function* checkPaperKey(_: Container.TypedState, action: UnlockFoldersGen.CheckPaperKeyPayload) {
  const {paperKey} = action.payload
  yield Saga.put(UnlockFoldersGen.createWaiting({waiting: true}))
  try {
    yield Saga.callUntyped(RPCTypes.loginPaperKeySubmitRpcPromise, {paperPhrase: paperKey})
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

const refresh = (_: Container.TypedState, action: EngineGen.Keybase1RekeyUIRefreshPayload) => {
  const {problemSetDevices} = action.payload.params
  const sessionID = action.payload.params.sessionID
  logger.info('Asked for rekey')
  return UnlockFoldersGen.createNewRekeyPopup({
    devices: problemSetDevices.devices || [],
    problemSet: problemSetDevices.problemSet,
    sessionID,
  })
}

const registerRekeyUI = () =>
  RPCTypes.delegateUiCtlRegisterRekeyUIRpcPromise()
    .then(() => {
      logger.info('Registered rekey ui')
    })
    .catch(error => {
      logger.warn('error in registering rekey ui: ')
      logger.debug('error in registering rekey ui: ', error)
    })

// we get this with sessionID == 0 if we call openDialog
const delegateRekeyUI = (
  _: Container.TypedState,
  action: EngineGen.Keybase1RekeyUIDelegateRekeyUIPayload
) => {
  // Dangling, never gets closed
  const session = getEngine().createSession({
    dangling: true,
    incomingCallMap: {
      'keybase.1.rekeyUI.refresh': ({sessionID, problemSetDevices}) =>
        UnlockFoldersGen.createNewRekeyPopup({
          devices: problemSetDevices.devices || [],
          problemSet: problemSetDevices.problemSet,
          sessionID,
        }),
      'keybase.1.rekeyUI.rekeySendEvent': () => {}, // ignored debug call from daemon
    },
  })
  const response = action.payload.response
  response && response.result(session.id)
}

function* unlockFoldersSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainGenerator<UnlockFoldersGen.CheckPaperKeyPayload>(
    UnlockFoldersGen.checkPaperKey,
    checkPaperKey
  )
  yield* Saga.chainAction2(UnlockFoldersGen.closePopup, closePopup)
  yield* Saga.chainAction2(UnlockFoldersGen.openPopup, openPopup)
  yield* Saga.chainAction2(EngineGen.keybase1RekeyUIRefresh, refresh)
  getEngine().registerCustomResponse('keybase.1.rekeyUI.delegateRekeyUI')
  yield* Saga.chainAction2(EngineGen.keybase1RekeyUIDelegateRekeyUI, delegateRekeyUI)
  yield* Saga.chainAction2(EngineGen.connected, registerRekeyUI)
}

export default unlockFoldersSaga
