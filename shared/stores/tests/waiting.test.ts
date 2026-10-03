/// <reference types="jest" />
import {RPCError} from '../../util/errors'
import {resetAllStores} from '../../util/zustand'
import {holdWaiting, useWaitingState, withWaiting} from '../waiting'
import logger from '../../logger'
import {testWaitingKey} from '../../test/waiting-key'

afterEach(() => {
  resetAllStores()
})

test('waiting counts and errors track increments, decrements, and clears', () => {
  const {dispatch} = useWaitingState.getState()
  const error = new RPCError('boom', 7)

  dispatch.increment(testWaitingKey('load'))
  expect((useWaitingState.getState().counts.get('load') ?? 0) > 0).toBe(true)
  expect((useWaitingState.getState().counts.get('other') ?? 0) > 0).toBe(false)

  dispatch.decrement(testWaitingKey('load'), error)
  expect((useWaitingState.getState().counts.get('load') ?? 0) > 0).toBe(false)
  expect(useWaitingState.getState().errors.get('load')).toBe(error)

  dispatch.clear(testWaitingKey('load'))
  expect(useWaitingState.getState().errors.get('load')).toBeUndefined()
})

test('batch applies a mixed waiting update set', () => {
  const {dispatch} = useWaitingState.getState()

  dispatch.batch([
    {increment: true, key: testWaitingKey('a')},
    {increment: true, key: [testWaitingKey('b'), testWaitingKey('c')]},
    {increment: false, key: testWaitingKey('a')},
  ])

  expect((useWaitingState.getState().counts.get('a') ?? 0) > 0).toBe(false)
  expect((useWaitingState.getState().counts.get('b') ?? 0) > 0).toBe(true)
  expect((useWaitingState.getState().counts.get('c') ?? 0) > 0).toBe(true)
})

test('a logout keeps in-flight counts so the calls that end afterwards bring them back to zero', () => {
  const {dispatch} = useWaitingState.getState()
  const error = new RPCError('boom', 7)
  dispatch.increment(testWaitingKey('load'))
  dispatch.decrement(testWaitingKey('other'), error)

  resetAllStores()

  expect(useWaitingState.getState().errors.get('other')).toBeUndefined()
  expect(useWaitingState.getState().counts.get('load')).toBe(1)
  dispatch.decrement(testWaitingKey('load'))
  expect(useWaitingState.getState().counts.get('load')).toBeUndefined()
})

test('a release with nothing held never leaves a negative count, and says so in a dev build', () => {
  const dev = __DEV__
  global.__DEV__ = true
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const {dispatch} = useWaitingState.getState()
  dispatch.decrement(testWaitingKey('load1'))
  expect(useWaitingState.getState().counts.get('load1')).toBeUndefined()
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('load1'))
  dispatch.increment(testWaitingKey('load1'))
  expect(useWaitingState.getState().counts.get('load1')).toBe(1)
  dispatch.decrement(testWaitingKey('load1'))
  expect(useWaitingState.getState().counts.get('load1')).toBeUndefined()
  warn.mockRestore()
  global.__DEV__ = dev
})

test('clearErrors drops the error and keeps the count', () => {
  const {dispatch} = useWaitingState.getState()
  const error = new RPCError('boom', 7)
  dispatch.increment(testWaitingKey('load2'))
  dispatch.increment(testWaitingKey('load2'))
  dispatch.decrement(testWaitingKey('load2'), error)
  dispatch.clearErrors([testWaitingKey('load2')])
  expect(useWaitingState.getState().errors.get('load2')).toBeUndefined()
  expect(useWaitingState.getState().counts.get('load2')).toBe(1)
})

test('an error-only batch entry records the error and leaves the count', () => {
  const {dispatch} = useWaitingState.getState()
  const error = new RPCError('boom', 7)
  dispatch.increment(testWaitingKey('load3'))
  dispatch.batch([{error, key: testWaitingKey('load3')}])
  expect(useWaitingState.getState().errors.get('load3')).toBe(error)
  expect(useWaitingState.getState().counts.get('load3')).toBe(1)
})

test('holdWaiting holds the key until its release, which runs once', () => {
  const a = holdWaiting(testWaitingKey('load4'))
  const b = holdWaiting(testWaitingKey('load4'))
  expect(useWaitingState.getState().counts.get('load4')).toBe(2)
  a()
  a()
  expect(useWaitingState.getState().counts.get('load4')).toBe(1)
  b()
  expect(useWaitingState.getState().counts.get('load4')).toBeUndefined()
})

test('withWaiting holds the key while its work runs, however it ends', async () => {
  let during: number | undefined
  await expect(
    withWaiting(testWaitingKey('load5'), async () => {
      during = useWaitingState.getState().counts.get('load5')
      return Promise.resolve(3)
    })
  ).resolves.toBe(3)
  expect(during).toBe(1)
  expect(useWaitingState.getState().counts.get('load5')).toBeUndefined()
  await expect(
    withWaiting(testWaitingKey('load5'), async () => Promise.reject(new Error('broke')))
  ).rejects.toThrow('broke')
  expect(useWaitingState.getState().counts.get('load5')).toBeUndefined()
})

test('a batch lands as one store update', () => {
  const updates = jest.fn()
  const unsubscribe = useWaitingState.subscribe(updates)
  useWaitingState.getState().dispatch.batch([
    {increment: true, key: testWaitingKey('load6')},
    {increment: false, key: testWaitingKey('load6')},
    {increment: true, key: testWaitingKey('load7')},
  ])
  unsubscribe()
  expect(updates).toHaveBeenCalledTimes(1)
  expect(useWaitingState.getState().counts.get('load6')).toBeUndefined()
  expect(useWaitingState.getState().counts.get('load7')).toBe(1)
})
