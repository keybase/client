import * as T from '../types'
import * as C from '..'

export const onEngineConnected = () => {
  const f = async () => {
    try {
      await T.RPCGen.delegateUiCtlRegisterChatUIRpcPromise()
      await T.RPCGen.delegateUiCtlRegisterLogUIRpcPromise()
      console.log('Registered Chat UI')
    } catch (error) {
      console.warn('Error in registering Chat UI:', error)
    }
  }
  C.ignorePromise(f())
}

