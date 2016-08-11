// @flow
import type {incomingRPCCallbackType, connectCallbackType} from './platform-specific'
import {Buffer} from 'buffer'
import {NativeModules, NativeAppEventEmitter} from 'react-native'
import {TransportShared, sharedCreateClient} from './transport-shared'

// Modules from the native part of the code. Differently named on android/ios
const nativeBridge = NativeModules.KeybaseEngine || NativeModules.ObjcEngine

class NativeTransport extends TransportShared {
  constructor (incomingRPCCallback, connectCallback) {
    super({},
      connectCallback,
      incomingRPCCallback,
      // We pass data over to the native side to be handled
      (data) => {
        nativeBridge.runWithData(data)
      }
    )

    // We're connected locally so we never get disconnected
    this.needsConnect = false
    // framed-msg-pack sends us a payload length, then the payload. This holds the length of the next payload
    this.rawWriteLength = null
  }

  // We're always connected, so call the callback
  connect (cb: () => void) { cb() }
  is_connected () { return true } // eslint-disable-line camelcase

  // Override and disable some built in stuff in TransportShared
  reset () { }
  close () { }
  get_generation () { return 1 } // eslint-disable-line camelcase

  // We get called 2 times per msg. once with the lenth and once with the payload
  _raw_write (bufStr: any, enc: any) { // eslint-disable-line camelcase
    if (this.rawWriteLength === null) {
      this.rawWriteLength = Buffer.from(bufStr, enc)
    } else {
      const buffer = Buffer.concat([this.rawWriteLength, Buffer.from(bufStr, enc)])
      this.rawWriteLength = null
      // We have to write b64 encoded data over the RN bridge
      this.writeCallback(buffer.toString('base64'))
    }
  }
}

function createClient (incomingRPCCallback: incomingRPCCallbackType, connectCallback: connectCallbackType) {
  const client = sharedCreateClient(new NativeTransport(incomingRPCCallback, connectCallback))

  // This is how the RN side writes back to us
  NativeAppEventEmitter.addListener(
    nativeBridge.eventName,
    payload => {
      if (payload) {
        // We get b64 encoded data back from the RN bridge
        client.transport.packetize_data(new Buffer(payload, 'base64'))
      }
    }
  )

  return client
}

function resetClient () {
  // Tell the RN bridge to reset itself
  nativeBridge.reset()
}

export {
  resetClient,
  createClient,
}
