/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import logger from '@/logger'
import {
  consumeInputIntent,
  registerInputIntentConsumer,
  setInputIntent,
  useInputIntentState,
} from './input-intent-store'

const convX = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convY = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const inputProviderTypes = ['injectText', 'setEditing', 'setReplyTo', 'commandStatus'] as const

// The consumer registry is module state a provider owns for the life of its mount, so
// resetAllStores does not touch it. Nothing here mounts a provider, so unwind by hand.
const registrations = new Array<() => void>()
const register = (
  ...args: Parameters<typeof registerInputIntentConsumer<(typeof inputProviderTypes)[number]>>
) => {
  const unregister = registerInputIntentConsumer(...args)
  registrations.push(unregister)
  return unregister
}

afterEach(() => {
  registrations.splice(0).forEach(unregister => unregister())
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

test('commandStatus drops with no consumer registered', () => {
  jest.spyOn(logger, 'info').mockImplementation(() => {})
  jest.spyOn(logger, 'error').mockImplementation(() => {})
  setInputIntent(convX, {type: 'commandStatus', info: undefined})
  expect(useInputIntentState.getState().intents.has(convX)).toBe(false)
  expect(logger.info).toHaveBeenCalled()
  // an ordinary outcome of writing to a conversation nobody has open, not a fault
  expect(logger.error).not.toHaveBeenCalled()
})

// The freeze case, at the store's own level: a registered consumer that does NOT consume during
// the write still keeps its commandStatus. Delivery is not what proves a consumer is mounted -
// registration is - so a provider whose delivery is deferred does not lose the intent.
test('commandStatus is kept for a registered consumer that consumes nothing synchronously', () => {
  jest.spyOn(logger, 'error').mockImplementation(() => {})
  register(convX, inputProviderTypes)
  setInputIntent(convX, {type: 'commandStatus', info: undefined})
  expect(consumeInputIntent(convX, inputProviderTypes)).toEqual({type: 'commandStatus', info: undefined})
  expect(logger.error).not.toHaveBeenCalled()
})

test('unregistering a consumer restores the drop', () => {
  jest.spyOn(logger, 'info').mockImplementation(() => {})
  register(convX, inputProviderTypes)()
  setInputIntent(convX, {type: 'commandStatus', info: undefined})
  expect(useInputIntentState.getState().intents.has(convX)).toBe(false)
})

test('one of two consumers unmounting leaves the conversation registered', () => {
  const first = register(convX, inputProviderTypes)
  register(convX, inputProviderTypes)
  first()
  setInputIntent(convX, {type: 'commandStatus', info: undefined})
  expect(useInputIntentState.getState().intents.has(convX)).toBe(true)
})

test('a consumer registered for another conversation does not make this one deliverable', () => {
  jest.spyOn(logger, 'info').mockImplementation(() => {})
  register(convY, inputProviderTypes)
  setInputIntent(convX, {type: 'commandStatus', info: undefined})
  expect(useInputIntentState.getState().intents.has(convX)).toBe(false)
})

// A consumer only makes deliverable the types it claims, the same split consumeInputIntent
// enforces: ConversationCenterProvider being mounted must not vouch for the composer.
test('a consumer that does not claim commandStatus does not make it deliverable', () => {
  jest.spyOn(logger, 'info').mockImplementation(() => {})
  registrations.push(registerInputIntentConsumer(convX, ['highlight']))
  setInputIntent(convX, {type: 'commandStatus', info: undefined})
  expect(useInputIntentState.getState().intents.has(convX)).toBe(false)
})

// The mailbox holds one intent per conversation, so a drop that wrote first and deleted after
// took an unrelated durable intent down with it. A drop has to be a no-op.
test('a dropped commandStatus leaves a pending intent alone', () => {
  jest.spyOn(logger, 'info').mockImplementation(() => {})
  setInputIntent(convX, {type: 'injectText', text: 'still here'})
  setInputIntent(convX, {type: 'commandStatus', info: undefined})
  expect(consumeInputIntent(convX, inputProviderTypes)).toEqual({type: 'injectText', text: 'still here'})
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
