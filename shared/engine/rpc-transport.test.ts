/// <reference types="jest" />

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

  constructor(p?: {connected?: boolean; incomingRPCCallback?: IncomingRPCCallbackType; writeError?: Error}) {
    super({incomingRPCCallback: p?.incomingRPCCallback})
    this._connected = p?.connected ?? true
    this._writeError = p?.writeError
  }

  protected override isConnected() {
    return this._connected
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

  expect(cb).toHaveBeenCalledWith(writeError, {})
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

test('seqids keep advancing after outstanding invocations are failed, so a late reply cannot alias', () => {
  const transport = new TestTransport()
  transport.invoke('keybase.1.test.a', [{}], () => {})
  transport.failAllOutstanding()
  transport.invoke('keybase.1.test.b', [{}], () => {})

  const [, firstSeqid] = transport.sent[0] as [number, number, string, [object]]
  const [, secondSeqid] = transport.sent[1] as [number, number, string, [object]]
  expect(secondSeqid).toBeGreaterThan(firstSeqid)
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
