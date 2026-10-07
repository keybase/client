/// <reference types="jest" />
import {EventEmitter} from 'events'
import {decodeMulti} from '@msgpack/msgpack'
import logger from '@/logger'
import {EngineRelay} from './engine-relay.desktop'
import type {EngineLinkFrame} from '@/util/electron'

class MockSocket extends EventEmitter {
  written = new Array<Uint8Array>()
  destroyed = false
  write(b: Uint8Array) {
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

const socket = (i: number) => {
  const s = mockSockets[i]
  if (!s) throw new Error(`relay never opened socket ${i}`)
  return s
}
const methodsWritten = (s: MockSocket) =>
  [...decodeMulti(Buffer.concat(s.written))].filter(m => Array.isArray(m)).map(m => (m as Array<unknown>)[2])
const up = (epoch: number): EngineLinkFrame => ({epoch, type: 'link', up: true})
const down = (epoch: number): EngineLinkFrame => ({epoch, type: 'link', up: false})
const call = (method: string) => [0, 1, method, [{}]] as [number, ...Array<unknown>]

let toRenderer: Array<Uint8Array | EngineLinkFrame>
const makeRelay = () => {
  toRenderer = []
  return new EngineRelay(d => toRenderer.push(d))
}

beforeEach(() => {
  jest.useFakeTimers()
  mockSockets.length = 0
})
afterEach(() => {
  jest.useRealTimers()
})

test('service bytes, a link drop and the reconnect reach the renderer in that order', () => {
  makeRelay()
  socket(0).emit('connect')
  socket(0).emit('data', Buffer.from([1, 2, 3]))
  socket(0).emit('close')
  jest.advanceTimersByTime(1000)
  socket(1).emit('connect')
  expect(toRenderer).toEqual([up(1), new Uint8Array([1, 2, 3]), down(1), up(2)])
})

test('a failed connect is retried and sends the renderer nothing until it connects', () => {
  makeRelay()
  socket(0).emit('error', new Error('no service'))
  socket(0).emit('close')
  expect(toRenderer).toEqual([])
  jest.advanceTimersByTime(1000)
  socket(1).emit('connect')
  expect(toRenderer).toEqual([up(1)])
})

test('a send is written only when stamped with the connection that is up now', () => {
  const relay = makeRelay()
  socket(0).emit('connect')
  relay.send({epoch: 1, message: call('first')})
  socket(0).emit('close')
  relay.send({epoch: 1, message: call('whileDown')})
  jest.advanceTimersByTime(1000)
  socket(1).emit('connect')
  relay.send({epoch: 1, message: call('stale')})
  relay.send({epoch: 2, message: call('second')})
  expect(methodsWritten(socket(0))).toEqual(['first'])
  expect(methodsWritten(socket(1))).toEqual(['second'])
})

test('a renderer start replays the current link state', () => {
  const relay = makeRelay()
  relay.replayLinkState()
  socket(0).emit('connect')
  relay.replayLinkState()
  expect(toRenderer).toEqual([down(0), up(1), up(1)])
})

test('a renderer reload gets a fresh connection, and the old renderer’s sends are dropped', () => {
  const relay = makeRelay()
  socket(0).emit('connect')
  relay.restartLink()
  expect(socket(0).destroyed).toBe(true)
  socket(1).emit('connect')
  relay.send({epoch: 1, message: call('oldRenderer')})
  relay.send({epoch: 2, message: call('newRenderer')})
  expect(toRenderer).toEqual([up(1), down(1), up(2)])
  expect(methodsWritten(socket(0))).toEqual([])
  expect(methodsWritten(socket(1))).toEqual(['newRenderer'])
})

test('a renderer engine reset drops the connection and reconnects only after the delay', () => {
  const relay = makeRelay()
  socket(0).emit('connect')
  relay.restartLink({afterDelay: true})
  expect(socket(0).destroyed).toBe(true)
  expect(mockSockets).toHaveLength(1)
  jest.advanceTimersByTime(1000)
  socket(1).emit('connect')
  expect(toRenderer).toEqual([up(1), down(1), up(2)])
})

test('an engine reset drops the link and never reconnects, until a renderer reload restarts it', () => {
  const relay = makeRelay()
  socket(0).emit('connect')
  relay.dropLink()
  expect(socket(0).destroyed).toBe(true)
  jest.advanceTimersByTime(60000)
  expect(mockSockets).toHaveLength(1)
  expect(toRenderer).toEqual([up(1), down(1)])
  relay.restartLink()
  expect(mockSockets).toHaveLength(2)
  socket(1).emit('connect')
  expect(toRenderer).toEqual([up(1), down(1), down(1), up(2)])
})

test('a drop while a reconnect is pending or connecting leaves the link down', () => {
  const relay = makeRelay()
  socket(0).emit('connect')
  socket(0).emit('close')
  relay.dropLink()
  jest.advanceTimersByTime(60000)
  expect(mockSockets).toHaveLength(1)
  relay.restartLink()
  relay.dropLink()
  socket(1).emit('connect')
  expect(socket(1).destroyed).toBe(true)
  jest.advanceTimersByTime(60000)
  expect(mockSockets).toHaveLength(2)
})

test('a renderer reload while the service is down replays the down state and keeps retrying', () => {
  const relay = makeRelay()
  socket(0).emit('connect')
  socket(0).emit('close')
  relay.restartLink()
  jest.advanceTimersByTime(1000)
  socket(1).emit('connect')
  expect(toRenderer).toEqual([up(1), down(1), down(1), up(2)])
})

test('bytes still arriving from a replaced connection never reach the renderer', () => {
  const relay = makeRelay()
  socket(0).emit('connect')
  relay.restartLink()
  socket(1).emit('connect')
  socket(0).emit('data', Buffer.from([9, 9]))
  socket(1).emit('data', Buffer.from([1]))
  expect(toRenderer).toEqual([up(1), down(1), up(2), new Uint8Array([1])])
})

test('a send whose write throws restarts the link, so the renderer hears the drop', () => {
  const relay = makeRelay()
  socket(0).emit('connect')
  socket(0).write = () => {
    throw new Error('write after end')
  }
  const logged = jest.spyOn(logger, 'error').mockImplementation(() => {})
  try {
    expect(() => relay.send({epoch: 1, message: call('lost')})).not.toThrow()
    expect(logged).toHaveBeenCalledTimes(1)
  } finally {
    logged.mockRestore()
  }
  expect(socket(0).destroyed).toBe(true)
  jest.advanceTimersByTime(1000)
  socket(1).emit('connect')
  expect(toRenderer).toEqual([up(1), down(1), up(2)])
})

test('a send that is not an epoch-stamped rpc message is dropped without throwing', () => {
  const relay = makeRelay()
  socket(0).emit('connect')
  for (const bad of [undefined, null, 'x', {epoch: 1}, {message: call('noEpoch')}, {epoch: 1, message: 'x'}]) {
    expect(() => relay.send(bad)).not.toThrow()
  }
  relay.send({epoch: 1, message: call('good')})
  expect(methodsWritten(socket(0))).toEqual(['good'])
})
