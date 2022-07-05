import logger from '../logger'
import * as UnlockFoldersGen from './unlock-folders-gen'
import * as EngineGen from './engine-gen-gen'
import * as Saga from '../util/saga'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Constants from '../constants/unlock-folders'
import {getEngine} from '../engine/require'

const checkPaperKey = async (action: UnlockFoldersGen.CheckPaperKeyPayload) => {
  const {paperKey} = action.payload
  await RPCTypes.loginPaperKeySubmitRpcPromise({paperPhrase: paperKey}, Constants.waitingKey)
  return UnlockFoldersGen.createCheckPaperKeyDone()
}

const openPopup = async () => {
  await RPCTypes.rekeyShowPendingRekeyStatusRpcPromise()
}

const closePopup = () => {
  RPCTypes.rekeyRekeyStatusFinishRpcPromise()
  return UnlockFoldersGen.createCloseDone()
}

const refresh = (action: EngineGen.Keybase1RekeyUIRefreshPayload) => {
  const {problemSetDevices} = action.payload.params
  const sessionID = action.payload.params.sessionID
  logger.info('Asked for rekey')
  return UnlockFoldersGen.createNewRekeyPopup({
    devices: problemSetDevices.devices ?? [],
    problemSet: problemSetDevices.problemSet,
    sessionID,
  })
}

const registerRekeyUI = async () => {
  try {
    await RPCTypes.delegateUiCtlRegisterRekeyUIRpcPromise()
    logger.info('Registered rekey ui')
  } catch (error) {
    logger.warn('error in registering rekey ui: ')
    logger.debug('error in registering rekey ui: ', error)
  }
}

// we get this with sessionID == 0 if we call openDialog
const delegateRekeyUI = (action: EngineGen.Keybase1RekeyUIDelegateRekeyUIPayload) => {
  // Dangling, never gets closed
  const session = getEngine().createSession({
    dangling: true,
    incomingCallMap: {
      'keybase.1.rekeyUI.refresh': ({sessionID, problemSetDevices}) =>
        Saga.put(
          UnlockFoldersGen.createNewRekeyPopup({
            devices: problemSetDevices.devices || [],
            problemSet: problemSetDevices.problemSet,
            sessionID,
          })
        ),
      'keybase.1.rekeyUI.rekeySendEvent': () => {}, // ignored debug call from daemon
    },
  })
  const {response} = action.payload
  response && response.result(session.id)
}

function* unlockFoldersSaga() {
  yield* Saga.chainAction(UnlockFoldersGen.checkPaperKey, checkPaperKey)
  yield* Saga.chainAction2(UnlockFoldersGen.closePopup, closePopup)
  yield* Saga.chainAction2(UnlockFoldersGen.openPopup, openPopup)
  yield* Saga.chainAction(EngineGen.keybase1RekeyUIRefresh, refresh)
  getEngine().registerCustomResponse('keybase.1.rekeyUI.delegateRekeyUI')
  yield* Saga.chainAction(EngineGen.keybase1RekeyUIDelegateRekeyUI, delegateRekeyUI)
  yield* Saga.chainAction2(EngineGen.connected, registerRekeyUI)
}

export default unlockFoldersSaga
