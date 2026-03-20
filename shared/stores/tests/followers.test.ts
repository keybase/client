import {resetAllStores} from '@/util/zustand'
import {useFollowerState} from '../followers'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('followers and following sets update independently', () => {
  const store = useFollowerState

  store.getState().dispatch.updateFollowers('alice', true)
  store.getState().dispatch.updateFollowing('bob', true)
  store.getState().dispatch.updateFollowers('alice', false)

  expect(store.getState().followers.has('alice')).toBe(false)
  expect(store.getState().following.has('bob')).toBe(true)
})

test('replace overwrites both sets and resetAllStores clears them again', () => {
  const store = useFollowerState

  store.getState().dispatch.replace(new Set(['alice']), new Set(['bob']))
  expect(store.getState().followers).toEqual(new Set(['alice']))
  expect(store.getState().following).toEqual(new Set(['bob']))

  resetAllStores()

  expect(store.getState().followers).toEqual(new Set())
  expect(store.getState().following).toEqual(new Set())
})
