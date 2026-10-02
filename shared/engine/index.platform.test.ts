/// <reference types="jest" />

// jest.setup.js sets isMobile=false and _fromPreload.functions with no engineSend or ipcRendererOn;
// each test wires what it drives.
import {createClient, dispatchRpcBatch, makeDispatchOne} from './index.platform'
// Aliased: two tests below declare a local `errors` array for captured log
// messages.
import {encodeFrame, errors as rpcErrors} from './rpc-transport'
import type {IncomingRPCCallbackType} from './rpc-transport'
import type {EngineLinkFrame, EngineSend, KB2} from '@/util/electron'

const getPreload = () => globalThis._fromPreload as KB2

// A renderer client wired to a stand-in relay: `fromRelay` is node's side of 'engineIncoming'
const makeRendererClient = (opts?: {noEngineSend?: boolean; incoming?: IncomingRPCCallbackType}) => {
  const preload = getPreload()
  const sent = new Array<EngineSend>()
  let incoming: ((e: unknown, data: unknown) => void) | undefined
  preload.functions.ipcRendererOn = (channel, cb) => {
    if (channel === 'engineIncoming') {
      incoming = cb
    }
    return undefined
  }
  if (!opts?.noEngineSend) {
    preload.functions.engineSend = s => {
      sent.push(s)
    }
  }
  const connected = jest.fn()
  const disconnected = jest.fn()
  const client = createClient(opts?.incoming ?? (() => {}), connected, disconnected)
  const fromRelay = (data: Uint8Array | EngineLinkFrame) => incoming?.(undefined, data)
  return {client, connected, disconnected, fromRelay, sent}
}
const up = (epoch: number): EngineLinkFrame => ({epoch, type: 'link', up: true})
const down = (epoch: number): EngineLinkFrame => ({epoch, type: 'link', up: false})
const disconnectError = {code: rpcErrors.EOF, desc: 'The service connection was lost', name: 'EOF'}

afterEach(() => {
  const {functions} = getPreload()
  delete functions.engineRestartLink
  delete functions.engineSend
  delete functions.ipcRendererOn
})

test('a missing engineSend fails the write instead of silently no-oping', () => {
  const {client, fromRelay} = makeRendererClient({noEngineSend: true})
  fromRelay(up(1))

  const ok = client.transport.send([1, 3, null, {}])

  expect(ok).toBe(false)
})

test('calls made before the first link-up wait for it, then go out stamped with that link', () => {
  const {client, fromRelay, sent} = makeRendererClient()
  client.invoke('keybase.1.test.hello', [{}], () => {})
  expect(sent).toEqual([])

  fromRelay(up(3))

  expect(sent.map(s => [s.epoch, s.message[2]])).toEqual([[3, 'keybase.1.test.hello']])
})

test('each link change reaches the engine once, and a replayed or stale frame is ignored', () => {
  const {connected, disconnected, fromRelay} = makeRendererClient()
  fromRelay(down(0))
  fromRelay(up(1))
  fromRelay(up(1))
  fromRelay(down(0))
  expect(connected).toHaveBeenCalledTimes(1)
  expect(disconnected).not.toHaveBeenCalled()

  fromRelay(down(1))
  fromRelay(down(1))
  fromRelay(up(2))

  expect(connected).toHaveBeenCalledTimes(2)
  expect(disconnected).toHaveBeenCalledTimes(1)
})

test('a link-up for a new connection while the old one is up takes the old one down first', () => {
  const {connected, disconnected, fromRelay} = makeRendererClient()
  fromRelay(up(1))
  fromRelay(up(2))
  expect(connected).toHaveBeenCalledTimes(2)
  expect(disconnected).toHaveBeenCalledTimes(1)
})

test('service bytes are read only while the link is up', () => {
  const incoming = jest.fn()
  const {fromRelay} = makeRendererClient({incoming})
  const notify = encodeFrame([2, 'keybase.1.test.notify', [{}]])
  fromRelay(up(1))

  fromRelay(down(1))
  fromRelay(notify)
  expect(incoming).not.toHaveBeenCalled()

  fromRelay(up(2))
  fromRelay(notify)
  expect(incoming).toHaveBeenCalledTimes(1)
})

test('a link drop discards a partly delivered frame', () => {
  const incoming = jest.fn()
  const {fromRelay} = makeRendererClient({incoming})
  const notify = encodeFrame([2, 'keybase.1.test.notify', [{n: 1}]])
  fromRelay(up(1))

  fromRelay(notify.subarray(0, 3))
  fromRelay(down(1))
  fromRelay(up(2))
  fromRelay(notify)

  expect(incoming).toHaveBeenCalledTimes(1)
  expect(incoming).toHaveBeenCalledWith({method: 'keybase.1.test.notify', param: [{n: 1}]})
})

test('a link drop fails the calls in flight on it once, before the engine hears', () => {
  const calls = new Array<string>()
  const {client, disconnected, fromRelay} = makeRendererClient()
  disconnected.mockImplementation(() => calls.push('engine told'))
  fromRelay(up(1))
  const cb = jest.fn(() => calls.push('call failed'))
  client.invoke('keybase.1.test.hello', [{}], cb)

  fromRelay(down(1))
  fromRelay(down(1))
  fromRelay(up(2))

  expect(cb).toHaveBeenCalledTimes(1)
  expect(cb).toHaveBeenCalledWith(disconnectError, {})
  expect(calls).toEqual(['call failed', 'engine told'])
})

test('a service restarting twice before the renderer hears the first drop fails the call once', () => {
  const {client, fromRelay, sent} = makeRendererClient()
  fromRelay(up(1))
  const cb = jest.fn()
  client.invoke('keybase.1.test.hello', [{}], cb)

  // The renderer never hears epoch 2's own link frames, only that 3 is up
  fromRelay(up(3))
  fromRelay(down(3))
  fromRelay(up(4))

  expect(cb).toHaveBeenCalledTimes(1)
  expect(cb).toHaveBeenCalledWith(disconnectError, {})
  expect(sent.map(s => s.epoch)).toEqual([1])
})

test('after the first link-up, a call made while the link is down is refused at once and never sent', () => {
  const {client, fromRelay, sent} = makeRendererClient()
  fromRelay(up(1))
  fromRelay(down(1))
  const cb = jest.fn()

  client.invoke('keybase.1.test.hello', [{}], cb)
  expect(cb).toHaveBeenCalledTimes(1)
  expect(cb).toHaveBeenCalledWith(disconnectError, {})

  fromRelay(up(2))
  expect(sent).toEqual([])
})

test('at boot a replayed link-down does not refuse a call waiting for the first link-up', () => {
  const {client, fromRelay, sent} = makeRendererClient()
  const cb = jest.fn()
  fromRelay(down(0))
  client.invoke('keybase.1.test.hello', [{}], cb)
  fromRelay(down(0))
  expect(cb).not.toHaveBeenCalled()

  fromRelay(up(1))
  expect(sent.map(s => [s.epoch, s.message[2]])).toEqual([[1, 'keybase.1.test.hello']])
})

test('an answer to the service made while the link is down goes to no later link', () => {
  let payload: Parameters<IncomingRPCCallbackType>[0] | undefined
  const {fromRelay, sent} = makeRendererClient({
    incoming: p => {
      payload = p
    },
  })
  fromRelay(up(1))
  fromRelay(encodeFrame([0, 9, 'keybase.1.test.prompt', [{}]]))
  fromRelay(down(1))

  payload?.response?.result?.({answer: true})
  fromRelay(up(2))

  expect(sent).toEqual([])
})

test('an answer to a call from an earlier link, made once a new link is up, is not written to it', () => {
  let payload: Parameters<IncomingRPCCallbackType>[0] | undefined
  const {fromRelay, sent} = makeRendererClient({
    incoming: p => {
      payload = p
    },
  })
  fromRelay(up(1))
  fromRelay(encodeFrame([0, 9, 'keybase.1.test.prompt', [{}]]))
  fromRelay(down(1))
  fromRelay(up(2))

  payload?.response?.result?.({answer: true})

  expect(sent).toEqual([])
})

test('reset asks the relay to restart the link, and the link frames, not the reset, fail what is in flight', () => {
  const {client, fromRelay, sent} = makeRendererClient()
  const restarts = jest.fn()
  getPreload().functions.engineRestartLink = restarts
  fromRelay(up(1))
  const cb = jest.fn()
  client.invoke('keybase.1.test.hello', [{}], cb)

  client.transport.reset()
  expect(restarts).toHaveBeenCalledTimes(1)
  expect(cb).not.toHaveBeenCalled()

  fromRelay(down(1))
  fromRelay(up(2))
  expect(cb).toHaveBeenCalledTimes(1)
  expect(cb).toHaveBeenCalledWith(disconnectError, {})

  // A reply for the old seqid arriving later is dropped, not delivered to the already-failed callback
  const seqid = sent[0]!.message[1] as number
  client.transport.dispatchDecodedMessage([1, seqid, null, {ok: 'late'}])
  expect(cb).toHaveBeenCalledTimes(1)
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
