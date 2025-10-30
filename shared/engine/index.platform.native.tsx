import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import {encode} from '@msgpack/msgpack'
import type {IncomingRPCCallbackType, ConnectDisconnectCB} from './index.platform'
import logger from '@/logger'
import {engineStart, engineReset, getNativeEmitter, isGoReady} from 'react-native-kb'

class NativeTransport extends TransportShared {
  private connectCB: undefined | ((err?: unknown) => void)
  private connected = false
  constructor(
    incomingRPCCallback: IncomingRPCCallbackType,
    connectCallback?: ConnectDisconnectCB,
    disconnectCallback?: ConnectDisconnectCB
  ) {
    super({}, connectCallback, disconnectCallback, incomingRPCCallback)

    // we don't connect a socket but there is a handshake we need to do
    this.needsConnect = false

    console.error('aaaa native construct', this.connected)
  }

  setGoReady() {
    this.connected = true
    this.connectCB?.()
    this.connectCB = undefined
  }

  // We're always connected, so call the callback
  connect(cb: (err?: unknown) => void) {
    console.error('aaaa connect call')
    this.connectCB = cb
  }

  is_connected() {
    console.error('aaaa isconnected', this.connected)
    return this.connected
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
  console.error('aaaa createclient')
  const nativeTransport = new NativeTransport(incomingRPCCallback, connectCallback, disconnectCallback)
  const client = sharedCreateClient(nativeTransport)

  global.rpcOnJs = (objs: unknown) => {
    try {
      client.transport._dispatch(objs)
    } catch (e) {
      logger.error('>>>> rpcOnJs JS thrown!', e)
    }
  }

  const RNEmitter = getNativeEmitter()

  if (isGoReady()) {
    engineStart()
    nativeTransport.setGoReady()
  }

  console.error('aaaa engine before add listener')
  RNEmitter.addListener('kb-meta-engine-event', (payload: string) => {
    try {
      switch (payload) {
        case 'kb-engine-reset':
          connectCallback()
          break
        case 'kb-engine-ready':
          console.error('aaaa engine reday')
          // Go is initialized, start the bridge
          engineStart()
          nativeTransport.setGoReady()
          break
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
