// Classes used to handle RPCs. Ability to inject delays into calls to/from server
import * as Framed from 'framed-msgpack-rpc'
import {printRPC, printRPCWaitingSession} from '@/local-debug'
import {requestIdleCallback} from '@/util/idle-callback'
import * as LocalConsole from './local-console'
import * as Stats from './stats'

Framed.pack.set_opt('encode_lib', '@msgpack/msgpack')

// Logging for rpcs
function rpcLog(info: {method: string; reason: string; extra?: {}; type: string}): void {
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

class TransportShared extends Framed.transport.RobustTransport {
  constructor(
    opts: {path?: string},
    connectCallback?: Framed.connectDisconnectCB,
    disconnectCallback?: Framed.connectDisconnectCB,
    incomingRPCCallback?: Framed.incomingRPCCallbackType
  ) {
    super(opts)

    this.hooks = {
      connected: () => {
        this.needsConnect = false
        connectCallback?.()
      },
      eof: () => {
        disconnectCallback?.()
      },
    }

    if (incomingRPCCallback) {
      // delay the call back to us
      this.set_generic_handler(payload => {
        const {method} = payload
        if (printRPC) {
          const {param} = payload
          const extra = param[0]
          const reason = '[incoming]'
          const type = 'serverToEngine'
          rpcLog({extra, method, reason, type})
        }

        // always capture stats
        if (method) {
          Stats.gotStat(method, true)
        }

        this._injectInstrumentedResponse(payload)
        incomingRPCCallback(payload)
      })
    }
  }

  _packetize_error(err: unknown) {
    console.error('Got packetize error!', err)
  }

  // add logging / multiple call checking
  _injectInstrumentedResponse(payload: Framed.PayloadType) {
    if (!payload.response) {
      return
    }

    if (payload.response.error) {
      const old = payload.response.error.bind(payload.response)
      let once = false
      payload.response.error = (err: Framed.ErrorType) => {
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

  unwrap_incoming_error(err: unknown) {
    if (!err) {
      return null
    }

    if (typeof err === 'object') {
      return err
    } else {
      try {
        return new Error(JSON.stringify(err))
      } catch {
        return new Error('unknown')
      }
    }
  }

  // Override RobustTransport.invoke.
  invoke(arg: Framed.InvokeArgs, cb: (err: Framed.ErrorType, data: {}) => void) {
    // don't actually compress
    // if (arg.ctype == undefined) {
    //   arg.ctype = rpc.dispatch.COMPRESSION_TYPE_GZIP // default to gzip compression
    // }
    const extra = arg.args[0]
    const method = arg.method
    const reason = '[+calling]'
    const type = 'engineToServer'
    if (printRPC) {
      rpcLog({extra, method, reason, type})
    }
    Stats.gotStat(method, false)

    let once = false
    super.invoke(arg, (err: Framed.ErrorType, data: {}) => {
      if (once) {
        rpcLog({method, reason: 'ignoring multiple result calls', type: 'engineInternal'})
        return
      }
      once = true
      if (printRPC) {
        const reason = '[-calling]'
        const type = 'serverToEngine'
        const extra = data
        rpcLog({extra, method, reason, type})
      }
      Stats.gotStat(method, false)
      cb(err, data)
    })
  }
}

function sharedCreateClient(nativeTransport: TransportShared) {
  const rpcClient = new Framed.client.Client(nativeTransport)

  if (rpcClient.transport.needsConnect) {
    rpcClient.transport.connect(err => {
      if (err) {
        console.log('Error in connecting to transport rpc:', err)
      }
    })
  }

  return rpcClient
}

export {TransportShared, sharedCreateClient, rpcLog}
