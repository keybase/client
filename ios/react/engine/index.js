'use strict'

// Handles sending requests to objc (then go) and back

var React = require('react-native')
var EventEmitter = require('EventEmitter')

var {
  NativeModules,
  NativeAppEventEmitter
} = React

var objcEngine = NativeModules.ObjcEngine

var rpc = require('../framed-msgpack-rpc/lib/main')
var RpcTransport = rpc.transport.Transport
var RpcClient = rpc.client.Client
var Buffer = require('buffer').Buffer

class EngineError extends Error {
  constructor (err) {
    if (!err) {
      err = {}
    }
    super(err.desc)
    this.code = err.code
    this.desc = err.desc
    this.name = err.name
  }

  toString () {
    switch (this.name) {
      case EngineError.ALREADY_LOGGED_IN:
        return 'You are already logged in'
      case EngineError.API_NETWORK_ERROR:
        return 'Networking error, try again'
      case EngineError.BAD_LOGIN_PASSWORD:
        return 'Invalid login'
      case EngineError.CANCELED:
      case EngineError.GENERIC:
      case EngineError.IDENTIFICATION_EXPIRED:
      case EngineError.KEY_BAD_GEN:
      case EngineError.KEY_IN_USE:
      case EngineError.KEY_NOT_FOUND:
      case EngineError.KEY_NO_ACTIVE:
      case EngineError.KEY_NO_SECRET:
      case EngineError.LOGIN_REQUIRED:
      case EngineError.PROOF_ERROR:
      case EngineError.SC_KEY_NO_ACTIVE:
      case EngineError.SC_STREAM_NOT_FOUND:
      case EngineError.SC_TIMEOUT:
      case EngineError.SELF_NOT_FOUND:
      case EngineError.STREAM_EOF:
      case EngineError.STREAM_EXISTS:
      case EngineError.STREAM_WRONG_KIND:
      default:
        return 'Something went wrong, try again'
    }
    return JSON.stringify(this)
  }
}

// Error codes from libkb/rpc_exim.go
EngineError.ALREADY_LOGGED_IN = 'ALREADY_LOGGED_IN'
EngineError.API_NETWORK_ERROR = 'API_NETWORK_ERROR'
EngineError.BAD_LOGIN_PASSWORD = 'BAD_LOGIN_PASSWORD'
EngineError.CANCELED = 'CANCELED'
EngineError.GENERIC = 'GENERIC'
EngineError.IDENTIFICATION_EXPIRED = 'IDENTIFICATION_EXPIRED'
EngineError.KEY_BAD_GEN = 'KEY_BAD_GEN'
EngineError.KEY_IN_USE = 'KEY_IN_USE'
EngineError.KEY_NOT_FOUND = 'KEY_NOT_FOUND'
EngineError.KEY_NO_ACTIVE = 'KEY_NO_ACTIVE'
EngineError.KEY_NO_SECRET = 'KEY_NO_SECRET'
EngineError.LOGIN_REQUIRED = 'LOGIN_REQUIRED'
EngineError.PROOF_ERROR = 'PROOF_ERROR'
EngineError.SC_KEY_NO_ACTIVE = 'SC_KEY_NO_ACTIVE'
EngineError.SC_STREAM_NOT_FOUND = 'SC_STREAM_NOT_FOUND'
EngineError.SC_TIMEOUT = 'SC_TIMEOUT'
EngineError.SELF_NOT_FOUND = 'SELF_NOT_FOUND'
EngineError.STREAM_EOF = 'STREAM_EOF'
EngineError.STREAM_EXISTS = 'STREAM_EXISTS'
EngineError.STREAM_WRONG_KIND = 'STREAM_WRONG_KIND'

// Transport which just gives us the payload and skips really sending over the wire
class DummyTransport extends RpcTransport {
  constructor (writeCallback, incomingRPCCallback) {
    super({})
    this.writeCallback = writeCallback
    this.set_generic_handler(incomingRPCCallback)
  }

  connect (cb) { cb() }
  is_connected () { return true }
  reset () { }
  close () { }
  get_generation () { return 1 }

  unwrap_incoming_error (err) {
    if (!err) {
      return null
    }

    if (typeof (err) === 'object') {
      return new EngineError(err)
    } else {
      return new Error(JSON.stringify(err))
    }
  }

  _raw_write_bufs (len, buf) {
    var buffer = Buffer.concat([new Buffer(len), new Buffer(buf)])
    var data = buffer.toString('base64')
    this.writeCallback(data)
  }
}

class Engine {
  constructor () {
    this.rpcClient = new RpcClient(
      new DummyTransport(
        this._rpcWrite,
        (payload) => { this._rpcIncoming(payload) }),
        'keybase.1'
    )
    this.setupListener()
    this.sessionID = 123

    // to find the right callbacks for rpc callbacks
    this.sessionIDToCallbackMap = {}

    // to find the right emitter for rpc callbacks
    this.sessionIDToEmitterMap = {}
  }

  getSessionID () {
    this.sessionID++
    return this.sessionID
  }

  setupListener () {
    this.subscription = NativeAppEventEmitter.addListener(
      objcEngine.eventName,
      (payload) => {
        if (!payload) {
          return
        }

        this.rpcClient.transport.packetize_data(new Buffer(payload, 'base64'))
      }
    )
  }

  _rpcWrite (data) {
    objcEngine.runWithData(data)
  }

  _rpcIncoming (payload) {
    var {
      method: method,
      param: [param],
      response: response
    } = payload

    var {sessionID: sessionID} = param

    var callback = this.sessionIDToCallbackMap[sessionID]

    if (callback) {
      callback(null, method, param, response)
    }

    var emitter = this.sessionIDToEmitterMap[sessionID]

    if (emitter) {
      emitter.emit(method, param, response)
    }
  }

  _rpc (method, param, callback, sessionCollating) {
    if (!param) {
      param = {}
    }

    var sessionID = param.sessionID = this.getSessionID()

    if (sessionCollating) {
      this.sessionIDToCallbackMap[param.sessionID] = callback
    }

    this.rpcClient.invoke(method, [param], (err, data) => {
      if (sessionCollating) {
        // deregister callback
        delete this.sessionIDToCallbackMap[sessionID]
        if (callback) {
          callback(err, null, data)
        }
      } else {
        if (callback) {
          callback(err, data)
        }
      }
    })
  }

  // Make an RPC and call callback repeatedly with any related server -> client RPC calls (server calls client sometimes)
  // (name of call, {arguments object}, function(err, method, params, response)
  collatedRpc (method, param, callback) {
    this._rpc(method, param, callback, true)
  }

  // Make a single RPC call and get results, ignore any server->client callbacks
  // (name of call, {arguments object}, function(err, results), true if you want multi calls to any related server->client RPCs
  rpc (method, param, callback) {
    this._rpc(method, param, callback, false)
  }

  // Make an rpc and get back an eventemitter which sends events for any callbacks that come back
  emitterRpc (method, param) {
    if (!param) {
      param = {}
    }

    var sessionID = param.sessionID = this.getSessionID()
    var emitter = new EventEmitter()
    this.sessionIDToEmitterMap[param.sessionID] = emitter

    this.rpcClient.invoke(method, [param], (err, data) => {
      emitter.emit(method, err, data)

      // cleanup
      delete this.sessionIDToEmitterMap[sessionID]
      emitter.removeAllListeners()
    })

    return emitter
  }

  reset () {
    objcEngine.reset()
  }
}

module.exports = new Engine()
