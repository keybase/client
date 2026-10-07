/// <reference types="jest" />
import {RPCError} from '../../util/errors'
import {resetAllStores} from '../../util/zustand'
import {holdWaiting, useWaitingState, withWaiting} from '../waiting'
import logger from '../../logger'
import {testWaitingKey} from '../../test/waiting-key'

// Each test its own key: resetAllStores keeps counts by design
const k = {
  load: testWaitingKey('load'),
  other: testWaitingKey('other'),
  a: testWaitingKey('a'),
  b: testWaitingKey('b'),
  c: testWaitingKey('c'),
  load1: testWaitingKey('load1'),
  load2: testWaitingKey('load2'),
  load3: testWaitingKey('load3'),
  load4: testWaitingKey('load4'),
  load5: testWaitingKey('load5'),
  load6: testWaitingKey('load6'),
  load7: testWaitingKey('load7'),
}

afterEach(() => {
  resetAllStores()
})

test('waiting counts and errors track increments, decrements, and clears', () => {
  const {dispatch} = useWaitingState.getState()
  const error = new RPCError('boom', 7)

  dispatch.increment(k.load)
  expect((useWaitingState.getState().counts.get(k.load) ?? 0) > 0).toBe(true)
  expect((useWaitingState.getState().counts.get(k.other) ?? 0) > 0).toBe(false)

  dispatch.decrement(k.load, error)
  expect((useWaitingState.getState().counts.get(k.load) ?? 0) > 0).toBe(false)
  expect(useWaitingState.getState().errors.get(k.load)).toBe(error)

  dispatch.clear(k.load)
  expect(useWaitingState.getState().errors.get(k.load)).toBeUndefined()
})

test('batch applies a mixed waiting update set', () => {
  const {dispatch} = useWaitingState.getState()

  dispatch.batch([
    {increment: true, key: k.a},
    {increment: true, key: [k.b, k.c]},
    {increment: false, key: k.a},
  ])

  expect((useWaitingState.getState().counts.get(k.a) ?? 0) > 0).toBe(false)
  expect((useWaitingState.getState().counts.get(k.b) ?? 0) > 0).toBe(true)
  expect((useWaitingState.getState().counts.get(k.c) ?? 0) > 0).toBe(true)
})

test('a logout keeps in-flight counts so the calls that end afterwards bring them back to zero', () => {
  const {dispatch} = useWaitingState.getState()
  const error = new RPCError('boom', 7)
  dispatch.increment(k.load)
  dispatch.decrement(k.other, error)

  resetAllStores()

  expect(useWaitingState.getState().errors.get(k.other)).toBeUndefined()
  expect(useWaitingState.getState().counts.get(k.load)).toBe(1)
  dispatch.decrement(k.load)
  expect(useWaitingState.getState().counts.get(k.load)).toBeUndefined()
})

test('a release with nothing held never leaves a negative count, and says so in a dev build', () => {
  const dev = __DEV__
  global.__DEV__ = true
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const {dispatch} = useWaitingState.getState()
  dispatch.decrement(k.load1)
  expect(useWaitingState.getState().counts.get(k.load1)).toBeUndefined()
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('load1'))
  dispatch.increment(k.load1)
  expect(useWaitingState.getState().counts.get(k.load1)).toBe(1)
  dispatch.decrement(k.load1)
  expect(useWaitingState.getState().counts.get(k.load1)).toBeUndefined()
  warn.mockRestore()
  global.__DEV__ = dev
})

test('clearErrors drops the error and keeps the count', () => {
  const {dispatch} = useWaitingState.getState()
  const error = new RPCError('boom', 7)
  dispatch.increment(k.load2)
  dispatch.increment(k.load2)
  dispatch.decrement(k.load2, error)
  dispatch.clearErrors([k.load2])
  expect(useWaitingState.getState().errors.get(k.load2)).toBeUndefined()
  expect(useWaitingState.getState().counts.get(k.load2)).toBe(1)
})

test('an error-only batch entry records the error and leaves the count', () => {
  const {dispatch} = useWaitingState.getState()
  const error = new RPCError('boom', 7)
  dispatch.increment(k.load3)
  dispatch.batch([{error, key: k.load3}])
  expect(useWaitingState.getState().errors.get(k.load3)).toBe(error)
  expect(useWaitingState.getState().counts.get(k.load3)).toBe(1)
})

test('holdWaiting holds the key until its release, which runs once', () => {
  const a = holdWaiting(k.load4)
  const b = holdWaiting(k.load4)
  expect(useWaitingState.getState().counts.get(k.load4)).toBe(2)
  a()
  a()
  expect(useWaitingState.getState().counts.get(k.load4)).toBe(1)
  b()
  expect(useWaitingState.getState().counts.get(k.load4)).toBeUndefined()
})

test('withWaiting holds the key while its work runs, however it ends', async () => {
  let during: number | undefined
  await expect(
    withWaiting(k.load5, async () => {
      during = useWaitingState.getState().counts.get(k.load5)
      return Promise.resolve(3)
    })
  ).resolves.toBe(3)
  expect(during).toBe(1)
  expect(useWaitingState.getState().counts.get(k.load5)).toBeUndefined()
  await expect(
    withWaiting(k.load5, async () => Promise.reject(new Error('broke')))
  ).rejects.toThrow('broke')
  expect(useWaitingState.getState().counts.get(k.load5)).toBeUndefined()
})

test('a batch lands as one store update', () => {
  const updates = jest.fn()
  const unsubscribe = useWaitingState.subscribe(updates)
  useWaitingState.getState().dispatch.batch([
    {increment: true, key: k.load6},
    {increment: false, key: k.load6},
    {increment: true, key: k.load7},
  ])
  unsubscribe()
  expect(updates).toHaveBeenCalledTimes(1)
  expect(useWaitingState.getState().counts.get(k.load6)).toBeUndefined()
  expect(useWaitingState.getState().counts.get(k.load7)).toBe(1)
})
