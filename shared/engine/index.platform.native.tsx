import {NativeModules, NativeEventEmitter} from 'react-native'
import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import {encode, decodeMulti} from '@msgpack/msgpack'
import type {SendArg, incomingRPCCallbackType, connectDisconnectCB} from './index.platform'

const nativeBridge: NativeEventEmitter & {
  metaEventName: string
  metaEventEngineReset: string
  start: () => void
  reset: () => void
} = NativeModules.KeybaseEngine
// @ts-ignore
const RNEmitter = new NativeEventEmitter(nativeBridge)

class NativeTransport extends TransportShared {
  constructor(incomingRPCCallback, connectCallback, disconnectCallback) {
    super({}, connectCallback, disconnectCallback, incomingRPCCallback)

    // We're connected locally so we never get disconnected
    this.needsConnect = false
  }

  // We're always connected, so call the callback
  connect(cb: (err?: any) => void) {
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
  send(msg: SendArg) {
    const packed = encode(msg)
    const len = encode(packed.length)
    // We have to write b64 encoded data over the RN bridge

    const buf = new Uint8Array(len.length + packed.length)
    buf.set(len, 0)
    buf.set(packed, len.length)
    // Pass data over to the native side to be handled, with JSI!
    if (typeof global.rpcOnGo !== 'function') {
      NativeModules.GoJSIBridge.install()
    }
    global.rpcOnGo(buf.buffer)
    return true
  }
}

const TEMPY = o => {
  Object.keys(o).forEach(k => {
    const v = o[k]
    if (v instanceof Uint8Array && !(v instanceof Buffer)) {
      o[k] = Buffer.from(v)
    }
    if (v instanceof Object) {
      TEMPY(v)
    }
  })
}

function createClient(
  incomingRPCCallback: incomingRPCCallbackType,
  connectCallback: connectDisconnectCB,
  disconnectCallback: connectDisconnectCB
) {
  const client = sharedCreateClient(
    new NativeTransport(incomingRPCCallback, connectCallback, disconnectCallback)
  )

  global.rpcOnJs = (objs, b64temp) => {
    try {
      var buftemp = Buffer.from(b64temp, 'base64')
      const temps = []
      for (const o of decodeMulti(buftemp)) {
        temps.push(o)
      }
      const temp = temps[1]
      // wrap uint8array as buf to make it compare correctly
      TEMPY(temp)
      const s1 = JSON.stringify(objs)
      const s2 = JSON.stringify(temp)
      if (s1 !== s2) {
        debugger
        console.log('aaa ', {s1, s2})
      }
    } catch (e) {
      console.log('aaa err', e)
    }
    // @ts-ignore this does exist
    client.transport._dispatch(objs)
  }

  nativeBridge.start()

  RNEmitter.addListener(nativeBridge.metaEventName, (payload: string) => {
    switch (payload) {
      case nativeBridge.metaEventEngineReset:
        connectCallback()
    }
  })

  return client
}

function resetClient() {
  // Tell the RN bridge to reset itself
  nativeBridge.reset()
}

export {resetClient, createClient, rpcLog}
