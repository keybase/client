/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {addTeamMemberAfterReset} from './reset-user'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

afterEach(() => {
  jest.restoreAllMocks()
})

test('letting a reset user back in refreshes the conversation participants', async () => {
  jest.spyOn(T.RPCChat, 'localAddTeamMemberAfterResetRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  await addTeamMemberAfterReset(conversationIDKey, 'testuser')

  expect(T.RPCChat.localAddTeamMemberAfterResetRpcPromise).toHaveBeenCalledWith({
    convID,
    username: 'testuser',
  })
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledWith({convID})
})

test('a failed re-add never claims the participants are fresh', async () => {
  jest
    .spyOn(T.RPCChat, 'localAddTeamMemberAfterResetRpcPromise')
    .mockRejectedValue(new Error('still reset'))
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  await expect(addTeamMemberAfterReset(conversationIDKey, 'testuser')).rejects.toThrow('still reset')
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
})
