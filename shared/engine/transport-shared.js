// @flow
// Classes used to handle RPCs. Ability to inject delays into calls to/from server
import rpc from 'framed-msgpack-rpc'
import {localLog} from '../util/forward-logs'
import {printRPC} from '../local-debug'
import {requestIdleCallback} from '../util/idle-callback'

import type {rpcLogType} from './index.platform'

const RobustTransport = rpc.transport.RobustTransport
const RpcClient = rpc.client.Client

// Wrapped to ensure its called once
// $FlowIssue using start to help with this inference insanity
function _makeOnceOnly(f: *): * {
  let once = false
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
function _makeLogged(
  // $FlowIssue using start to help with this inference insanity
  f: *,
  type: rpcLogType,
  logTitle: string,
  extraInfo?: ?Object,
  titleFromArgs?: ?(...Array<any>) => string
  // $FlowIssue using start to help with this inference insanity
): * {
  if (printRPC) {
    return (...args) => {
      rpcLog(type, titleFromArgs ? titleFromArgs(...args) : logTitle, {...extraInfo, args})
      f(...args)
    }
  } else {
    return f
  }
}

// We basically always log/ensure once all the calls back and forth
// $FlowIssue using start to help with this inference insanity
function _wrap(f: *, logType: rpcLogType, logTitle: string, logInfo?: Object): * {
  const logged = _makeLogged(f, logType, logTitle, logInfo)
  const onceOnly = _makeOnceOnly(logged)
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

      this.set_generic_handler(
        _makeLogged(handler, 'serverToEngine', 'incoming', null, args => `incoming: ${args.method}`)
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
        payload.response[call] = _wrap(
          (...args) => {
            oldResponse[call](...args)
          },
          'engineToServer',
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
            'serverToEngine',
            `received ${arg.method}`
          )
        )
      },
      'engineToServer',
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
