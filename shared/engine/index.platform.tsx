import logger from '@/logger'
import {TransportShared, LocalTransport, sharedCreateClient, rpcLog} from './transport-shared'
import type {RPCMessage} from './rpc-transport'
import type {InvokeType, PayloadType, ConnectDisconnectCB, IncomingRPCCallbackType} from '@/engine/rpc-transport'

export type {PayloadType, ConnectDisconnectCB, IncomingRPCCallbackType, InvokeType}

export type CreateClientType = {
  transport: TransportShared
  invoke: InvokeType
}
import KB2 from '@/util/electron'
import type {Socket} from 'net'
import {printRPCBytes} from '@/local-debug'
import {socketPath} from '@/constants/platform'
import {onMetaEvent, notifyJSReady} from 'react-native-kb'

// used by node
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
    const {mainWindowDispatchEngineIncoming} = KB2.functions
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
    const {engineSend} = KB2.functions
    if (!engineSend) {
      // Silently no-oping here reports success upstream (send() returns true)
      // while the invocation is never delivered, leaving it outstanding
      // forever. Throwing lets the transport fail it, same as mobile.
      throw new Error('engineSend missing')
    }
    engineSend(message)
  }
  // On account-switch reset fail outstanding invocations so pre-switch RPC
  // callbacks can't fire later against post-switch state
  override reset() {
    this.failAllOutstanding()
  }
}

// Mobile transport — only instantiated when isMobile
class NativeTransportMobile extends LocalTransport {
  protected writeMessage(message: RPCMessage) {
    if (!global.rpcOnGo) {
      throw new Error('rpcOnGo send before rpcOnGo global')
    }
    // Throwing rather than swallowing is load-bearing: the transport catches
    // it and fails that invocation, instead of leaving the caller waiting on
    // a reply that can never arrive. rpcOnGo returns false when the native
    // write to Go failed.
    if (!global.rpcOnGo(message)) {
      throw new Error('native rpc write failed')
    }
  }
  // Reached two ways: a mobile account switch calling Engine.reset()
  // synchronously, or the Go connection resetting underneath us (a stream
  // desync detected natively). Either way nothing will answer the in-flight
  // RPCs after that, so fail them rather than hang every caller.
  override reset() {
    this.failAllOutstanding()
  }
}

// Expands a native rpcOnJs batch into individual dispatchOne calls. Exported
// so the mobile batch path (otherwise only reachable through the
// isMobile-gated global.rpcOnJs assignment inside createClient) can be
// exercised directly in tests.
export const dispatchRpcBatch = (
  objs: unknown,
  count: number,
  dispatchOne: (obj: unknown) => void,
  logError: (msg: string, e?: unknown) => void
) => {
  // Outer guard: this is called from native, so throwing here would abort the
  // whole batch delivery and unwind into native code.
  try {
    if (count > 1) {
      if (!Array.isArray(objs)) {
        // Native always sends an array when it batches, so this means the
        // two sides disagree -- and count-1 messages would vanish silently.
        logError(`rpcOnJs: count ${count} but payload is not an array`)
        return
      }
      for (const obj of objs) {
        dispatchOne(obj)
      }
    } else {
      dispatchOne(objs)
    }
  } catch (e) {
    logError('rpcOnJs: batch guard threw', e)
  }
}

function createClient(
  incomingRPCCallback: IncomingRPCCallbackType,
  connectCallback: ConnectDisconnectCB,
  disconnectCallback: ConnectDisconnectCB
) {
  if (isMobile) {
    const client = sharedCreateClient(
      new NativeTransportMobile(incomingRPCCallback, connectCallback, disconnectCallback)
    )

    // Per-message try/catch: one bad message must not drop the rest of the
    // batch the native side handed over.
    const dispatchOne = (obj: unknown) => {
      try {
        client.transport.dispatchDecodedMessage(obj)
      } catch (e) {
        logger.error('rpcOnJs: dispatch threw', e)
      }
    }

    global.rpcOnJs = (objs: unknown, count: number) => {
      dispatchRpcBatch(objs, count, dispatchOne, (msg, e) => logger.error(msg, e))
    }

    onMetaEvent((payload: string) => {
      try {
        switch (payload) {
          case 'kb-engine-reset':
            // Go dropped the loopback connection; anything in flight is dead.
            // Report the disconnect before the reconnect so the engine cancels
            // its sessions and the UI shows the reconnect state -- the desktop
            // socket path does the same pair. disconnectCallback and
            // connectCallback are isolated in their own try/catch: a throw
            // from a session cancel handler inside disconnectCallback must
            // not strand the UI on the disconnect banner by skipping
            // connectCallback (which synchronously clears the daemon error
            // via startHandshake()).
            client.transport.reset()
            try {
              disconnectCallback()
            } catch (e) {
              logger.error('>>>> meta engine event: disconnectCallback threw', e)
            }
            try {
              connectCallback()
            } catch (e) {
              logger.error('>>>> meta engine event: connectCallback threw', e)
            }
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

  const {ipcRendererOn} = KB2.functions
  const {isRenderer} = KB2.constants

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
        logger.error('>>>> engineIncoming IPC JS thrown!', e)
      }
    })

    return client
  }
}

// Desktop only; Engine.reset() is a no-op on mobile
function resetClient(
  client: CreateClientType,
  incomingRPCCallback: IncomingRPCCallbackType,
  connectCallback: ConnectDisconnectCB,
  disconnectCallback: ConnectDisconnectCB
) {
  const {isRenderer} = KB2.constants

  if (isRenderer) {
    client.transport.reset()
    return client
  }

  client.transport.close()
  return sharedCreateClient(new NativeTransport(incomingRPCCallback, connectCallback, disconnectCallback))
}

export {resetClient, createClient, rpcLog}
