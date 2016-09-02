// @flow
// Classes used to handle RPCs. Ability to inject delays into calls to/from server
import rpc from 'framed-msgpack-rpc'
import setupLocalLogs from '../util/local-log'
import {requestIdleCallback} from '../util/idle-callback'
import type {rpcLogType} from './index.platform'
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
      rpcLog('engineInternal', 'ignoring multiple result calls', {args})
    } else {
      once = true
      f(...args)
    }
  }
}

// Wrapped to add logging
function _makeLogged (f: () => void, type: rpcLogType, logTitle: string, extraInfo?: Object): () => void {
  if (printRPC) {
    return (...args) => {
      rpcLog(type, logTitle, {...extraInfo, args})
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
function _wrap (f: () => void, logType: rpcLogType, amount: number, logTitle: string, logInfo?: Object): () => void {
  const logged = _makeLogged(f, logType, logTitle, logInfo)
  const delayed = _makeDelayed(logged, amount)
  const onceOnly = _makeOnceOnly(delayed)
  return onceOnly
}

// Logging for rpcs
function rpcLog (type: rpcLogType, title: string, info?: Object): void {
  if (!printRPC) {
    return
  }

  const prefix = {
    'engineToServer': '[engine] ->',
    'serverToEngine': '[engine] <-',
    'engineInternal': '[engine]',
  }[type]
  const style = {
    'engineToServer': 'color: blue',
    'serverToEngine': 'color: green',
    'engineInternal': 'color: purple',
  }[type]

  requestIdleCallback(() => {
    logLocal(`%c${prefix}`, style, title, info)
  })
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

      this.set_generic_handler(_makeDelayed(_makeLogged(handler, 'serverToEngine', 'incoming'), KEYBASE_RPC_DELAY_RESULT))
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
        }, 'engineToServer', KEYBASE_RPC_DELAY, call, {payload})
      })
    }
  }

  unwrap_incoming_error (err: any) { // eslint-disable-line camelcase
    if (!err) {
      return null
    }

    if (typeof (err) === 'object') {
      return err
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
      }, 'serverToEngine', KEYBASE_RPC_DELAY_RESULT, 'received'))
    }, 'engineToServer', KEYBASE_RPC_DELAY, 'sent')

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
