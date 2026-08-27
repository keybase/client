/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {setConversationOrangeLine, useExplicitOrangeLineState} from './orange-line-context'

const conversationIDKey = T.Chat.stringToConversationIDKey('conv1')
const otherConversationIDKey = T.Chat.stringToConversationIDKey('conv2')
const ordinal = (n: number) => T.Chat.numberToOrdinal(n)

const updates = () => useExplicitOrangeLineState.getState().updates

afterEach(() => {
  resetAllStores()
})

test('records the requested ordinal for the conversation', () => {
  setConversationOrangeLine(conversationIDKey, ordinal(5))
  expect(updates().get(conversationIDKey)?.ordinal).toBe(5)
})

test('ignores invalid conversations and the zero ordinal', () => {
  setConversationOrangeLine(T.Chat.noConversationIDKey, ordinal(5))
  setConversationOrangeLine(conversationIDKey, ordinal(0))
  expect(updates().size).toBe(0)
})

test('every set bumps the version so a repeat of the same ordinal still applies', () => {
  setConversationOrangeLine(conversationIDKey, ordinal(5))
  const first = updates().get(conversationIDKey)
  setConversationOrangeLine(conversationIDKey, ordinal(5))
  const second = updates().get(conversationIDKey)
  expect(second?.ordinal).toBe(5)
  expect(second?.version).toBeGreaterThan(first?.version ?? 0)
})

test('versions are global so the newest request across conversations wins', () => {
  setConversationOrangeLine(conversationIDKey, ordinal(5))
  setConversationOrangeLine(otherConversationIDKey, ordinal(9))
  const a = updates().get(conversationIDKey)?.version ?? 0
  const b = updates().get(otherConversationIDKey)?.version ?? 0
  expect(b).toBeGreaterThan(a)
})

test('conversations keep separate marks', () => {
  setConversationOrangeLine(conversationIDKey, ordinal(5))
  setConversationOrangeLine(otherConversationIDKey, ordinal(9))
  expect(updates().get(conversationIDKey)?.ordinal).toBe(5)
  expect(updates().get(otherConversationIDKey)?.ordinal).toBe(9)
})

test('signing out clears the explicit marks', () => {
  setConversationOrangeLine(conversationIDKey, ordinal(5))
  resetAllStores()
  expect(updates().size).toBe(0)
})
