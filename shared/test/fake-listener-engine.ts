/// <reference types="jest" />
import * as T from '@/constants/types'
import listener from '@/engine/listener'
import {initEngine, initEngineListener} from '@/engine/require'
import {RPCError} from '@/util/errors'
import {useWaitingState} from '@/stores/waiting'

// The engine boundary the real listener calls: every *RpcListener runs through the real listener,
// and the test settles each call the way the engine does (an RPCError for a service failure).
type Outgoing = {
  callback: (error?: RPCError, result?: unknown) => void
  customResponseIncomingCallMap?: {[method: string]: (params: unknown, response: unknown) => void}
  incomingCallMap: {[method: string]: (params: unknown, response: unknown) => void}
  method: string
  params?: object
}

export const installListenerEngine = () => {
  const calls: Array<Outgoing> = []
  const settled = new Set<Outgoing>()
  const cancel = (call: Outgoing | undefined) => {
    if (call && !settled.has(call)) {
      settled.add(call)
      call.callback(new RPCError('Canceling RPC', T.RPCGen.StatusCode.sccanceled))
    }
  }
  initEngine({
    _rpcOutgoing: (p: Outgoing) => {
      calls.push(p)
      return calls.length
    },
    cancelOutstandingSessions: () => calls.forEach(cancel),
    cancelSession: (sessionID: number) => cancel(calls[sessionID - 1]),
    dispatchWaitingAction: (key: string, waiting: boolean, error?: RPCError) =>
      useWaitingState.getState().dispatch.batch([{error, increment: waiting, key}]),
  } as never)
  initEngineListener(listener)

  const pending = (method: string) => {
    const call = calls.find(c => c.method === method && !settled.has(c))
    if (!call) {
      throw new Error(`no pending listener call for ${method}`)
    }
    return call
  }
  const settle = (method: string, error?: RPCError, result?: unknown) => {
    const call = pending(method)
    settled.add(call)
    call.callback(error, result)
  }

  return {
    calls,
    fail: (method: string, code: number, desc = 'service error') =>
      settle(method, new RPCError(desc, code, null, undefined, method)),
    pending,
    succeed: (method: string, result?: unknown) => settle(method, undefined, result),
  }
}

export const uninstallListenerEngine = () => {
  initEngine(undefined as never)
  initEngineListener(undefined)
}
