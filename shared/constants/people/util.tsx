import * as T from '../types'
import * as C from '..'

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

