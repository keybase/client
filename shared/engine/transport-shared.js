// @flow
// Classes used to handle RPCs. Ability to inject delays into calls to/from server
import rpc from 'framed-msgpack-rpc'
import {localLog} from '../util/forward-logs'
import {printRPC, printRPCStats} from '../local-debug'
import {requestIdleCallback} from '../util/idle-callback'
import * as Stats from './stats'

const RobustTransport = rpc.transport.RobustTransport
const RpcClient = rpc.client.Client

// We basically always log/ensure once all the calls back and forth
function _wrap<A1, A2, A3, A4, A5, F: (A1, A2, A3, A4, A5) => void>(
  f: F,
  info: Object,
  enforceOnlyOnce: boolean
): F {
  let once = false
  // $ForceType
  const wrapped: F = (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5): void => {
    if (enforceOnlyOnce && once) {
      rpcLog({...a1, reason: 'ignoring multiple result calls', type: 'engineInternal'})
    } else {
      once = true

      if (printRPC) {
        rpcLog({...info, ...a1})
      }

      if (printRPCStats) {
        const type = info.type || a1.type
        const method = info.method || a1.method

        if (type !== 'engineInternal') {
          Stats.gotStat(method, type === 'serverToEngine')
        }
      }

      f(a1, a2, a3, a4, a5)
    }
  }
  return wrapped
}

// Logging for rpcs
function rpcLog(info: Object): void {
  if (!printRPC) {
    return
  }

  const prefix = {
    engineInternal: '[engine]',
    engineToServer: '[engine] ↗️',
    serverToEngine: '[engine] ⤵️',
  }[info.type]
  const style = {
    engineInternal: 'color: purple',
    engineToServer: 'color: blue',
    serverToEngine: 'color: green',
  }[info.type]

  if (!prefix) {
  }

  requestIdleCallback(
    () => {
      localLog(`%c${prefix}`, style, info.reason || info.method, info)
    },
    {timeout: 1e3}
  )
}

class TransportShared extends RobustTransport {
  constructor(
    opts: Object,
    connectCallback: () => void,
    disconnectCallback: () => void,
    incomingRPCCallback: (a: any) => void,
    writeCallback: any
  ) {
    super(opts)

    this.hooks = {
      connected: () => {
        this.needsConnect = false
        connectCallback && connectCallback()
      },
      eof: () => {
        disconnectCallback && disconnectCallback()
      },
    }

    if (writeCallback) {
      this.writeCallback = writeCallback
    }
    if (incomingRPCCallback) {
      // delay the call back to us
      const handler = payload => {
        this._injectInstrumentedResponse(payload)
        incomingRPCCallback(payload)
      }

      this.set_generic_handler(_wrap(handler, {type: 'serverToEngine'}, false))
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
        payload.response[call] = _wrap(
          (...args) => {
            oldResponse[call](...args)
          },
          {
            method: payload.method,
            payload,
            type: 'engineToServer',
          },
          true
        )
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

  invoke(arg: Object, cb: any) {
    // args needs to be wrapped as an array for some reason so let's just do that here
    const wrappedArgs = {
      ...arg,
      args: [arg.args || {}],
    }

    const wrappedInvoke = _wrap(
      args => {
        super.invoke(
          args,
          _wrap(
            (err, data) => {
              cb(err, data)
            },
            {
              method: arg.method,
              type: 'serverToEngine',
            },
            true
          )
        )
      },
      {
        method: arg.method,
        type: 'engineToServer',
      },
      true
    )

    wrappedInvoke(wrappedArgs)
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
