import type {Socket} from 'net'
import {decode} from '@msgpack/msgpack'
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

const cloneChunkForIPC = (data: Uint8Array) => Uint8Array.from(data)

const normalizeIncomingChunk = (data: unknown) => {
  if (data instanceof Uint8Array) {
    return cloneChunkForIPC(data)
  }
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView
    return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength))
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data.slice(0))
  }
  if (Array.isArray(data)) {
    return Uint8Array.from(data)
  }
  return undefined
}

// used by node
class NativeTransport extends TransportShared {
  private _socket?: Socket
  private _reconnectTimer?: ReturnType<typeof setTimeout>
  private _connecting = false
  private _debugBufferedBytes = 0
  private _debugChunks = new Array<Uint8Array>()
  private _debugChunkOffset = 0

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
    const [type, seqid, methodOrError] = message
    if (__DEV__ && TEMP_RPC_DEBUG_REQUEST_INBOX_UNBOX) {
      if (type === 0 && methodOrError === 'chat.1.local.requestInboxUnbox') {
        console.warn('[TEMP requestInboxUnbox daemon debug] node wrote invoke to daemon', {
          message,
          seqid,
        })
      } else if (type === 1) {
        console.warn('[TEMP requestInboxUnbox daemon debug] node wrote response to daemon', {
          message,
          seqid,
        })
      }
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
    // Socket reads can arrive as Buffer-backed subarray views. Normalize them before crossing
    // Electron IPC so the renderer packetizer always sees an exact standalone byte range.
    const chunk = cloneChunkForIPC(m)
    this.debugPacketizeData(chunk)
    mainWindowDispatchEngineIncoming(chunk)
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

  private debugPacketizeData(data: Uint8Array) {
    if (!__DEV__ || !TEMP_RPC_DEBUG_REQUEST_INBOX_UNBOX) {
      return
    }
    try {
      this.appendDebugChunk(data)
      while (this._debugBufferedBytes > 0) {
        const firstByte = this.peekDebugByte()
        if (firstByte === undefined) {
          return
        }
        const headerLen = this.frameHeaderLength(firstByte)
        if (!headerLen || this._debugBufferedBytes < headerLen) {
          return
        }
        const header = this.copyDebugBufferedBytes(headerLen)
        if (!header) {
          return
        }
        const payloadLen = decode(header)
        if (typeof payloadLen !== 'number' || payloadLen < 0) {
          this.resetDebugPacketizer()
          return
        }
        if (this._debugBufferedBytes < headerLen + payloadLen) {
          return
        }
        this.consumeDebugBufferedBytes(headerLen)
        const payloadBytes = this.copyDebugBufferedBytes(payloadLen)
        if (!payloadBytes) {
          return
        }
        const payload = decode(payloadBytes) as RPCMessage
        this.consumeDebugBufferedBytes(payloadLen)
        const [type, seqid] = payload
        if (type === 1) {
          console.warn('[TEMP requestInboxUnbox daemon debug] node received response from daemon', {
            payload,
            seqid,
          })
        } else if (type === 0) {
          console.warn('[TEMP requestInboxUnbox daemon debug] node received invoke from daemon', {
            payload,
            seqid,
          })
        }
      }
    } catch {
      this.resetDebugPacketizer()
    }
  }

  private frameHeaderLength(leadByte: number) {
    if (leadByte < 0x80) {
      return 1
    }
    switch (leadByte) {
      case 0xcc:
        return 2
      case 0xcd:
        return 3
      case 0xce:
        return 5
      default:
        return 0
    }
  }

  private resetDebugPacketizer() {
    this._debugBufferedBytes = 0
    this._debugChunks = []
    this._debugChunkOffset = 0
  }

  private appendDebugChunk(data: Uint8Array) {
    const chunk = new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    if (!chunk.length) {
      return
    }
    this._debugChunks.push(chunk)
    this._debugBufferedBytes += chunk.length
  }

  private peekDebugByte() {
    const firstChunk = this._debugChunks[0]
    if (!firstChunk) {
      return undefined
    }
    return firstChunk[this._debugChunkOffset]
  }

  private copyDebugBufferedBytes(length: number) {
    if (length > this._debugBufferedBytes) {
      return undefined
    }

    const firstChunk = this._debugChunks[0]
    if (firstChunk) {
      const available = firstChunk.length - this._debugChunkOffset
      if (available >= length) {
        return firstChunk.slice(this._debugChunkOffset, this._debugChunkOffset + length)
      }
    }

    const out = new Uint8Array(length)
    let outOffset = 0
    let remaining = length
    let chunkIndex = 0
    let chunkOffset = this._debugChunkOffset

    while (remaining > 0) {
      const chunk = this._debugChunks[chunkIndex]
      if (!chunk) {
        return undefined
      }

      const available = chunk.length - chunkOffset
      const toCopy = Math.min(remaining, available)
      out.set(chunk.subarray(chunkOffset, chunkOffset + toCopy), outOffset)
      outOffset += toCopy
      remaining -= toCopy
      chunkIndex += 1
      chunkOffset = 0
    }

    return out
  }

  private consumeDebugBufferedBytes(length: number) {
    let remaining = length
    while (remaining > 0) {
      const chunk = this._debugChunks[0]
      if (!chunk) {
        this._debugChunkOffset = 0
        this._debugBufferedBytes = 0
        return
      }

      const available = chunk.length - this._debugChunkOffset
      if (remaining < available) {
        this._debugChunkOffset += remaining
        this._debugBufferedBytes -= length
        return
      }

      remaining -= available
      this._debugChunks.shift()
      this._debugChunkOffset = 0
    }
    this._debugBufferedBytes -= length
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
        const chunk = normalizeIncomingChunk(data)
        if (!chunk) {
          logger.error('>>>> rpcOnJs invalid engineIncoming chunk', {
            constructorName: data && typeof data === 'object' ? data.constructor?.name : undefined,
            type: typeof data,
          })
          return
        }
        client.transport.packetizeData(chunk)
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
