import logger from '../logger'
import * as UnlockFoldersGen from './unlock-folders-gen'
import * as EngineGen from './engine-gen-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Constants from '../constants/unlock-folders'
import * as Container from '../util/container'
import {getEngine} from '../engine/require'

const checkPaperKey = async (_: unknown, action: UnlockFoldersGen.CheckPaperKeyPayload) => {
  const {paperKey} = action.payload
  await RPCTypes.loginPaperKeySubmitRpcPromise({paperPhrase: paperKey}, Constants.waitingKey)
  return UnlockFoldersGen.createCheckPaperKeyDone()
}

const openPopup = async () => {
  await RPCTypes.rekeyShowPendingRekeyStatusRpcPromise()
}

const closePopup = () => {
  RPCTypes.rekeyRekeyStatusFinishRpcPromise()
    .then(() => {})
    .catch(() => {})
  return UnlockFoldersGen.createCloseDone()
}

const refresh = (_: unknown, action: EngineGen.Keybase1RekeyUIRefreshPayload) => {
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
const delegateRekeyUI = (_: unknown, action: EngineGen.Keybase1RekeyUIDelegateRekeyUIPayload) => {
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
  const {response} = action.payload
  response.result(session.id)
}

const initUnlockFolders = () => {
  Container.listenAction(UnlockFoldersGen.checkPaperKey, checkPaperKey)
  Container.listenAction(UnlockFoldersGen.closePopup, closePopup)
  Container.listenAction(UnlockFoldersGen.openPopup, openPopup)
  Container.listenAction(EngineGen.keybase1RekeyUIRefresh, refresh)
  getEngine().registerCustomResponse('keybase.1.rekeyUI.delegateRekeyUI')
  Container.listenAction(EngineGen.keybase1RekeyUIDelegateRekeyUI, delegateRekeyUI)
  Container.listenAction(EngineGen.connected, registerRekeyUI)
}

export default initUnlockFolders
