/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {removeMembersFromChannel} from './confirm-remove-from-channel'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

afterEach(() => {
  jest.restoreAllMocks()
})

test('removing members asks the service to remove them', async () => {
  jest.spyOn(T.RPCChat, 'localRemoveFromConversationLocalRpcPromise').mockResolvedValue({} as never)

  await removeMembersFromChannel(conversationIDKey, ['testuser', 'testuser-mac'])

  expect(T.RPCChat.localRemoveFromConversationLocalRpcPromise).toHaveBeenCalledWith({
    convID,
    usernames: ['testuser', 'testuser-mac'],
  })
})

test('a failed removal rejects with the service error', async () => {
  jest
    .spyOn(T.RPCChat, 'localRemoveFromConversationLocalRpcPromise')
    .mockRejectedValue(new Error('not an admin'))

  await expect(removeMembersFromChannel(conversationIDKey, ['testuser'])).rejects.toThrow('not an admin')
})
