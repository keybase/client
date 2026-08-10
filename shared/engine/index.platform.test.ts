/// <reference types="jest" />

// jest.setup.js sets isMobile=false, isRenderer=true, and _fromPreload.functions
// with no engineSend -- exactly the "renderer up, preload never wired engineSend"
// case this test drives.
import {EventEmitter} from 'events'
import {createClient, resetClient, dispatchRpcBatch, makeDispatchOne} from './index.platform'
// Aliased: two tests below declare a local `errors` array for captured log
// messages.
import {errors as rpcErrors, type RPCMessage} from './rpc-transport'
import type {KB2} from '@/util/electron'

// The non-renderer desktop transport opens a real unix socket via a lazy
// require('net') inside connectOnce(). Stand in for it so the transport's
// connect/write/close lifecycle can be driven deterministically.
class MockSocket extends EventEmitter {
  written = new Array<Buffer>()
  destroyed = false
  write(b: Buffer) {
    this.written.push(b)
    return true
  }
  destroy() {
    this.destroyed = true
  }
}
const mockSockets = new Array<MockSocket>()
jest.mock('net', () => ({
  connect: () => {
    const socket = new MockSocket()
    mockSockets.push(socket)
    return socket
  },
}))

const getPreload = () => globalThis._fromPreload as KB2

test('a missing engineSend fails the write instead of silently no-oping', () => {
  const client = createClient(
    () => {},
    () => {},
    () => {}
  )

  const ok = client.transport.send([1, 3, null, {}])

  expect(ok).toBe(false)
})

test('ProxyNativeTransport.reset fails outstanding invocations so pre-switch callbacks cannot fire against post-switch state', () => {
  const preload = getPreload()
  const sent = new Array<RPCMessage>()
  preload.functions.engineSend = m => {
    sent.push(m)
  }

  try {
    const client = createClient(
      () => {},
      () => {},
      () => {}
    )
    const cb = jest.fn()
    client.invoke('keybase.1.test.hello', [{}], cb)

    expect(sent).toHaveLength(1)
    expect(cb).not.toHaveBeenCalled()

    // Desktop account switch: without this the pre-switch callback stays
    // outstanding forever (or fires later against post-switch state).
    client.transport.reset()

    expect(cb).toHaveBeenCalledTimes(1)
    const [err] = cb.mock.calls[0] as [unknown, unknown]
    expect((err as {code?: number}).code).toBe(rpcErrors.EOF)

    // A reply for the pre-switch seqid arriving after the reset must be
    // dropped, not delivered to the already-failed callback.
    const [, seqid] = sent[0] as [number, number, string, [object]]
    client.transport.dispatchDecodedMessage([1, seqid, null, {ok: 'late'}])
    expect(cb).toHaveBeenCalledTimes(1)
  } finally {
    delete preload.functions.engineSend
  }
})

test('resetClient outside the renderer closes the old transport and builds a fresh one', () => {
  const preload = getPreload()
  const originalIsRenderer = preload.constants.isRenderer
  preload.constants.isRenderer = false
  mockSockets.length = 0

  try {
    const client = createClient(
      () => {},
      () => {},
      () => {}
    )
    expect(mockSockets).toHaveLength(1)
    const socket = mockSockets[0]!
    socket.emit('connect')

    const cb = jest.fn()
    client.invoke('keybase.1.test.hello', [{}], cb)
    expect(socket.written).toHaveLength(1)
    expect(cb).not.toHaveBeenCalled()

    const next = resetClient(
      client,
      () => {},
      () => {},
      () => {}
    )

    // close() must fail what was in flight -- same invariant the renderer
    // branch gets from transport.reset().
    expect(cb).toHaveBeenCalledTimes(1)
    const [err] = cb.mock.calls[0] as [unknown, unknown]
    expect((err as {code?: number}).code).toBe(rpcErrors.EOF)
    expect(socket.destroyed).toBe(true)

    // A brand new transport on a brand new socket, not the closed one.
    expect(next.transport).not.toBe(client.transport)
    expect(mockSockets).toHaveLength(2)
    expect(mockSockets[1]).not.toBe(socket)

    next.transport.close()
  } finally {
    preload.constants.isRenderer = originalIsRenderer
  }
})

// The reachable path for a non-empty pending queue at close() time: the
// non-renderer transport is created with needsConnect, so it starts
// disconnected and every invoke made before the socket connects is queued.
// resetClient then closes it. Dropping that queue silently would hang each
// caller forever.
test('resetClient outside the renderer fails invokes queued on a transport that never connected', () => {
  const preload = getPreload()
  const originalIsRenderer = preload.constants.isRenderer
  preload.constants.isRenderer = false
  mockSockets.length = 0

  try {
    const client = createClient(
      () => {},
      () => {},
      () => {}
    )
    // Socket never emits 'connect', so the transport stays disconnected.
    expect(mockSockets).toHaveLength(1)
    const socket = mockSockets[0]!

    const cbA = jest.fn()
    const cbB = jest.fn()
    client.invoke('keybase.1.test.a', [{}], cbA)
    client.invoke('keybase.1.test.b', [{}], cbB)
    expect(socket.written).toHaveLength(0)
    expect(cbA).not.toHaveBeenCalled()

    const next = resetClient(
      client,
      () => {},
      () => {},
      () => {}
    )

    expect(cbA).toHaveBeenCalledTimes(1)
    expect(cbB).toHaveBeenCalledTimes(1)
    for (const cb of [cbA, cbB]) {
      const [err] = cb.mock.calls[0] as [unknown, unknown]
      expect((err as {code?: number}).code).toBe(rpcErrors.EOF)
    }

    // A late connect on the abandoned socket must not flush the queue it
    // already settled.
    socket.emit('connect')
    expect(socket.written).toHaveLength(0)
    expect(cbA).toHaveBeenCalledTimes(1)
    expect(cbB).toHaveBeenCalledTimes(1)

    next.transport.close()
  } finally {
    preload.constants.isRenderer = originalIsRenderer
  }
})

// dispatchRpcBatch backs the mobile global.rpcOnJs batch dispatcher (only
// wired up inside createClient's isMobile branch, which this desktop test
// env never takes). Exercise it directly instead.
describe('dispatchRpcBatch', () => {
  test('a normal multi-message array dispatches every element in order', () => {
    const dispatched: Array<unknown> = []
    dispatchRpcBatch(['a', 'b', 'c'], 3, obj => dispatched.push(obj), () => {})
    expect(dispatched).toEqual(['a', 'b', 'c'])
  })

  test('a single message (count === 1) dispatches directly, not as a wrapper', () => {
    const dispatched: Array<unknown> = []
    dispatchRpcBatch({solo: true}, 1, obj => dispatched.push(obj), () => {})
    expect(dispatched).toEqual([{solo: true}])
  })

  test('count > 1 with a non-array logs an error and dispatches nothing', () => {
    const dispatched: Array<unknown> = []
    const errors: Array<string> = []
    dispatchRpcBatch({not: 'an array'}, 2, obj => dispatched.push(obj), msg => errors.push(msg))
    expect(dispatched).toEqual([])
    expect(errors).toEqual(['rpcOnJs: count 2 but payload is not an array'])
  })

  test("one message's dispatch throwing does not stop the remaining messages", () => {
    const dispatched: Array<unknown> = []
    // Exercises production's own dispatchOne (via makeDispatchOne) rather
    // than a re-implementation, so this test still fails if production ever
    // loses its per-message try/catch.
    const fakeClient = {
      transport: {
        dispatchDecodedMessage: (obj: unknown) => {
          if (obj === 'bad') {
            throw new Error('dispatch threw')
          }
          dispatched.push(obj)
        },
      },
    }
    const dispatchOne = makeDispatchOne(fakeClient)
    const errors: Array<string> = []
    dispatchRpcBatch(['a', 'bad', 'b'], 3, dispatchOne, msg => errors.push(msg))
    expect(dispatched).toEqual(['a', 'b'])
    expect(errors).toEqual([])
  })

  // The tests above route through production's makeDispatchOne, which swallows
  // per-message throws -- so they never reach dispatchRpcBatch's own outer
  // catch. These pass a RAW throwing dispatchOne instead. dispatchRpcBatch is
  // called from native: a throw escaping it unwinds through JSI, which is
  // undefined behavior rather than a catchable error.
  describe('the outer batch guard', () => {
    test('swallows and logs a raw dispatchOne throw on the multi-message path', () => {
      const logged = new Array<[string, unknown]>()
      expect(() =>
        dispatchRpcBatch(
          ['a', 'b'],
          2,
          () => {
            throw new Error('raw dispatch threw')
          },
          (msg, e) => logged.push([msg, e])
        )
      ).not.toThrow()

      expect(logged).toHaveLength(1)
      expect(logged[0]?.[0]).toBe('rpcOnJs: batch guard threw')
      expect((logged[0]?.[1] as Error).message).toBe('raw dispatch threw')
    })

    test('swallows and logs a raw dispatchOne throw on the single-message path', () => {
      const logged = new Array<[string, unknown]>()
      expect(() =>
        dispatchRpcBatch(
          {solo: true},
          1,
          () => {
            throw new Error('raw solo dispatch threw')
          },
          (msg, e) => logged.push([msg, e])
        )
      ).not.toThrow()

      expect(logged).toHaveLength(1)
      expect(logged[0]?.[0]).toBe('rpcOnJs: batch guard threw')
      expect((logged[0]?.[1] as Error).message).toBe('raw solo dispatch threw')
    })

    test('swallows and logs a throw raised by iterating the batch itself', () => {
      // Array.isArray() is true for a Proxy wrapping an array, so this gets
      // past the count/array check and blows up inside the for..of instead --
      // outside any per-message try/catch.
      const hostile = new Proxy(['a', 'b'], {
        get(target, prop, receiver) {
          if (prop === Symbol.iterator) {
            throw new Error('iteration blew up')
          }
          return Reflect.get(target, prop, receiver) as unknown
        },
      })
      const dispatched: Array<unknown> = []
      const logged = new Array<[string, unknown]>()

      expect(() =>
        dispatchRpcBatch(hostile, 2, obj => dispatched.push(obj), (msg, e) => logged.push([msg, e]))
      ).not.toThrow()

      expect(dispatched).toEqual([])
      expect(logged).toHaveLength(1)
      expect(logged[0]?.[0]).toBe('rpcOnJs: batch guard threw')
    })
  })
})
