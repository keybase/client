// @flow
// Classes used to handle RPCs. Ability to inject delays into calls to/from server
import rpc from 'framed-msgpack-rpc'
import {localLog} from '../util/forward-logs'
import {printRPC} from '../local-debug'
import {requestIdleCallback} from '../util/idle-callback'

import type {rpcLogType} from './index.platform'

const {transport: {RobustTransport}, client: {Client: RpcClient}} = rpc
const KEYBASE_RPC_DELAY_RESULT: number = process.env.KEYBASE_RPC_DELAY_RESULT
  ? parseInt(process.env.KEYBASE_RPC_DELAY_RESULT)
  : 0
const KEYBASE_RPC_DELAY: number = process.env.KEYBASE_RPC_DELAY ? parseInt(process.env.KEYBASE_RPC_DELAY) : 0

// Wrapped to ensure its called once
function _makeOnceOnly<F: Function>(f: F): F {
  let once = false
  // $FlowIssue
  return (...args) => {
    if (once) {
      rpcLog('engineInternal', 'ignoring multiple result calls', {args})
    } else {
      once = true
      f(...args)
    }
  }
}

// Wrapped to add logging
function _makeLogged<F: Function>(
  f: F,
  type: rpcLogType,
  logTitle: string,
  extraInfo?: ?Object,
  titleFromArgs?: ?Function
): F {
  if (printRPC) {
    // $FlowIssue
    return (...args) => {
      rpcLog(type, titleFromArgs ? titleFromArgs(...args) : logTitle, {...extraInfo, args})
      f(...args)
    }
  } else {
    return f
  }
}

// Wrapped to make time delayed functions to test timing issues
function _makeDelayed<F: Function>(f: F, amount: number): F {
  if (__DEV__ && amount > 0) {
    // $FlowIssue
    return (...args) => {
      localLog('%c[RPC Delay call]', 'color: red')
      setTimeout(() => {
        f(...args)
      }, amount)
    }
  } else {
    return f
  }
}

// We basically always delay/log/ensure once all the calls back and forth
function _wrap<F: Function>(
  f: F,
  logType: rpcLogType,
  amount: number,
  logTitle: string,
  logInfo?: Object
): F {
  const logged: F = _makeLogged(f, logType, logTitle, logInfo)
  const delayed: F = _makeDelayed(logged, amount)
  const onceOnly: F = _makeOnceOnly(delayed)
  return onceOnly
}

// Logging for rpcs
function rpcLog(type: rpcLogType, title: string, info?: Object): void {
  if (!printRPC) {
    return
  }

  const prefix = {
    engineInternal: '[engine]',
    engineToServer: '[engine] ->',
    serverToEngine: '[engine] <-',
  }[type]
  const style = {
    engineInternal: 'color: purple',
    engineToServer: 'color: blue',
    serverToEngine: 'color: green',
  }[type]

  requestIdleCallback(
    () => {
      localLog(`%c${prefix}`, style, title, info)
    },
    {timeout: 1e3}
  )
}

class TransportShared extends RobustTransport {
  // $FlowIssue
  constructor(opts, connectCallback, disconnectCallback, incomingRPCCallback, writeCallback) {
    const hooks = {
      connected: () => {
        // $FlowIssue complains that this might be null
        this.needsConnect = false
        connectCallback && connectCallback()
      },
      eof: () => {
        disconnectCallback && disconnectCallback()
      },
    }

    super({hooks, ...opts})

    if (writeCallback) {
      this.writeCallback = writeCallback
    }
    if (incomingRPCCallback) {
      // delay the call back to us
      const handler = payload => {
        this._injectInstrumentedResponse(payload)
        // Defer a frame since decoding can take awhile, using setTimeout and not setImmediate on purpose
        setTimeout(() => {
          incomingRPCCallback(payload)
        }, 0)
      }

      this.set_generic_handler(
        _makeDelayed(
          _makeLogged(handler, 'serverToEngine', 'incoming', null, args => `incoming: ${args.method}`),
          KEYBASE_RPC_DELAY_RESULT
        )
      )
    }
  }

  // add delay / logging / multiple call checking
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
          'engineToServer',
          KEYBASE_RPC_DELAY,
          call,
          {payload}
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
    // args needs to be wrapped as an array for some reason so lets just do that here
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
            'serverToEngine',
            KEYBASE_RPC_DELAY_RESULT,
            `received ${arg.method}`
          )
        )
      },
      'engineToServer',
      KEYBASE_RPC_DELAY,
      `sent ${arg.method}`
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
