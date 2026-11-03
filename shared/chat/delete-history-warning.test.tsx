/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {cleanup, fireEvent, render} from '@testing-library/react'
import * as C from '@/constants'
import * as Meta from '@/constants/chat/meta'
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {metasReceived} from './inbox/metadata-store'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import DeleteHistoryWarning from './delete-history-warning'

const deleteHistory = 'chat.1.local.postDeleteHistoryByAge'

let fake: FakeEngine

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

// what "clear for everyone" asks the service for
const expectDeleteSent = (tlfName: string) => {
  expect(paramsOf(fake, deleteHistory)).toEqual([
    {
      age: 0,
      conversationID: T.Chat.keyToConversationID(conversationIDKey),
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      tlfName,
      tlfPublic: false,
    },
  ])
}

const clickDelete = async (getByText: (t: string) => HTMLElement) => {
  fireEvent.click(getByText('Yes, clear for everyone'))
  await flush()
}

beforeEach(() => {
  fake = installFakeEngine()
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, tlfname: 'testuser,testuser-mac'}])
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('confirming clears modals and deletes all history by age 0', async () => {
  const clearModals = jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
  const modalsClearedAtDelete: Array<boolean> = []
  fake.answer(deleteHistory, () => {
    modalsClearedAtDelete.push(clearModals.mock.calls.length === 1)
    return {}
  })
  const {getByText} = render(<DeleteHistoryWarning conversationIDKey={conversationIDKey} />)

  await clickDelete(getByText)

  expect(clearModals).toHaveBeenCalledTimes(1)
  expectDeleteSent('testuser,testuser-mac')
  // modals clear before the RPC is issued
  expect(modalsClearedAtDelete).toEqual([true])
})

test('with no tlfname it warns and skips the RPC, but still clears modals', async () => {
  resetAllStores()
  const clearModals = jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const {getByText} = render(<DeleteHistoryWarning conversationIDKey={conversationIDKey} />)

  await clickDelete(getByText)

  expect(clearModals).toHaveBeenCalledTimes(1)
  expect(paramsOf(fake, deleteHistory)).toEqual([])
  expect(warn).toHaveBeenCalledWith('Deleting message history for non-existent TLF:')
})

test('a failed delete is only logged through ignorePromise', async () => {
  fake.answer(deleteHistory, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'delete broke'))
  const clearModals = jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
  const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const {getByText} = render(<DeleteHistoryWarning conversationIDKey={conversationIDKey} />)

  await clickDelete(getByText)

  expectDeleteSent('testuser,testuser-mac')
  expect(clearModals).toHaveBeenCalledTimes(1)
  expect(error).toHaveBeenCalledWith(
    'ignorePromise error',
    expect.objectContaining({code: T.RPCGen.StatusCode.scgeneric, desc: 'delete broke'})
  )
})

test('cancel navigates up and sends nothing', () => {
  const navigateUp = jest.spyOn(C.Router2, 'navigateUp').mockImplementation(() => {})
  const clearModals = jest.spyOn(C.Router2, 'clearModals').mockImplementation(() => {})
  const {getByText} = render(<DeleteHistoryWarning conversationIDKey={conversationIDKey} />)

  fireEvent.click(getByText('Cancel'))

  expect(navigateUp).toHaveBeenCalledTimes(1)
  expect(clearModals).not.toHaveBeenCalled()
  expect(paramsOf(fake, deleteHistory)).toEqual([])
})
