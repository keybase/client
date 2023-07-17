import logger from '../logger'
import * as EngineGen from './engine-gen-gen'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as ConfigConstants from '../constants/config'
import * as Container from '../util/container'
import * as Z from '../util/zustand'
import {getEngine} from '../engine/require'

const initUnlockFolders = () => {
  Container.listenAction(EngineGen.keybase1RekeyUIRefresh, (_, action) => {
    const {problemSetDevices} = action.payload.params
    logger.info('Asked for rekey')
    ConfigConstants.useConfigState.getState().dispatch.openUnlockFolders(problemSetDevices.devices ?? [])
  })
  getEngine().registerCustomResponse('keybase.1.rekeyUI.delegateRekeyUI')
  Container.listenAction(EngineGen.keybase1RekeyUIDelegateRekeyUI, (_, action) => {
    // we get this with sessionID == 0 if we call openDialog
    // Dangling, never gets closed
    const session = getEngine().createSession({
      dangling: true,
      incomingCallMap: {
        'keybase.1.rekeyUI.refresh': ({problemSetDevices}) => {
          ConfigConstants.useConfigState
            .getState()
            .dispatch.openUnlockFolders(problemSetDevices.devices ?? [])
        },
        'keybase.1.rekeyUI.rekeySendEvent': () => {}, // ignored debug call from daemon
      },
    })
    const {response} = action.payload
    response.result(session.id)
  })
  Container.listenAction(EngineGen.connected, () => {
    const registerRekeyUI = async () => {
      try {
        await RPCTypes.delegateUiCtlRegisterRekeyUIRpcPromise()
        logger.info('Registered rekey ui')
      } catch (error) {
        logger.warn('error in registering rekey ui: ')
        logger.debug('error in registering rekey ui: ', error)
      }
    }
    Z.ignorePromise(registerRekeyUI())
  })
}

export default initUnlockFolders
