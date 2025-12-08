import * as T from '../types'
import * as C from '..'
import * as EngineGen from '@/actions/engine-gen-gen'

export const onEngineConnected = () => {
  const f = async () => {
    try {
      await T.RPCGen.delegateUiCtlRegisterHomeUIRpcPromise()
      console.log('Registered home UI')
    } catch (error) {
      console.warn('Error in registering home UI:', error)
    }
  }
  C.ignorePromise(f())
}

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1HomeUIHomeUIRefresh:
    case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
      {
        const {useState_} = require('./index')
        useState_.getState().dispatch.onEngineIncoming(action)
      }
      break
    default:
  }
}
