/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as Constants from '@/constants'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'

type ConstantsModule = typeof Constants

jest.mock('@/constants', () => {
  const actual = jest.requireActual<ConstantsModule>('@/constants')
  return {...actual, Router2: {...actual.Router2, leaveConversation: jest.fn()}}
})

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as C from '@/constants'
import {metasReceived} from '@/chat/inbox/metadata'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {threadWrapper} from '@/test/thread-tree'
import Preview from './preview'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const joinConversation = 'chat.1.local.joinConversationByIDLocal'
const refreshParticipants = 'chat.1.local.refreshParticipants'

let fake: FakeEngine

const renderPreview = () => {
  render(<Preview />, {wrapper: threadWrapper(conversationIDKey).wrapper})
}

const click = async (label: string) => {
  fireEvent.click(screen.getByText(label))
  await flush()
}

const leaveConversation = () => C.Router2.leaveConversation as jest.Mock

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  metasReceived([{...Meta.makeConversationMeta(), channelname: 'general', conversationIDKey}], undefined, {
    force: true,
  })
  fake = installFakeEngine()
})

afterEach(() => {
  cleanup()
  jest.clearAllMocks()
  resetAllStores()
})

test('the banner names the channel', () => {
  renderPreview()
  expect(screen.getByText('Would you like to join #general?')).toBeTruthy()
})

test('joining asks the service to join the channel, then to recompute its participants', async () => {
  fake.answer(joinConversation, () => ({}))
  fake.answer(refreshParticipants, () => null)
  renderPreview()
  await click('Yes, join')
  const convID = T.Chat.keyToConversationID(conversationIDKey)
  expect(fake.calls.map(c => c.method)).toEqual([joinConversation, refreshParticipants])
  expect(paramsOf(fake, joinConversation)).toEqual([{convID}])
  expect(paramsOf(fake, refreshParticipants)).toEqual([{convID}])
})

test('declining leaves the channel', async () => {
  renderPreview()
  await click('No, thanks')
  expect(leaveConversation()).toHaveBeenCalledWith(conversationIDKey)
})

// an account switch keeps the screen up until the provider rebuilds its thread for the next account
describe('a banner whose thread has retired', () => {
  test('joins nothing', async () => {
    renderPreview()
    // the account leaves; the click lands on the banner still showing before the provider rebuilds
    act(() => {
      useCurrentUserState.setState({uid: 'other-uid'})
      fireEvent.click(screen.getByText('Yes, join'))
    })
    await flush()
    expect(paramsOf(fake, joinConversation)).toEqual([])
  })
})
