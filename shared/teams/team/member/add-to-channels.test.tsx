/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {addMembersToChannels} from './add-to-channels'

const convA = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convB = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

afterEach(() => {
  jest.restoreAllMocks()
})

test('adding someone to several channels refreshes every one of them', async () => {
  jest.spyOn(T.RPCChat, 'localBulkAddToManyConvsRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  await addMembersToChannels([convA, convB], ['testuser'])

  expect(T.RPCChat.localBulkAddToManyConvsRpcPromise).toHaveBeenCalledWith({
    conversations: [T.Chat.keyToConversationID(convA), T.Chat.keyToConversationID(convB)],
    usernames: ['testuser'],
  })
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledTimes(2)
})

test('a failed add never claims the participants are fresh', async () => {
  jest.spyOn(T.RPCChat, 'localBulkAddToManyConvsRpcPromise').mockRejectedValue(new Error('nope'))
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  await expect(addMembersToChannels([convA], ['testuser'])).rejects.toThrow('nope')
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
})

test('a failed refresh does not fail the add', async () => {
  jest.spyOn(T.RPCChat, 'localBulkAddToManyConvsRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockRejectedValue(new Error('offline'))

  await expect(addMembersToChannels([convA], ['testuser'])).resolves.toBeUndefined()
})
