// @flow
import {Buffer} from 'buffer'
import {NativeModules, NativeEventEmitter} from 'react-native'
import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'

import type {incomingRPCCallbackType, connectDisconnectCB} from './index.platform'

const nativeBridge = NativeModules.KeybaseEngine
const RNEmitter = new NativeEventEmitter(nativeBridge)

class NativeTransport extends TransportShared {
  constructor(incomingRPCCallback, connectCallback, disconnectCallback) {
    super(
      {},
      connectCallback,
      disconnectCallback,
      incomingRPCCallback,
      // We pass data over to the native side to be handled
      data => nativeBridge.runWithData(data)
    )

    // We're connected locally so we never get disconnected
    this.needsConnect = false
    // framed-msg-pack sends us a payload length, then the payload. This holds the length of the next payload
    this.rawWriteLength = null
  }

  // We're always connected, so call the callback
  connect(cb: () => void) {
    cb()
  }
  // eslint-disable-next-line camelcase
  is_connected() {
    return true
  }

  // Override and disable some built in stuff in TransportShared
  reset() {}
  close() {}
  // eslint-disable-next-line camelcase
  get_generation() {
    return 1
  }

  // We get called 2 times per msg. once with the lenth and once with the payload
  // eslint-disable-next-line camelcase
  _raw_write(bufStr: any, enc: any) {
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

function createClient(
  incomingRPCCallback: incomingRPCCallbackType,
  connectCallback: connectDisconnectCB,
  disconnectCallback: connectDisconnectCB
) {
  const client = sharedCreateClient(
    new NativeTransport(incomingRPCCallback, connectCallback, disconnectCallback)
  )

  nativeBridge.start()

  // This is how the RN side writes back to us
  RNEmitter.addListener(nativeBridge.eventName, payload =>
    client.transport.packetize_data(Buffer.from(payload, 'base64'))
  )

  return client
}

function resetClient() {
  // Tell the RN bridge to reset itself
  nativeBridge.reset()
}

export {resetClient, createClient, rpcLog}
