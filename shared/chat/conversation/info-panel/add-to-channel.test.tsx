/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {addMembersToChannel} from './add-to-channel'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

let engine: FakeEngine
let onBulkAdd: () => void = () => {}
let onRefresh: () => void = () => {}

beforeEach(() => {
  onBulkAdd = () => {}
  onRefresh = () => {}
  engine = installFakeEngine({
    'chat.1.local.bulkAddToConv': () => {
      onBulkAdd()
    },
    'chat.1.local.refreshParticipants': () => {
      onRefresh()
    },
  })
})

afterEach(() => {
  engine.uninstall()
  jest.restoreAllMocks()
})

test('adding members refreshes the conversation participants', async () => {
  await addMembersToChannel(conversationIDKey, ['testuser', 'testuser-mac'])

  expect(engine.calls('chat.1.local.bulkAddToConv')).toEqual([
    {method: 'chat.1.local.bulkAddToConv', params: {convID, usernames: ['testuser', 'testuser-mac']}},
  ])
  expect(engine.calls('chat.1.local.refreshParticipants')).toEqual([
    {method: 'chat.1.local.refreshParticipants', params: {convID}},
  ])
})

test('a failed add never claims the participants are fresh', async () => {
  onBulkAdd = () => {
    throw new Error('nope')
  }

  await expect(addMembersToChannel(conversationIDKey, ['testuser'])).rejects.toThrow('nope')
  expect(engine.callCount('chat.1.local.refreshParticipants')).toBe(0)
})

test('a failed refresh does not fail the add', async () => {
  onRefresh = () => {
    throw new Error('offline')
  }

  await expect(addMembersToChannel(conversationIDKey, ['testuser'])).resolves.toBeUndefined()
})
