/** @jest-environment jsdom */
/// <reference types="jest" />

type MockInboxLayoutState = {
  dispatch: {
    refresh: jest.Mock
    setRetriedOnCurrentEmpty: jest.Mock
  }
  hasLoaded: boolean
  layout: undefined
  retriedOnCurrentEmpty: boolean
}

let mockInboxLayoutState: MockInboxLayoutState
let mockConfigState = {loggedIn: true, userSwitching: false}

let mockPhone = false
jest.mock('@/constants', () => {
  const React = require('react')
  const actual = jest.requireActual<Record<string, unknown>>('@/constants')
  const mocked = {
    ...actual,
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
  return Object.defineProperty(mocked, 'isPhone', {get: () => mockPhone})
})

jest.mock('@/constants/chat', () => ({
  noConversationIDKey: '',
}))

jest.mock('./layout-state', () => ({
  useInboxLayout: () => ({
    hasLoaded: mockInboxLayoutState.hasLoaded,
    layout: mockInboxLayoutState.layout,
    refresh: mockInboxLayoutState.dispatch.refresh,
  }),
  useInboxRetryState: () => ({
    retriedOnCurrentEmpty: mockInboxLayoutState.retriedOnCurrentEmpty,
    setRetriedOnCurrentEmpty: mockInboxLayoutState.dispatch.setRetriedOnCurrentEmpty,
  }),
}))

jest.mock('./metadata', () => ({
  queueMetaToRequest: jest.fn(),
}))

jest.mock('@/stores/config', () => ({
  useConfigState: <T>(selector: (state: typeof mockConfigState) => T) => selector(mockConfigState),
}))

jest.mock('@/stores/current-user', () => ({
  useCurrentUserState: <T>(selector: (state: {username: string}) => T) => selector({username: 'alice'}),
}))

import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {makeRootState, navigationWrapper, type Layout} from '@/test/navigation'
import {useInboxState} from './use-inbox-state'

const g = globalThis as unknown as {isMobile: boolean}

// The hook runs as the chat root of the real navigation tree. `covered` puts a conversation over it
// (on a phone the thread is pushed above the tab bar), so the inbox is mounted but not focused.
const renderInbox = (
  p: {covered?: boolean; layout?: Layout; refreshInbox?: T.Chat.ChatRootInboxRefresh} = {}
) => {
  const layout = p.layout ?? 'desktop'
  const above = p.covered ? [{name: 'chatConversation', params: {conversationIDKey: 'c1'}}] : []
  const rootState =
    layout === 'phone'
      ? makeRootState({above, tab: Tabs.chatTab})
      : makeRootState({above: p.covered ? [{name: 'chatNewChat'}] : [], tab: Tabs.chatTab})
  const {wrapper} = navigationWrapper({layout, rootState, route: 'chatRoot'})
  return renderHook(() => useInboxState(undefined, false, p.refreshInbox), {wrapper})
}

let mockLoadInboxNumSmallRows: jest.Mock
let mockInboxRefresh: jest.Mock
let mockSetInboxRetriedOnCurrentEmpty: jest.Mock

beforeEach(() => {
  mockLoadInboxNumSmallRows = jest.fn()
  mockInboxRefresh = jest.fn()
  mockConfigState = {loggedIn: true, userSwitching: false}
  mockSetInboxRetriedOnCurrentEmpty = jest.fn()
  mockInboxLayoutState = {
    dispatch: {
      refresh: mockInboxRefresh,
      setRetriedOnCurrentEmpty: mockSetInboxRetriedOnCurrentEmpty,
    },
    hasLoaded: true,
    layout: undefined,
    retriedOnCurrentEmpty: true,
  }
  ;(C.useRPC as jest.Mock).mockReturnValue(mockLoadInboxNumSmallRows)
  jest.spyOn(T.RPCGen, 'configGuiSetValueRpcPromise').mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  g.isMobile = false
  mockPhone = false
})

test('useInboxState ignores non-positive inbox row counts', () => {
  const {result} = renderInbox()

  act(() => {
    result.current.setInboxNumSmallRows(0)
    result.current.setInboxNumSmallRows(-3)
  })

  expect(result.current.inboxNumSmallRows).toBe(5)
  expect(T.RPCGen.configGuiSetValueRpcPromise).not.toHaveBeenCalled()
})

test('useInboxState persists inbox row count changes when requested', () => {
  const {result} = renderInbox()

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
  const {result} = renderInbox()

  act(() => {
    result.current.setInboxNumSmallRows(7, false)
  })

  expect(result.current.inboxNumSmallRows).toBe(7)
  expect(T.RPCGen.configGuiSetValueRpcPromise).not.toHaveBeenCalled()
})

// The inbox RPCs refuse to run while a switch is under way, so the first load has to wait for it.
test('useInboxState loads the inbox once an account switch ends', () => {
  mockInboxRefresh.mockReturnValue(Promise.resolve())
  mockInboxLayoutState.hasLoaded = false
  mockConfigState = {loggedIn: true, userSwitching: true}
  const {rerender} = renderInbox()
  // what fired on mount ran into the switch and was refused
  mockInboxRefresh.mockClear()

  mockConfigState = {loggedIn: true, userSwitching: false}
  rerender()

  expect(mockInboxRefresh).toHaveBeenCalledWith('componentNeverLoaded')
})

// On mobile the inbox screen stays mounted under a thread, and loading it there would race the
// thread's own loads: it loads once it comes back into focus.
describe('focus gates loading on mobile', () => {
  const onPhone = () => {
    g.isMobile = true
    mockPhone = true
  }

  test('a never-loaded inbox under a thread waits for focus, then loads', () => {
    onPhone()
    mockInboxRefresh.mockReturnValue(Promise.resolve())
    mockInboxLayoutState.hasLoaded = false
    renderInbox({covered: true, layout: 'phone'})
    expect(mockInboxRefresh).not.toHaveBeenCalled()

    act(() => C.Router2.navigateUp())

    expect(mockInboxRefresh).toHaveBeenCalledWith('componentNeverLoaded')
  })

  test('a refresh asked for while under a thread runs once the inbox is focused', () => {
    onPhone()
    mockInboxRefresh.mockReturnValue(Promise.resolve())
    renderInbox({covered: true, layout: 'phone', refreshInbox: {nonce: 'n1', reason: 'inboxStale'}})
    expect(mockInboxRefresh).not.toHaveBeenCalled()

    act(() => C.Router2.navigateUp())

    expect(mockInboxRefresh).toHaveBeenCalledWith('inboxStale')
  })

  test('an empty synced inbox under a thread retries only once focused', () => {
    onPhone()
    mockInboxRefresh.mockReturnValue(Promise.resolve())
    mockInboxLayoutState.retriedOnCurrentEmpty = false
    renderInbox({covered: true, layout: 'phone'})
    expect(mockInboxRefresh).not.toHaveBeenCalled()

    act(() => C.Router2.navigateUp())

    expect(mockSetInboxRetriedOnCurrentEmpty).toHaveBeenCalledWith(true)
    expect(mockInboxRefresh).toHaveBeenCalledWith('inboxSyncedCurrentButEmpty')
  })

  test('a focused inbox loads at once', () => {
    onPhone()
    mockInboxRefresh.mockReturnValue(Promise.resolve())
    mockInboxLayoutState.hasLoaded = false
    renderInbox({layout: 'phone'})
    expect(mockInboxRefresh).toHaveBeenCalledWith('componentNeverLoaded')
  })

  test('on desktop focus does not gate: an inbox under a modal still loads', () => {
    mockInboxRefresh.mockReturnValue(Promise.resolve())
    renderInbox({covered: true, refreshInbox: {nonce: 'n1', reason: 'inboxStale'}})
    expect(mockInboxRefresh).toHaveBeenCalledWith('inboxStale')
  })
})
