import * as T from '../types'
import {ignorePromise} from '../utils'

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
