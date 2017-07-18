// @flow
import {Buffer} from 'buffer'
import {NativeModules, NativeEventEmitter} from 'react-native'
import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import {pack} from 'purepack'
import {toByteArray, fromByteArray} from 'base64-js'

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

  // We get called 2 times per msg. once with the lenth and once with the payload
  // // TODO DEL
  _raw_write(bufStr: any, enc: any) {
    // eslint-disable-line camelcase
    if (this.rawWriteLength === null) {
      this.rawWriteLength = Buffer.from(bufStr, enc)
    } else {
      const buffer = Buffer.concat([this.rawWriteLength, Buffer.from(bufStr, enc)])
      this.rawWriteLength = null
      // We have to write b64 encoded data over the RN bridge
      // this.writeCallback(buffer.toString('base64'))
    }
  }

  // A custom send override to write b64 to the react native bridge
  send(msg) {
    const oldStart = performance.now()
    const TIMES = 1000
    for (i = 0; i < TIMES; ++i) {
      var b, b1, b2, bufs, enc, rc, _i, _len
      this.rawWriteLength = null
      b2 = pack(msg)
      b1 = pack(b2.length)
      bufs = [b1, b2]
      rc = 0
      enc = 'binary'
      for ((_i = 0), (_len = bufs.length); _i < _len; _i++) {
        b = bufs[_i]
        this._raw_write(b.toString(enc), enc)
      }
    }
    const old = performance.now() - oldStart
    const newStart = performance.now()
    for (i = 0; i < TIMES; ++i) {
      const packed = pack(msg)
      const len = pack(packed.length)
      // We have to write b64 encoded data over the RN bridge

      const buf = new Uint8Array(len.length + packed.length)
      buf.set(len, 0)
      buf.set(packed, len.length)
      const b64 = fromByteArray(buf)
    }
    const n = performance.now() - newStart

    const packed = pack(msg)
    console._log('aaa write', old, ' -> ', n, ' -- ', packed.length)
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
    const oldStart = performance.now()
    const TIMES = 1000
    for (i = 0; i < TIMES; ++i) {
      const buffer = Buffer.from(payload, 'base64')
    }
    const old = performance.now() - oldStart
    const newStart = performance.now()
    for (i = 0; i < TIMES; ++i) {
      // const buffer = Buffer.from(new Uint8Array(atob(payload).split('').map(c => c.charCodeAt(0))))
      const buffer = toByteArray(payload)
    }
    const n = performance.now() - newStart

    console._log('aaa read', old, ' -> ', n, ' -- ', payload.length)

    // const oldBuffer = Buffer.from(payload, 'base64')
    // const newBuffer = Buffer.from(new Uint8Array(atob(payload).split('').map(c => c.charCodeAt(0))))
    //
    const buffer = Buffer.from(payload, 'base64')
    // const newBuffer = toByteArray(payload)
    // console.log('aaa', oldBuffer, newBuffer)
    return client.transport.packetize_data(buffer)
  })

  return client
}

function resetClient(client: createClientType) {
  // Tell the RN bridge to reset itself
  nativeBridge.reset()
}

export {resetClient, createClient, rpcLog}
