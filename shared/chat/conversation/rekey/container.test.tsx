/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as ChatRpcT from '@/chat/conversation/chat-rpc'
let mockRetired = false
// the thread's rpc, which retires with the thread
let mockRpc: ChatRpcT.ChatThreadRpc | undefined
const mockThreadRpc = () =>
  (mockRpc ??= jest
    .requireActual<typeof ChatRpcT>('@/chat/conversation/chat-rpc')
    .makeThreadChatRpc(() => mockRetired))

jest.mock('../thread-context', () => ({
  useConversationThreadActions: () => ({isRetired: () => mockRetired, rpc: mockThreadRpc()}),
  useThreadRpc: () => mockThreadRpc(),
  useThreadMeta: (sel: (m: {rekeyers: Set<string>}) => unknown) => sel({rekeyers: new Set(['testuser'])}),
}))

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import Rekey from './container'

let rpc: FakeChatRpc

const clickRekey = async () => {
  await act(async () => {
    fireEvent.click(screen.getByText('Rekey'))
    for (let i = 0; i < 5; i++) {
      await Promise.resolve()
    }
  })
}

beforeEach(() => {
  rpc = installFakeChatRpc()
  mockRetired = false
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
  resetAllStores()
})

test('rekeying asks the service to show the pending rekey', async () => {
  render(<Rekey />)
  await clickRekey()
  expect(rpc.calls('showPendingRekeyStatus')).toEqual([[]])
})

// an account switch keeps the screen up until the provider rebuilds its thread for the next account
test('a screen whose thread has retired asks for no rekey', async () => {
  render(<Rekey />)
  mockRetired = true
  await clickRekey()
  expect(rpc.calls('showPendingRekeyStatus')).toEqual([])
})
