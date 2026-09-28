/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import logger from '@/logger'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {resetAllStores} from '@/util/zustand'
import {metasReceived, participantInfoReceived} from '@/chat/inbox/metadata'
import {ConversationThreadProvider} from '../thread-context'
import ResetUser, {addTeamMemberAfterReset} from './reset-user'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
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

test('a re-add that lands still resolves when the participant refresh fails', async () => {
  jest.spyOn(T.RPCChat, 'localAddTeamMemberAfterResetRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockRejectedValue(new Error('offline'))
  const info = jest.spyOn(logger, 'info').mockImplementation(() => {})

  await expect(addTeamMemberAfterReset(conversationIDKey, 'testuser')).resolves.toBeUndefined()
  expect(info).toHaveBeenCalledWith(`refreshConversationParticipants: failed for ${conversationIDKey}`)
})

describe('the Let them in button', () => {
  const renderBanner = () => {
    metasReceived(
      [
        {
          ...makeConversationMeta(),
          conversationIDKey,
          resetParticipants: new Set(['testuser']),
        },
      ],
      undefined,
      {force: true}
    )
    participantInfoReceived(conversationIDKey, {
      all: ['testuser', 'testuser-mac'],
      contactName: new Map(),
      name: [],
    })
    render(
      <ConversationThreadProvider id={conversationIDKey}>
        <ResetUser />
      </ConversationThreadProvider>
    )
  }

  test('re-adds the first reset participant, then refreshes participants', async () => {
    const add = jest.spyOn(T.RPCChat, 'localAddTeamMemberAfterResetRpcPromise').mockResolvedValue(undefined)
    const refresh = jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)
    renderBanner()

    await act(async () => {
      fireEvent.click(screen.getByText('Let them in'))
      await flushPromises()
    })

    expect(add.mock.calls).toEqual([[{convID, username: 'testuser'}]])
    expect(refresh.mock.calls).toEqual([[{convID}]])
  })

  test('a rejected re-add is only logged and no refresh is sent', async () => {
    const failure = new Error('still reset')
    jest.spyOn(T.RPCChat, 'localAddTeamMemberAfterResetRpcPromise').mockRejectedValue(failure)
    const refresh = jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    renderBanner()

    await act(async () => {
      fireEvent.click(screen.getByText('Let them in'))
      await flushPromises()
    })

    expect(error).toHaveBeenCalledWith('ignorePromise error', failure)
    expect(refresh).not.toHaveBeenCalled()
    // the banner stays up: nothing about the conversation changed
    expect(screen.getByText('Let them in')).toBeTruthy()
  })
})
