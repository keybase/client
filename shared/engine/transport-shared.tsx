// Classes used to handle RPCs. Ability to inject delays into calls to/from server
import rpc from 'framed-msgpack-rpc'
import {printRPC, printRPCWaitingSession} from '../local-debug'
import {requestIdleCallback} from '../util/idle-callback'
import * as LocalConsole from './local-console'
import * as Stats from './stats'

const RobustTransport = rpc.transport.RobustTransport
const RpcClient = rpc.client.Client

rpc.pack.set_opt('encode_lib', '@msgpack/msgpack')

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
    const m = typeof method === 'string' ? method : method?.(...args)
    const e = typeof extra === 'object' ? extra : extra?.(...args)

    if (enforceOnlyOnce && once) {
      rpcLog({method: m || 'unknown', reason: 'ignoring multiple result calls', type: 'engineInternal'})
    } else {
      once = true

      if (printRPC) {
        rpcLog({extra: e || {}, method: m || 'unknown', reason, type})
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

type InvokeArgs = {
  program: string
  ctype: number
  method: string
  args: [Object]
  notify: boolean
}

class TransportShared extends RobustTransport {
  constructor(
    opts: Object,
    connectCallback?: () => void,
    disconnectCallback?: () => void,
    incomingRPCCallback?: (a: any) => void
  ) {
    super(opts)

    // @ts-ignore this exists
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
      const handler = payload => {
        this._injectInstrumentedResponse(payload)
        incomingRPCCallback(payload)
      }

      // @ts-ignore this exists
      this.set_generic_handler(
        _wrap({
          enforceOnlyOnce: false,
          extra: p => p.param[0],
          handler,
          method: p => p.method,
          reason: '[incoming]',
          type: 'serverToEngine',
        })
      )
    }
  }

  _packetize_error(err: any) {
    console.error('Got packetize error!', err)
  }

  // add logging / multiple call checking
  _injectInstrumentedResponse(payload: any) {
    if (!payload || !payload.response) {
      return
    }

    const oldResponse = payload && payload.response

    if (payload && oldResponse) {
      const calls = ['cancel', 'error', 'result']

      // Can't use {...} here due to react-native not doing object.assign on objects w/ proto chains
      payload.response = {}
      Object.keys(oldResponse).forEach(key => {
        payload.response[key] = oldResponse[key]
      })

      calls.forEach(call => {
        payload.response[call] = _wrap({
          enforceOnlyOnce: true,
          extra: response => ({payload, response}),
          handler: (...args) => {
            oldResponse[call](...args)
          },
          method: payload.method,
          reason: '[-calling:session]',
          type: 'engineToServer',
        })
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
  invoke(arg: InvokeArgs, cb: any) {
    // don't actually compress
    // if (arg.ctype == undefined) {
    //   arg.ctype = rpc.dispatch.COMPRESSION_TYPE_GZIP // default to gzip compression
    // }
    const wrappedInvoke = _wrap({
      enforceOnlyOnce: true,
      extra: arg.args[0],
      // @ts-ignore TODO fix this
      handler: (args: InvokeArgs) => {
        super.invoke(
          args,
          _wrap({
            enforceOnlyOnce: true,
            extra: (_, p) => p,
            handler: (err, data) => {
              cb(err, data)
            },
            method: arg.method,
            reason: '[-calling]',
            type: 'serverToEngine',
          })
        )
      },
      method: arg.method,
      reason: '[+calling]',
      type: 'engineToServer',
    })

    // @ts-ignore
    wrappedInvoke(arg)
  }
}

function sharedCreateClient(nativeTransport: any) {
  const rpcClient = new RpcClient(nativeTransport)

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
