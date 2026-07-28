/// <reference types="jest" />

import logger from '@/logger'
import {
  RPCTransport,
  encodeFrame,
  errors,
  type IncomingRPCCallbackType,
  type RPCMessage,
} from './rpc-transport'

class TestTransport extends RPCTransport {
  private _connected = true
  private _writeError: Error | undefined
  sent = new Array<RPCMessage>()
  packetizeErrors = new Array<unknown>()

  constructor(p?: {connected?: boolean; incomingRPCCallback?: IncomingRPCCallbackType; writeError?: Error}) {
    super({incomingRPCCallback: p?.incomingRPCCallback})
    this._connected = p?.connected ?? true
    this._writeError = p?.writeError
  }

  protected override isConnected() {
    return this._connected
  }

  // Records rather than replaces: the base still console.error()s, so tests
  // that only assert on that keep working.
  protected override onPacketizeError(err: unknown) {
    this.packetizeErrors.push(err)
    super.onPacketizeError(err)
  }

  protected writeMessage(message: RPCMessage) {
    if (this._writeError !== undefined) {
      throw this._writeError
    }
    this.sent.push(message)
  }

  setWriteError(err: Error | undefined) {
    this._writeError = err
  }

  setConnected(connected: boolean) {
    this._connected = connected
  }

  flushConnected() {
    this.setConnected(true)
    this.onConnected()
  }

  dropConnection() {
    this.setConnected(false)
    this.onDisconnected()
  }
}

test('packetizeData handles split frames and dispatches responses', () => {
  const transport = new TestTransport()
  const cb = jest.fn()
  transport.invoke('keybase.1.test.hello', [{}], cb)

  const response = encodeFrame([1, 1, null, {ok: true}])
  transport.packetizeData(response.slice(0, 2))
  expect(cb).not.toHaveBeenCalled()

  transport.packetizeData(response.slice(2))
  expect(cb).toHaveBeenCalledWith(null, {ok: true})
})

test('packetizeData handles byte-at-a-time reads without losing framing state', () => {
  const transport = new TestTransport()
  const cb = jest.fn()
  transport.invoke('keybase.1.test.hello', [{}], cb)

  const response = encodeFrame([1, 1, null, {ok: 'tiny-chunks'}])
  for (const byte of response) {
    transport.packetizeData(Uint8Array.of(byte))
  }

  expect(cb).toHaveBeenCalledWith(null, {ok: 'tiny-chunks'})
})

test('invoke queues while disconnected and flushes on connect', () => {
  const transport = new TestTransport({connected: false})
  const cb = jest.fn()

  transport.invoke('keybase.1.test.hello', [{a: 1}], cb)
  expect(transport.sent).toEqual([])

  transport.flushConnected()
  expect(transport.sent).toEqual([[0, 1, 'keybase.1.test.hello', [{a: 1}]]])

  transport.dispatchDecodedMessage([1, 1, null, {done: true}])
  expect(cb).toHaveBeenCalledWith(null, {done: true})
})

test('disconnect fails outstanding invocations with EOF', () => {
  const transport = new TestTransport()
  const cb = jest.fn()

  transport.invoke('keybase.1.test.hello', [{}], cb)
  transport.dropConnection()

  expect(cb).toHaveBeenCalledWith(expect.objectContaining({code: errors.EOF, desc: 'EOF from server'}), {})
})

test('incoming invoke exposes response handlers', () => {
  let payload: Parameters<IncomingRPCCallbackType>[0] | undefined
  const transport = new TestTransport({
    incomingRPCCallback: incoming => {
      payload = incoming
    },
  })

  transport.dispatchDecodedMessage([0, 7, 'keybase.1.test.hello', [{sessionID: 9}]])

  expect(payload?.method).toBe('keybase.1.test.hello')
  expect(payload?.param).toEqual([{sessionID: 9}])

  payload?.response?.result?.({ok: true})
  expect(transport.sent).toEqual([[1, 7, null, {ok: true}]])
})

test('incoming invoke without handler returns unknown method error', () => {
  const transport = new TestTransport()

  transport.dispatchDecodedMessage([0, 11, 'keybase.1.test.missing', [{}]])

  expect(transport.sent).toEqual([
    [1, 11, {code: errors.UNKNOWN_METHOD, desc: 'No method available', name: 'UNKNOWN_METHOD'}, null],
  ])
})

test('invoke fails the caller when the native write throws', () => {
  const writeError = new Error('native write failed')
  const transport = new TestTransport({writeError})
  const cb = jest.fn()

  transport.invoke('keybase.1.test.hello', [{}], cb)

  // The raw exception is wrapped into the transport error shape (code/desc)
  // so convertToError produces an RPCError; the message survives in desc.
  expect(cb).toHaveBeenCalledWith(
    expect.objectContaining({code: errors.EOF, desc: writeError.message}),
    {}
  )
})

test('a failed write leaves no outstanding invocation', () => {
  const transport = new TestTransport({writeError: new Error('native write failed')})
  const cb = jest.fn()

  transport.invoke('keybase.1.test.hello', [{}], cb)
  expect(cb).toHaveBeenCalledTimes(1)

  // If the seqid were still outstanding, this would fail the same callback
  // a second time with EOF.
  transport.failAllOutstanding()
  expect(cb).toHaveBeenCalledTimes(1)
})

test('a failed write does not consume the response for a later invoke', () => {
  const transport = new TestTransport({writeError: new Error('native write failed')})
  const failed = jest.fn()
  transport.invoke('keybase.1.test.hello', [{}], failed)

  transport.setWriteError(undefined)
  const ok = jest.fn()
  transport.invoke('keybase.1.test.hello', [{}], ok)

  const [, seqid] = transport.sent[0] as [number, number, string, [object]]
  transport.dispatchDecodedMessage([1, seqid, null, {ok: true}])

  expect(ok).toHaveBeenCalledWith(null, {ok: true})
  expect(failed).toHaveBeenCalledTimes(1)
})

test('send reports failure when the native write throws', () => {
  const transport = new TestTransport({writeError: new Error('native write failed')})

  expect(transport.send([1, 3, null, {ok: true}])).toBe(false)

  transport.setWriteError(undefined)
  expect(transport.send([1, 3, null, {ok: true}])).toBe(true)
  expect(transport.sent).toEqual([[1, 3, null, {ok: true}]])
})

test('failAllOutstanding fails every outstanding invocation exactly once', () => {
  const transport = new TestTransport()
  const calls: Array<unknown> = []
  transport.invoke('keybase.1.test.a', [{}], err => calls.push(err))
  transport.invoke('keybase.1.test.b', [{}], err => calls.push(err))

  transport.failAllOutstanding()

  expect(calls).toHaveLength(2)
  expect(calls.every(e => (e as {code?: number} | undefined)?.code === errors.EOF)).toBe(true)

  // A second call must not re-fail anything already failed.
  transport.failAllOutstanding()
  expect(calls).toHaveLength(2)
})

test('a callback that re-enters with a new invoke during failAllOutstanding is not itself failed', () => {
  const transport = new TestTransport()
  const calls: Array<unknown> = []
  const reentrant = jest.fn()

  transport.invoke('keybase.1.test.a', [{}], err => {
    calls.push(err)
    transport.invoke('keybase.1.test.c', [{}], reentrant)
  })
  transport.invoke('keybase.1.test.b', [{}], err => calls.push(err))

  transport.failAllOutstanding()

  expect(calls).toHaveLength(2)
  expect(reentrant).not.toHaveBeenCalled()
})

test('a throwing callback does not stop the remaining outstanding invocations from being failed', () => {
  const transport = new TestTransport()
  const calls: Array<number> = []

  transport.invoke('keybase.1.test.a', [{}], () => {
    calls.push(1)
    throw new Error('boom')
  })
  transport.invoke('keybase.1.test.b', [{}], () => calls.push(2))
  transport.invoke('keybase.1.test.c', [{}], () => calls.push(3))

  expect(() => transport.failAllOutstanding()).not.toThrow()

  expect(calls).toEqual([1, 2, 3])
})

test('a reset cycle fails outstanding invocations once and a post-reset invocation gets a fresh, non-colliding seqid that dispatches correctly', () => {
  const transport = new TestTransport()
  const preResetCb = jest.fn()
  transport.invoke('keybase.1.test.old', [{}], preResetCb)

  transport.failAllOutstanding()
  expect(preResetCb).toHaveBeenCalledTimes(1)

  const preResetSeqids = new Set(
    transport.sent.map(m => (m as [number, number, string, [object]])[1])
  )

  const postResetCb = jest.fn()
  transport.invoke('keybase.1.test.new', [{}], postResetCb)
  const [, postResetSeqid] = transport.sent[1] as [number, number, string, [object]]

  // The actual invariant: the post-reset seqid must not alias ANY seqid used
  // before the reset. "greater than the last one" would also pass if the
  // counter were reset and then advanced past a single stale value.
  expect(preResetSeqids.has(postResetSeqid)).toBe(false)

  transport.dispatchDecodedMessage([1, postResetSeqid, null, {ok: 'post-reset'}])
  expect(postResetCb).toHaveBeenCalledWith(null, {ok: 'post-reset'})
})

test('a response for a pre-reset seqid arriving after reset is ignored', () => {
  const transport = new TestTransport()
  const preResetCb = jest.fn()
  transport.invoke('keybase.1.test.old', [{}], preResetCb)
  const [, preResetSeqid] = transport.sent[0] as [number, number, string, [object]]

  transport.failAllOutstanding()
  expect(preResetCb).toHaveBeenCalledTimes(1)

  // A stale response for the pre-reset seqid shows up late -- the seqid is
  // gone from the invocations map, so this must be a silent no-op rather
  // than re-firing the already-failed callback.
  transport.dispatchDecodedMessage([1, preResetSeqid, null, {ok: 'stale'}])
  expect(preResetCb).toHaveBeenCalledTimes(1)
})

test('seqids keep advancing after outstanding invocations are failed, so a late reply cannot alias', () => {
  const transport = new TestTransport()
  // Several pre-reset invocations, so "not the last one" is genuinely weaker
  // than "not any of them" and only the latter is asserted.
  transport.invoke('keybase.1.test.a', [{}], () => {})
  transport.invoke('keybase.1.test.b', [{}], () => {})
  transport.invoke('keybase.1.test.c', [{}], () => {})
  const preResetSeqids = new Set(transport.sent.map(m => (m as [number, number, string, [object]])[1]))
  expect(preResetSeqids.size).toBe(3)

  transport.failAllOutstanding()

  transport.invoke('keybase.1.test.d', [{}], () => {})
  transport.invoke('keybase.1.test.e', [{}], () => {})
  const postResetSeqids = transport.sent
    .slice(3)
    .map(m => (m as [number, number, string, [object]])[1])

  // No post-reset seqid may be a member of the pre-reset set -- a late reply
  // for a failed invocation would otherwise be delivered to a live callback.
  for (const seqid of postResetSeqids) {
    expect(preResetSeqids.has(seqid)).toBe(false)
  }
  expect(new Set(postResetSeqids).size).toBe(postResetSeqids.length)
})

test('a throwing incoming handler does not desync the packetizer', () => {
  const delivered: Array<unknown> = []
  let shouldThrow = true
  const transport = new TestTransport({
    incomingRPCCallback: incoming => {
      if (shouldThrow) {
        shouldThrow = false
        throw new Error('app handler blew up')
      }
      delivered.push(incoming)
    },
  })

  // Two well-formed frames arriving in a single chunk. The first frame's
  // handler throws; the second frame must still be parsed and delivered.
  const first = encodeFrame([2, 'keybase.1.test.first', [{}]])
  const second = encodeFrame([2, 'keybase.1.test.second', [{}]])
  const both = new Uint8Array(first.length + second.length)
  both.set(first, 0)
  both.set(second, first.length)

  transport.packetizeData(both)

  expect(delivered).toHaveLength(1)
})

test('a throwing invoke handler still answers the caller with an error', () => {
  const transport = new TestTransport({
    incomingRPCCallback: () => {
      throw new Error('handler blew up')
    },
  })

  transport.dispatchDecodedMessage([0, 7, 'keybase.1.test.hello', [{}]])

  // Something must go back for seqid 7 -- otherwise the service waits forever.
  expect(transport.sent).toEqual([
    [1, 7, {code: errors.UNKNOWN_METHOD, desc: 'No method available', name: 'UNKNOWN_METHOD'}, null],
  ])
})

test('a response cannot be settled twice: error() after result() is a no-op', () => {
  let payload: Parameters<IncomingRPCCallbackType>[0] | undefined
  const transport = new TestTransport({
    incomingRPCCallback: incoming => {
      payload = incoming
    },
  })

  transport.dispatchDecodedMessage([0, 9, 'keybase.1.test.hello', [{}]])
  payload?.response?.result?.({ok: true})
  payload?.response?.error?.({code: errors.UNKNOWN_METHOD, desc: 'No method available', name: 'UNKNOWN_METHOD'})

  expect(transport.sent).toEqual([[1, 9, null, {ok: true}]])
})

test('an invoke handler that settles result() and then throws does not also send an error', () => {
  const transport = new TestTransport({
    incomingRPCCallback: incoming => {
      incoming.response?.result?.({ok: true})
      throw new Error('reducer blew up after acking')
    },
  })

  transport.dispatchDecodedMessage([0, 13, 'keybase.1.test.hello', [{}]])

  expect(transport.sent).toEqual([[1, 13, null, {ok: true}]])
})

test('auto-result then a throwing handler sends exactly one message and logs no double-settle error', () => {
  const transport = new TestTransport({
    incomingRPCCallback: incoming => {
      // Mirrors index.tsx: auto-result() for non-custom-response calls,
      // then the next line (dispatching the action) throws.
      incoming.response?.result?.({ok: true})
      throw new Error('reducer blew up after acking')
    },
  })
  const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {})

  transport.dispatchDecodedMessage([0, 21, 'keybase.1.test.hello', [{}]])

  expect(transport.sent).toEqual([[1, 21, null, {ok: true}]])
  // The handler-threw log is expected; a second, double-settle log is not --
  // this is an expected sequence (auto-result then a throwing dispatch), not
  // a real control-flow bug.
  expect(errorSpy).toHaveBeenCalledTimes(1)
  expect(errorSpy).toHaveBeenCalledWith('incoming invoke handler threw', expect.any(Error))
  expect(errorSpy.mock.calls.some(args => args.some(a => typeof a === 'string' && a.includes('twice')))).toBe(
    false
  )
  errorSpy.mockRestore()
})

test('a response cannot be settled twice: result() after error() is a no-op (first settle wins)', () => {
  let payload: Parameters<IncomingRPCCallbackType>[0] | undefined
  const transport = new TestTransport({
    incomingRPCCallback: incoming => {
      payload = incoming
    },
  })

  transport.dispatchDecodedMessage([0, 10, 'keybase.1.test.hello', [{}]])
  payload?.response?.error?.({code: errors.UNKNOWN_METHOD, desc: 'No method available', name: 'UNKNOWN_METHOD'})
  payload?.response?.result?.({ok: true})

  expect(transport.sent).toEqual([
    [1, 10, {code: errors.UNKNOWN_METHOD, desc: 'No method available', name: 'UNKNOWN_METHOD'}, null],
  ])
})

test('a genuine double-settle -- result() then error() called directly -- still logs', () => {
  let payload: Parameters<IncomingRPCCallbackType>[0] | undefined
  const transport = new TestTransport({
    incomingRPCCallback: incoming => {
      payload = incoming
    },
  })
  const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {})

  transport.dispatchDecodedMessage([0, 22, 'keybase.1.test.hello', [{}]])
  payload?.response?.result?.({ok: true})
  payload?.response?.error?.({code: errors.UNKNOWN_METHOD, desc: 'No method available', name: 'UNKNOWN_METHOD'})

  expect(transport.sent).toEqual([[1, 22, null, {ok: true}]])
  expect(
    errorSpy.mock.calls.some(args => args.some(a => typeof a === 'string' && a.includes('twice')))
  ).toBe(true)
  errorSpy.mockRestore()
})

test('a malformed frame resets the packetizer, and a subsequent well-formed frame still dispatches', () => {
  const delivered: Array<unknown> = []
  const transport = new TestTransport({
    incomingRPCCallback: incoming => {
      delivered.push(incoming)
    },
  })
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

  // 0x80 (msgpack fixmap) is not a fixint (<0x80) nor one of the supported
  // uint8/16/32 length-prefix bytes (0xcc/0xcd/0xce): frameHeaderLength
  // returns 0 for it, so packetizeData throws "Bad frame header received".
  transport.packetizeData(Uint8Array.of(0x80))
  expect(delivered).toHaveLength(0)

  const good = encodeFrame([2, 'keybase.1.test.recovered', [{}]])
  transport.packetizeData(good)

  expect(delivered).toHaveLength(1)
  expect((delivered[0] as {method: string}).method).toBe('keybase.1.test.recovered')
  consoleSpy.mockRestore()
})

test('a frame split at every possible byte boundary across two packetizeData calls still dispatches exactly once', () => {
  // Seqid 1: every TestTransport starts its sequence at 1, the same value
  // used directly elsewhere in this file.
  const frame = encodeFrame([1, 1, null, {ok: 'sweep', pad: 'x'.repeat(40)}])

  for (let splitAt = 1; splitAt < frame.length; splitAt++) {
    const transport = new TestTransport()
    const cb = jest.fn()
    transport.invoke('keybase.1.test.hello', [{}], cb)

    transport.packetizeData(frame.slice(0, splitAt))
    expect(cb).not.toHaveBeenCalled()

    transport.packetizeData(frame.slice(splitAt))
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith(null, {ok: 'sweep', pad: 'x'.repeat(40)})
  }
})

test('failAllOutstanding clears buffered frame bytes', () => {
  const delivered: Array<unknown> = []
  const transport = new TestTransport({
    incomingRPCCallback: incoming => {
      delivered.push(incoming)
    },
  })

  // Feed half a frame -- the packetizer buffers a partial header+payload.
  const first = encodeFrame([2, 'keybase.1.test.first', [{}]])
  transport.packetizeData(first.slice(0, first.length - 2))
  transport.failAllOutstanding()

  // A complete, unrelated frame arrives next. If the stale half-frame was not
  // dropped, it prefixes these bytes and corrupts the decode.
  const second = encodeFrame([2, 'keybase.1.test.second', [{}]])
  transport.packetizeData(second)

  expect(delivered).toHaveLength(1)
  expect((delivered[0] as {method: string}).method).toBe('keybase.1.test.second')
})

test('a failed response write is reported, not swallowed', () => {
  let payload: Parameters<IncomingRPCCallbackType>[0] | undefined
  const transport = new TestTransport({
    incomingRPCCallback: incoming => {
      payload = incoming
    },
    writeError: new Error('native write failed'),
  })
  const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {})

  transport.dispatchDecodedMessage([0, 11, 'keybase.1.test.hello', [{}]])
  payload?.response?.result?.({ok: true})

  // send() itself already logs the generic write failure; makeResponse must
  // add a second, seqid-specific log or the service-side hang is invisible.
  expect(errorSpy).toHaveBeenCalledTimes(2)

  // The response is marked settled before the write is attempted, so a
  // failed write must not leave it settleable again -- there is no
  // connection left to retry on. Fixing the write error and calling
  // result() again must not silently open a retry path: it should trip
  // the double-settle guard and send nothing.
  transport.setWriteError(undefined)
  payload?.response?.result?.({ok: 'retry'})
  expect(transport.sent).toEqual([])
  errorSpy.mockRestore()
})

// maxFrameSize (64MB) is a JS-side sanity limit: a corrupt/desynced length
// prefix would otherwise make the packetizer sit on a multi-hundred-MB
// allocation intent and buffer forever, never dispatching again.
const maxFrameSize = 64 * 1024 * 1024

// 0xce is the msgpack uint32 length prefix; the four bytes after it are the
// big-endian payload length. Only this prefix can express a length above
// maxFrameSize (0xcd tops out at 65535).
const oversizedHeader = (payloadLen: number) =>
  Uint8Array.of(
    0xce,
    (payloadLen >>> 24) & 0xff,
    (payloadLen >>> 16) & 0xff,
    (payloadLen >>> 8) & 0xff,
    payloadLen & 0xff
  )

test('a frame header declaring more than 64MB is rejected, resets the packetizer, and the next valid frame still dispatches', () => {
  const delivered: Array<unknown> = []
  const transport = new TestTransport({
    incomingRPCCallback: incoming => {
      delivered.push(incoming)
    },
  })
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

  // Header only -- no payload bytes follow. The size check must fire before
  // anything tries to buffer 128MB.
  transport.packetizeData(oversizedHeader(128 * 1024 * 1024))

  expect(transport.packetizeErrors).toHaveLength(1)
  expect((transport.packetizeErrors[0] as Error).message).toBe(`Frame too large: ${128 * 1024 * 1024} bytes`)
  expect(delivered).toHaveLength(0)

  // The packetizer was reset, so the stale 5 header bytes are gone and this
  // frame parses from its own first byte.
  const good = encodeFrame([2, 'keybase.1.test.after-oversized', [{}]])
  transport.packetizeData(good)

  expect(delivered).toHaveLength(1)
  expect((delivered[0] as {method: string}).method).toBe('keybase.1.test.after-oversized')
  consoleSpy.mockRestore()
})

test('the 64MB frame limit is exclusive: exactly maxFrameSize is accepted and only one byte over is rejected', () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

  // Exactly at the limit: legal, so the packetizer just waits for the payload.
  const atLimit = new TestTransport()
  atLimit.packetizeData(oversizedHeader(maxFrameSize))
  expect(atLimit.packetizeErrors).toEqual([])

  const overLimit = new TestTransport()
  overLimit.packetizeData(oversizedHeader(maxFrameSize + 1))
  expect(overLimit.packetizeErrors).toHaveLength(1)

  consoleSpy.mockRestore()
})

test('the 1001st queued invoke is failed, not silently swallowed', () => {
  const transport = new TestTransport({connected: false})
  const callbacks = new Array<jest.Mock>()

  // queueMax is 1000: the first 1000 are queued with no callback yet.
  for (let i = 0; i < 1000; i++) {
    const cb = jest.fn()
    callbacks.push(cb)
    transport.invoke(`keybase.1.test.queued${i}`, [{}], cb)
  }
  expect(callbacks.every(cb => cb.mock.calls.length === 0)).toBe(true)

  // A silently dropped invoke is a permanent hang for its caller, so the
  // overflow branch must answer rather than discard.
  const overflowCb = jest.fn()
  transport.invoke('keybase.1.test.overflow', [{}], overflowCb)
  expect(overflowCb).toHaveBeenCalledTimes(1)
  const [err] = overflowCb.mock.calls[0] as [unknown, unknown]
  expect((err as Error).message).toBe('Queue overflow for keybase.1.test.overflow')

  // The overflowed invoke was never queued, so connecting must flush exactly
  // the 1000 that were accepted -- and must not re-answer the overflowed one.
  transport.flushConnected()
  expect(transport.sent).toHaveLength(1000)
  expect(callbacks.every(cb => cb.mock.calls.length === 0)).toBe(true)
  expect(overflowCb).toHaveBeenCalledTimes(1)
})

test('send reports failure once the pending queue is full instead of growing without bound', () => {
  const transport = new TestTransport({connected: false})
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

  for (let i = 0; i < 1000; i++) {
    expect(transport.send([1, i, null, {}])).toBe(true)
  }

  expect(transport.send([1, 1000, null, {}])).toBe(false)
  expect(warnSpy).toHaveBeenCalledWith('Queue overflow for raw RPC message')

  transport.flushConnected()
  expect(transport.sent).toHaveLength(1000)
  warnSpy.mockRestore()
})

test('flushPending terminates and settles every queued item exactly once when the write fails on connect', () => {
  const transport = new TestTransport({connected: false})
  const calls = new Array<Array<unknown>>()

  for (let i = 0; i < 5; i++) {
    transport.invoke(`keybase.1.test.q${i}`, [{}], (err, data) => calls.push([err, data]))
  }
  transport.send([1, 99, null, {}])

  // Connected, but every write throws. flushPending() swaps _pending and
  // re-enters invoke()/send(); if a failing write could put items back on the
  // queue this would spin forever or double-settle a callback.
  const writeError = new Error('write failed right after connect')
  transport.setWriteError(writeError)
  transport.flushConnected()

  expect(calls).toHaveLength(5)
  expect(
    calls.every(([err]) => (err as {code?: number; desc?: string}).desc === writeError.message)
  ).toBe(true)
  expect(transport.sent).toEqual([])

  // Nothing was re-queued: a second flush with a working write sends nothing
  // and settles nothing again.
  transport.setWriteError(undefined)
  transport.flushConnected()
  expect(calls).toHaveLength(5)
  expect(transport.sent).toEqual([])
})

test('cancel packets surface a cancelled response payload', () => {
  const incoming = jest.fn()
  const transport = new TestTransport({incomingRPCCallback: incoming})

  transport.dispatchDecodedMessage([3, 44])

  expect(incoming).toHaveBeenCalledWith(
    expect.objectContaining({
      method: '',
      param: [],
      response: expect.objectContaining({cancelled: true, seqid: 44}),
    })
  )
})

test('close settles every queued invoke exactly once with EOF and drops queued sends', () => {
  const transport = new TestTransport({connected: false})
  const calls: Array<Array<unknown>> = []
  const cbA = jest.fn((err: unknown, data: unknown) => calls.push([err, data]))
  const cbB = jest.fn((err: unknown, data: unknown) => calls.push([err, data]))

  transport.invoke('keybase.1.test.a', [{}], cbA)
  transport.invoke('keybase.1.test.b', [{}], cbB)
  // A queued raw send() has no callback and nothing waiting on it; it must
  // simply be dropped, not replayed later.
  expect(transport.send([1, 5, null, {ok: true}])).toBe(true)

  transport.close()

  expect(cbA).toHaveBeenCalledTimes(1)
  expect(cbB).toHaveBeenCalledTimes(1)
  expect(calls.every(([err]) => (err as {code?: number} | undefined)?.code === errors.EOF)).toBe(true)
  expect(transport.sent).toEqual([])

  // Reconnecting must not replay or re-settle anything the close already
  // settled -- the queue was detached, not just marked.
  transport.flushConnected()
  expect(cbA).toHaveBeenCalledTimes(1)
  expect(cbB).toHaveBeenCalledTimes(1)
  expect(transport.sent).toEqual([])
})

test('close settles queued invokes even when one callback throws', () => {
  const transport = new TestTransport({connected: false})
  const calls: Array<number> = []

  transport.invoke('keybase.1.test.a', [{}], () => {
    calls.push(1)
    throw new Error('boom')
  })
  transport.invoke('keybase.1.test.b', [{}], () => calls.push(2))
  transport.invoke('keybase.1.test.c', [{}], () => calls.push(3))

  expect(() => transport.close()).not.toThrow()
  expect(calls).toEqual([1, 2, 3])
})

test('close does not re-queue an invoke made from a settling callback', () => {
  const transport = new TestTransport({connected: false})
  const reentrant = jest.fn()

  transport.invoke('keybase.1.test.a', [{}], () => {
    // Post-close invokes hit the explicit-close branch and fail immediately
    // rather than sitting in a queue nothing will ever flush.
    transport.invoke('keybase.1.test.reentrant', [{}], reentrant)
  })

  transport.close()

  expect(reentrant).toHaveBeenCalledTimes(1)
  expect(reentrant).toHaveBeenCalledWith(expect.objectContaining({code: errors.EOF}), {})

  transport.flushConnected()
  expect(reentrant).toHaveBeenCalledTimes(1)
  expect(transport.sent).toEqual([])
})
