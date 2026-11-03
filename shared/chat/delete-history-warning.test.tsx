/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render} from '@testing-library/react'
import * as NavTree from '@/constants/nav-tree'
import * as Meta from '@/constants/chat/meta'
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {metasReceived} from './inbox/metadata-store'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {makeRootState, navigationWrapper, renders} from '@/test/navigation'
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

// The warning is up over the conversation's info panel, both modals above the thread
const renderWarning = () => {
  const {wrapper, ...nav} = navigationWrapper({
    rootState: makeRootState({
      above: [
        {name: 'chatInfoPanel', params: {conversationIDKey}},
        {name: 'chatDeleteHistoryWarning', params: {conversationIDKey}},
      ],
      tabStack: [{name: 'chatRoot', params: {conversationIDKey}}],
    }),
    route: 'chatDeleteHistoryWarning',
  })
  const rendered = render(<DeleteHistoryWarning conversationIDKey={conversationIDKey} />, {wrapper})
  const modals = () => NavTree.modalStack(nav.getRootState()).map(r => r.name)
  expect(modals()).toEqual(['chatInfoPanel', 'chatDeleteHistoryWarning'])
  return {...rendered, modals, nav}
}

const clickDelete = async (getByText: (t: string) => HTMLElement) => {
  act(() => {
    fireEvent.click(getByText('Yes, clear for everyone'))
  })
  await flush()
  await renders()
}

// every modal is gone and the thread under them is showing
const expectBackOnThread = (r: ReturnType<typeof renderWarning>) => {
  expect(r.modals()).toEqual([])
  expect(r.nav.visibleScreen()).toMatchObject({name: 'chatRoot', params: {conversationIDKey}})
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
  const r = renderWarning()
  const modalsAtDelete: Array<ReadonlyArray<string>> = []
  fake.answer(deleteHistory, () => {
    modalsAtDelete.push(r.modals())
    return {}
  })

  await clickDelete(r.getByText)

  expectBackOnThread(r)
  expectDeleteSent('testuser,testuser-mac')
  // modals clear before the RPC is issued
  expect(modalsAtDelete).toEqual([[]])
})

test('with no tlfname it warns and skips the RPC, but still clears modals', async () => {
  resetAllStores()
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
  const r = renderWarning()

  await clickDelete(r.getByText)

  expectBackOnThread(r)
  expect(paramsOf(fake, deleteHistory)).toEqual([])
  expect(warn).toHaveBeenCalledWith('Deleting message history for non-existent TLF:')
})

test('a failed delete is only logged through ignorePromise', async () => {
  fake.answer(deleteHistory, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'delete broke'))
  const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const r = renderWarning()

  await clickDelete(r.getByText)

  expectDeleteSent('testuser,testuser-mac')
  expectBackOnThread(r)
  expect(error).toHaveBeenCalledWith(
    'ignorePromise error',
    expect.objectContaining({code: T.RPCGen.StatusCode.scgeneric, desc: 'delete broke'})
  )
})

test('cancel closes only the warning and sends nothing', async () => {
  const r = renderWarning()

  act(() => {
    fireEvent.click(r.getByText('Cancel'))
  })
  await renders()

  expect(r.modals()).toEqual(['chatInfoPanel'])
  expect(paramsOf(fake, deleteHistory)).toEqual([])
})
