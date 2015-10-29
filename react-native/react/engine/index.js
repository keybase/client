'use strict'

// Handles sending requests to objc (then go) and back

import React from '../base-react'
import engine from './native'
import EngineError from './errors'

import rpc from 'framed-msgpack-rpc'
const {
  client: { Client: RpcClient },
  transport: { Transport: RpcTransport }
} = rpc

import { Buffer } from 'buffer'
import NativeEventEmitter from '../common-adapters/native-event-emitter'

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
    const buffer = Buffer.concat([new Buffer(len), new Buffer(buf)])
    const data = buffer.toString('base64')
    this.writeCallback(data)
  }
}

class ElectronTransport extends RpcTransport {
  constructor (opts, incomingRPCCallback) {
    super(opts)
    this.set_generic_handler(incomingRPCCallback)
  }
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
}

class Engine {
  constructor () {
    if ('platform' in React) {
      /* React Native */
      this.rpcClient = new RpcClient(
        new DummyTransport(
          this._rpcWrite,
          (payload) => { this._rpcIncoming(payload) }
        ),
        'keybase.1'
      )
    } else {
      /* React Desktop */
      this.rpcClient = new RpcClient(
        new ElectronTransport({
          path: '/run/user/1000/keybase.devel/keybased.sock',
          robust: true
        },
          (payload) => { this._rpcIncoming(payload) }
        ),
        'keybase.1'
      )
      this.rpcClient.transport.connect(err => console.log(err))
    }

    this.setupListener()
    this.sessionID = 123

    // to find callMap for rpc callbacks
    this.sessionIDToIncomingCall = {}
  }

  getSessionID () {
    this.sessionID++
    return this.sessionID
  }

  setupListener () {
    this.subscription = NativeEventEmitter.addListener(
      engine.eventName,
      (payload) => {
        if (!payload) {
          return
        }

        if ('platform' in React) {
          this.rpcClient.transport.packetize_data(new Buffer(payload, 'base64'))
        }
      }
    )
  }

  _rpcWrite (data) {
    engine.runWithData(data)
  }

  _rpcIncoming (payload) {
    const {
      method: method,
      param: [param],
      response: response
    } = payload

    const {sessionID: sessionID} = param

    const callMap = this.sessionIDToIncomingCall[sessionID]

    if (callMap && callMap[method]) {
      callMap[method](param, response)
    } else {
      console.log(`Unknown incoming rpc: ${sessionID} ${method}`)
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

    this.rpcClient.invoke(method, [param], (err, data) => {
      // deregister incomingCallbacks
      delete this.sessionIDToIncomingCall[sessionID]
      if (callback) {
        callback(err, data)
      }
    })
  }

  reset () {
    engine.reset()
  }
}

export default new Engine()
