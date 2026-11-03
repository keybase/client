/** @jest-environment jsdom */
/// <reference types="jest" />
// useInboxState against the real inbox layout, config and current-user stores, the real
// useOnMountOnce and useRPC, and a fake service answering the layout and GUI config calls.

// isPhone is a plain property set per test: modules the tree imports read it while this file is still
// loading, before any test-scope variable is initialized.
jest.mock('@/constants', () => ({...jest.requireActual<object>('@/constants'), isPhone: false}))
const setPhone = (phone: boolean) => {
  jest.requireMock<{isPhone: boolean}>('@/constants').isPhone = phone
}

import {afterEach, beforeEach, expect, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import * as C from '@/constants'
import type * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {makeRootState, navigationWrapper, type Layout} from '@/test/navigation'
import {useInboxLayoutState} from './layout-state'
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

const emptyLayout: T.RPCChat.UIInboxLayout = {bigTeams: [], smallTeams: [], totalSmallTeams: 0}

let fake: FakeEngine
// the stored ui.inboxSmallRows; undefined is a path never set
let storedRows: number | undefined
const layoutRequests = () => fake.calls.filter(c => c.method === 'chat.1.local.requestInboxLayout').length
const savedRows = () => fake.calls.filter(c => c.method === 'keybase.1.config.guiSetValue').map(c => c.params as unknown)

// An inbox that has (or has not) had its layout from the service
const layoutLoaded = (loaded: boolean, retriedOnCurrentEmpty = true) => {
  useInboxLayoutState.setState({
    hasLoaded: loaded,
    layout: loaded ? emptyLayout : undefined,
    retriedOnCurrentEmpty,
  })
}

beforeEach(() => {
  resetAllStores()
  storedRows = undefined
  fake = installFakeEngine()
  // the service answers the request at once; the layout itself arrives later as a notification
  fake.answer('chat.1.local.requestInboxLayout', () => null)
  fake.answer('keybase.1.config.guiGetValue', () =>
    storedRows === undefined ? {isNull: true} : {i: storedRows, isNull: false}
  )
  fake.answer('keybase.1.config.guiSetValue', () => null)
  useConfigState.setState({loggedIn: true, userSwitching: false})
  useCurrentUserState.setState({username: 'testuser'})
  layoutLoaded(true)
})

afterEach(() => {
  cleanup()
  g.isMobile = false
  setPhone(false)
})

test('useInboxState starts from the stored inbox row count', async () => {
  storedRows = 9
  const {result} = renderInbox()
  expect(result.current.inboxNumSmallRows).toBe(5)

  await flush()

  expect(result.current.inboxNumSmallRows).toBe(9)
})

test('useInboxState ignores non-positive inbox row counts', async () => {
  const {result} = renderInbox()
  await flush()

  act(() => {
    result.current.setInboxNumSmallRows(0)
    result.current.setInboxNumSmallRows(-3)
  })
  await flush()

  expect(result.current.inboxNumSmallRows).toBe(5)
  expect(savedRows()).toEqual([])
})

test('useInboxState persists inbox row count changes when requested', async () => {
  const {result} = renderInbox()
  await flush()

  act(() => {
    result.current.setInboxNumSmallRows(8)
  })
  await flush()

  expect(result.current.inboxNumSmallRows).toBe(8)
  expect(savedRows()).toEqual([expect.objectContaining({path: 'ui.inboxSmallRows', value: {i: 8, isNull: false}})])
})

test('useInboxState updates inbox row count without persisting when persist is false', async () => {
  const {result} = renderInbox()
  await flush()

  act(() => {
    result.current.setInboxNumSmallRows(7, false)
  })
  await flush()

  expect(result.current.inboxNumSmallRows).toBe(7)
  expect(savedRows()).toEqual([])
})

test('a row count the user picks is not overwritten by the stored one arriving later', async () => {
  storedRows = 9
  const held = fake.hold('keybase.1.config.guiGetValue')
  const {result} = renderInbox()
  await flush()

  act(() => {
    result.current.setInboxNumSmallRows(7, false)
  })
  held.forEach(h => h.reply({i: 9, isNull: false}))
  await flush()

  expect(result.current.inboxNumSmallRows).toBe(7)
})

test('a never-loaded inbox on desktop asks the service for its layout on mount', async () => {
  layoutLoaded(false)
  renderInbox()
  await flush()

  expect(layoutRequests()).toBeGreaterThan(0)
})

// The inbox refresh does not ask the service while a switch is under way, so the first load has to
// fire again once it ends.
test('useInboxState loads the inbox once an account switch ends', async () => {
  layoutLoaded(false)
  useConfigState.setState({userSwitching: true})
  renderInbox()
  await flush()
  expect(layoutRequests()).toBe(0)

  act(() => {
    useConfigState.setState({userSwitching: false})
  })
  await flush()

  expect(layoutRequests()).toBeGreaterThan(0)
})

// On mobile the inbox screen stays mounted under a thread, and loading it there would race the
// thread's own loads: it loads once it comes back into focus.
describe('focus gates loading on mobile', () => {
  const onPhone = () => {
    g.isMobile = true
    setPhone(true)
  }

  test('a never-loaded inbox under a thread waits for focus, then loads', async () => {
    onPhone()
    layoutLoaded(false)
    renderInbox({covered: true, layout: 'phone'})
    await flush()
    expect(layoutRequests()).toBe(0)

    act(() => C.Router2.navigateUp())
    await flush()

    expect(layoutRequests()).toBeGreaterThan(0)
  })

  test('a refresh asked for while under a thread runs once the inbox is focused', async () => {
    onPhone()
    renderInbox({covered: true, layout: 'phone', refreshInbox: {nonce: 'n1', reason: 'inboxStale'}})
    await flush()
    expect(layoutRequests()).toBe(0)

    act(() => C.Router2.navigateUp())
    await flush()

    expect(layoutRequests()).toBe(1)
  })

  test('an empty synced inbox under a thread retries only once focused', async () => {
    onPhone()
    layoutLoaded(true, false)
    renderInbox({covered: true, layout: 'phone'})
    await flush()
    expect(layoutRequests()).toBe(0)

    act(() => C.Router2.navigateUp())
    await flush()

    expect(useInboxLayoutState.getState().retriedOnCurrentEmpty).toBe(true)
    expect(layoutRequests()).toBe(1)
  })

  test('a focused inbox loads at once', async () => {
    onPhone()
    layoutLoaded(false)
    renderInbox({layout: 'phone'})
    await flush()
    expect(layoutRequests()).toBeGreaterThan(0)
  })

  test('on desktop focus does not gate: an inbox under a modal still loads', async () => {
    renderInbox({covered: true, refreshInbox: {nonce: 'n1', reason: 'inboxStale'}})
    await flush()
    expect(layoutRequests()).toBe(1)
  })
})
