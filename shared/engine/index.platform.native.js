// @flow
import {NativeModules, NativeEventEmitter} from 'react-native'
import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import {pack} from 'purepack'
import {toByteArray, fromByteArray} from 'base64-js'
import toBuffer from 'typedarray-to-buffer'

import type {createClientType, incomingRPCCallbackType, connectDisconnectCB} from './index.platform'

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
  }

  // We're always connected, so call the callback
  connect(cb: () => void) {
    cb()
  }
  is_connected() {
    return true
  } // eslint-disable-line camelcase

  // Override and disable some built in stuff in TransportShared
  reset() {}
  close() {}
  get_generation() {
    return 1
  } // eslint-disable-line camelcase

  // A custom send override to write b64 to the react native bridge
  send(msg) {
    const packed = pack(msg)
    const len = pack(packed.length)
    // We have to write b64 encoded data over the RN bridge

    const buf = new Uint8Array(len.length + packed.length)
    buf.set(len, 0)
    buf.set(packed, len.length)
    const b64 = fromByteArray(buf)
    this.writeCallback(b64)
    return true
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
  RNEmitter.addListener(nativeBridge.eventName, payload => {
    return client.transport.packetize_data(toBuffer(toByteArray(payload)))
  })

  return client
}

function resetClient(client: createClientType) {
  // Tell the RN bridge to reset itself
  nativeBridge.reset()
}

export {resetClient, createClient, rpcLog}
