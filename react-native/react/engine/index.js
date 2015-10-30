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

let platform = 'desktop'
if ('Platform' in React) {
  platform = React.Platform.OS
}
console.log(`Platform is ${platform}.`)

class BaseTransport extends RpcTransport {
  constructor (opts, writeCallback, incomingRPCCallback) {
    super(opts)

    if (writeCallback) {
      this.writeCallback = writeCallback
    }
    if (incomingRPCCallback) {
      this.set_generic_handler(incomingRPCCallback)
    }
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

// Transport which just gives us the payload and skips really sending over the wire
class MobileTransport extends BaseTransport {
  constructor (opts, writeCallback, incomingRPCCallback) {
    super(opts, writeCallback, incomingRPCCallback)
  }

  connect (cb) { cb() }
  is_connected () { return true }
  reset () { }
  close () { }
  get_generation () { return 1 }

  _raw_write_bufs (len, buf) {
    const buffer = Buffer.concat([new Buffer(len), new Buffer(buf)])
    const data = buffer.toString('base64')
    this.writeCallback(data)
  }
}

class Engine {
  constructor () {
    let program = 'keybase.1'
    if (platform === 'desktop') {
      /* React Desktop */
      const paths = [
        // Hardcoded for now!
        process.env.HOME + '/Library/Caches/KeybaseDevel/keybased.sock',
        process.env.XDG_RUNTIME_DIR + '/keybase.devel/keybased.sock'
      ]
      let sockfile = null
      paths.map(path => {
        // Can't use ES2015 import because it'll hoist and crash mobile.
        let fs = require('fs')
        let exists = fs.existsSync(path)
        if (exists) {
          console.log('Found keybased socket file at ' + path)
          sockfile = path
        }
      })
      if (!sockfile) {
        console.error('No keybased socket file found!')
      }
      this.rpcClient = new RpcClient(
        new BaseTransport(
          { path: sockfile, robust: true },
          null,
          (payload) => { this._rpcIncoming(payload) }
        ),
        program
      )
      this.rpcClient.transport.connect(err => console.log(err))
    } else {
      /* React Native */
      this.rpcClient = new RpcClient(
        new MobileTransport(
          {},
          this._rpcWrite,
          (payload) => { this._rpcIncoming(payload) }
        ),
        program
      )
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

        if (platform !== 'desktop') {
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
