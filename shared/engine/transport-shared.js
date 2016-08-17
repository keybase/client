// @flow
// Classes used to handle RPCs. Ability to inject delays into calls to/from server
import EngineError from './errors'
import rpc from 'framed-msgpack-rpc'
import setupLocalLogs from '../util/local-log'
import type {rpcLogType} from './platform-specific'
import {intersperse} from '../util/arrays'
import {printRPC} from '../local-debug'

const {logLocal} = setupLocalLogs()
const {transport: {RobustTransport}, client: {Client: RpcClient}} = rpc
const KEYBASE_RPC_DELAY_RESULT: number = process.env.KEYBASE_RPC_DELAY_RESULT ? parseInt(process.env.KEYBASE_RPC_DELAY_RESULT) : 0
const KEYBASE_RPC_DELAY: number = process.env.KEYBASE_RPC_DELAY ? parseInt(process.env.KEYBASE_RPC_DELAY) : 0

// Wrapped to ensure its called once
function _makeOnceOnly (f: () => void): () => void {
  let once = false
  return (...args) => {
    if (once) {
      rpcLog('engineInternal', 'Ignoring multiple result calls', ...args)
    } else {
      once = true
      f(...args)
    }
  }
}

// Wrapped to add logging
function _makeLogged (f: () => void, type: rpcLogType, ...extraArgs: Array<any>): () => void {
  if (printRPC) {
    return (...args) => {
      rpcLog(type, ...args, ...extraArgs)
      f(...args)
    }
  } else {
    return f
  }
}

// Wrapped to make time delayed functions to test timing issues
function _makeDelayed (f: () => void, amount: number): () => void {
  if (__DEV__ && amount > 0) {
    return (...args) => {
      logLocal('%c[RPC Delay call]', 'color: red')
      setTimeout(() => {
        f(...args)
      }, amount)
    }
  } else {
    return f
  }
}

// We basically always delay/log/ensure once all the calls back and forth
function _wrap (f: () => void, logType: rpcLogType, amount: number, ...logArgs: Array<any>): () => void {
  const logged = _makeLogged(f, logType, ...logArgs)
  const delayed = _makeDelayed(logged, amount)
  const onceOnly = _makeOnceOnly(delayed)
  return onceOnly
}

// Logging for rpcs
function rpcLog (type: rpcLogType, ...args: Array<any>): void {
  if (!printRPC) {
    return
  }

  const prefix = {
    'engineToServer': '  us ▶▶ server',
    'serverToEngine': '  us ◀◀ server',
    'engineInternal': '  [ engine ]',
  }[type]
  const style = {
    'engineToServer': 'color: blue',
    'serverToEngine': 'color: green',
    'engineInternal': 'color: purple',
  }[type]

  logLocal(`%c${prefix} `, style, '\n  ', ...intersperse('\n  ', args))
}

class TransportShared extends RobustTransport {
  // $FlowIssue
  constructor (opts, connectCallback, incomingRPCCallback, writeCallback) {
    const hooks = connectCallback ? {
      connected: () => {
        // $FlowIssue complains that this might be null
        this.needsConnect = false
        connectCallback()
      },
    } : null

    super({hooks, ...opts})

    if (writeCallback) {
      this.writeCallback = writeCallback
    }
    if (incomingRPCCallback) {
      // delay the call back to us
      const handler = payload => {
        this._injectInstrumentedResponse(payload)
        incomingRPCCallback(payload)
      }

      this.set_generic_handler(_makeDelayed(_makeLogged(handler, 'serverToEngine'), KEYBASE_RPC_DELAY_RESULT))
    }
  }

  // add delay / logging / multiple call checking
  _injectInstrumentedResponse (payload: any) {
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
        payload.response[call] = _wrap((...args) => {
          oldResponse[call](...args)
        }, 'engineToServer', KEYBASE_RPC_DELAY, payload)
      })
    }
  }

  unwrap_incoming_error (err: any) { // eslint-disable-line camelcase
    if (!err) {
      return null
    }

    if (typeof (err) === 'object') {
      return new EngineError(err)
    } else {
      return new Error(JSON.stringify(err))
    }
  }

  invoke (arg: Object, cb: any) {
    // args needs to be wrapped as an array for some reason so lets just do that here
    const wrappedArgs = {
      ...arg,
      args: [arg.args || {}],
    }

    const wrappedInvoke = _wrap((args) => {
      super.invoke(args, _wrap((err, data) => {
        cb(err, data)
      }, 'serverToEngine', KEYBASE_RPC_DELAY_RESULT, args))
    }, 'engineToServer', KEYBASE_RPC_DELAY)

    wrappedInvoke(wrappedArgs)
  }
}

function sharedCreateClient (nativeTransport: any) {
  const rpcClient = new RpcClient(nativeTransport, 'keybase.1')

  if (rpcClient.transport.needsConnect) {
    rpcClient.transport.connect(err => {
      if (err != null) {
        console.log('Error in connecting to transport rpc:', err)
      }
    })
  }

  return rpcClient
}

export {
  TransportShared,
  sharedCreateClient,
  rpcLog,
}
