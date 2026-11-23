/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {addMembersToChannels} from './add-to-channels'

const convA = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convB = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

afterEach(() => {
  jest.restoreAllMocks()
})

test('adding someone to several channels sends them all in one call', async () => {
  jest.spyOn(T.RPCChat, 'localBulkAddToManyConvsRpcPromise').mockResolvedValue(undefined)

  await addMembersToChannels([convA, convB], ['testuser'])

  expect(T.RPCChat.localBulkAddToManyConvsRpcPromise).toHaveBeenCalledWith({
    conversations: [T.Chat.keyToConversationID(convA), T.Chat.keyToConversationID(convB)],
    usernames: ['testuser'],
  })
})

test('a failed add rejects with the service error', async () => {
  jest.spyOn(T.RPCChat, 'localBulkAddToManyConvsRpcPromise').mockRejectedValue(new Error('nope'))

  await expect(addMembersToChannels([convA], ['testuser'])).rejects.toThrow('nope')
})
