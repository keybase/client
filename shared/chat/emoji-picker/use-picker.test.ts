/// <reference types="jest" />
import {resetAllStores} from '@/util/zustand'
import {usePickerState} from './use-picker'

const pick = (emojiStr: string) => ({
  emojiStr,
  renderableEmoji: {renderStock: emojiStr, unicodeStock: emojiStr},
})

const state = () => usePickerState.getState()

afterEach(() => {
  resetAllStores()
})

test('nothing is waiting for a screen that never asked', () => {
  expect(state().pickerMap.get('reaction')).toBeUndefined()
})

test('each pick key has its own mailbox', () => {
  state().dispatch.updatePickerMap('reaction', pick(':+1:'))
  expect(state().pickerMap.get('reaction')?.emojiStr).toBe(':+1:')
  expect(state().pickerMap.get('chatInput')).toBeUndefined()

  state().dispatch.updatePickerMap('chatInput', pick(':wave:'))
  expect(state().pickerMap.get('reaction')?.emojiStr).toBe(':+1:')
  expect(state().pickerMap.get('chatInput')?.emojiStr).toBe(':wave:')
})

test('a consumer clears its own key so the pick is not replayed', () => {
  state().dispatch.updatePickerMap('addAlias', pick(':fire:'))
  state().dispatch.updatePickerMap('addAlias', undefined)
  expect(state().pickerMap.get('addAlias')).toBeUndefined()
  // the key stays in the map as an explicit empty mailbox
  expect(state().pickerMap.has('addAlias')).toBe(true)
})

test('a newer pick replaces an unread one', () => {
  state().dispatch.updatePickerMap('reaction', pick(':+1:'))
  state().dispatch.updatePickerMap('reaction', pick(':-1:'))
  expect(state().pickerMap.get('reaction')?.emojiStr).toBe(':-1:')
})

test('signing out empties every mailbox', () => {
  state().dispatch.updatePickerMap('reaction', pick(':+1:'))
  state().dispatch.updatePickerMap('chatInput', pick(':wave:'))
  resetAllStores()
  expect(state().pickerMap.size).toBe(0)
})
