/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, render, screen} from '@testing-library/react'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import type * as React from 'react'
import {resetAllStores} from '@/util/zustand'
import {useShellState} from '@/stores/shell'
import NormalWrapper from './container'

let mockConversationIDKey: T.Chat.ConversationIDKey
let mockLoaded = true
let mockMeta: T.Chat.ConversationMeta
let mockSetOrangeLine: ((messageID: T.Chat.MessageID) => void) | undefined

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

const makeMeta = (
  conversationIDKey: T.Chat.ConversationIDKey,
  readMsgID = 1,
  maxVisibleMsgID = 1
): T.Chat.ConversationMeta => ({
  ...Meta.makeConversationMeta(),
  conversationIDKey,
  maxVisibleMsgID: T.Chat.numberToMessageID(maxVisibleMsgID),
  readMsgID: T.Chat.numberToMessageID(readMsgID),
})

jest.mock('.', () => {
  const React = require('react') as typeof import('react')
  const {OrangeLineContext, SetOrangeLineContext} =
    require('../orange-line-context') as typeof import('../orange-line-context')
  const MockNormal = () => {
    const orangeLine = React.useContext(OrangeLineContext)
    const setOrangeLine = React.useContext(SetOrangeLineContext)
    React.useEffect(() => {
      mockSetOrangeLine = setOrangeLine
    }, [setOrangeLine])
    return React.createElement('div', {'data-testid': 'orange-line'}, String(orangeLine))
  }
  return {__esModule: true, default: MockNormal}
})

jest.mock('@/engine/action-listener', () => ({
  useEngineActionListener: jest.fn(),
}))

jest.mock('../thread-context', () => ({
  useConversationThreadID: () => mockConversationIDKey,
  useConversationThreadLoaded: () => mockLoaded,
  useConversationThreadMeta: () => mockMeta,
}))

jest.mock('../team-hooks', () => {
  const React = require('react') as typeof import('react')
  const ChatTeamProvider = ({children}: {children: React.ReactNode}) =>
    React.createElement(React.Fragment, null, children)
  return {ChatTeamProvider}
})

jest.mock('../center-context', () => {
  const React = require('react') as typeof import('react')
  const ConversationCenterProvider = ({children}: {children: React.ReactNode}) =>
    React.createElement(React.Fragment, null, children)
  return {ConversationCenterProvider}
})

jest.mock('../input-area/input-state', () => {
  const React = require('react') as typeof import('react')
  const ConversationInputProvider = ({children}: {children: React.ReactNode}) =>
    React.createElement(React.Fragment, null, children)
  return {ConversationInputProvider}
})

jest.mock('../thread-load-status-context', () => {
  const React = require('react') as typeof import('react')
  const ConversationThreadLoadStatusProvider = ({children}: {children: React.ReactNode}) =>
    React.createElement(React.Fragment, null, children)
  return {ConversationThreadLoadStatusProvider}
})

jest.mock('@/common-adapters/markdown/maybe-mention/context', () => {
  const React = require('react') as typeof import('react')
  const MaybeMentionProvider = ({children}: {children: React.ReactNode}) =>
    React.createElement(React.Fragment, null, children)
  return {MaybeMentionProvider}
})

jest.mock('../thread-search-route', () => ({
  useChatThreadRouteParams: () => undefined,
}))

beforeEach(() => {
  mockConversationIDKey = convID
  mockLoaded = true
  mockMeta = makeMeta(convID)
  mockSetOrangeLine = undefined
  useShellState.setState({active: true, mobileAppState: 'active'})
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('orange line stays fixed across unreadline refreshes while the thread stays mounted', async () => {
  const initialOrangeLine = T.Chat.numberToOrdinal(10)
  jest
    .spyOn(T.RPCChat, 'localGetUnreadlineRpcPromise')
    .mockResolvedValueOnce({offline: false, unreadlineID: T.Chat.numberToMessageID(10)})
    .mockResolvedValueOnce({offline: false, unreadlineID: T.Chat.numberToMessageID(20)})
    .mockResolvedValueOnce({offline: false, unreadlineID: T.Chat.numberToMessageID(30)})

  const {rerender} = render(<NormalWrapper />)
  await act(async () => {
    await flushPromises()
  })

  expect(screen.getByTestId('orange-line').textContent).toBe(String(initialOrangeLine))

  act(() => {
    useShellState.setState({active: false})
  })
  await act(async () => {
    await flushPromises()
  })

  expect(screen.getByTestId('orange-line').textContent).toBe(String(initialOrangeLine))

  mockMeta = makeMeta(convID, 1, 30)
  rerender(<NormalWrapper />)
  await act(async () => {
    await flushPromises()
  })

  expect(screen.getByTestId('orange-line').textContent).toBe(String(initialOrangeLine))
})

test('manual orange line updates do not move an existing orange line', async () => {
  const initialOrangeLine = T.Chat.numberToOrdinal(10)
  jest
    .spyOn(T.RPCChat, 'localGetUnreadlineRpcPromise')
    .mockResolvedValue({offline: false, unreadlineID: T.Chat.numberToMessageID(10)})

  render(<NormalWrapper />)
  await act(async () => {
    await flushPromises()
  })

  expect(screen.getByTestId('orange-line').textContent).toBe(String(initialOrangeLine))

  act(() => {
    mockSetOrangeLine?.(T.Chat.numberToMessageID(50))
  })

  expect(screen.getByTestId('orange-line').textContent).toBe(String(initialOrangeLine))
})

test('orange line resets after switching to another thread', async () => {
  const initialOrangeLine = T.Chat.numberToOrdinal(10)
  const nextThreadOrangeLine = T.Chat.numberToOrdinal(40)
  jest
    .spyOn(T.RPCChat, 'localGetUnreadlineRpcPromise')
    .mockResolvedValueOnce({offline: false, unreadlineID: T.Chat.numberToMessageID(10)})
    .mockResolvedValueOnce({offline: false, unreadlineID: T.Chat.numberToMessageID(40)})

  const {rerender} = render(<NormalWrapper />)
  await act(async () => {
    await flushPromises()
  })

  expect(screen.getByTestId('orange-line').textContent).toBe(String(initialOrangeLine))

  mockConversationIDKey = otherConvID
  mockMeta = makeMeta(otherConvID, 1, 40)
  rerender(<NormalWrapper />)
  await act(async () => {
    await flushPromises()
  })

  expect(screen.getByTestId('orange-line').textContent).toBe(String(nextThreadOrangeLine))
})
