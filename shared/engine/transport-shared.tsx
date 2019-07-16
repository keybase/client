// Classes used to handle RPCs. Ability to inject delays into calls to/from server
import rpc from 'framed-msgpack-rpc'
import {printRPC, printRPCWaitingSession} from '../local-debug'
import {requestIdleCallback} from '../util/idle-callback'
import * as LocalConsole from '../util/local-console'
import * as Stats from './stats'

const RobustTransport = rpc.transport.RobustTransport
const RpcClient = rpc.client.Client

// We basically always log/ensure once all the calls back and forth
function _wrap<A1, A2, A3, A4, A5, F extends (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => void>(options: {
  handler: F
  type: string
  method: string | ((...args: Array<any>) => string)
  reason: string
  extra: Object | ((...args: Array<any>) => Object)
  enforceOnlyOnce: boolean
}): F {
  const {handler, extra, method, type, enforceOnlyOnce, reason} = options
  let once = false

  // @ts-ignore codemode issue
  const wrapped: F = (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): void => {
    const m = typeof method === 'string' ? method : method && method(a1, a2, a3, a4, a5)
    const e = typeof extra === 'object' ? extra : extra && extra(a1, a2, a3, a4, a5)

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

      handler(a1, a2, a3, a4, a5)
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
  }[info.type]

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
  method: string
  args: [Object]
  notify: boolean
}

class TransportShared extends RobustTransport {
  constructor(
    opts: Object,
    connectCallback: () => void,
    disconnectCallback: () => void,
    incomingRPCCallback: (a: any) => void
  ) {
    super(opts)

    // @ts-ignore codemode issue
    this.hooks = {
      connected: () => {
        this.needsConnect = false
        connectCallback && connectCallback()
      },
      eof: () => {
        disconnectCallback && disconnectCallback()
      },
    }

    if (incomingRPCCallback) {
      // delay the call back to us
      const handler = payload => {
        this._injectInstrumentedResponse(payload)
        incomingRPCCallback(payload)
      }

      // @ts-ignore codemode issue
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
    // eslint-disable-line camelcase
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
