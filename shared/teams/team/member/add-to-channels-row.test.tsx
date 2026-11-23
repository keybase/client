/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {joinChannel, leaveChannel} from './add-to-channels-row'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

afterEach(() => {
  jest.restoreAllMocks()
})

test('joining a channel asks the service to join it', async () => {
  jest.spyOn(T.RPCChat, 'localJoinConversationByIDLocalRpcPromise').mockResolvedValue({} as never)

  await joinChannel(conversationIDKey)

  expect(T.RPCChat.localJoinConversationByIDLocalRpcPromise).toHaveBeenCalledWith({convID})
})

test('leaving a channel asks the service to leave it', async () => {
  jest.spyOn(T.RPCChat, 'localLeaveConversationLocalRpcPromise').mockResolvedValue({} as never)

  await leaveChannel(conversationIDKey)

  expect(T.RPCChat.localLeaveConversationLocalRpcPromise).toHaveBeenCalledWith({convID})
})

test('a failed join rejects with the service error', async () => {
  jest
    .spyOn(T.RPCChat, 'localJoinConversationByIDLocalRpcPromise')
    .mockRejectedValue(new Error('cannot join'))

  await expect(joinChannel(conversationIDKey)).rejects.toThrow('cannot join')
})
