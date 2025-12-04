import * as T from '../types'
import * as C from '..'
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
  C.ignorePromise(f())
}

