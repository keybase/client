import * as T from '../types'
import * as C from '..'
import type * as EngineGen from '@/actions/engine-gen-gen'
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

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1RekeyUIRefresh:
    case EngineGen.keybase1RekeyUIDelegateRekeyUI:
      const {useState} = require('./index')
      useState.getState().dispatch.onEngineIncoming(action)
      break
    default:
  }
}

