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
  constructor (writeCallback) {
    super({})
    this.writeCallback = writeCallback
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
    this.rpcClient = new RpcClient(new DummyTransport(this._rpcWrite), 'keybase.1')
    this.setupListener()
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

  // (name of call, {arguuments object}, function(err, results)
  rpc (proc, arg, callback) {
    this.rpcClient.invoke(proc, [arg], callback)
  }
}

module.exports = new Engine()
