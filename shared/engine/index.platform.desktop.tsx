import type {Socket} from 'net'
import logger from '@/logger'
import {TransportShared, LocalTransport, sharedCreateClient, rpcLog} from './transport-shared'
import {socketPath} from '@/constants/platform.desktop'
import {printRPCBytes} from '@/local-debug'
import type {CreateClientType, IncomingRPCCallbackType, ConnectDisconnectCB} from './index.platform'
import type {RPCMessage} from './rpc-transport'
import KB2 from '@/util/electron.desktop'

const {engineSend, ipcRendererOn, mainWindowDispatchEngineIncoming} = KB2.functions
const {isRenderer} = KB2.constants
const TEMP_RPC_DEBUG_REQUEST_INBOX_UNBOX = true

const tempRPCBridgeLog = (event: string, details: object) => {
  if (!TEMP_RPC_DEBUG_REQUEST_INBOX_UNBOX || !__DEV__) {
    return
  }
  console.warn(`[TEMP requestInboxUnbox bridge debug] ${event}`, details)
}

// used by node
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

  protected isConnected() {
    return !!this._socket
  }

  protected writeMessage(message: RPCMessage) {
    if (!this._socket) {
      throw new Error('write attempt with no active stream')
    }
    const framed = this.encodeMessage(message)
    if (printRPCBytes) {
      logger.debug('[RPC] Writing', framed.length)
    }
    this._socket.write(Buffer.from(framed))
  }

  connect(cb: (err?: unknown) => void) {
    this.clearExplicitClose()
    if (this._socket) {
      cb()
      return
    }
    this.connectOnce(cb)
  }

  packetizeData(m: Uint8Array) {
    if (printRPCBytes) {
      logger.debug('[RPC] Read', m.length)
    }
    if (__DEV__ && TEMP_RPC_DEBUG_REQUEST_INBOX_UNBOX) {
      try {
        const decoded = this.decodeMessageForDebug(m)
        const [type, seqid] = decoded
        if (type === 1) {
          console.warn('[TEMP requestInboxUnbox daemon debug] node received response from daemon', {
            decoded,
            seqid,
          })
        } else if (type === 0) {
          console.warn('[TEMP requestInboxUnbox daemon debug] node received invoke from daemon', {
            decoded,
            seqid,
          })
        }
      } catch {}
    }
    mainWindowDispatchEngineIncoming(m)
  }

  close() {
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

  private decodeMessageForDebug(data: Uint8Array): RPCMessage {
    const packet = this.copyForDebug(data)
    const payload = require('@msgpack/msgpack').decode(packet.slice(5))
    return payload as RPCMessage
  }

  private copyForDebug(data: Uint8Array) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  }
}

class ProxyNativeTransport extends LocalTransport {
  protected writeMessage(message: RPCMessage) {
    const [type, seqid, methodOrError] = message
    if (type === 1) {
      tempRPCBridgeLog('renderer write response', {message, seqid})
    } else if (type === 0 && methodOrError === 'chat.1.local.requestInboxUnbox') {
      tempRPCBridgeLog('renderer write invoke', {message, seqid})
    }
    engineSend?.(message)
  }
}

function createClient(
  incomingRPCCallback: IncomingRPCCallbackType,
  connectCallback: ConnectDisconnectCB,
  disconnectCallback: ConnectDisconnectCB
) {
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
  if (isRenderer) {
    client.transport.reset()
    return client
  }

  client.transport.close()
  return sharedCreateClient(new NativeTransport(incomingRPCCallback, connectCallback, disconnectCallback))
}

export {resetClient, createClient, rpcLog}
