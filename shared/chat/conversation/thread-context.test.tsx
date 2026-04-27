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

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

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

const wrapper = ({children}: {children: React.ReactNode}) => (
  <ConversationThreadProvider id={convID} seedFromCache={false}>{children}</ConversationThreadProvider>
)

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('centered load clears stale thread state and requests a centered load', async () => {
  getConvoState(convID).dispatch.galleryMessagesLoaded([makeTextMessage()])
  expect(getConvoState(convID).messageMap.size).toBe(1)
  const loadThread = jest
    .spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener')
    .mockResolvedValue({offline: false})
  const {result} = renderHook(() => useConversationThreadLoadMessagesCentered(), {wrapper})

  act(() => {
    result.current(T.Chat.numberToMessageID(999), 'flash')
  })
  await act(async () => {
    await flushPromises()
  })

  expect(getConvoState(convID).messageMap.size).toBe(0)
  expect(getConvoState(convID).messageOrdinals).toBeUndefined()
  expect(loadThread).toHaveBeenCalledWith(
    expect.objectContaining({
      params: expect.objectContaining({
        query: expect.objectContaining({
          messageIDControl: expect.objectContaining({
            mode: T.RPCChat.MessageIDControlMode.centered,
            pivot: T.Chat.numberToMessageID(999),
          }),
        }),
      }),
    })
  )
})

test('jumpToRecent reloads recent messages through the mounted thread action', async () => {
  const onThreadLoadStatus = jest.fn()
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadStatus']?.({
      status: {typ: T.RPCChat.UIChatThreadStatusTyp.server},
    })
    return {offline: false}
  })
  const {result} = renderHook(() => useConversationThreadJumpToRecent(), {wrapper})

  act(() => {
    result.current({onThreadLoadStatus})
  })
  await act(async () => {
    await flushPromises()
  })

  expect(onThreadLoadStatus).toHaveBeenCalledWith(convID, T.RPCChat.UIChatThreadStatusTyp.server)
})
