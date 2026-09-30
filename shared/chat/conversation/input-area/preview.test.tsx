/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as ChatRpcT from '@/chat/conversation/chat-rpc'
import type * as Constants from '@/constants'
import * as T from '@/constants/types'

type ConstantsModule = typeof Constants

const mockConversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
let mockRetired = false
// the thread's rpc, which retires with the thread
let mockRpc: ChatRpcT.ChatThreadRpc | undefined
const mockThreadRpc = () =>
  (mockRpc ??= jest
    .requireActual<typeof ChatRpcT>('@/chat/conversation/chat-rpc')
    .makeThreadChatRpc(() => mockRetired))

jest.mock('@/constants', () => {
  const actual = jest.requireActual<ConstantsModule>('@/constants')
  return {...actual, Router2: {...actual.Router2, leaveConversation: jest.fn()}}
})
jest.mock('../thread-context', () => ({
  useConversationThreadActions: () => ({isRetired: () => mockRetired, rpc: mockThreadRpc()}),
  useThreadRpc: () => mockThreadRpc(),
  useConversationThreadID: () => mockConversationIDKey,
  useThreadMeta: (sel: (m: {channelname: string}) => unknown) => sel({channelname: 'general'}),
}))

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as C from '@/constants'
import {resetAllStores} from '@/util/zustand'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import Preview from './preview'

let rpc: FakeChatRpc

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

const click = async (label: string) => {
  await act(async () => {
    fireEvent.click(screen.getByText(label))
    await flushPromises()
  })
}

const leaveConversation = () => C.Router2.leaveConversation as jest.Mock

beforeEach(() => {
  rpc = installFakeChatRpc()
  mockRetired = false
})

afterEach(() => {
  cleanup()
  restoreChatRpc()
  jest.clearAllMocks()
  resetAllStores()
})

test('joining asks the service to join the channel', async () => {
  render(<Preview />)
  await click('Yes, join')
  expect(rpc.calls('joinConversation')).toEqual([[mockConversationIDKey]])
})

test('declining leaves the channel', async () => {
  render(<Preview />)
  await click('No, thanks')
  expect(leaveConversation()).toHaveBeenCalledWith(mockConversationIDKey)
})

// an account switch keeps the screen up until the provider rebuilds its thread for the next account
describe('a banner whose thread has retired', () => {
  test('joins nothing', async () => {
    render(<Preview />)
    mockRetired = true
    await click('Yes, join')
    expect(rpc.calls('joinConversation')).toEqual([])
  })
})
