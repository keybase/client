/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import {useBlockButtonsState} from './block-buttons-state'

const state = () => useBlockButtonsState.getState()

afterEach(() => {
  resetAllStores()
})

test('prefs index the adders by team and mark the store loaded', () => {
  expect(state().loaded).toBe(false)
  state().dispatch.updateFromPrefs({allowAnimatedEmojis: true, blockButtonsAdders: {t1: 'testuser-mac'}})
  expect(state().blockButtonsMap.get('t1')).toEqual({adder: 'testuser-mac'})
  expect(state().loaded).toBe(true)
})

test('a later push replaces the whole map, and a reset forgets it', () => {
  state().dispatch.updateFromPrefs({allowAnimatedEmojis: true, blockButtonsAdders: {t1: 'testuser-mac'}})
  state().dispatch.updateFromPrefs({allowAnimatedEmojis: true, blockButtonsAdders: null})
  expect(state().blockButtonsMap.size).toBe(0)
  expect(state().loaded).toBe(true)
  state().dispatch.resetState()
  expect(state().loaded).toBe(false)
})
