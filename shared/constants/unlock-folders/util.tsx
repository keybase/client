import * as T from '../types'
import * as C from '..'
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
  C.ignorePromise(f())
}

