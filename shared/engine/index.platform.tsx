import logger from '@/logger'
import {TransportShared, LocalTransport, sharedCreateClient, rpcLog} from './transport-shared'
import type {CreateClientType, IncomingRPCCallbackType, ConnectDisconnectCB} from './index.platform.shared'
import type {RPCMessage} from './rpc-transport'
import type {KB2} from '@/util/electron'
import type {Socket} from 'net'

const getKB2 = () => (require('@/util/electron') as {default: KB2}).default

// Desktop transport — only instantiated when !isMobile
class NativeTransport extends TransportShared {
  private _socket?: Socket
  private _reconnectTimer?: ReturnType<typeof setTimeout>
  private _connecting = false

  constructor(
    incomingRPCCallback: IncomingRPCCallbackType,
    connectCallback?: ConnectDisconnectCB,
    disconnectCallback?: ConnectDisconnectCB
  ) {
    super(connectCallback, disconnectCallback, incomingRPCCallback)
    this.needsConnect = true
  }

  protected override isConnected() {
    return !!this._socket
  }

  protected writeMessage(message: RPCMessage) {
    if (!this._socket) {
      throw new Error('write attempt with no active stream')
    }
    const {printRPCBytes} = require('@/local-debug') as {printRPCBytes: boolean}
    const framed = this.encodeMessage(message)
    if (printRPCBytes) {
      logger.debug('[RPC] Writing', framed.length)
    }
    this._socket.write(Buffer.from(framed))
  }

  override connect(cb: (err?: unknown) => void) {
    this.clearExplicitClose()
    if (this._socket) {
      cb()
      return
    }
    this.connectOnce(cb)
  }

  override packetizeData(m: Uint8Array) {
    const {printRPCBytes} = require('@/local-debug') as {printRPCBytes: boolean}
    const {mainWindowDispatchEngineIncoming} = getKB2().functions
    if (printRPCBytes) {
      logger.debug('[RPC] Read', m.length)
    }
    mainWindowDispatchEngineIncoming?.(m)
  }

  override close() {
    this.markExplicitClose()
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = undefined
    }
    this._socket?.destroy()
    this._socket = undefined
    super.close()
  }

  private connectOnce(cb?: (err?: unknown) => void) {
    if (this._connecting || this._socket) {
      cb?.()
      return
    }
    this._connecting = true

    const {socketPath} = require('@/constants/platform') as {socketPath: string}
    const socket = require('net').connect({path: socketPath}) as Socket
    let settled = false

    const finish = (err?: unknown) => {
      if (settled) {
        return
      }
      settled = true
      this._connecting = false
      if (err) {
        socket.destroy()
        cb?.(err)
        this.scheduleReconnect()
        return
      }

      this._socket = socket
      socket.on('close', () => {
        if (this._socket !== socket) {
          return
        }
        this._socket = undefined
        if (this.isExplicitClose()) {
          return
        }
        this.onDisconnected()
        this.scheduleReconnect()
      })
      socket.on('data', data => {
        const bytes = typeof data === 'string' ? Buffer.from(data) : data
        this.packetizeData(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))
      })
      socket.on('error', err => {
        logger.warn('Desktop RPC socket error', err)
      })

      this.onConnected()
      cb?.()
    }

    socket.once('connect', () => finish())
    socket.once('error', err => finish(err))
    socket.once('close', () => finish(new Error('error in connection')))
  }

  private scheduleReconnect() {
    if (this.isExplicitClose() || this._reconnectTimer || this._connecting) {
      return
    }
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = undefined
      if (this.isConnected()) {
        return
      }
      this.connectOnce()
    }, 1000)
  }
}

class ProxyNativeTransport extends LocalTransport {
  protected writeMessage(message: RPCMessage) {
    const {engineSend} = getKB2().functions
    engineSend?.(message)
  }
}

// Mobile transport — only instantiated when isMobile
class NativeTransportMobile extends LocalTransport {
  protected writeMessage(message: RPCMessage) {
    try {
      if (!global.rpcOnGo) {
        logger.error('>>>> rpcOnGo send before rpcOnGo global?')
      }
      global.rpcOnGo?.(message)
    } catch (e) {
      logger.error('>>>> rpcOnGo JS thrown!', e)
    }
  }
}

function createClient(
  incomingRPCCallback: IncomingRPCCallbackType,
  connectCallback: ConnectDisconnectCB,
  disconnectCallback: ConnectDisconnectCB
) {
  if (isMobile) {
    const {getNativeEmitter, notifyJSReady} = require('react-native-kb') as {
      getNativeEmitter: () => {addListener: (event: string, cb: (payload: string) => void) => void}
      notifyJSReady: () => void
    }

    const client = sharedCreateClient(
      new NativeTransportMobile(incomingRPCCallback, connectCallback, disconnectCallback)
    )

    global.rpcOnJs = (objs: unknown, count: number) => {
      try {
        if (count > 1) {
          const arr = objs as Array<unknown>
          for (const obj of arr) {
            client.transport.dispatchDecodedMessage(obj)
          }
        } else {
          client.transport.dispatchDecodedMessage(objs)
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

    logger.info('JS engine ready, notifying native side')
    notifyJSReady()

    return client
  }

  const {ipcRendererOn} = getKB2().functions
  const {isRenderer} = getKB2().constants

  if (!isRenderer) {
    return sharedCreateClient(new NativeTransport(incomingRPCCallback, connectCallback, disconnectCallback))
  } else {
    const client = sharedCreateClient(
      new ProxyNativeTransport(incomingRPCCallback, connectCallback, disconnectCallback)
    )

    // plumb back data from the node side
    ipcRendererOn?.('engineIncoming', (_e: unknown, data: unknown) => {
      try {
        client.transport.packetizeData(data as Uint8Array)
      } catch (e) {
        logger.error('>>>> rpcOnJs JS thrown!', e)
      }
    })

    return client
  }
}

function resetClient(
  client: CreateClientType,
  incomingRPCCallback: IncomingRPCCallbackType,
  connectCallback: ConnectDisconnectCB,
  disconnectCallback: ConnectDisconnectCB
) {
  if (isMobile) {
    const {engineReset} = require('react-native-kb') as {engineReset: () => void}
    engineReset()
    return client
  }

  const {isRenderer} = getKB2().constants

  if (isRenderer) {
    client.transport.reset()
    return client
  }

  client.transport.close()
  return sharedCreateClient(new NativeTransport(incomingRPCCallback, connectCallback, disconnectCallback))
}

export type {CreateClientType, PayloadType, InvokeType} from './index.platform.shared'
export {resetClient, createClient, rpcLog}
