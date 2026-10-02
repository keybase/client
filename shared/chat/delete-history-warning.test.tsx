/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'

let mockTlfname = ''

jest.mock('./conversation/data-hooks', () => ({
  useConversationMeta: () => ({tlfname: mockTlfname}),
}))

import {act, cleanup, fireEvent, render} from '@testing-library/react'
import * as C from '@/constants'
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import DeleteHistoryWarning from './delete-history-warning'

let rpc: FakeChatRpc

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

// what "clear for everyone" asks the service for
const expectDeleteSent = (tlfName: string) => {
  expect(rpc.calls('deleteHistory')).toEqual([[conversationIDKey, tlfName]])
}

const clickDelete = async (getByText: (t: string) => HTMLElement) => {
  fireEvent.click(getByText('Yes, clear for everyone'))
  await act(async () => {
    await flushPromises()
  })
}

beforeEach(() => {
  rpc = installFakeChatRpc()
  mockTlfname = 'testuser,testuser-mac'
})

afterEach(() => {
  cleanup()
  restoreChatRpc()
  jest.restoreAllMocks()
  resetAllStores()
})

test('confirming clears modals and deletes all history by age 0', async () => {
  const clearModals = jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
  const modalsClearedAtDelete: Array<boolean> = []
  rpc.on('deleteHistory', () => {
    modalsClearedAtDelete.push(clearModals.mock.calls.length === 1)
  })
  const {getByText} = render(<DeleteHistoryWarning conversationIDKey={conversationIDKey} />)

  await clickDelete(getByText)

  expect(clearModals).toHaveBeenCalledTimes(1)
  expectDeleteSent('testuser,testuser-mac')
  // modals clear before the RPC is issued
  expect(modalsClearedAtDelete).toEqual([true])
})

test('with no tlfname it warns and skips the RPC, but still clears modals', async () => {
  mockTlfname = ''
  const clearModals = jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const {getByText} = render(<DeleteHistoryWarning conversationIDKey={conversationIDKey} />)

  await clickDelete(getByText)

  expect(clearModals).toHaveBeenCalledTimes(1)
  expect(rpc.calls('deleteHistory')).toEqual([])
  expect(warn).toHaveBeenCalledWith('Deleting message history for non-existent TLF:')
})

test('a failed delete is only logged through ignorePromise', async () => {
  const failure = new Error('delete broke')
  rpc.fail('deleteHistory', failure)
  const clearModals = jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
  const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const {getByText} = render(<DeleteHistoryWarning conversationIDKey={conversationIDKey} />)

  await clickDelete(getByText)

  expectDeleteSent('testuser,testuser-mac')
  expect(clearModals).toHaveBeenCalledTimes(1)
  expect(error).toHaveBeenCalledWith('ignorePromise error', failure)
})

test('cancel navigates up and sends nothing', () => {
  const navigateUp = jest.spyOn(C.Router2, 'navigateUp').mockImplementation(() => {})
  const clearModals = jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
  const {getByText} = render(<DeleteHistoryWarning conversationIDKey={conversationIDKey} />)

  fireEvent.click(getByText('Cancel'))

  expect(navigateUp).toHaveBeenCalledTimes(1)
  expect(clearModals).not.toHaveBeenCalled()
  expect(rpc.calls('deleteHistory')).toEqual([])
})
