import * as T from '../types'
import * as C from '..'
import {ignorePromise} from '../utils'
import * as EngineGen from '@/actions/engine-gen-gen'
import {storeRegistry} from '../store-registry'

export const onEngineConnected = () => {
  const f = async () => {
    try {
      await T.RPCGen.delegateUiCtlRegisterHomeUIRpcPromise()
      console.log('Registered home UI')
    } catch (error) {
      console.warn('Error in registering home UI:', error)
    }
  }
  ignorePromise(f())
}

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1HomeUIHomeUIRefresh:
    case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
      {
        storeRegistry.getState('people').dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
