// Handles sending requests to native mobile (then go) and back

import engine from './index.native'
import Transport from './transport'
import rpc from 'framed-msgpack-rpc'
import {printRPC} from '../local-debug'
const {client: {Client: RpcClient}} = rpc

import setupLocalLogs, {logLocal} from '../util/local-log'

import {Buffer} from 'buffer'
import NativeEventEmitter from '../common-adapters/native-event-emitter'
import windowsHack from './windows-hack'
import {log} from '../native/log/logui'

import {constants} from '../constants/types/keybase-v1'
import {printOutstandingRPCs} from '../local-debug'

class Engine {
  constructor () {
    windowsHack()
    setupLocalLogs()

    if (printOutstandingRPCs) {
      setInterval(() => {
        const keys = Object.keys(this.sessionIDToResponse).filter(k => this.sessionIDToResponse[k])
        if (keys.length) {
          console.log('Outstanding RPC sessionIDs: ', keys)
        }
      }, 10 * 1000)
    }

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

    // any non-responded to response objects
    this.sessionIDToResponse = {}

    // A call map for general listeners
    // These are commands that the service can call at any point in time
    this.generalListeners = {}

    this.serverListeners = {}

    // A list of functions to call when we connect
    this.onConnectFns = {}

    // Throw an error and fail?
    this._failOnError = false
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
  listenGeneralIncomingRpc (params) {
    Object.keys(params).forEach(method => {
      this.generalListeners[method] = params[method]
    })
  }

  removeGeneralIncomingRpc (method) {
    this.listenGeneralIncomingRpc({[method]: () => {}})
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
    const {sessionID} = param

    const seqid = response && response.seqid
    let once = false

    const wrappedResponse = {
      seqid,
      result: (...args) => {
        if (once) {
          if (printRPC) {
            logLocal('RPC ▼ result bailing on additional calls: ', method, param, ...args)
          }
          return
        }
        once = true

        if (printRPC) {
          logLocal('RPC ▼ result: ', method, param, ...args)
        }
        if (response) {
          this.sessionIDToResponse[sessionID] = null
          response.result(...args)
        } else if (__DEV__) {
          console.warn('Calling response.result on non-response object: ', method)
        }
      },
      error: (...args) => {
        if (once) {
          if (printRPC) {
            logLocal('RPC ▼ error bailing on additional calls: ', method, param, ...args)
          }
          return
        }
        once = true

        if (printRPC) {
          logLocal('RPC ▼ error: ', method, param, ...args)
        }

        if (response) {
          this.sessionIDToResponse[sessionID] = null
          response.error(...args)
        } else if (__DEV__) {
          console.warn('Calling response.error on non-response object: ', method)
        }
      }
    }

    // Incoming calls have no sessionID so let's ignore
    if (sessionID) {
      this.sessionIDToResponse[sessionID] = wrappedResponse
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

  _hasNoHandler (method, callMap, generalIncomingRpcMap) {
    if (!callMap) {
      return generalIncomingRpcMap[method] == null
    }

    return callMap[method] == null
  }

  _rpcIncoming (payload) {
    const {
      method: method,
      param: [param],
      response: response
    } = payload

    const {sessionID} = param

    const callMap = this.sessionIDToIncomingCall[sessionID]

    if (printRPC) {
      logLocal('RPC ◀ incoming: ', payload)
    }
    // make wrapper so we only call this once
    const wrappedResponse = this._wrapResponseOnceOnly(method, param, response)

    if (callMap && callMap[method]) {
      callMap[method](param, wrappedResponse)
    } else if (method === 'keybase.1.logUi.log' && this._hasNoHandler(method, callMap || {}, this._generalIncomingRpc)) {
      log(param)
      wrappedResponse.result()
    } else if (!sessionID && this.generalListeners[method]) {
      this._generalIncomingRpc(method, param, wrappedResponse)
    } else if (!sessionID && this.serverListeners[method]) {
      this._serverInitIncomingRPC(method, param, wrappedResponse)
    } else {
      if (__DEV__) {
        logLocal(`Unknown incoming rpc: ${sessionID} ${method} ${param}${response ? ': Sending back error' : ''}`)
      }

      if (this._failOnError && __DEV__) {
        throw new Error(`unhandled incoming rpc: ${sessionID} ${method} ${JSON.stringify(param)}${response ? '. has response' : ''}`)
      }

      if (response && response.error) {
        wrappedResponse.error({
          code: constants.StatusCode.scgeneric,
          desc: 'Unhandled incoming RPC'
        })
      }
    }
  }

  setFailOnError () {
    this._failOnError = true
  }

  // Make an RPC and call callbacks in the incomingCallMap
  // (name of call, {arguments object}, {methodName: function(params, response)}, function(err, data)
  // Use rpc() instead
  rpc_unchecked (method, param, incomingCallMap, callback) {
    if (!param) {
      param = {}
    }

    const sessionID = param.sessionID = this.getSessionID()
    this.sessionIDToIncomingCall[sessionID] = incomingCallMap
    this.sessionIDToResponse[sessionID] = null

    const invoke = () => {
      if (printRPC) {
        logLocal('RPC ▶', method, param)
      }

      this.rpcClient.invoke(method, [param], (err, data) => {
        if (printRPC) {
          logLocal('RPC ◀', method, param, err, data)
        }
        // deregister incomingCallbacks
        delete this.sessionIDToIncomingCall[sessionID]
        delete this.sessionIDToResponse[sessionID]
        if (callback) {
          callback(err, data)
        }
      })
    }

    if (__DEV__ && process.env.KEYBASE_RPC_DELAY) {
      if (printRPC) {
        logLocal('RPC [DELAYED] ▶', method, param)
      }
      setTimeout(invoke, process.env.KEYBASE_RPC_DELAY)
    } else {
      invoke()
    }

    return sessionID
  }

  rpc (params) {
    const {method, param, incomingCallMap, callback} = params
    return this.rpc_unchecked(method, param, incomingCallMap, callback)
  }

  // If you just have a sessionID / seqId
  rpcResponse (sessionID, seqid, params, isError) {
    const response = {
      result: () => {
        this.rpcClient.transport.respond(seqid, null, params)
      },
      error: () => {
        this.rpcClient.transport.respond(seqid, params, null)
      },
      seqid
    }

    const wrappedResponse = this._wrapResponseOnceOnly('rpcResponse', {sessionID}, response)
    if (isError) {
      wrappedResponse.error(params)
    } else {
      wrappedResponse.result(params)
    }
  }

  cancelRPC (sessionID) {
    const response = this.sessionIDToResponse[sessionID]
    if (response) {
      if (response.error) {
        response.error({
          code: constants.StatusCode.scgeneric,
          desc: 'Canceling RPC'
        })
      }
    } else {
      logLocal('Invalid sessionID sent to cancelRPC: ', sessionID)
    }
  }

  reset () {
    engine.reset()
  }
}

export default new Engine()
