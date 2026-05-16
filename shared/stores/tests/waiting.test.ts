/// <reference types="jest" />
import {RPCError} from '../../util/errors'
import {resetAllStores} from '../../util/zustand'
import {useWaitingState} from '../waiting'

afterEach(() => {
  resetAllStores()
})

test('waiting counts and errors track increments, decrements, and clears', () => {
  const {dispatch} = useWaitingState.getState()
  const error = new RPCError('boom', 7)

  dispatch.increment('load')
  expect((useWaitingState.getState().counts.get('load') ?? 0) > 0).toBe(true)
  expect((useWaitingState.getState().counts.get('other') ?? 0) > 0).toBe(false)

  dispatch.decrement('load', error)
  expect((useWaitingState.getState().counts.get('load') ?? 0) > 0).toBe(false)
  expect(useWaitingState.getState().errors.get('load')).toBe(error)

  dispatch.clear('load')
  expect(useWaitingState.getState().errors.get('load')).toBeUndefined()
})

test('batch applies a mixed waiting update set', () => {
  const {dispatch} = useWaitingState.getState()

  dispatch.batch([
    {increment: true, key: 'a'},
    {increment: true, key: ['b', 'c']},
    {increment: false, key: 'a'},
  ])

  expect((useWaitingState.getState().counts.get('a') ?? 0) > 0).toBe(false)
  expect((useWaitingState.getState().counts.get('b') ?? 0) > 0).toBe(true)
  expect((useWaitingState.getState().counts.get('c') ?? 0) > 0).toBe(true)
})
