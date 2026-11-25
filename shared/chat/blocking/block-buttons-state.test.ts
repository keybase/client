/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import {useBlockButtonsState} from './block-buttons-state'

const state = () => useBlockButtonsState.getState()

afterEach(() => {
  resetAllStores()
})

test('prefs mark the store loaded, and a reset forgets it', () => {
  expect(state().loaded).toBe(false)
  state().dispatch.updateFromPrefs({allowAnimatedEmojis: true, blockButtonsAdders: null})
  expect(state().loaded).toBe(true)
  state().dispatch.resetState()
  expect(state().loaded).toBe(false)
})
