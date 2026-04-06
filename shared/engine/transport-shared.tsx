// Classes used to handle RPCs. Ability to inject delays into calls to/from server
import {printRPC, printRPCWaitingSession} from '@/local-debug'
import {requestIdleCallback} from '@/util/idle-callback'
import * as LocalConsole from './local-console'
import {
  RPCTransport,
  type ErrorType,
  type ConnectDisconnectCB,
  type IncomingRPCCallbackType,
  type InvokeType,
  type PayloadType,
} from './rpc-transport'

// Logging for rpcs
function rpcLog(info: {method: string; reason: string; extra?: object; type: string}): void {
  if (!printRPC) {
    return
  }

  if (!printRPCWaitingSession && info.type === 'engineInternal') {
    return
  }

  const prefix = {
    engineInternal: '=',
    engineToServer: '<< OUT',
    serverToEngine: 'IN >>',
  }[info.type] as string

  requestIdleCallback(
    () => {
      const params = [info.reason, info.method, info.extra].filter(Boolean)
      LocalConsole.green(prefix, info.method, info.reason, ...params)
    },
    {timeout: 1e3}
  )
}

abstract class TransportShared extends RPCTransport {
  constructor(
    connectCallback?: ConnectDisconnectCB,
    disconnectCallback?: ConnectDisconnectCB,
    incomingRPCCallback?: IncomingRPCCallbackType
  ) {
    super({
      connectCallback,
      disconnectCallback,
      incomingRPCCallback: payload => {
        const {method} = payload
        if (printRPC) {
          const {param} = payload
          const extra = param[0]
          rpcLog({extra, method, reason: '[incoming]', type: 'serverToEngine'})
        }

        this.injectInstrumentedResponse(payload)
        incomingRPCCallback?.(payload)
      },
    })
  }

  // add logging / multiple call checking
  injectInstrumentedResponse(payload: PayloadType) {
    if (!payload.response) {
      return
    }

    if (payload.response.error) {
      const old = payload.response.error.bind(payload.response)
      let once = false
      payload.response.error = (err?: ErrorType) => {
        const {method} = payload
        if (once) {
          rpcLog({method, reason: 'ignoring multiple result calls', type: 'engineInternal'})
        }
        once = true
        if (printRPC) {
          rpcLog({extra: {payload}, method, reason: '[-calling:session]', type: 'engineToServer'})
        }
        old(err)
      }
    }
    if (payload.response.result) {
      const old = payload.response.result.bind(payload.response)
      let once = false
      payload.response.result = (data: unknown) => {
        const {method} = payload
        if (once) {
          rpcLog({method, reason: 'ignoring multiple result calls', type: 'engineInternal'})
        }
        once = true
        if (printRPC) {
          rpcLog({extra: {payload}, method, reason: '[-calling:session]', type: 'engineToServer'})
        }
        old(data)
      }
    }
  }

  // add logging / multiple call checking
  invoke(method: string, args: [object], cb: (err: unknown, data: unknown) => void) {
    const extra = args[0]
    if (printRPC) {
      rpcLog({extra, method, reason: '[+calling]', type: 'engineToServer'})
    }
    let once = false
    super.invoke(method, args, (err: unknown, data: unknown) => {
      if (once) {
        rpcLog({method, reason: 'ignoring multiple result calls', type: 'engineInternal'})
        return
      }
      once = true
      if (printRPC) {
        rpcLog({extra: data as object | undefined, method, reason: '[-calling]', type: 'serverToEngine'})
      }
      cb(err, data)
    })
  }
}

// Base for transports that are always locally connected (mobile JSI, desktop renderer IPC).
// Only writeMessage() needs to be overridden per platform.
abstract class LocalTransport extends TransportShared {
  constructor(
    incomingRPCCallback: IncomingRPCCallbackType,
    connectCallback?: ConnectDisconnectCB,
    disconnectCallback?: ConnectDisconnectCB
  ) {
    super(connectCallback, disconnectCallback, incomingRPCCallback)
    this.needsConnect = false
  }
  connect(cb: (err?: unknown) => void) {
    cb()
  }
  protected isConnected() {
    return true
  }
  reset() {}
  close() {}
}

function sharedCreateClient(nativeTransport: TransportShared): {invoke: InvokeType; transport: TransportShared} {
  const rpcClient = {
    invoke: nativeTransport.invoke.bind(nativeTransport) as InvokeType,
    transport: nativeTransport,
  }

  if (rpcClient.transport.needsConnect) {
    rpcClient.transport.connect(err => {
      if (err) {
        console.log('Error in connecting to transport rpc:', err)
      }
    })
  }

  return rpcClient
}

export {TransportShared, LocalTransport, sharedCreateClient, rpcLog}
