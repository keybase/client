'use strict'

// Handles sending requests to objc (then go) and back

import React from '../base-react'
import engine from './native'
import Transport from './transport'

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

class Engine {
  constructor () {
    let program = 'keybase.1'
    this.rpcClient = new RpcClient(
      new Transport((payload) => { this._rpcIncoming(payload) }),
      program
    )

    if (this.rpcClient.transport.needsConnect) {
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

        if (this.rpcClient.transport.needsBase64) {
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
