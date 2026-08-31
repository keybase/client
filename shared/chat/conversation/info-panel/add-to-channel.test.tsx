/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {addMembersToChannel} from './add-to-channel'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

afterEach(() => {
  jest.restoreAllMocks()
})

test('adding members refreshes the conversation participants', async () => {
  jest.spyOn(T.RPCChat, 'localBulkAddToConvRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  await addMembersToChannel(conversationIDKey, ['testuser', 'testuser-mac'])

  expect(T.RPCChat.localBulkAddToConvRpcPromise).toHaveBeenCalledWith({
    convID,
    usernames: ['testuser', 'testuser-mac'],
  })
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledWith({convID})
})

test('a failed add never claims the participants are fresh', async () => {
  jest.spyOn(T.RPCChat, 'localBulkAddToConvRpcPromise').mockRejectedValue(new Error('nope'))
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  await expect(addMembersToChannel(conversationIDKey, ['testuser'])).rejects.toThrow('nope')
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
})

test('a failed refresh does not fail the add', async () => {
  jest.spyOn(T.RPCChat, 'localBulkAddToConvRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockRejectedValue(new Error('offline'))

  await expect(addMembersToChannel(conversationIDKey, ['testuser'])).resolves.toBeUndefined()
})
