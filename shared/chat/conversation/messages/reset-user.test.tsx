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
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {threadWrapper} from '@/test/thread-tree'
import ResetUser, {addTeamMemberAfterReset} from './reset-user'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const addAfterReset = 'chat.1.local.addTeamMemberAfterReset'
const refreshParticipants = 'chat.1.local.refreshParticipants'
const convID = T.Chat.keyToConversationID(conversationIDKey)

let fake: FakeEngine

// what the service received, by method, in order
const serviceLog = () => fake.calls.map(c => c.method)

beforeEach(() => {
  mockFirstOnClick.clear()
  fake = installFakeEngine()
  fake.answer(addAfterReset, () => {})
  fake.answer(refreshParticipants, () => {})
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
  jest.restoreAllMocks()
  resetAllStores()
})

test('letting a reset user back in refreshes the conversation participants', async () => {
  await addTeamMemberAfterReset(conversationIDKey, 'testuser')

  expect(paramsOf(fake, addAfterReset)).toEqual([{convID, username: 'testuser'}])
  expect(paramsOf(fake, refreshParticipants)).toEqual([{convID}])
})

test('a failed re-add never claims the participants are fresh', async () => {
  fake.answer(addAfterReset, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'still reset'))

  await expect(addTeamMemberAfterReset(conversationIDKey, 'testuser')).rejects.toMatchObject({
    desc: 'still reset',
  })
  expect(paramsOf(fake, refreshParticipants)).toEqual([])
})

test('a re-add that lands still resolves when the participant refresh fails', async () => {
  fake.answer(refreshParticipants, () => fakeError(T.RPCGen.StatusCode.scapinetworkerror, 'offline'))
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
    render(<ResetUser />, {wrapper: threadWrapper(conversationIDKey).wrapper})
  }

  test('re-adds the first reset participant, then refreshes participants', async () => {
    renderBanner()

    act(() => {
      fireEvent.click(screen.getByText('Let them in'))
    })
    await flush()

    expect(serviceLog()).toEqual([addAfterReset, refreshParticipants])
    expect(paramsOf(fake, addAfterReset)).toEqual([{convID, username: 'testuser'}])
  })

  test('a rejected re-add is only logged and no refresh is sent', async () => {
    fake.answer(addAfterReset, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'still reset'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    renderBanner()

    act(() => {
      fireEvent.click(screen.getByText('Let them in'))
    })
    await flush()

    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.objectContaining({desc: 'still reset'}))
    expect(paramsOf(fake, refreshParticipants)).toEqual([])
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

    act(() => {
      mockFirstOnClick.get('Let them in')?.()
    })
    await flush()

    expect(mockFirstOnClick.has('Let them in')).toBe(true)
    expect(paramsOf(fake, addAfterReset)).toEqual([])
  })
})
