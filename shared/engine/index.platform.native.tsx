import {NativeEventEmitter} from 'react-native'
import {NativeModules} from '../util/native-modules.native'
import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import {encode} from '@msgpack/msgpack'
import type {SendArg, incomingRPCCallbackType, connectDisconnectCB} from './index.platform'
import logger from '../logger'

const RNEmitter = new NativeEventEmitter(NativeModules.KeybaseEngine as any)

class NativeTransport extends TransportShared {
  constructor(
    incomingRPCCallback: incomingRPCCallbackType,
    connectCallback?: connectDisconnectCB,
    disconnectCallback?: connectDisconnectCB
  ) {
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
  }

  // Override and disable some built in stuff in TransportShared
  reset() {}
  close() {}
  get_generation() {
    return 1
  }

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
    try {
      global.rpcOnGo(buf.buffer)
    } catch (e) {
      logger.error('>>>> rpcOnGo JS thrown!', e)
    }
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

  global.rpcOnJs = objs => {
    try {
      client.transport._dispatch(objs)
    } catch (e) {
      logger.error('>>>> rpcOnJs JS thrown!', e)
    }
  }

  NativeModules.KeybaseEngine.start()

  RNEmitter.addListener('kb-meta-engine-event', (payload: string) => {
    try {
      switch (payload) {
        case 'kb-engine-reset':
          connectCallback()
      }
    } catch (e) {
      logger.error('>>>> meta engine event JS thrown!', e)
    }
  })

  return client
}

function resetClient() {
  // Tell the RN bridge to reset itself
  NativeModules.KeybaseEngine.reset()
}

export {resetClient, createClient, rpcLog}
