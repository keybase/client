import {TransportShared, sharedCreateClient, rpcLog} from './transport-shared'
import type {IncomingRPCCallbackType, ConnectDisconnectCB} from './index.platform'
import logger from '@/logger'
import {engineReset, getNativeEmitter, notifyJSReady} from 'react-native-kb'

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
    try {
      if (!global.rpcOnGo) {
        logger.error('>>>> rpcOnGo send before rpcOnGo global?')
      }
      global.rpcOnGo?.(msg)
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

  global.rpcOnJs = (objs: unknown, count: number) => {
    try {
      if (count > 1) {
        const arr = objs as Array<unknown>
        for (const obj of arr) {
          client.transport._dispatch(obj)
        }
      } else {
        client.transport._dispatch(objs)
      }
    } catch (e) {
      logger.error('>>>> rpcOnJs JS thrown!', e)
    }
  }

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
  
  // Signal that JS is ready to send/receive RPCs
  // This sets up native infrastructure and starts bidirectional communication
  logger.info('JS engine ready, notifying native side')
  notifyJSReady()
  
  return client
}

function resetClient() {
  // Tell the RN bridge to reset itself
  engineReset()
}

export {resetClient, createClient, rpcLog}
