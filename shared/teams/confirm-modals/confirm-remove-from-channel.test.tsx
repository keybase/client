/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {removeMembersFromChannel} from './confirm-remove-from-channel'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

afterEach(() => {
  jest.restoreAllMocks()
})

test('removing members refreshes the conversation participants', async () => {
  jest.spyOn(T.RPCChat, 'localRemoveFromConversationLocalRpcPromise').mockResolvedValue({} as never)
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  await removeMembersFromChannel(conversationIDKey, ['testuser', 'testuser-mac'])

  expect(T.RPCChat.localRemoveFromConversationLocalRpcPromise).toHaveBeenCalledWith({
    convID,
    usernames: ['testuser', 'testuser-mac'],
  })
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledWith({convID})
})

test('a failed removal never claims the participants are fresh', async () => {
  jest
    .spyOn(T.RPCChat, 'localRemoveFromConversationLocalRpcPromise')
    .mockRejectedValue(new Error('not an admin'))
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  await expect(removeMembersFromChannel(conversationIDKey, ['testuser'])).rejects.toThrow('not an admin')
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
})
