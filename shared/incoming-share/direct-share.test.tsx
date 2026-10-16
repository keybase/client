/** @jest-environment jsdom */
/// <reference types="jest" />
import * as C from '@/constants'
import * as T from '@/constants/types'
import {act, cleanup, render, screen} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({setOptions: () => {}}),
}))

import IncomingShareMain, {nextShare} from './index'

const g = globalThis as unknown as {isIOS: boolean}
const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

let lastShareID = 0
const shareToSuggestedConversation = async (share: Omit<T.RPCGen.IncomingShareItems, 'id'>, id?: string) => {
  const res = {...share, id: id ?? `share-${++lastShareID}`}
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
    intent: {append: true, notice: "1 item couldn't be prepared.", text: 'hello', type: 'injectText'},
  })
})

test('a complete text share to a suggested conversation carries no notice', async () => {
  await shareToSuggestedConversation({
    droppedCount: 0,
    items: [{content: 'hello', type: T.RPCGen.IncomingShareType.text}],
  })

  expect(C.Router2.navigateToThread).toHaveBeenCalledWith(conversationIDKey, 'extension', {
    intent: {append: true, notice: undefined, text: 'hello', type: 'injectText'},
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

test('a link to a conversation with no share behind it leaves the conversation alone', async () => {
  await shareToSuggestedConversation({droppedCount: 0, items: null})

  expect(C.Router2.navigateToThread).not.toHaveBeenCalled()
  expect(C.Router2.navigateAppend).not.toHaveBeenCalled()
  expect(screen.getByText("There's nothing to share.")).toBeTruthy()
  expect(screen.queryByText('Whoops! Something went wrong.')).toBeNull()
})

test('a reload that finds the share again, or nothing, keeps the share shown; a newer share replaces it', () => {
  const first = {droppedCount: 0, id: 'a', items: [{content: 'hello', type: T.RPCGen.IncomingShareType.text}]}
  const repeat = {...first, items: [...first.items]}
  const nothing = {droppedCount: 0, id: '', items: []}
  const allDropped = {droppedCount: 1, id: 'b', items: []}
  const newer = {droppedCount: 0, id: 'c', items: [{content: 'hello', type: T.RPCGen.IncomingShareType.text}]}

  expect(nextShare(undefined, nothing)).toBe(nothing)
  expect(nextShare(first, nothing)).toBe(first)
  expect(nextShare(first, repeat)).toBe(first)
  expect(nextShare(allDropped, nothing)).toBe(allDropped)
  expect(nextShare(nothing, first)).toBe(first)
  expect(nextShare(first, newer)).toBe(newer)
  expect(nextShare(first, allDropped)).toBe(allDropped)
})

test('a share handed out again is not sent to its conversation a second time', async () => {
  const share = {droppedCount: 0, items: [{content: 'hello', type: T.RPCGen.IncomingShareType.text}]}
  await shareToSuggestedConversation(share, 'repeated')
  expect(C.Router2.navigateToThread).toHaveBeenCalledTimes(1)
  cleanup()

  await shareToSuggestedConversation(share, 'repeated')
  expect(C.Router2.navigateToThread).toHaveBeenCalledTimes(1)
  expect(screen.getByText("There's nothing to share.")).toBeTruthy()

  await shareToSuggestedConversation(share)
  expect(C.Router2.navigateToThread).toHaveBeenCalledTimes(2)
})
