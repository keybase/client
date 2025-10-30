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
    // We need explicit connection handshake with Go
    this.needsConnect = true
  }

  signalGoReady() {
    if (this.connected) {
      logger.info('Go already marked ready, ignoring')
      return
    }
    logger.info('Go is ready, marking transport connected')
    this.connected = true
    this.connectCB?.()
    this.connectCB = undefined
  }

  connect(cb: (err?: unknown) => void) {
    logger.info('Transport connect called')
    if (this.connected) {
      // Already connected
      cb()
      return
    }
    this.connectCB = cb
  }

  is_connected() {
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

let engineStarted = false

function createClient(
  incomingRPCCallback: IncomingRPCCallbackType,
  connectCallback: ConnectDisconnectCB,
  disconnectCallback: ConnectDisconnectCB
) {
  logger.info('Creating native RPC client')
  const nativeTransport = new NativeTransport(incomingRPCCallback, connectCallback, disconnectCallback)
  const client = sharedCreateClient(nativeTransport)

  global.rpcOnJs = (objs: unknown) => {
    try {
      client.transport._dispatch(objs)
    } catch (e) {
      logger.error('>>>> rpcOnJs JS thrown!', e)
    }
  }

  const handleGoReady = () => {
    if (engineStarted) {
      logger.warn('engineStart already called, ignoring')
      return
    }
    engineStarted = true
    logger.info('Starting engine Go→JS read loop')
    engineStart()
    nativeTransport.signalGoReady()
  }

  // Register listener FIRST
  const RNEmitter = getNativeEmitter()
  RNEmitter.addListener('kb-meta-engine-event', (payload: string) => {
    try {
      switch (payload) {
        case 'kb-engine-reset':
          logger.info('Engine reset requested')
          engineStarted = false
          nativeTransport.connected = false
          connectCallback()
          break
        case 'kb-engine-ready':
          logger.info('Received Go ready event')
          handleGoReady()
          break
      }
    } catch (e) {
      logger.error('>>>> meta engine event JS thrown!', e)
    }
  })

  // THEN check if Go is already ready (handles race)
  // Small delay to ensure listener is fully registered
  setTimeout(() => {
    if (isGoReady()) {
      logger.info('Go was already ready, starting now')
      handleGoReady()
    } else {
      logger.info('Waiting for Go to become ready...')
    }
  }, 0)

  return client
}

function resetClient() {
  engineReset()
  engineStarted = false
}

export {resetClient, createClient, rpcLog}
