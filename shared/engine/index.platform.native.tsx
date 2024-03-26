import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import {encode} from '@msgpack/msgpack'
import type {IncomingRPCCallbackType, ConnectDisconnectCB} from './index.platform'
import logger from '@/logger'
import {engineStart, engineReset, getNativeEmitter} from 'react-native-kb'

class NativeTransport extends TransportShared {
  constructor(
    incomingRPCCallback: IncomingRPCCallbackType,
    connectCallback?: ConnectDisconnectCB,
    disconnectCallback?: ConnectDisconnectCB
  ) {
    super({}, connectCallback, disconnectCallback, incomingRPCCallback)

    // We're connected locally so we never get disconnected
    this.needsConnect = false
  }

  // We're always connected, so call the callback
  connect(cb: (err?: unknown) => void) {
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

  // A custom send override to write to the react native bridge
  send(msg: unknown) {
    const packed = encode(msg)
    const len = encode(packed.length)
    const buf = new Uint8Array(len.length + packed.length)
    buf.set(len, 0)
    buf.set(packed, len.length)
    // Pass data over to the native side to be handled, with JSI!
    try {
      if (!global.rpcOnGo) {
        logger.error('>>>> rpcOnGo send before rpcOnGo global?')
      }
      global.rpcOnGo?.(buf.buffer)
    } catch (e) {
      logger.error('>>>> rpcOnGo JS thrown!', e)
    }
    return true
  }
}

function createClient(
  incomingRPCCallback: IncomingRPCCallbackType,
  connectCallback: ConnectDisconnectCB,
  disconnectCallback: ConnectDisconnectCB
) {
  const client = sharedCreateClient(
    new NativeTransport(incomingRPCCallback, connectCallback, disconnectCallback)
  )

  global.rpcOnJs = (objs: unknown) => {
    try {
      client.transport._dispatch(objs)
    } catch (e) {
      logger.error('>>>> rpcOnJs JS thrown!', e)
    }
  }

  engineStart()

  const RNEmitter = getNativeEmitter()
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
  engineReset()
}

export {resetClient, createClient, rpcLog}
