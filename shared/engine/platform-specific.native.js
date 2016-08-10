// @flow
import type {incomingRPCCallbackType, connectCallbackType} from './platform-specific'
import {Buffer} from 'buffer'
import {NativeModules, NativeAppEventEmitter} from 'react-native'
import {TransportShared, sharedCreateClient} from './transport-shared'

const nativeBridge = NativeModules.KeybaseEngine || NativeModules.ObjcEngine

class NativeTransport extends TransportShared {
  constructor (incomingRPCCallback, connectCallback) {
    super({},
      connectCallback,
      incomingRPCCallback,
      (data) => {
        nativeBridge.runWithData(data)
      }
    )

    this.needsConnect = false
    this.rawWriteLength = null
  }

  connect (cb: () => void) { cb() }
  is_connected () { return true } // eslint-disable-line camelcase
  reset () { }
  close () { }
  get_generation () { return 1 } // eslint-disable-line camelcase

  // We get called 2 times per transport. once with the lenth and once with the payload
  _raw_write (bufStr: any, enc: any) { // eslint-disable-line camelcase
    if (this.rawWriteLength === null) {
      this.rawWriteLength = Buffer.from(bufStr, enc)
    } else {
      const buffer = Buffer.concat([this.rawWriteLength, Buffer.from(bufStr, enc)])
      this.rawWriteLength = null
      this.writeCallback(buffer.toString('base64'))
    }
  }
}

function createClient (incomingRPCCallback: incomingRPCCallbackType, connectCallback: connectCallbackType) {
  const client = sharedCreateClient(new NativeTransport(incomingRPCCallback, connectCallback))

  NativeAppEventEmitter.addListener(
    nativeBridge.eventName,
    payload => {
      if (payload) {
        client.transport.packetize_data(new Buffer(payload, 'base64'))
      }
    }
  )

  return client
}

function resetClient () {
  nativeBridge.reset()
}

export {
  resetClient,
  createClient,
}
