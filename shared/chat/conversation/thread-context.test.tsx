/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {act, cleanup, renderHook} from '@testing-library/react'
import type * as React from 'react'
import {getConvoState} from '@/stores/convostate'
import {resetAllStores} from '@/util/zustand'
import {
  ConversationThreadProvider,
  useConversationThreadJumpToRecent,
  useConversationThreadLoadMessagesCentered,
} from './thread-context'

jest.mock('@/stores/inbox-rows', () => ({
  flushInboxRowUpdates: jest.fn(),
  queueInboxRowUpdate: jest.fn(),
}))

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const makeTextMessage = () =>
  Message.makeMessageText({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(301),
    ordinal: T.Chat.numberToOrdinal(301),
    outboxID: T.Chat.stringToOutboxID('outbox-1'),
    text: new HiddenString('stale message'),
    timestamp: 100,
  })

const makeLoadMoreMessagesMock = () =>
  Object.assign(jest.fn(), {
    cancel: () => {},
    flush: () => undefined,
  })

const installLoadMoreMessagesMock = () => {
  const state = getConvoState(convID)
  const loadMoreMessages = makeLoadMoreMessagesMock()
  state.dispatch.loadMoreMessages = loadMoreMessages as typeof state.dispatch.loadMoreMessages
  return loadMoreMessages
}

const wrapper = ({children}: {children: React.ReactNode}) => (
  <ConversationThreadProvider id={convID} seedFromCache={false}>{children}</ConversationThreadProvider>
)

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('centered load clears stale thread state and requests a centered load', () => {
  getConvoState(convID).dispatch.galleryMessagesLoaded([makeTextMessage()])
  expect(getConvoState(convID).messageMap.size).toBe(1)
  const loadMoreMessages = installLoadMoreMessagesMock()
  const {result} = renderHook(() => useConversationThreadLoadMessagesCentered(), {wrapper})

  act(() => {
    result.current(T.Chat.numberToMessageID(999), 'flash')
  })

  expect(getConvoState(convID).messageMap.size).toBe(0)
  expect(getConvoState(convID).messageOrdinals).toBeUndefined()
  expect(loadMoreMessages).toHaveBeenCalledWith(
    expect.objectContaining({
      centeredMessageID: {
        conversationIDKey: convID,
        highlightMode: 'flash',
        messageID: T.Chat.numberToMessageID(999),
      },
      messageIDControl: expect.objectContaining({
        mode: T.RPCChat.MessageIDControlMode.centered,
        pivot: T.Chat.numberToMessageID(999),
      }),
      reason: 'centered',
    })
  )
})

test('jumpToRecent reloads recent messages through the mounted thread action', () => {
  const onThreadLoadStatus = jest.fn()
  const loadMoreMessages = installLoadMoreMessagesMock()
  const {result} = renderHook(() => useConversationThreadJumpToRecent(), {wrapper})

  act(() => {
    result.current({onThreadLoadStatus})
  })

  expect(loadMoreMessages).toHaveBeenCalledWith(
    expect.objectContaining({
      onThreadLoadStatus,
      reason: 'jump to recent',
    })
  )
})
