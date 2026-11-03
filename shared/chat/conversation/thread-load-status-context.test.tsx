/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import type * as React from 'react'
import * as T from '@/constants/types'
import {routeChatNotification} from '@/chat/notification-router'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {
  ConversationThreadLoadStatusProvider,
  useThreadLoadStatus,
  useThreadLoadStatusOptions,
  useThreadLoadStatusReporter,
} from './thread-load-status-context'
import {navigationWrapper} from '@/test/navigation'
import {ConversationThreadProvider} from './thread-context'
import {microtasks} from '@/test/flush'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

beforeEach(() => {
  Nav = navigationWrapper({params: {conversationIDKey: convID}, route: 'chatRoot'}).wrapper
  jest.spyOn(T.RPCChat, 'localRequestInboxUnboxRpcPromise').mockResolvedValue(undefined)
  useConfigState.setState({loggedIn: true})
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

let Nav: ReturnType<typeof navigationWrapper>['wrapper']
const wrapper = ({children}: {children: React.ReactNode}) => (
  <Nav>
    <ConversationThreadProvider id={convID}>
      <ConversationThreadLoadStatusProvider id={convID} skipThreadLoadOnSelection={true}>
        {children}
      </ConversationThreadLoadStatusProvider>
    </ConversationThreadProvider>
  </Nav>
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
    routeChatNotification({
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
    await microtasks()
  })

  expect(result.current).toBe(T.RPCChat.UIChatThreadStatusTyp.server)
})
