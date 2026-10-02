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
  // Whether the link to the service is up now
  private _linkUp: boolean

  constructor(
    incomingRPCCallback?: IncomingRPCCallbackType,
    connectCallback?: ConnectDisconnectCB,
    disconnectCallback?: ConnectDisconnectCB,
    linkUp = false
  ) {
    super({
      connectCallback,
      disconnectCallback,
      // logging wrapper only when printRPC; avoids per-message overhead in prod
      incomingRPCCallback:
        incomingRPCCallback && printRPC
          ? payload => {
              const {method, param} = payload
              const extra = param[0]
              rpcLog({extra, method, reason: '[incoming]', type: 'serverToEngine'})
              this.injectInstrumentedResponse(payload)
              incomingRPCCallback(payload)
            }
          : incomingRPCCallback,
    })
    this._linkUp = linkUp
  }

  get isLinkUp() {
    return this._linkUp
  }

  protected override isConnected() {
    return this._linkUp
  }

  protected markLinkDown() {
    this._linkUp = false
    this.onLinkDown()
  }

  protected markLinkUp() {
    this._linkUp = true
    this.onConnected()
  }

  // add logging / multiple call checking
  injectInstrumentedResponse(payload: PayloadType) {
    if (!printRPC || !payload.response) {
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
  override invoke(method: string, args: [object], cb: (err: unknown, data: unknown) => void) {
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

function sharedCreateClient(nativeTransport: TransportShared): {invoke: InvokeType; transport: TransportShared} {
  return {
    invoke: nativeTransport.invoke.bind(nativeTransport) as InvokeType,
    transport: nativeTransport,
  }
}

export {TransportShared, sharedCreateClient, rpcLog}
