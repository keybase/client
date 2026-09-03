/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import logger from '@/logger'
import {consumeInputIntent, setInputIntent, useInputIntentState} from './input-intent-store'

const convX = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convY = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const inputProviderTypes = ['injectText', 'setEditing', 'setReplyTo', 'commandStatus'] as const

afterEach(() => {
  resetAllStores()
  jest.restoreAllMocks()
})

test('write then consume', () => {
  const ordinal = T.Chat.numberToOrdinal(1)
  setInputIntent(convX, {type: 'setEditing', ordinal})
  expect(consumeInputIntent(convX, inputProviderTypes)).toEqual({type: 'setEditing', ordinal})
})

test('consume deletes', () => {
  const ordinal = T.Chat.numberToOrdinal(1)
  setInputIntent(convX, {type: 'setEditing', ordinal})
  consumeInputIntent(convX, inputProviderTypes)
  expect(consumeInputIntent(convX, inputProviderTypes)).toBeUndefined()
  expect(useInputIntentState.getState().intents.has(convX)).toBe(false)
})

test('keying isolation', () => {
  const ordinal = T.Chat.numberToOrdinal(1)
  setInputIntent(convX, {type: 'setEditing', ordinal})
  expect(consumeInputIntent(convY, inputProviderTypes)).toBeUndefined()
  expect(consumeInputIntent(convX, inputProviderTypes)).toEqual({type: 'setEditing', ordinal})
})

test('type filter isolates highlight from the input-provider consumer', () => {
  const messageID = T.Chat.numberToMessageID(1)
  setInputIntent(convX, {type: 'highlight', messageID})
  expect(consumeInputIntent(convX, inputProviderTypes)).toBeUndefined()
  expect(useInputIntentState.getState().intents.get(convX)).toEqual({type: 'highlight', messageID})
  expect(consumeInputIntent(convX, ['highlight'])).toEqual({type: 'highlight', messageID})
})

test('last write wins', () => {
  const ordinal1 = T.Chat.numberToOrdinal(1)
  const ordinal2 = T.Chat.numberToOrdinal(2)
  setInputIntent(convX, {type: 'setEditing', ordinal: ordinal1})
  setInputIntent(convX, {type: 'setEditing', ordinal: ordinal2})
  expect(consumeInputIntent(convX, inputProviderTypes)).toEqual({type: 'setEditing', ordinal: ordinal2})
})

test('commandStatus drops with no subscriber', () => {
  jest.spyOn(logger, 'error').mockImplementation(() => {})
  setInputIntent(convX, {type: 'commandStatus', info: undefined})
  expect(useInputIntentState.getState().intents.has(convX)).toBe(false)
  expect(logger.error).toHaveBeenCalled()
})

test('commandStatus delivers with a subscriber', () => {
  jest.spyOn(logger, 'error').mockImplementation(() => {})
  let delivered: unknown
  const unsubscribe = useInputIntentState.subscribe(state => {
    if (state.intents.has(convX)) {
      delivered = consumeInputIntent(convX, inputProviderTypes)
    }
  })
  setInputIntent(convX, {type: 'commandStatus', info: undefined})
  unsubscribe()
  expect(delivered).toEqual({type: 'commandStatus', info: undefined})
  expect(logger.error).not.toHaveBeenCalled()
})

test('durable intents survive no subscriber', () => {
  setInputIntent(convX, {type: 'injectText', text: 'hello'})
  expect(useInputIntentState.getState().intents.get(convX)).toEqual({type: 'injectText', text: 'hello'})
})

test('resetState clears', () => {
  const ordinal = T.Chat.numberToOrdinal(1)
  setInputIntent(convX, {type: 'setEditing', ordinal})
  setInputIntent(convY, {type: 'setReplyTo', ordinal})
  useInputIntentState.getState().dispatch.resetState()
  expect(useInputIntentState.getState().intents.size).toBe(0)
})
