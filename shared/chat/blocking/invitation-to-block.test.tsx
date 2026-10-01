/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as ChatRpcT from '@/chat/conversation/chat-rpc'
import type * as React from 'react'
import * as T from '@/constants/types'

// each icon's latest onClick, by icon type
const mockIconOnClick = new Map<string, () => void>()
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<{Icon: React.ComponentType<{onClick?: () => void; type: string}>}>(
    '@/common-adapters'
  )
  const R = jest.requireActual<typeof React>('react')
  return {
    ...actual,
    Icon: (p: {onClick?: () => void; type: string}) => {
      if (p.onClick) {
        mockIconOnClick.set(p.type, p.onClick)
      }
      return R.createElement(actual.Icon, p)
    },
  }
})

const mockConversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const mockTeamID = 'aabbccdd'
let mockRetired = false
// the thread's rpc, which retires with the thread
let mockRpc: ChatRpcT.ChatThreadRpc | undefined
const mockThreadRpc = () =>
  (mockRpc ??= jest
    .requireActual<typeof ChatRpcT>('@/chat/conversation/chat-rpc')
    .makeThreadChatRpc(() => mockRetired))
let mockOwnMessage = false

jest.mock('../conversation/thread-context', () => ({
  useConversationThreadActions: () => ({isRetired: () => mockRetired, rpc: mockThreadRpc()}),
  useThreadRpc: () => mockThreadRpc(),
  useConversationThreadID: () => mockConversationIDKey,
  useConversationThreadStore: () => ({getState: () => ({messageMap: new Map(), messageOrdinals: []})}),
  useConversationThreadSelector: (
    sel: (s: {messageMap: Map<number, {author: string}>; messageOrdinals: Array<number>}) => unknown
  ) =>
    sel({
      messageMap: new Map(mockOwnMessage ? [[1, {author: 'testuser'}]] : []),
      messageOrdinals: mockOwnMessage ? [1] : [],
    }),
  useThreadMeta: (sel: (m: {teamID: string; teamname: string; tlfname: string}) => unknown) =>
    sel({teamID: mockTeamID, teamname: 'testteam', tlfname: 'testteam'}),
}))
jest.mock('./block-buttons-state', () => ({
  useBlockButtonsInfo: () => ({adder: 'testuser-mac'}),
}))

import * as Meta from '@/constants/chat/meta'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {metasReceived} from '@/chat/inbox/metadata'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import BlockButtons from './invitation-to-block'

let rpc: FakeChatRpc

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

const renderBanner = async () => {
  render(<BlockButtons />)
  await act(async () => {
    await flushPromises()
  })
}

const clickDismiss = async () => {
  const onClick = mockIconOnClick.get('iconfont-remove')
  expect(onClick).toBeTruthy()
  await act(async () => {
    onClick?.()
    await flushPromises()
  })
}

beforeEach(() => {
  mockIconOnClick.clear()
  rpc = installFakeChatRpc()
  mockRetired = false
  mockOwnMessage = false
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  metasReceived(
    [{...Meta.makeConversationMeta(), conversationIDKey: mockConversationIDKey, tlfname: 'testteam'}],
    undefined,
    {force: true}
  )
})

const clickWave = async () => {
  await act(async () => {
    fireEvent.click(screen.getByText('Wave at everyone'))
    await flushPromises()
  })
}

afterEach(() => {
  cleanup()
  restoreChatRpc()
  resetAllStores()
})

test('dismissing asks the service to dismiss the banner', async () => {
  await renderBanner()
  await clickDismiss()
  expect(rpc.calls('dismissBlockButtons')).toEqual([[mockTeamID]])
})

test('a message of your own in the thread dismisses the banner', async () => {
  mockOwnMessage = true
  await renderBanner()
  expect(rpc.calls('dismissBlockButtons')).toEqual([[mockTeamID]])
})

test('waving posts a plain wave into the conversation', async () => {
  await renderBanner()
  await clickWave()
  expect(rpc.params('postText')).toEqual([
    {
      clientPrev: T.Chat.numberToMessageID(0),
      conversationIDKey: mockConversationIDKey,
      ephemeralLifetime: 0,
      onStellarCanceled: expect.any(Function),
      text: ':wave:',
      tlfName: 'testteam',
    },
  ])
})

// an account switch keeps the screen up until the provider rebuilds its thread for the next account
describe('a banner whose thread has retired', () => {
  test('dismisses nothing when clicked', async () => {
    await renderBanner()
    mockRetired = true
    await clickDismiss()
    expect(rpc.calls('dismissBlockButtons')).toEqual([])
  })

  test('waves nothing', async () => {
    await renderBanner()
    mockRetired = true
    await clickWave()
    expect(rpc.calls('postText')).toEqual([])
  })

  test('dismisses nothing for a message of your own', async () => {
    mockOwnMessage = true
    mockRetired = true
    await renderBanner()
    expect(rpc.calls('dismissBlockButtons')).toEqual([])
  })
})
