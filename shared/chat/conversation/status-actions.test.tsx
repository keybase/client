/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {joinConversation} from './status-actions'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

let engine: FakeEngine
let onJoin: () => void = () => {}

beforeEach(() => {
  onJoin = () => {}
  engine = installFakeEngine({
    'chat.1.local.joinConversationByIDLocal': () => {
      onJoin()
      return {} as never
    },
    'chat.1.local.refreshParticipants': () => {},
  })
})

afterEach(() => {
  engine.uninstall()
  jest.restoreAllMocks()
})

test('joining a conversation refreshes its participants', async () => {
  joinConversation(conversationIDKey)
  await flushPromises()

  expect(engine.calls('chat.1.local.joinConversationByIDLocal')).toEqual([
    {method: 'chat.1.local.joinConversationByIDLocal', params: {convID}},
  ])
  expect(engine.calls('chat.1.local.refreshParticipants')).toEqual([
    {method: 'chat.1.local.refreshParticipants', params: {convID}},
  ])
})

test('a failed join never claims the participants are fresh', async () => {
  onJoin = () => {
    throw new Error('cannot join')
  }

  joinConversation(conversationIDKey)
  await flushPromises()

  expect(engine.callCount('chat.1.local.refreshParticipants')).toBe(0)
})
