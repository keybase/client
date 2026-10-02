// The node side of the desktop engine. The main renderer runs the only Engine; this owns the socket
// to the service, reconnects it, and relays bytes both ways. Link changes go to the renderer on the
// same channel as the service's bytes, so it sees them in order with the bytes.
import {connect, type Socket} from 'net'
import logger from '@/logger'
import {socketPath} from '@/constants/platform'
import {printRPCBytes} from '@/local-debug'
import {encodeFrame, isRPCMessage} from '@/engine/rpc-transport'
import type {EngineLinkFrame, EngineSend} from '@/util/electron'

const reconnectDelayMs = 1000

export class EngineRelay {
  private _socket?: Socket
  private _connecting = false
  private _reconnectTimer?: ReturnType<typeof setTimeout>
  private _epoch = 0
  private _toRenderer: (data: Uint8Array | EngineLinkFrame) => void

  constructor(toRenderer: (data: Uint8Array | EngineLinkFrame) => void) {
    this._toRenderer = toRenderer
    this.connect()
  }

  // A send made on an earlier connection is dropped: the service it was meant for is gone, and its
  // seqids mean nothing to the one there now.
  send({epoch, message}: EngineSend) {
    if (!isRPCMessage(message)) {
      logger.warn('Engine relay: dropped a send that is not an rpc message')
      return
    }
    const socket = this._socket
    if (!socket || epoch !== this._epoch) {
      logger.info('Engine relay: dropped a send from another connection', {
        current: this._epoch,
        epoch,
        up: !!socket,
      })
      return
    }
    const framed = encodeFrame(message)
    if (printRPCBytes) {
      logger.debug('[RPC] Writing', framed.length)
    }
    socket.write(Buffer.from(framed))
  }

  // For a renderer that may have missed the link frames sent before it was listening
  replayLinkState() {
    this.sendLinkFrame(!!this._socket)
  }

  // A reloaded renderer starts its seqids over, so replies to the old renderer's calls must not
  // reach it: drop the connection and give the new renderer a fresh one.
  restartLink() {
    const socket = this._socket
    if (!socket) {
      this.replayLinkState()
      return
    }
    this._socket = undefined
    socket.destroy()
    this.sendLinkFrame(false)
    this.connect()
  }

  private sendLinkFrame(up: boolean) {
    this._toRenderer({epoch: this._epoch, type: 'link', up})
  }

  private connect() {
    if (this._connecting || this._socket) {
      return
    }
    this._connecting = true
    const socket = connect({path: socketPath})
    let settled = false

    const finish = (err?: unknown) => {
      if (settled) {
        return
      }
      settled = true
      this._connecting = false
      if (err) {
        socket.destroy()
        this.scheduleReconnect()
        return
      }

      this._socket = socket
      this._epoch += 1
      socket.on('close', () => {
        if (this._socket !== socket) {
          return
        }
        this._socket = undefined
        this.sendLinkFrame(false)
        this.scheduleReconnect()
      })
      socket.on('data', (data: Buffer | string) => {
        const bytes = typeof data === 'string' ? Buffer.from(data) : data
        if (printRPCBytes) {
          logger.debug('[RPC] Read', bytes.length)
        }
        this._toRenderer(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength))
      })
      socket.on('error', err => {
        logger.warn('Desktop RPC socket error', err)
      })
      this.sendLinkFrame(true)
    }

    socket.once('connect', () => finish())
    socket.once('error', err => finish(err))
    socket.once('close', () => finish(new Error('error in connection')))
  }

  private scheduleReconnect() {
    if (this._reconnectTimer) {
      return
    }
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = undefined
      this.connect()
    }, reconnectDelayMs)
  }
}
