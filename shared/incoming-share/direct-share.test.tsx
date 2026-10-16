/** @jest-environment jsdom */
/// <reference types="jest" />
import * as C from '@/constants'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'

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

test('a text share to a suggested conversation carries the dropped-items notice into the thread', async () => {
  await shareToSuggestedConversation({
    droppedCount: 1,
    items: [{content: 'hello', type: T.RPCGen.IncomingShareType.text}],
  })

  expect(C.Router2.navigateToThread).toHaveBeenCalledWith(conversationIDKey, 'extension', {
    intent: {notice: "1 item couldn't be prepared.", text: 'hello', type: 'injectText'},
  })
})

test('a complete text share to a suggested conversation carries no notice', async () => {
  await shareToSuggestedConversation({
    droppedCount: 0,
    items: [{content: 'hello', type: T.RPCGen.IncomingShareType.text}],
  })

  expect(C.Router2.navigateToThread).toHaveBeenCalledWith(conversationIDKey, 'extension', {
    intent: {notice: undefined, text: 'hello', type: 'injectText'},
  })
})

test('an attachment share to a suggested conversation carries the notice to the send screen', async () => {
  const navigateAppend = jest.mocked(C.Router2.navigateAppend)
  await shareToSuggestedConversation({
    droppedCount: 1,
    items: [{originalPath: '/tmp/a.jpg', type: T.RPCGen.IncomingShareType.image}],
  })

  const appended = navigateAppend.mock.calls[0]?.[0] as
    | {name: string; params: {notice?: string}}
    | undefined
  expect(appended?.name).toBe('chatAttachmentGetTitles')
  expect(appended?.params.notice).toBe("1 item couldn't be prepared.")
})
