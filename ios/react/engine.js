'use strict'

// Handles sending requests to objc (then go) and back

var React = require('react-native')

var {
  NativeModules,
  NativeAppEventEmitter
} = React

var objcEngine = NativeModules.ObjcEngine

var rpc = require('./framed-msgpack-rpc/lib/main')
var RpcTransport = rpc.transport.Transport
var RpcClient = rpc.client.Client
var Buffer = require('buffer').Buffer

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

  _raw_write_bufs (len, buf) {
    var buffer = Buffer.concat([new Buffer(len), new Buffer(buf)])
    var data = buffer.toString('base64')
    this.writeCallback(data)
  }
}

class Engine {
  constructor () {
    this.rpcClient = new RpcClient(new DummyTransport(this._rpcWrite, (payload) => {this._rpcIncoming(payload)}), 'keybase.1')
    this.setupListener()
    this.sessionID = 123
    // if you opt to call rpc with sessionCollating=true you'll get multiple callbacks associated
    // with the same sessionId back to you
    this.sessionIDToCallbackMap = {}
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
      param: [param]
    } = payload

    var {sessionID: sessionID} = param

    var callback = this.sessionIDToCallbackMap[sessionID]

    if (callback) {
      callback(null, method, param)
    } else {
      console.log('Invalid incoming rpc sessionID')
    }
  }

  _rpc (proc, arg, callback, sessionCollating) {
    if (!arg) {
      arg = {}
    }

    var sessionID = arg.sessionID = this.sessionID++

    if (sessionCollating) {
      this.sessionIDToCallbackMap[arg.sessionID] = callback
    }

    this.rpcClient.invoke(proc, [arg], (err, data) => {
      if (sessionCollating) {
        // deregister callback
        delete this.sessionIDToCallbackMap[sessionID]
        callback(err, null, data)
      } else {
        callback(err, data)
      }
    })
  }

  // Make an RPC and call callback repeatedly with any related server -> client RPC calls (server calls client sometimes)
  // (name of call, {arguments object}, function(err, proc, results)
  collatedRpc (method, param, callback) {
    this._rpc(method, param, callback, true)
  }

  // Make a single RPC call and get results, ignore any server->client callbacks
  // (name of call, {arguments object}, function(err, results), true if you want multi calls to any related server->client RPCs
  rpc (method, param, callback) {
    this._rpc(method, param, callback, false)
  }
}

module.exports = new Engine()
