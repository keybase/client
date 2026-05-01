/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import type * as React from 'react'
import * as T from '@/constants/types'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {useShellState} from '@/stores/shell'
import {
  ConversationThreadLoadStatusProvider,
  useThreadLoadStatus,
  useThreadLoadStatusOptions,
  useThreadLoadStatusReporter,
} from './thread-load-status-context'
import {ConversationThreadProvider} from './thread-context'

let mockRouteFocused = true
let mockVisibleScreenName: string | undefined
jest.mock('@react-navigation/core', () => ({
  createNavigationContainerRef: jest.fn(() => ({current: null})),
  useIsFocused: () => mockRouteFocused,
}))
jest.mock('@/constants/router', () => {
  const actual = jest.requireActual('@/constants/router')
  return {
    ...actual,
    getVisibleScreen: () => (mockVisibleScreenName ? {name: mockVisibleScreenName} : undefined),
  }
})

jest.mock('@/stores/inbox-rows', () => ({
  flushInboxRowUpdates: jest.fn(),
  getInboxRowTrustedState: jest.fn(() => undefined),
  queueInboxRowUpdate: jest.fn(),
  setInboxRowTrustedState: jest.fn(),
  syncInboxRowBadgeState: jest.fn(),
  syncInboxRowsFromLayout: jest.fn(),
  syncInboxRowsFromMetaAndParticipants: jest.fn(),
  syncInboxRowsFromMetas: jest.fn(),
  syncInboxRowsFromParticipantMap: jest.fn(),
  syncInboxRowsFromParticipants: jest.fn(),
  updateInboxRowTyping: jest.fn(),
}))

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

beforeEach(() => {
  mockRouteFocused = true
  mockVisibleScreenName = undefined
  jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockResolvedValue(undefined)
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

const wrapper = ({children}: {children: React.ReactNode}) => (
  <ConversationThreadProvider id={convID}>
    <ConversationThreadLoadStatusProvider id={convID} skipThreadLoadOnSelection={true}>
      {children}
    </ConversationThreadLoadStatusProvider>
  </ConversationThreadProvider>
)

test('thread load status reporter ignores stale conversation statuses', () => {
  const {result} = renderHook(
    () => ({
      report: useThreadLoadStatusReporter(),
      status: useThreadLoadStatus(),
    }),
    {wrapper}
  )

  expect(result.current.status).toBe(T.RPCChat.UIChatThreadStatusTyp.none)

  act(() => {
    result.current.report(otherConvID, T.RPCChat.UIChatThreadStatusTyp.server)
  })
  expect(result.current.status).toBe(T.RPCChat.UIChatThreadStatusTyp.none)

  act(() => {
    result.current.report(convID, T.RPCChat.UIChatThreadStatusTyp.server)
  })
  expect(result.current.status).toBe(T.RPCChat.UIChatThreadStatusTyp.server)
})

test('thread load options invalidate when the mounted provider unmounts', () => {
  const {result, unmount} = renderHook(() => useThreadLoadStatusOptions(), {wrapper})
  const options = result.current

  expect(options.isThreadLoadCurrent?.()).toBe(true)

  unmount()

  expect(options.isThreadLoadCurrent?.()).toBe(false)
})

test('mounted stale-thread reload reports status through the provider', async () => {
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadStatus']?.({
      status: {typ: T.RPCChat.UIChatThreadStatusTyp.server},
    })
    await Promise.resolve()
    return {offline: false}
  })
  const {result} = renderHook(() => useThreadLoadStatus(), {wrapper})

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          uid: '',
          updates: [
            {
              convID: T.Chat.keyToConversationID(convID),
              updateType: T.RPCChat.StaleUpdateType.newactivity,
            },
          ],
        },
      },
      type: 'chat.1.NotifyChat.ChatThreadsStale',
    } as never)
  })
  await act(async () => {
    await flushPromises()
  })

  expect(result.current).toBe(T.RPCChat.UIChatThreadStatusTyp.server)
})

test('mounted route focus reload reports status through the provider', async () => {
  mockRouteFocused = false
  jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadStatus']?.({
      status: {typ: T.RPCChat.UIChatThreadStatusTyp.server},
    })
    await Promise.resolve()
    return {offline: false}
  })
  const {rerender, result} = renderHook(() => useThreadLoadStatus(), {wrapper})

  act(() => {
    mockRouteFocused = true
    rerender()
  })
  await act(async () => {
    await flushPromises()
  })

  expect(result.current).toBe(T.RPCChat.UIChatThreadStatusTyp.server)
})

test('mounted route focus skips reload after returning from emoji picker', async () => {
  mockRouteFocused = false
  mockVisibleScreenName = 'chatChooseEmoji'
  const getThread = jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockResolvedValue({
    offline: false,
  })
  const {rerender} = renderHook(() => useThreadLoadStatus(), {wrapper})

  act(() => {
    mockRouteFocused = true
    mockVisibleScreenName = undefined
    rerender()
  })
  await act(async () => {
    await flushPromises()
  })

  expect(getThread).not.toHaveBeenCalled()
})

test('mounted app foreground does not reload the thread', async () => {
  const getThread = jest.spyOn(T.RPCChat, 'localGetThreadNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatThreadStatus']?.({
      status: {typ: T.RPCChat.UIChatThreadStatusTyp.server},
    })
    await Promise.resolve()
    return {offline: false}
  })
  renderHook(() => useThreadLoadStatus(), {wrapper})

  act(() => {
    useShellState.getState().dispatch.changedFocus(false)
  })
  await act(async () => {
    await flushPromises()
  })
  act(() => {
    useShellState.getState().dispatch.changedFocus(true)
  })
  await act(async () => {
    await flushPromises()
  })

  expect(getThread).not.toHaveBeenCalled()
})
