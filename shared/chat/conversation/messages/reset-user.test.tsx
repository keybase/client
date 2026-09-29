/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'

// each button's first onClick: the handler a screen kept through an account switch still holds
const mockFirstOnClick = new Map<string, () => void>()
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<{Button: React.ComponentType<{label?: string; onClick?: () => void}>}>(
    '@/common-adapters'
  )
  const R = jest.requireActual<typeof React>('react')
  return {
    ...actual,
    Button: (p: {label?: string; onClick?: () => void}) => {
      if (p.label && p.onClick && !mockFirstOnClick.has(p.label)) {
        mockFirstOnClick.set(p.label, p.onClick)
      }
      return R.createElement(actual.Button, p)
    },
  }
})

import * as T from '@/constants/types'
import logger from '@/logger'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {makeConversationMeta} from '@/constants/chat/meta'
import {resetAllStores} from '@/util/zustand'
import {metasReceived, participantInfoReceived} from '@/chat/inbox/metadata'
import {useCurrentUserState} from '@/stores/current-user'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {ConversationThreadProvider} from '../thread-context'
import ResetUser, {addTeamMemberAfterReset} from './reset-user'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

let rpc: FakeChatRpc

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

beforeEach(() => {
  mockFirstOnClick.clear()
  rpc = installFakeChatRpc()
  // the thread provider builds a thread only for a signed-in account
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
})

afterEach(() => {
  cleanup()
  restoreChatRpc()
  jest.restoreAllMocks()
  resetAllStores()
})

test('letting a reset user back in refreshes the conversation participants', async () => {
  await addTeamMemberAfterReset(conversationIDKey, 'testuser')

  expect(rpc.calls('addTeamMemberAfterReset')).toContainEqual([conversationIDKey, 'testuser'])
  expect(rpc.calls('refreshParticipants')).toContainEqual([conversationIDKey])
})

test('a failed re-add never claims the participants are fresh', async () => {
  rpc.fail('addTeamMemberAfterReset', new Error('still reset'))

  await expect(addTeamMemberAfterReset(conversationIDKey, 'testuser')).rejects.toThrow('still reset')
  expect(rpc.calls('refreshParticipants')).toEqual([])
})

test('a re-add that lands still resolves when the participant refresh fails', async () => {
  rpc.fail('refreshParticipants', new Error('offline'))
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
    renderBanner()

    await act(async () => {
      fireEvent.click(screen.getByText('Let them in'))
      await flushPromises()
    })

    expect(rpc.log).toEqual([
      {args: [conversationIDKey, 'testuser'], method: 'addTeamMemberAfterReset'},
      {args: [conversationIDKey], method: 'refreshParticipants'},
    ])
  })

  test('a rejected re-add is only logged and no refresh is sent', async () => {
    const failure = new Error('still reset')
    rpc.fail('addTeamMemberAfterReset', failure)
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    renderBanner()

    await act(async () => {
      fireEvent.click(screen.getByText('Let them in'))
      await flushPromises()
    })

    expect(error).toHaveBeenCalledWith('ignorePromise error', failure)
    expect(rpc.calls('refreshParticipants')).toEqual([])
    // the banner stays up: nothing about the conversation changed
    expect(screen.getByText('Let them in')).toBeTruthy()
  })

  // an account switch keeps the screen up until the provider rebuilds its thread for the next account
  test('a banner whose thread has retired re-adds no one', async () => {
    renderBanner()
    act(() => {
      useCurrentUserState.getState().dispatch.setBootstrap({
        deviceID: 'device-id2',
        deviceName: 'testuser-mac',
        uid: 'uid2',
        username: 'testuser2',
      })
    })

    await act(async () => {
      mockFirstOnClick.get('Let them in')?.()
      await flushPromises()
    })

    expect(mockFirstOnClick.has('Let them in')).toBe(true)
    expect(rpc.calls('addTeamMemberAfterReset')).toEqual([])
  })
})
