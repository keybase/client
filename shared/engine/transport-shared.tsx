// Classes used to handle RPCs. Ability to inject delays into calls to/from server
import * as Framed from 'framed-msgpack-rpc'
import {printRPC, printRPCWaitingSession} from '../local-debug'
import {requestIdleCallback} from '../util/idle-callback'
import * as LocalConsole from './local-console'
import * as Stats from './stats'

Framed.pack.set_opt('encode_lib', '@msgpack/msgpack')

// We basically always log/ensure once all the calls back and forth
function _wrap(options: {
  handler: (...args: Array<any>) => void
  type: string
  method: string | ((...args: Array<any>) => string)
  reason: string
  extra: Object | ((...args: Array<any>) => Object)
  enforceOnlyOnce: boolean
}) {
  const {handler, extra, method, type, enforceOnlyOnce, reason} = options
  let once = false

  const wrapped = (...args: Array<any>): void => {
    const m = typeof method === 'string' ? method : method(...args)
    const e = typeof extra === 'object' ? extra : extra(...args)

    if (enforceOnlyOnce && once) {
      rpcLog({method: m || 'unknown', reason: 'ignoring multiple result calls', type: 'engineInternal'})
    } else {
      once = true

      if (printRPC) {
        rpcLog({extra: e, method: m || 'unknown', reason, type})
      }

      // always capture stats
      if (m && type !== 'engineInternal') {
        Stats.gotStat(m, type === 'serverToEngine')
      }

      handler(...args)
    }
  }
  return wrapped
}

// Logging for rpcs
function rpcLog(info: {method: string; reason: string; extra?: Object; type: string}): void {
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
          const extra = param[0] as any
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

  _packetize_error(err: any) {
    console.error('Got packetize error!', err)
  }

  // add logging / multiple call checking
  _injectInstrumentedResponse(payload: Framed.PayloadType) {
    if (!payload.response) {
      return
    }

    if (payload.response.error) {
      const old = payload.response.error.bind(payload.response)
      payload.response.error = _wrap({
        enforceOnlyOnce: true,
        extra: response => ({payload, response}),
        handler: (...args: Array<any>) => {
          // @ts-ignore
          old(...args)
        },
        method: payload.method,
        reason: '[-calling:session]',
        type: 'engineToServer',
      })
    }
    if (payload.response.result) {
      const old = payload.response.result.bind(payload.response)
      payload.response.result = _wrap({
        enforceOnlyOnce: true,
        extra: response => ({payload, response}),
        handler: (...args: Array<any>) => {
          // @ts-ignore
          old(...args)
        },
        method: payload.method,
        reason: '[-calling:session]',
        type: 'engineToServer',
      })
    }
  }

  unwrap_incoming_error(err: any) {
    if (!err) {
      return null
    }

    if (typeof err === 'object') {
      return err
    } else {
      return new Error(JSON.stringify(err))
    }
  }

  // Override RobustTransport.invoke.
  invoke(arg: Framed.InvokeArgs, cb: (err: any, data: any) => void) {
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
    super.invoke(arg, (err, data) => {
      if (once) {
        rpcLog({method, reason: 'ignoring multiple result calls', type: 'engineInternal'})
        return
      }
      once = true
      if (printRPC) {
        const reason = '[-calling]'
        const type = 'serverToEngine'
        const extra = data as any
        rpcLog({extra, method, reason, type})
      }
      Stats.gotStat(method, false)
      cb(err, data)
    })
  }
}

function sharedCreateClient(nativeTransport: any) {
  const rpcClient = new Framed.client.Client(nativeTransport)

  if (rpcClient.transport.needsConnect) {
    rpcClient.transport.connect(err => {
      if (err != null) {
        console.log('Error in connecting to transport rpc:', err)
      }
    })
  }

  return rpcClient
}

export {TransportShared, sharedCreateClient, rpcLog}
