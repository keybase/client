import {decode, encode} from '@msgpack/msgpack'
import logger from '@/logger'

export const MESSAGE_TYPE_INVOKE = 0
export const MESSAGE_TYPE_RESPONSE = 1
export const MESSAGE_TYPE_NOTIFY = 2
export const MESSAGE_TYPE_CANCEL = 3

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
  // Read-only: true once error()/result() has settled this response. Lets a
  // caller that catches after an intentional settle (e.g. a throwing
  // reducer that runs after the auto-result() call) skip re-settling instead
  // of tripping the double-settle guard below and logging a false alarm.
  readonly settled?: boolean
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

// Settles a call made on, or waiting on, a link to the service that has gone. An EOF, not a cancel:
// callers read a cancel as the user's own and stay quiet, and isErrorTransient knows an EOF as a
// service restart.
const makeDisconnectError = (): ErrorType => ({
  code: errors.EOF,
  desc: 'The service connection was lost',
  name: 'EOF',
})

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
  private _packetizer = new FramePacketizer()
  private _explicitClose = false
  // Set once the link has gone down. Before that, calls made while not connected wait for the first
  // link-up (boot); after it, they are refused, since the service they were meant for is gone and
  // the next one knows nothing of them.
  private _linkLost = false
  // Bumped on every link drop. A reply to an incoming call is written only on the link the call came
  // in on: the service on any later link never asked it.
  private _linkGeneration = 0
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

  protected onConnected() {
    this.flushPending()
    this._connectCallback?.()
  }

  // The link to the service is gone, and with it every call in flight on it: settle them all before
  // the engine hears, so its own drop path finds them settled
  protected onLinkDown() {
    this._linkLost = true
    this._linkGeneration += 1
    this._packetizer.reset()
    this.failOutstanding(makeDisconnectError(), {})
    this._disconnectCallback?.()
  }

  // Not connected after the link has gone down once: a write now would be for a service that is gone
  private linkIsLost() {
    return this._linkLost && !this.isConnected()
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

  // Settles everything queued while disconnected. Detaching the array first is
  // what makes this once-only: a later flushPending()/onConnected() sees an
  // empty queue, so nothing is re-sent or settled twice. Queued raw send()s
  // have no callback and nothing waiting on them, so they're just dropped.
  protected failPending(err: unknown, data: unknown) {
    const pending = this._pending
    this._pending = []
    for (const item of pending) {
      if (item.type !== 'invoke') {
        continue
      }
      try {
        item.cb(err, data)
      } catch (e) {
        logger.error('failPending callback threw', e)
      }
    }
  }

  protected failOutstanding(err: unknown, data: unknown) {
    const invocations = this._invocations
    this._invocations = new Map()
    invocations.forEach(cb => {
      try {
        cb(err, data)
      } catch (e) {
        logger.error('failOutstanding callback threw', e)
      }
    })
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

        // Dispatch outside the framing try: an app-side handler that throws must
        // not reach the catch below, which resets the packetizer and discards
        // every buffered byte. That leaves parsing to resume at an arbitrary
        // offset -- and on the renderer transport there is no socket to
        // reconnect, so it never recovers.
        try {
          this.dispatchDecodedMessage(payload)
        } catch (e) {
          logger.error('dispatchDecodedMessage threw', e)
        }
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
          try {
            this._incomingRPCCallback(payload)
          } catch (e) {
            logger.error('incoming invoke handler threw', e)
            // If the handler already settled the response (e.g. an
            // auto-result() call followed by a throwing reducer on the next
            // line) it has already answered the service; settling again
            // would only trip the double-settle guard and log a false
            // alarm. Only settle here when nothing has answered yet -- the
            // service side would otherwise wait forever on this seqid.
            if (!payload.response.settled) {
              payload.response.error?.(makeTransportError('UNKNOWN_METHOD'))
            }
          }
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
      try {
        this.writeMessage(message)
      } catch (err) {
        logger.error('Failed to write RPC message', err)
        return false
      }
      return true
    }
    if (this._explicitClose) {
      console.warn('send call after explicit close')
      return false
    }
    if (this.linkIsLost()) {
      logger.info('Dropped an RPC write: the link to the service is down')
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
    if (this.linkIsLost()) {
      cb(makeDisconnectError(), {})
      return
    }
    if (this._pending.length >= queueMax) {
      cb(new Error(`Queue overflow for ${method}`), {})
      return
    }
    this._pending.push({args, cb, method, type: 'invoke'})
  }

  // A fresh link to the service, where there is a service to reconnect to
  restartLink() {}

  // Stop talking to the service until the app reloads
  reset() {}

  close() {
    this._explicitClose = true
    this.failPending(makeEOFError(), {})
    this._packetizer.reset()
    this.failOutstanding(makeEOFError(), {})
  }

  private invokeNow(method: string, args: [object], cb: InvocationCallback) {
    const seqid = this._seqid
    this._seqid += 1
    this._invocations.set(seqid, cb)
    try {
      this.writeMessage([MESSAGE_TYPE_INVOKE, seqid, method, args])
    } catch (err) {
      // The message never left, so no response is coming. Fail the caller
      // rather than leaving the seqid outstanding for the rest of the session.
      // Shaped like every other transport-level failure (code/desc, not the
      // raw exception) so downstream convertToError yields an RPCError with a
      // code; the original message survives in desc.
      this._invocations.delete(seqid)
      cb({code: errors.EOF, desc: err instanceof Error ? err.message : String(err), name: 'EOF'}, {})
    }
  }

  private makeResponse(seqid: number): ResponseType {
    let settled = false
    const generation = this._linkGeneration
    const write = (message: RPCMessage) => {
      if (generation !== this._linkGeneration) {
        logger.info(`Dropped the reply for seqid ${seqid}: the link it came in on is gone`)
        return true
      }
      return this.send(message)
    }
    return {
      cancelled: false,
      get settled() {
        return settled
      },
      error: err => {
        if (settled) {
          logger.error(`Attempted to settle response for seqid ${seqid} twice (error after already settled)`)
          return
        }
        settled = true
        if (!write([MESSAGE_TYPE_RESPONSE, seqid, err, null]) && !this.linkIsLost()) {
          // The service is waiting on this reply and nothing else will tell
          // it. The write already failed (send() logged that), so there's no
          // connection left to retry on -- surface which seqid was lost.
          logger.error(`failed to write error response for seqid ${seqid}`)
        }
      },
      result: result => {
        if (settled) {
          logger.error(`Attempted to settle response for seqid ${seqid} twice (result after already settled)`)
          return
        }
        settled = true
        if (!write([MESSAGE_TYPE_RESPONSE, seqid, null, result]) && !this.linkIsLost()) {
          // Same as above: the write failed, the connection is gone, and
          // nothing will retry this seqid.
          logger.error(`failed to write response for seqid ${seqid}`)
        }
      },
      seqid,
    }
  }
}

export {encodeFrame, isRPCMessage, makeDisconnectError, makeEOFError, makeTransportError}
