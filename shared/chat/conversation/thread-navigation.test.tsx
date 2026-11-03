/** @jest-environment jsdom */
/// <reference types="jest" />
// Thread search and the info panel, on the real navigation tree: where each layout ends up.
import * as T from '@/constants/types'
import type * as React from 'react'
import {act, cleanup, renderHook} from '@testing-library/react'
import {useCurrentUserState} from '@/stores/current-user'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {installNavigation, navigationWrapper, stateShowing, type InstalledNavigation} from '@/test/navigation'
import {ConversationThreadProvider} from './thread-context'
import {
  showConversationInfoPanel,
  toggleConversationThreadSearch,
  useConversationShowInfoPanel,
  useConversationThreadToggleSearch,
} from './thread-navigation'
import {microtasks} from '@/test/flush'

let mockSplit = true
jest.mock('@/constants/chat/layout', () => ({
  get isSplit() {
    return mockSplit
  },
  get threadRouteName() {
    return mockSplit ? 'chatRoot' : 'chatConversation'
  },
}))
// isPhone is a plain property set per test: modules the tree imports read it while this file is still
// loading, before any test-scope variable is initialized.
jest.mock('@/constants/platform', () => ({...jest.requireActual<object>('@/constants/platform'), isPhone: false}))
const setPhone = (phone: boolean) => {
  jest.requireMock<{isPhone: boolean}>('@/constants/platform').isPhone = phone
}

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

let nav: InstalledNavigation
let fake: FakeEngine

// nothing is scripted for it, so a cancel would also fail the test when the fake uninstalls
const cancelSearchCalls = () => fake.calls.filter(c => c.method === 'chat.1.local.cancelActiveSearch')

const visible = () => nav.visibleScreen()
const visibleParams = () => visible()?.params as Record<string, unknown> | undefined

beforeEach(() => {
  mockSplit = true
  setPhone(false)
  fake = installFakeEngine()
  // the thread provider builds a thread only for a signed-in account
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
})

afterEach(() => {
  cleanup()
})

describe('toggleConversationThreadSearch', () => {
  test('split: opens search on the chat root when the visible screen has none', async () => {
    nav = installNavigation({rootState: stateShowing('chatRoot', {params: {conversationIDKey: convID}})})
    act(() => toggleConversationThreadSearch(convID))
    await microtasks()
    expect(visible()?.name).toBe('chatRoot')
    expect(visibleParams()).toMatchObject({conversationIDKey: convID, threadSearch: {}})
    expect(cancelSearchCalls()).toEqual([])
  })

  // the search UI unmounting is what cancels its search
  test('toggling while search shows closes it on that route and leaves the cancel to the search UI', async () => {
    nav = installNavigation({
      rootState: stateShowing('chatRoot', {params: {conversationIDKey: convID, threadSearch: {query: 'x'}}}),
    })
    act(() => toggleConversationThreadSearch(convID))
    await microtasks()
    expect(visible()?.name).toBe('chatRoot')
    expect(visibleParams()?.['threadSearch']).toBeUndefined()
    expect(visibleParams()?.['conversationIDKey']).toBe(convID)
    expect(cancelSearchCalls()).toEqual([])
  })

  test('not split: replaces the conversation route with the search params', () => {
    mockSplit = false
    setPhone(true)
    nav = installNavigation({
      layout: 'phone',
      rootState: stateShowing('chatConversation', {layout: 'phone', params: {conversationIDKey: convID}}),
    })
    act(() => toggleConversationThreadSearch(convID))
    expect(visible()?.name).toBe('chatConversation')
    expect(visibleParams()).toEqual({conversationIDKey: convID, threadSearch: {}})
  })

  test('the hook toggles for the provider conversation', () => {
    const {wrapper: Nav, ...recorder} = navigationWrapper({route: 'chatRoot', params: {conversationIDKey: convID}})
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <Nav>
        <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
      </Nav>
    )
    const {result} = renderHook(() => useConversationThreadToggleSearch(), {wrapper})
    act(() => result.current())
    expect(recorder.visibleScreen()?.params).toMatchObject({conversationIDKey: convID, threadSearch: {}})
  })
})

describe('showConversationInfoPanel', () => {
  test('not a phone: the panel is a chat root param', () => {
    nav = installNavigation({rootState: stateShowing('chatRoot', {params: {conversationIDKey: convID}})})
    act(() => showConversationInfoPanel(convID, true, 'members'))
    expect(visibleParams()).toMatchObject({conversationIDKey: convID, infoPanel: {tab: 'members'}})
    act(() => showConversationInfoPanel(convID, false, 'members'))
    expect(visibleParams()?.['infoPanel']).toBeUndefined()
    expect(nav.pushes()).toEqual([])
  })

  test('phone: showing pushes the panel, replacing one already showing', () => {
    setPhone(true)
    nav = installNavigation({
      layout: 'phone',
      rootState: stateShowing('chatConversation', {layout: 'phone', params: {conversationIDKey: convID}}),
    })
    act(() => showConversationInfoPanel(convID, true, 'settings'))
    expect(visible()?.name).toBe('chatInfoPanel')
    expect(visibleParams()).toEqual({conversationIDKey: convID, tab: 'settings'})
    const depth = nav.getRootState()?.routes?.length
    act(() => showConversationInfoPanel(convID, true, 'bots'))
    expect(visibleParams()).toEqual({conversationIDKey: convID, tab: 'bots'})
    expect(nav.getRootState()?.routes?.length).toBe(depth)
  })

  test('phone: hiding pops the panel only when it is the visible screen', () => {
    setPhone(true)
    nav = installNavigation({
      layout: 'phone',
      rootState: stateShowing('chatConversation', {layout: 'phone', params: {conversationIDKey: convID}}),
    })
    act(() => showConversationInfoPanel(convID, false, undefined))
    expect(visible()?.name).toBe('chatConversation')
    act(() => showConversationInfoPanel(convID, true, 'settings'))
    act(() => showConversationInfoPanel(convID, false, undefined))
    expect(visible()?.name).toBe('chatConversation')
  })

  test('the hook shows the panel for the provider conversation', () => {
    const {wrapper: Nav, ...recorder} = navigationWrapper({route: 'chatRoot', params: {conversationIDKey: convID}})
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <Nav>
        <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
      </Nav>
    )
    const {result} = renderHook(() => useConversationShowInfoPanel(), {wrapper})
    act(() => result.current(true, 'attachments'))
    expect(recorder.visibleScreen()?.params).toMatchObject({conversationIDKey: convID, infoPanel: {tab: 'attachments'}})
  })
})
