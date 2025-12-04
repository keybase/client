import * as T from '../types'
import * as C from '..'
import logger from '@/logger'

export const onEngineConnected = () => {
  const f = async () => {
    try {
      await T.RPCGen.delegateUiCtlRegisterIdentify3UIRpcPromise()
      logger.info('Registered identify ui')
    } catch (error) {
      logger.warn('error in registering identify ui: ', error)
    }
  }
  C.ignorePromise(f())
}

