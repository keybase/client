/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {addTeamMemberAfterReset} from './reset-user'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

let engine: FakeEngine
let onAdd: () => void = () => {}

beforeEach(() => {
  onAdd = () => {}
  engine = installFakeEngine({
    'chat.1.local.addTeamMemberAfterReset': () => {
      onAdd()
    },
    'chat.1.local.refreshParticipants': () => {},
  })
})

afterEach(() => {
  engine.uninstall()
  jest.restoreAllMocks()
})

test('letting a reset user back in refreshes the conversation participants', async () => {
  await addTeamMemberAfterReset(conversationIDKey, 'testuser')

  expect(engine.calls('chat.1.local.addTeamMemberAfterReset')).toEqual([
    {method: 'chat.1.local.addTeamMemberAfterReset', params: {convID, username: 'testuser'}},
  ])
  expect(engine.calls('chat.1.local.refreshParticipants')).toEqual([
    {method: 'chat.1.local.refreshParticipants', params: {convID}},
  ])
})

test('a failed re-add never claims the participants are fresh', async () => {
  onAdd = () => {
    throw new Error('still reset')
  }

  await expect(addTeamMemberAfterReset(conversationIDKey, 'testuser')).rejects.toThrow('still reset')
  expect(engine.callCount('chat.1.local.refreshParticipants')).toBe(0)
})
