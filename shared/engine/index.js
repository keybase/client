// Handles sending requests to objc (then go) and back

import engine from './index.native'
import Transport from './transport'
import rpc from 'framed-msgpack-rpc'
import {printRPC} from '../local-debug'
const {client: {Client: RpcClient}} = rpc

import {Buffer} from 'buffer'
import NativeEventEmitter from '../common-adapters/native-event-emitter'
import windowsHack from './windows-hack'

class Engine {
  constructor () {
    windowsHack()

    this.program = 'keybase.1'
    this.rpcClient = new RpcClient(
      new Transport(
        payload => { this._rpcIncoming(payload) },
        this._rpcWrite,
        () => this.onConnect()
      ),
      this.program
    )

    if (this.rpcClient.transport.needsConnect) {
      this.rpcClient.transport.connect(err => {
        if (err != null) {
          console.log('Error in connecting to transport rpc:', err)
        }
      })
    }

    this.setupListener()
    this.sessionID = 123

    // to find callMap for rpc callbacks
    this.sessionIDToIncomingCall = {}

    // A call map for general listeners
    // These are commands that the service can call at any point in time
    this.generalListeners = {}

    this.serverListeners = {}

    // A list of functions to call when we connect
    this.onConnectFns = {}
  }

  onConnect () {
    this.inListenerCallback = true
    Object.keys(this.onConnectFns).forEach(k => this.onConnectFns[k]())
    this.inListenerCallback = false
  }

  listenOnConnect (key, f) {
    if (!f) {
      throw new Error('Null callback sent to listenOnConnect')
    }

    if (this.inListenerCallback) {
      throw new Error('Ran a listenOnConnect within another listenOnConnect')
    }

    // The transport is already connected, so let's call this function right away
    if (!this.rpcClient.transport.needsConnect) {
      f()
    }

    // Regardless if we were connected or not, we'll add this to the callback fns
    // that should be called when we connect.
    this.onConnectFns[key] = f
  }

  getSessionID () {
    this.sessionID++
    return this.sessionID
  }

  setupListener () {
    this.subscription = NativeEventEmitter.addListener(
      engine.eventName,
      payload => {
        if (!payload) {
          return
        }

        if (this.rpcClient.transport.needsBase64) {
          this.rpcClient.transport.packetize_data(new Buffer(payload, 'base64'))
        }
      }
    )
  }

  // Bind a single callback to a method.
  // Newer calls to this will overwrite older listeners, and older listeners will not get called.
  listenGeneralIncomingRpc (method, listener) {
    this.generalListeners[method] = listener
  }

  removeGeneralIncomingRpc (method) {
    this.listenGeneralIncomingRpc(method, () => {})
  }

  listenServerInit (method, listener) {
    this.serverListeners[method] = listener
  }

  _serverInitIncomingRPC (method, param, response) {
    const sid = this.getSessionID()
    const cbs = {
      start: callMap => {
        this.sessionIDToIncomingCall[sid] = callMap
        response.result(sid)
      },
      end: () => {
        delete this.sessionIDToIncomingCall[sid]
      }
    }
    this.serverListeners[method](param, cbs)
  }

  _rpcWrite (data) {
    engine.runWithData(data)
  }

  _wrapResponseOnceOnly (method, param, response) {
    let once = false
    const wrappedResponse = {
      result: (...args) => {
        if (once) {
          if (printRPC) {
            console.log('RPC ▼ result bailing on additional calls: ', method, param, ...args)
          }
          return
        }
        once = true

        if (printRPC) {
          console.log('RPC ▼ result: ', method, param, ...args)
        }

        response.result(...args)
      },
      error: (...args) => {
        if (once) {
          if (printRPC) {
            console.log('RPC ▼ error bailing on additional calls: ', method, param, ...args)
          }
          return
        }
        once = true

        if (printRPC) {
          console.log('RPC ▼ error: ', method, param, ...args)
        }

        response.error(...args)
      }
    }
    return wrappedResponse
  }

  _generalIncomingRpc (method, param, response) {
    const listener = this.generalListeners[method]

    if (!listener) {
      return
    }

    // make wrapper so we only call this once
    const wrappedResponse = this._wrapResponseOnceOnly(method, param, response)
    listener(param, wrappedResponse)
  }

  _rpcIncoming (payload) {
    const {
      method: method,
      param: [param],
      response: response
    } = payload

    const {sessionID} = param

    const callMap = this.sessionIDToIncomingCall[sessionID]

    if (callMap && callMap[method]) {
      // make wrapper so we only call this once
      const wrappedResponse = this._wrapResponseOnceOnly(method, param, response)
      callMap[method](param, wrappedResponse)
    } else if (callMap && method === 'keybase.1.logUi.log') {
      logUiLog(param)
    } else if (!sessionID && this.generalListeners[method]) {
      this._generalIncomingRpc(method, param, response)
    } else if (!sessionID && this.serverListeners[method]) {
      this._serverInitIncomingRPC(method, param, response)
    } else {
      console.log(`Unknown incoming rpc: ${sessionID} ${method} ${param}`)
    }
  }

  // Make an RPC and call callbacks in the incomingCallMap
  // (name of call, {arguments object}, {methodName: function(params, response)}, function(err, data)
  rpc (method, param, incomingCallMap, callback) {
    if (!param) {
      param = {}
    }

    const sessionID = param.sessionID = this.getSessionID()
    this.sessionIDToIncomingCall[sessionID] = incomingCallMap

    const invoke = () => {
      if (printRPC) {
        console.log('RPC ▶', method, param)
      }

      this.rpcClient.invoke(method, [param], (err, data) => {
        if (printRPC) {
          console.log('RPC ◀', method, param, err, data)
        }
        // deregister incomingCallbacks
        delete this.sessionIDToIncomingCall[sessionID]
        if (callback) {
          callback(err, data)
        }
      })
    }

    if (__DEV__ && process.env.KEYBASE_RPC_DELAY) { // eslint-disable-line no-undef
      if (printRPC) {
        console.log('RPC [DELAYED] ▶', method, param)
      }
      setTimeout(invoke, process.env.KEYBASE_RPC_DELAY)
    } else {
      invoke()
    }
  }

  reset () {
    engine.reset()
  }
}

export default new Engine()
