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
// $FlowIssue using start to help with this inference insanity
function _wrap(f: *, info: Object, enforceOnlyOnce: boolean): * {
  let once = false
  return (...args) => {
    if (!enforceOnlyOnce || once) {
      rpcLog({args, reason: 'ignoring multiple result calls', type: 'engineInternal'})
    } else {
      once = enforceOnlyOnce && true

      if (printRPC) {
        rpcLog({...info, args})
      }

      if (printRPCStats && args.length) {
        Stats.gotStat(info.method, info.incoming)
      }

      f(...args)
    }
  }
}

// Logging for rpcs
function rpcLog(info: Object): void {
  if (!printRPC) {
    return
  }

  const prefix = {
    engineInternal: '[engine]',
    engineToServer: '[engine] ->',
    serverToEngine: '[engine] <-',
  }[info.type]
  const style = {
    engineInternal: 'color: purple',
    engineToServer: 'color: blue',
    serverToEngine: 'color: green',
  }[info.type]

  requestIdleCallback(
    () => {
      localLog(`%c${prefix}`, style, info)
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

      this.set_generic_handler(_wrap(handler, {direction: 'incoming', type: 'serverToEngine'}, false))
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
            incoming: false,
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
              incoming: true,
              method: arg.method,
              type: 'serverToEngine',
            },
            true
          )
        )
      },
      {
        incoming: false,
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
