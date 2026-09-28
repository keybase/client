/** @jest-environment jsdom */
/// <reference types="jest" />
// Thread search and the info panel: which navigation each layout asks for.
import * as Router from '@/constants/router'
import * as T from '@/constants/types'
import type * as React from 'react'
import {act, cleanup, renderHook} from '@testing-library/react'
import {ConversationThreadProvider} from './thread-context'
import {
  showConversationInfoPanel,
  toggleConversationThreadSearch,
  useConversationShowInfoPanel,
  useConversationThreadToggleSearch,
} from './thread-navigation'

let mockSplit = true
let mockPhone = false
jest.mock('@/constants/chat/layout', () => ({
  get isSplit() {
    return mockSplit
  },
  get threadRouteName() {
    return mockSplit ? 'chatRoot' : 'chatConversation'
  },
}))
jest.mock('@/constants/platform', () => {
  const actual = jest.requireActual<object>('@/constants/platform')
  return Object.defineProperty({...actual}, 'isPhone', {get: () => mockPhone})
})

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

type Visible = ReturnType<typeof Router.getVisibleScreen>
const visible = (name: string, params?: object) => ({key: name, name, params}) as unknown as Visible

let setChatRootParams: jest.SpyInstance
let navigateAppend: jest.SpyInstance
let navigateUp: jest.SpyInstance
let getVisibleScreen: jest.SpyInstance
let cancelSearch: jest.SpyInstance

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

beforeEach(() => {
  mockSplit = true
  mockPhone = false
  setChatRootParams = jest.spyOn(Router, 'setChatRootParams').mockReturnValue(true)
  navigateAppend = jest.spyOn(Router, 'navigateAppend').mockReturnValue(true)
  navigateUp = jest.spyOn(Router, 'navigateUp').mockImplementation(() => {})
  getVisibleScreen = jest.spyOn(Router, 'getVisibleScreen').mockReturnValue(undefined)
  cancelSearch = jest.spyOn(T.RPCChat, 'localCancelActiveSearchRpcPromise').mockResolvedValue()
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
})

describe('toggleConversationThreadSearch', () => {
  test('split: opens search on the chat root when the visible screen has none', async () => {
    toggleConversationThreadSearch(convID)
    await flushPromises()
    expect(setChatRootParams).toHaveBeenCalledWith({conversationIDKey: convID, threadSearch: {}})
    expect(navigateAppend).not.toHaveBeenCalled()
    expect(cancelSearch).not.toHaveBeenCalled()
  })

  test('split: a query goes with it', () => {
    toggleConversationThreadSearch(convID, false, 'hello')
    expect(setChatRootParams).toHaveBeenCalledWith({conversationIDKey: convID, threadSearch: {query: 'hello'}})
  })

  test('toggling while search shows closes it and cancels the running search', async () => {
    getVisibleScreen.mockReturnValue(visible('chatRoot', {threadSearch: {query: 'x'}}))
    toggleConversationThreadSearch(convID)
    await flushPromises()
    expect(setChatRootParams).toHaveBeenCalledWith({conversationIDKey: convID, threadSearch: undefined})
    expect(cancelSearch).toHaveBeenCalledTimes(1)
  })

  test('an explicit hide wins over the visible state, and a show ignores the query when empty', async () => {
    toggleConversationThreadSearch(convID, true, 'ignored')
    await flushPromises()
    expect(setChatRootParams).toHaveBeenLastCalledWith({conversationIDKey: convID, threadSearch: undefined})
    expect(cancelSearch).toHaveBeenCalledTimes(1)
    getVisibleScreen.mockReturnValue(visible('chatRoot', {threadSearch: {}}))
    toggleConversationThreadSearch(convID, false, '')
    expect(setChatRootParams).toHaveBeenLastCalledWith({conversationIDKey: convID, threadSearch: {}})
  })

  test('not split: replaces the conversation route with the search params', () => {
    mockSplit = false
    toggleConversationThreadSearch(convID, undefined, 'q')
    expect(setChatRootParams).not.toHaveBeenCalled()
    expect(navigateAppend).toHaveBeenCalledWith(
      {name: 'chatConversation', params: {conversationIDKey: convID, threadSearch: {query: 'q'}}},
      true
    )
  })

  test('the hook toggles for the provider conversation', () => {
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
    )
    const {result} = renderHook(() => useConversationThreadToggleSearch(), {wrapper})
    act(() => result.current(false, 'hi'))
    expect(setChatRootParams).toHaveBeenCalledWith({conversationIDKey: convID, threadSearch: {query: 'hi'}})
  })
})

describe('showConversationInfoPanel', () => {
  test('not a phone: the panel is a chat root param', () => {
    showConversationInfoPanel(convID, true, 'members')
    expect(setChatRootParams).toHaveBeenLastCalledWith({conversationIDKey: convID, infoPanel: {tab: 'members'}})
    showConversationInfoPanel(convID, false, 'members')
    expect(setChatRootParams).toHaveBeenLastCalledWith({conversationIDKey: convID, infoPanel: undefined})
    expect(navigateAppend).not.toHaveBeenCalled()
  })

  test('phone: showing pushes the panel, replacing one already showing', () => {
    mockPhone = true
    showConversationInfoPanel(convID, true, 'settings')
    expect(navigateAppend).toHaveBeenLastCalledWith(
      {name: 'chatInfoPanel', params: {conversationIDKey: convID, tab: 'settings'}},
      false
    )
    getVisibleScreen.mockReturnValue(visible('chatInfoPanel'))
    showConversationInfoPanel(convID, true, 'bots')
    expect(navigateAppend).toHaveBeenLastCalledWith(
      {name: 'chatInfoPanel', params: {conversationIDKey: convID, tab: 'bots'}},
      true
    )
    expect(setChatRootParams).not.toHaveBeenCalled()
  })

  test('phone: hiding pops the panel only when it is the visible screen', () => {
    mockPhone = true
    showConversationInfoPanel(convID, false, undefined)
    expect(navigateUp).not.toHaveBeenCalled()
    getVisibleScreen.mockReturnValue(visible('chatInfoPanel'))
    showConversationInfoPanel(convID, false, undefined)
    expect(navigateUp).toHaveBeenCalledTimes(1)
    expect(setChatRootParams).not.toHaveBeenCalled()
  })

  test('the hook shows the panel for the provider conversation', () => {
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
    )
    const {result} = renderHook(() => useConversationShowInfoPanel(), {wrapper})
    act(() => result.current(true, 'attachments'))
    expect(setChatRootParams).toHaveBeenCalledWith({conversationIDKey: convID, infoPanel: {tab: 'attachments'}})
  })
})
