/** @jest-environment jsdom */
/// <reference types="jest" />

type MockChatState = {
  dispatch: {
    inboxRefresh: jest.Mock
    queueMetaToRequest: jest.Mock
    setInboxRetriedOnCurrentEmpty: jest.Mock
  }
  getUnreadIndicies: () => Map<number, number>
  inboxHasLoaded: boolean
  inboxLayout: undefined
  inboxRetriedOnCurrentEmpty: boolean
}

let mockChatState: MockChatState

jest.mock('@/constants', () => {
  const React = require('react')
  const actual = jest.requireActual('@/constants') as Record<string, unknown> & {
    Router2: Record<string, unknown>
  }
  return {
    ...actual,
    Router2: {
      ...actual.Router2,
      appendNewChatBuilder: jest.fn(),
      useSafeFocusEffect: jest.fn(),
    },
    useOnMountOnce: (cb: () => void) => {
      const ranRef = React.useRef(false)
      React.useEffect(() => {
        if (ranRef.current) {
          return
        }
        ranRef.current = true
        cb()
      }, [cb])
    },
    useRPC: jest.fn(),
  }
})

jest.mock('@/stores/chat', () => ({
  getConvoState: () => ({
    dispatch: {
      tabSelected: jest.fn(),
    },
  }),
  getSelectedConversation: () => '',
  isSplit: false,
  noConversationIDKey: '',
  useChatState: <T>(selector: (state: MockChatState) => T) => selector(mockChatState),
}))

jest.mock('@/stores/config', () => ({
  useConfigState: <T>(selector: (state: {loggedIn: boolean}) => T) => selector({loggedIn: true}),
}))

jest.mock('@/stores/current-user', () => ({
  useCurrentUserState: <T>(selector: (state: {username: string}) => T) => selector({username: 'alice'}),
}))

jest.mock('@react-navigation/core', () => ({
  createNavigationContainerRef: jest.fn(() => ({current: null})),
  useIsFocused: jest.fn(() => true),
}))

import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import {useInboxState} from './use-inbox-state'

let mockLoadInboxNumSmallRows: jest.Mock
let mockInboxRefresh: jest.Mock
let mockQueueMetaToRequest: jest.Mock
let mockSetInboxRetriedOnCurrentEmpty: jest.Mock

beforeEach(() => {
  mockLoadInboxNumSmallRows = jest.fn()
  mockInboxRefresh = jest.fn()
  mockQueueMetaToRequest = jest.fn()
  mockSetInboxRetriedOnCurrentEmpty = jest.fn()
  mockChatState = {
    dispatch: {
      inboxRefresh: mockInboxRefresh,
      queueMetaToRequest: mockQueueMetaToRequest,
      setInboxRetriedOnCurrentEmpty: mockSetInboxRetriedOnCurrentEmpty,
    },
    getUnreadIndicies: () => new Map<number, number>(),
    inboxHasLoaded: true,
    inboxLayout: undefined,
    inboxRetriedOnCurrentEmpty: true,
  }
  ;(C.useRPC as jest.Mock).mockReturnValue(mockLoadInboxNumSmallRows)
  jest.spyOn(T.RPCGen, 'configGuiSetValueRpcPromise').mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
})

test('useInboxState ignores non-positive inbox row counts', () => {
  const {result} = renderHook(() => useInboxState())

  act(() => {
    result.current.setInboxNumSmallRows(0)
    result.current.setInboxNumSmallRows(-3)
  })

  expect(result.current.inboxNumSmallRows).toBe(5)
  expect(T.RPCGen.configGuiSetValueRpcPromise).not.toHaveBeenCalled()
})

test('useInboxState persists inbox row count changes when requested', () => {
  const {result} = renderHook(() => useInboxState())

  act(() => {
    result.current.setInboxNumSmallRows(8)
  })

  expect(result.current.inboxNumSmallRows).toBe(8)
  expect(T.RPCGen.configGuiSetValueRpcPromise).toHaveBeenCalledWith({
    path: 'ui.inboxSmallRows',
    value: {i: 8, isNull: false},
  })
})

test('useInboxState updates inbox row count without persisting when persist is false', () => {
  const {result} = renderHook(() => useInboxState())

  act(() => {
    result.current.setInboxNumSmallRows(7, false)
  })

  expect(result.current.inboxNumSmallRows).toBe(7)
  expect(T.RPCGen.configGuiSetValueRpcPromise).not.toHaveBeenCalled()
})
