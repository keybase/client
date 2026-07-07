import {decode, encode} from '@msgpack/msgpack'

const MESSAGE_TYPE_INVOKE = 0
const MESSAGE_TYPE_RESPONSE = 1
const MESSAGE_TYPE_NOTIFY = 2
const MESSAGE_TYPE_CANCEL = 3

type ErrorName = 'OK' | 'UNKNOWN_METHOD' | 'EOF'

const errorMessages: Record<ErrorName, string> = {
  EOF: 'EOF from server',
  OK: 'Success',
  UNKNOWN_METHOD: 'No method available',
}

export const errors = {
  EOF: 101,
  OK: 0,
  UNKNOWN_METHOD: 100,
} as const

export type ErrorType = {
  code: number
  desc: string
  name?: string
}

export type ResponseType = {
  cancelled?: boolean
  seqid: number
  error?: (e?: ErrorType) => void
  result?: (r?: unknown) => void
}

export type PayloadType = {
  method: string
  param: Array<{sessionID?: number}>
  response?: ResponseType
}

export type IncomingRPCCallbackType = (payload: PayloadType) => void
export type ConnectDisconnectCB = () => void
export type InvokeType = (method: string, args: [object], cb: (err: unknown, data: unknown) => void) => void

type InvocationCallback = (err: unknown, data: unknown) => void
export type RPCMessage = [number, ...Array<unknown>]
type PendingItem =
  | {type: 'invoke'; method: string; args: [object]; cb: InvocationCallback}
  | {type: 'message'; message: RPCMessage}

const queueMax = 1000
const maxFrameSize = 64 * 1024 * 1024 // 64 MB; rejects oversized frames before buffering payload bytes

const makeTransportError = (name: ErrorName): ErrorType => ({
  code: errors[name],
  desc: errorMessages[name],
  name,
})

const makeEOFError = () => makeTransportError('EOF')

const frameHeaderLength = (leadByte: number) => {
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

const toUint8Array = (data: Uint8Array) => new Uint8Array(data.buffer, data.byteOffset, data.byteLength)

const encodeFrame = (message: RPCMessage) => {
  const payload = encode(message)
  const frame = new Uint8Array(5 + payload.length)
  frame[0] = 0xce
  frame[1] = (payload.length >>> 24) & 0xff
  frame[2] = (payload.length >>> 16) & 0xff
  frame[3] = (payload.length >>> 8) & 0xff
  frame[4] = payload.length & 0xff
  frame.set(payload, 5)
  return frame
}

const isRPCMessage = (message: unknown): message is RPCMessage =>
  Array.isArray(message) && typeof message[0] === 'number'

// Reassembles length-prefixed msgpack frames from an arbitrary byte-chunk
// stream. Only byte-stream transports use this (desktop socket / renderer
// IPC); mobile JSI hands over already-decoded messages.
class FramePacketizer {
  private _bufferedBytes = 0
  private _chunks = new Array<Uint8Array>()
  private _chunkOffset = 0

  get bufferedBytes() {
    return this._bufferedBytes
  }

  reset() {
    this._bufferedBytes = 0
    this._chunks = []
    this._chunkOffset = 0
  }

  append(data: Uint8Array) {
    const chunk = toUint8Array(data)
    if (!chunk.length) {
      return
    }
    this._chunks.push(chunk)
    this._bufferedBytes += chunk.length
  }

  peekByte() {
    const firstChunk = this._chunks[0]
    if (!firstChunk) {
      return undefined
    }
    return firstChunk[this._chunkOffset]
  }

  // Read-only view (or copy when spanning chunks) of the next `length` bytes;
  // does not consume. Views stay valid because chunks are never mutated in place.
  peekBytes(length: number) {
    if (length > this._bufferedBytes) {
      return undefined
    }

    const firstChunk = this._chunks[0]
    if (firstChunk) {
      const available = firstChunk.length - this._chunkOffset
      if (available >= length) {
        return firstChunk.subarray(this._chunkOffset, this._chunkOffset + length)
      }
    }

    const out = new Uint8Array(length)
    let outOffset = 0
    let remaining = length
    let chunkIndex = 0
    let chunkOffset = this._chunkOffset

    while (remaining > 0) {
      const chunk = this._chunks[chunkIndex]
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

  consumeBytes(length: number) {
    let remaining = length
    while (remaining > 0) {
      const chunk = this._chunks[0]
      if (!chunk) {
        this._chunkOffset = 0
        this._bufferedBytes = 0
        return
      }

      const available = chunk.length - this._chunkOffset
      if (remaining < available) {
        this._chunkOffset += remaining
        this._bufferedBytes -= length
        return
      }

      remaining -= available
      this._chunks.shift()
      this._chunkOffset = 0
    }
    this._bufferedBytes -= length
  }
}

export abstract class RPCTransport {
  needsConnect = false
  private _packetizer = new FramePacketizer()
  private _explicitClose = false
  private _incomingRPCCallback?: IncomingRPCCallbackType
  private _connectCallback?: ConnectDisconnectCB
  private _disconnectCallback?: ConnectDisconnectCB
  private _invocations = new Map<number, InvocationCallback>()
  private _pending = new Array<PendingItem>()
  private _seqid = 1

  constructor(p?: {
    incomingRPCCallback?: IncomingRPCCallbackType
    connectCallback?: ConnectDisconnectCB
    disconnectCallback?: ConnectDisconnectCB
  }) {
    this._incomingRPCCallback = p?.incomingRPCCallback
    this._connectCallback = p?.connectCallback
    this._disconnectCallback = p?.disconnectCallback
  }

  protected isConnected() {
    return true
  }

  protected abstract writeMessage(message: RPCMessage): void

  protected markExplicitClose() {
    this._explicitClose = true
  }

  protected clearExplicitClose() {
    this._explicitClose = false
  }

  protected isExplicitClose() {
    return this._explicitClose
  }

  protected onConnected() {
    this.needsConnect = false
    this.flushPending()
    this._connectCallback?.()
  }

  protected onDisconnected() {
    this._packetizer.reset()
    this.failOutstanding(makeEOFError(), {})
    this._disconnectCallback?.()
  }

  protected onPacketizeError(err: unknown) {
    console.error('Got packetize error!', err)
  }

  protected unwrapIncomingError(err: unknown) {
    if (!err) {
      return null
    }
    if (typeof err === 'object') {
      return err
    }
    try {
      return new Error(JSON.stringify(err))
    } catch {
      return new Error('unknown')
    }
  }

  protected flushPending() {
    const pending = this._pending
    this._pending = []
    for (const item of pending) {
      if (item.type === 'invoke') {
        this.invoke(item.method, item.args, item.cb)
      } else {
        this.send(item.message)
      }
    }
  }

  protected failOutstanding(err: unknown, data: unknown) {
    const invocations = this._invocations
    this._invocations = new Map()
    invocations.forEach(cb => cb(err, data))
  }

  packetizeData(data: Uint8Array) {
    const p = this._packetizer
    try {
      p.append(data)

      while (p.bufferedBytes > 0) {
        const firstByte = p.peekByte()
        if (firstByte === undefined) {
          return
        }

        const headerLen = frameHeaderLength(firstByte)
        if (!headerLen) {
          throw new Error('Bad frame header received')
        }
        if (p.bufferedBytes < headerLen) {
          return
        }

        const header = p.peekBytes(headerLen)
        if (!header) {
          return
        }

        // Frame length is a msgpack uint (fixint/uint8/uint16/uint32); read the
        // big-endian bytes directly rather than paying a msgpack decode per frame
        let payloadLen = 0
        if (headerLen === 1) {
          payloadLen = header[0] ?? 0
        } else {
          for (let i = 1; i < headerLen; i++) {
            payloadLen = payloadLen * 256 + (header[i] ?? 0)
          }
        }
        if (payloadLen > maxFrameSize) {
          throw new Error(`Frame too large: ${payloadLen} bytes`)
        }
        if (p.bufferedBytes < headerLen + payloadLen) {
          return
        }

        p.consumeBytes(headerLen)
        const payloadBytes = p.peekBytes(payloadLen)
        if (!payloadBytes) {
          return
        }
        const payload = decode(payloadBytes)
        p.consumeBytes(payloadLen)
        this.dispatchDecodedMessage(payload)
      }
    } catch (err) {
      p.reset()
      this.onPacketizeError(err)
    }
  }

  dispatchDecodedMessage(message: unknown) {
    if (!isRPCMessage(message) || message.length < 2) {
      console.warn('Bad input packet in dispatch')
      return
    }

    const [type, ...rest] = message
    switch (type) {
      case MESSAGE_TYPE_INVOKE: {
        const [seqid, method, param] = rest
        if (typeof seqid !== 'number' || typeof method !== 'string' || !Array.isArray(param)) {
          console.warn('Invalid invoke packet received')
          return
        }
        const payload = {
          method,
          param: param as Array<{sessionID?: number}>,
          response: this.makeResponse(seqid),
        }
        if (this._incomingRPCCallback) {
          this._incomingRPCCallback(payload)
        } else {
          payload.response.error?.(makeTransportError('UNKNOWN_METHOD'))
        }
        return
      }
      case MESSAGE_TYPE_NOTIFY: {
        const [method, param] = rest
        if (typeof method !== 'string' || !Array.isArray(param)) {
          console.warn('Invalid notify packet received')
          return
        }
        this._incomingRPCCallback?.({
          method,
          param: param as Array<{sessionID?: number}>,
        })
        return
      }
      case MESSAGE_TYPE_RESPONSE: {
        const [seqid, error, result] = rest
        if (typeof seqid !== 'number') {
          console.warn('Invalid response packet received')
          return
        }
        const cb = this._invocations.get(seqid)
        if (!cb) {
          return
        }
        this._invocations.delete(seqid)
        cb(this.unwrapIncomingError(error), result)
        return
      }
      case MESSAGE_TYPE_CANCEL: {
        const [seqid] = rest
        if (typeof seqid !== 'number') {
          console.warn('Invalid cancel packet received')
          return
        }
        this._incomingRPCCallback?.({
          method: '',
          param: [],
          response: {cancelled: true, seqid},
        })
        return
      }
      default:
        console.warn(`Unknown message type: ${type}`)
    }
  }

  send(message: unknown): boolean {
    if (!isRPCMessage(message)) {
      console.warn('Attempted to send invalid RPC message')
      return false
    }

    if (this.isConnected()) {
      this.writeMessage(message)
      return true
    }
    if (this._explicitClose) {
      console.warn('send call after explicit close')
      return false
    }
    if (this._pending.length >= queueMax) {
      console.warn('Queue overflow for raw RPC message')
      return false
    }
    this._pending.push({message, type: 'message'})
    return true
  }

  invoke(method: string, args: [object], cb: InvocationCallback) {
    if (this.isConnected()) {
      this.invokeNow(method, args, cb)
      return
    }
    if (this._explicitClose) {
      cb(makeEOFError(), {})
      return
    }
    if (this._pending.length >= queueMax) {
      cb(new Error(`Queue overflow for ${method}`), {})
      return
    }
    this._pending.push({args, cb, method, type: 'invoke'})
  }

  connect(cb: (err?: unknown) => void) {
    cb()
  }

  reset() {}

  close() {
    this.markExplicitClose()
    this._pending = []
    this._packetizer.reset()
    this.failOutstanding(makeEOFError(), {})
  }

  encodeMessage(message: RPCMessage) {
    return encodeFrame(message)
  }

  private invokeNow(method: string, args: [object], cb: InvocationCallback) {
    const seqid = this._seqid
    this._seqid += 1
    this._invocations.set(seqid, cb)
    this.writeMessage([MESSAGE_TYPE_INVOKE, seqid, method, args])
  }

  private makeResponse(seqid: number): ResponseType {
    return {
      cancelled: false,
      error: err => {
        this.send([MESSAGE_TYPE_RESPONSE, seqid, err, null])
      },
      result: result => {
        this.send([MESSAGE_TYPE_RESPONSE, seqid, null, result])
      },
      seqid,
    }
  }

}

export {encodeFrame, makeEOFError, makeTransportError}
