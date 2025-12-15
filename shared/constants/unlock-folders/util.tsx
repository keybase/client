import * as T from '../types'
import {ignorePromise} from '../utils'
import * as EngineGen from '@/actions/engine-gen-gen'
import {storeRegistry} from '../store-registry'
import logger from '@/logger'

export const onEngineConnected = () => {
  const f = async () => {
    try {
      await T.RPCGen.delegateUiCtlRegisterRekeyUIRpcPromise()
      logger.info('Registered rekey ui')
    } catch (error) {
      logger.warn('error in registering rekey ui: ')
      logger.debug('error in registering rekey ui: ', error)
    }
  }
  ignorePromise(f())
}

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1RekeyUIRefresh:
    case EngineGen.keybase1RekeyUIDelegateRekeyUI:
      {
        storeRegistry.getState('unlock-folders').dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
