/** @jest-environment jsdom */
/// <reference types="jest" />
import * as C from '@/constants'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({setOptions: () => {}}),
}))

import IncomingShareMain from './index'

const g = globalThis as unknown as {isIOS: boolean}
const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const shareToSuggestedConversation = async (res: T.RPCGen.IncomingShareItems) => {
  jest.spyOn(T.RPCGen, 'incomingShareGetIncomingShareItemsRpcPromise').mockResolvedValue(res)
  render(<IncomingShareMain selectedConversationIDKey={conversationIDKey} />)
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  g.isIOS = true
  jest.spyOn(C.Router2, 'navigateToThread').mockImplementation(() => {})
  jest.spyOn(C.Router2, 'navigateAppend').mockReturnValue(true)
})

afterEach(() => {
  g.isIOS = false
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('a text share to a suggested conversation still says which items were dropped', async () => {
  await shareToSuggestedConversation({
    droppedCount: 1,
    items: [{content: 'hello', type: T.RPCGen.IncomingShareType.text}],
  })

  expect(C.Router2.navigateToThread).toHaveBeenCalledWith(conversationIDKey, 'extension', {
    intent: {text: 'hello', type: 'injectText'},
  })
  expect(useConfigState.getState().globalError?.message).toBe("1 of 2 items couldn't be prepared.")
})

test('a complete text share to a suggested conversation shows no error', async () => {
  await shareToSuggestedConversation({
    droppedCount: 0,
    items: [{content: 'hello', type: T.RPCGen.IncomingShareType.text}],
  })

  expect(C.Router2.navigateToThread).toHaveBeenCalled()
  expect(useConfigState.getState().globalError).toBeUndefined()
})

test('an attachment share to a suggested conversation carries the notice to the send screen', async () => {
  await shareToSuggestedConversation({
    droppedCount: 1,
    items: [{originalPath: '/tmp/a.jpg', type: T.RPCGen.IncomingShareType.image}],
  })

  expect(C.Router2.navigateAppend).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'chatAttachmentGetTitles',
      params: expect.objectContaining({notice: "1 of 2 items couldn't be prepared."}),
    })
  )
  expect(useConfigState.getState().globalError).toBeUndefined()
})
