/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {joinConversation} from './status-actions'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

afterEach(() => {
  jest.restoreAllMocks()
})

test('joining a conversation refreshes its participants', async () => {
  jest.spyOn(T.RPCChat, 'localJoinConversationByIDLocalRpcPromise').mockResolvedValue({} as never)
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  joinConversation(conversationIDKey)
  await flushPromises()

  expect(T.RPCChat.localJoinConversationByIDLocalRpcPromise).toHaveBeenCalledWith({convID})
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledWith({convID})
})

test('a failed join never claims the participants are fresh', async () => {
  jest
    .spyOn(T.RPCChat, 'localJoinConversationByIDLocalRpcPromise')
    .mockRejectedValue(new Error('cannot join'))
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  joinConversation(conversationIDKey)
  await flushPromises()

  expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
})
