/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {joinChannel, leaveChannel} from './add-to-channels-row'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

afterEach(() => {
  jest.restoreAllMocks()
})

test('joining a channel refreshes its participants', async () => {
  jest.spyOn(T.RPCChat, 'localJoinConversationByIDLocalRpcPromise').mockResolvedValue({} as never)
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  await joinChannel(conversationIDKey)

  expect(T.RPCChat.localJoinConversationByIDLocalRpcPromise).toHaveBeenCalledWith({convID})
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledWith({convID})
})

test('leaving a channel refreshes its participants', async () => {
  jest.spyOn(T.RPCChat, 'localLeaveConversationLocalRpcPromise').mockResolvedValue({} as never)
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  await leaveChannel(conversationIDKey)

  expect(T.RPCChat.localLeaveConversationLocalRpcPromise).toHaveBeenCalledWith({convID})
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledWith({convID})
})

test('a failed join never claims the participants are fresh', async () => {
  jest
    .spyOn(T.RPCChat, 'localJoinConversationByIDLocalRpcPromise')
    .mockRejectedValue(new Error('cannot join'))
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  await expect(joinChannel(conversationIDKey)).rejects.toThrow('cannot join')
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
})
