import * as T from '../types'
import {ignorePromise} from '../utils'
import * as EngineGen from '@/actions/engine-gen-gen'
import {storeRegistry} from '../store-registry'
import {usePinentryState} from '../pinentry'
import logger from '@/logger'

export const onEngineConnected = () => {
  const f = async () => {
    try {
      await T.RPCGen.delegateUiCtlRegisterSecretUIRpcPromise()
      logger.info('Registered secret ui')
    } catch (error) {
      logger.warn('error in registering secret ui: ', error)
    }
  }
  ignorePromise(f())
}

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1SecretUiGetPassphrase:
      {
        usePinentryState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
