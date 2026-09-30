/** @jest-environment jsdom */
/// <reference types="jest" />
// The scroll-target decision tests model the thread with threadTransitions. This holds each transition
// to what the real thread store does, so a decision test cannot rest on a state the thread never
// produces.
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {act, cleanup, renderHook} from '@testing-library/react'
import type * as React from 'react'
import {metasReceived} from '@/chat/inbox/metadata'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {ConversationThreadProvider, useConversationThreadActions} from '../thread-context'
import {emptyThread, range, threadTransitions, type ThreadSnapshot} from './list-test-store'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const textAt = (n: number) =>
  Message.makeMessageText({
    author: 'testuser',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(n),
    ordinal: T.Chat.numberToOrdinal(n),
    text: new HiddenString(`message ${n}`),
    timestamp: 100,
  })

const wrapper = ({children}: {children: React.ReactNode}) => (
  <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
)

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'testuser',
  })
  metasReceived(
    [{...Meta.makeConversationMeta(), conversationIDKey: convID, readMsgID: T.Chat.numberToMessageID(0)}],
    undefined,
    {force: true}
  )
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

const mountThread = () => {
  const {result} = renderHook(() => useConversationThreadActions(), {wrapper})
  const snapshot = (): ThreadSnapshot => {
    const {clearVersion, loaded, messageOrdinals} = result.current.getSnapshot()
    return {clearVersion, loaded, messageOrdinals}
  }
  const load = (ordinals: ReadonlyArray<T.Chat.Ordinal>) =>
    act(() => {
      result.current.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: ordinals.map(o => textAt(T.Chat.ordinalToNumber(o))),
        moreToLoad: false,
        scrollDirection: 'none',
      })
    })
  return {
    clear: () => act(() => result.current.messagesClear()),
    load,
    receive: (n: number) => act(() => result.current.addMessages([textAt(n)])),
    snapshot,
  }
}

test('a fresh thread is empty and unloaded', () => {
  expect(mountThread().snapshot()).toEqual(emptyThread)
})

test('a load fills the window and marks it loaded', () => {
  const thread = mountThread()
  thread.load(range(1, 60))
  expect(thread.snapshot()).toEqual(threadTransitions.loaded(emptyThread, range(1, 60)))
})

test('paging merges into the window', () => {
  const thread = mountThread()
  thread.load(range(21, 80))
  const before = thread.snapshot()
  thread.load(range(1, 20))
  expect(thread.snapshot()).toEqual(threadTransitions.loaded(before, range(1, 20)))
})

test('a clear empties the window, marks it unloaded and starts a new dataset, in one update', () => {
  const thread = mountThread()
  thread.load(range(1, 60))
  const before = thread.snapshot()
  thread.clear()
  expect(thread.snapshot()).toEqual(threadTransitions.cleared(before))
})

test('a centred jump is a clear, then a load of the window around the target', () => {
  const thread = mountThread()
  thread.load(range(1, 60))
  let expected = threadTransitions.loaded(emptyThread, range(1, 60))
  thread.clear()
  expected = threadTransitions.cleared(expected)
  thread.load(range(450, 550))
  expected = threadTransitions.loaded(expected, range(450, 550))
  expect(thread.snapshot()).toEqual(expected)
})

test('a message arriving into a window that reaches the newest is appended', () => {
  const thread = mountThread()
  thread.load(range(1, 60))
  const before = thread.snapshot()
  thread.receive(61)
  expect(thread.snapshot()).toEqual(threadTransitions.received(before, T.Chat.numberToOrdinal(61)))
})

test('a message arriving between a clear and its reload is not placed, and leaves an empty window', () => {
  const thread = mountThread()
  thread.load(range(1, 60))
  thread.clear()
  const cleared = thread.snapshot()
  thread.receive(61)
  expect(thread.snapshot()).toEqual(threadTransitions.receivedDuringReload(cleared))
})
