/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, render, screen} from '@testing-library/react'
import * as C from '@/constants'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import * as React from 'react'
import {useEngineActionListener} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import {useShellState} from '@/stores/shell'
import {OrangeLineContext, SetOrangeLineContext, setConversationOrangeLine} from '@/chat/conversation/orange-line-context'
import NormalWrapper from '@/chat/conversation/normal/container'

let mockConversationIDKey: T.Chat.ConversationIDKey
let mockLoaded = true
let mockMeta: T.Chat.ConversationMeta
let mockRouteParams: {highlightMessageID?: T.Chat.MessageID; threadSearch?: {query?: string}} | undefined
let mockSetOrangeLine: ((ordinal: T.Chat.Ordinal) => void) | undefined
let mockThreadLoadStatusProviderProps:
  | {
      allowMarkReadOnLoad?: boolean
      id: T.Chat.ConversationIDKey
      skipThreadLoadOnSelection?: boolean
    }
  | undefined

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))
const noOrangeLine = T.Chat.numberToOrdinal(0)

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

function mockNormal() {
  return React.createElement(OrangeLineContext.Consumer, {
    children: (orangeLine: T.Chat.Ordinal) =>
      React.createElement(SetOrangeLineContext.Consumer, {
        children: (setOrangeLine: (ordinal: T.Chat.Ordinal) => void) => {
          mockSetOrangeLine = setOrangeLine
          return React.createElement('div', {'data-testid': 'orange-line'}, String(orangeLine))
        },
      }),
  })
}

function mockPassthroughProvider({children}: {children: React.ReactNode}) {
  return React.createElement(React.Fragment, null, children)
}

function mockConversationThreadLoadStatusProvider(
  props: React.PropsWithChildren<{
    allowMarkReadOnLoad?: boolean
    id: T.Chat.ConversationIDKey
    skipThreadLoadOnSelection?: boolean
  }>
) {
  mockThreadLoadStatusProviderProps = {
    allowMarkReadOnLoad: props.allowMarkReadOnLoad,
    id: props.id,
    skipThreadLoadOnSelection: props.skipThreadLoadOnSelection,
  }
  return React.createElement(React.Fragment, null, props.children)
}

jest.mock('.', () => {
  return {__esModule: true, default: mockNormal}
})

jest.mock('@/constants', () => {
  const actual = jest.requireActual('@/constants')
  return {...actual, Router2: {...actual.Router2, navigateAppend: jest.fn()}}
})

jest.mock('@/engine/action-listener', () => ({
  useEngineActionListener: jest.fn(),
}))

jest.mock('../thread-context', () => ({
  useConversationThreadID: () => mockConversationIDKey,
  useConversationThreadSelector: (
    selector: (state: {loaded: boolean; meta: T.Chat.ConversationMeta}) => unknown
  ) => selector({loaded: mockLoaded, meta: mockMeta}),
}))

jest.mock('../team-hooks', () => {
  return {ChatTeamProvider: mockPassthroughProvider}
})

jest.mock('../center-context', () => {
  return {ConversationCenterProvider: mockPassthroughProvider}
})

jest.mock('../input-area/input-state', () => {
  return {ConversationInputProvider: mockPassthroughProvider}
})

jest.mock('../thread-load-status-context', () => {
  return {ConversationThreadLoadStatusProvider: mockConversationThreadLoadStatusProvider}
})

jest.mock('@/common-adapters/markdown/maybe-mention/context', () => {
  return {MaybeMentionProvider: mockPassthroughProvider}
})

jest.mock('../thread-search-route', () => ({
  useChatThreadRouteParams: () => mockRouteParams,
}))

const getUnreadlineRpc = () => jest.spyOn(T.RPCChat, 'localGetUnreadlineRpcPromise')

const getNavigateAppend = () => C.Router2.navigateAppend as jest.Mock

const expectOrangeLine = (orangeLine: T.Chat.Ordinal) => {
  expect(screen.getByTestId('orange-line').textContent).toBe(String(orangeLine))
}

const flushOrangeLine = async () => {
  await act(async () => {
    await flushPromises()
  })
}

type ManageChannelsAction = {
  payload: {params: {teamname: string}}
}

const getManageChannelsListener = (): ((action: ManageChannelsAction) => void) => {
  const listener = (useEngineActionListener as jest.Mock).mock.calls.find(
    ([type]) => type === 'chat.1.chatUi.chatShowManageChannels'
  )?.[1] as ((action: ManageChannelsAction) => void) | undefined
  expect(listener).toEqual(expect.any(Function))
  if (!listener) {
    throw new Error('Missing manage channels listener')
  }
  return listener
}

const expectUnreadlineRpcReadMsgID = (unreadlineRpc: jest.SpyInstance, readMsgID: number) => {
  expect(unreadlineRpc).toHaveBeenLastCalledWith(
    expect.objectContaining({
      convID: T.Chat.keyToConversationID(convID),
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      readMsgID,
    })
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockConversationIDKey = convID
  mockLoaded = true
  mockMeta = makeMeta(convID)
  mockRouteParams = undefined
  mockSetOrangeLine = undefined
  mockThreadLoadStatusProviderProps = undefined
  useShellState.setState({active: true, mobileAppState: 'active'})
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('orange line stays fixed across unreadline refreshes while the thread stays mounted', async () => {
  const initialOrangeLine = T.Chat.numberToOrdinal(10)
  getUnreadlineRpc()
    .mockResolvedValueOnce({offline: false, unreadlineID: T.Chat.numberToMessageID(10)})
    .mockResolvedValueOnce({offline: false, unreadlineID: T.Chat.numberToMessageID(20)})
    .mockResolvedValueOnce({offline: false, unreadlineID: T.Chat.numberToMessageID(30)})
    .mockResolvedValue({offline: false, unreadlineID: T.Chat.numberToMessageID(30)})

  const {rerender} = render(<NormalWrapper />)
  await flushOrangeLine()

  expectOrangeLine(initialOrangeLine)

  act(() => {
    useShellState.setState({active: false})
  })
  await flushOrangeLine()

  expectOrangeLine(initialOrangeLine)

  mockMeta = makeMeta(convID, 1, 30)
  rerender(<NormalWrapper />)
  await flushOrangeLine()

  expectOrangeLine(initialOrangeLine)
})

test('manual orange line updates move an existing orange line', async () => {
  const initialOrangeLine = T.Chat.numberToOrdinal(10)
  getUnreadlineRpc().mockResolvedValue({offline: false, unreadlineID: T.Chat.numberToMessageID(10)})

  render(<NormalWrapper />)
  await flushOrangeLine()

  expectOrangeLine(initialOrangeLine)

  act(() => {
    mockSetOrangeLine?.(T.Chat.numberToOrdinal(50))
  })

  expectOrangeLine(T.Chat.numberToOrdinal(50))
})

test('orange line resets after switching to another thread', async () => {
  const initialOrangeLine = T.Chat.numberToOrdinal(10)
  const nextThreadOrangeLine = T.Chat.numberToOrdinal(40)
  getUnreadlineRpc()
    .mockResolvedValueOnce({offline: false, unreadlineID: T.Chat.numberToMessageID(10)})
    .mockResolvedValueOnce({offline: false, unreadlineID: T.Chat.numberToMessageID(40)})
    .mockResolvedValue({offline: false, unreadlineID: T.Chat.numberToMessageID(40)})

  const {rerender} = render(<NormalWrapper />)
  await flushOrangeLine()

  expectOrangeLine(initialOrangeLine)

  mockConversationIDKey = otherConvID
  mockMeta = makeMeta(otherConvID, 1, 40)
  rerender(<NormalWrapper />)
  await flushOrangeLine()

  expectOrangeLine(nextThreadOrangeLine)
})

test('loaded gate defers fetching the orange line until the thread has loaded', async () => {
  const unreadlineRpc = getUnreadlineRpc().mockResolvedValue({
    offline: false,
    unreadlineID: T.Chat.numberToMessageID(12),
  })
  mockLoaded = false

  render(<NormalWrapper />)
  await flushOrangeLine()

  expect(unreadlineRpc).not.toHaveBeenCalled()
  expectOrangeLine(noOrangeLine)

  act(() => {
    mockLoaded = true
    useShellState.setState({mobileAppState: 'background'})
  })
  await flushOrangeLine()

  expect(unreadlineRpc).toHaveBeenCalledTimes(1)
  expectOrangeLine(T.Chat.numberToOrdinal(12))
})

test('initial load uses the read message ID from mount even if meta changes before load', async () => {
  const unreadlineRpc = getUnreadlineRpc().mockResolvedValue({
    offline: false,
    unreadlineID: T.Chat.numberToMessageID(15),
  })
  mockLoaded = false
  mockMeta = makeMeta(convID, 5)

  render(<NormalWrapper />)
  await flushOrangeLine()

  mockMeta = makeMeta(convID, 99)
  act(() => {
    mockLoaded = true
    useShellState.setState({mobileAppState: 'background'})
  })
  await flushOrangeLine()

  expect(unreadlineRpc).toHaveBeenCalledTimes(1)
  expectUnreadlineRpcReadMsgID(unreadlineRpc, 5)
  expectOrangeLine(T.Chat.numberToOrdinal(15))
})

test('negative read message IDs are clamped before fetching the orange line', async () => {
  const unreadlineRpc = getUnreadlineRpc().mockResolvedValue({
    offline: false,
    unreadlineID: T.Chat.numberToMessageID(8),
  })
  mockMeta = makeMeta(convID, -5)

  render(<NormalWrapper />)
  await flushOrangeLine()

  expect(unreadlineRpc).toHaveBeenCalledTimes(1)
  expectUnreadlineRpcReadMsgID(unreadlineRpc, 0)
  expectOrangeLine(T.Chat.numberToOrdinal(8))
})

test('zero unreadline responses render as no orange line', async () => {
  getUnreadlineRpc().mockResolvedValue({
    offline: false,
    unreadlineID: T.Chat.numberToMessageID(0),
  })

  render(<NormalWrapper />)
  await flushOrangeLine()

  expectOrangeLine(noOrangeLine)
})

test('missing unreadline responses render as no orange line', async () => {
  getUnreadlineRpc().mockResolvedValue({
    offline: false,
    unreadlineID: undefined,
  })

  render(<NormalWrapper />)
  await flushOrangeLine()

  expectOrangeLine(noOrangeLine)
})

test('manual orange line update sets the line when no line exists yet', async () => {
  const unreadlineRpc = getUnreadlineRpc().mockResolvedValue({
    offline: false,
    unreadlineID: T.Chat.numberToMessageID(30),
  })
  const localOrdinal = T.Chat.numberToOrdinal(50.001)
  mockLoaded = false

  render(<NormalWrapper />)
  await flushOrangeLine()

  expect(unreadlineRpc).not.toHaveBeenCalled()
  expectOrangeLine(noOrangeLine)

  act(() => {
    mockSetOrangeLine?.(localOrdinal)
  })

  expectOrangeLine(localOrdinal)
})

test('explicit orange line requests from outside the thread move an existing orange line', async () => {
  getUnreadlineRpc().mockResolvedValue({offline: false, unreadlineID: T.Chat.numberToMessageID(10)})

  render(<NormalWrapper />)
  await flushOrangeLine()

  expectOrangeLine(T.Chat.numberToOrdinal(10))

  act(() => {
    setConversationOrangeLine(convID, T.Chat.numberToOrdinal(50))
  })

  expectOrangeLine(T.Chat.numberToOrdinal(50))
})

test('explicit orange line requests for other threads are ignored', async () => {
  getUnreadlineRpc().mockResolvedValue({offline: false, unreadlineID: T.Chat.numberToMessageID(10)})

  render(<NormalWrapper />)
  await flushOrangeLine()

  expectOrangeLine(T.Chat.numberToOrdinal(10))

  act(() => {
    setConversationOrangeLine(otherConvID, T.Chat.numberToOrdinal(50))
  })

  expectOrangeLine(T.Chat.numberToOrdinal(10))
})

test('stale explicit orange line requests from before mount do not override the loaded line', async () => {
  act(() => {
    setConversationOrangeLine(convID, T.Chat.numberToOrdinal(50))
  })
  getUnreadlineRpc().mockResolvedValue({offline: false, unreadlineID: T.Chat.numberToMessageID(10)})

  render(<NormalWrapper />)
  await flushOrangeLine()

  expectOrangeLine(T.Chat.numberToOrdinal(10))
})

test('orange line captured while active is hidden while the mobile app state is non-active', async () => {
  getUnreadlineRpc().mockResolvedValue({
    offline: false,
    unreadlineID: T.Chat.numberToMessageID(10),
  })

  render(<NormalWrapper />)
  await flushOrangeLine()
  expectOrangeLine(T.Chat.numberToOrdinal(10))

  act(() => {
    useShellState.setState({mobileAppState: 'background'})
  })

  expectOrangeLine(noOrangeLine)

  act(() => {
    useShellState.setState({mobileAppState: 'active'})
  })

  expectOrangeLine(T.Chat.numberToOrdinal(10))
})

test('inactive unreadline refreshes use the latest read message ID', async () => {
  const unreadlineRpc = getUnreadlineRpc().mockResolvedValue({
    offline: false,
    unreadlineID: T.Chat.numberToMessageID(0),
  })

  render(<NormalWrapper />)
  await flushOrangeLine()

  expect(unreadlineRpc).toHaveBeenCalledTimes(1)
  expectUnreadlineRpcReadMsgID(unreadlineRpc, 1)

  mockMeta = makeMeta(convID, 7, 30)
  act(() => {
    useShellState.setState({active: false})
  })
  await flushOrangeLine()

  expect(unreadlineRpc).toHaveBeenCalledTimes(2)
  expectUnreadlineRpcReadMsgID(unreadlineRpc, 7)
})

test('active max visible message changes do not refresh the orange line', async () => {
  const unreadlineRpc = getUnreadlineRpc().mockResolvedValue({
    offline: false,
    unreadlineID: T.Chat.numberToMessageID(10),
  })

  const {rerender} = render(<NormalWrapper />)
  await flushOrangeLine()

  mockMeta = makeMeta(convID, 2, 30)
  rerender(<NormalWrapper />)
  await flushOrangeLine()

  expect(unreadlineRpc).toHaveBeenCalledTimes(1)
  expectOrangeLine(T.Chat.numberToOrdinal(10))
})

test('highlight route params skip thread load on selection', () => {
  mockLoaded = false
  mockRouteParams = {highlightMessageID: T.Chat.numberToMessageID(123)}

  render(<NormalWrapper />)

  expect(mockThreadLoadStatusProviderProps).toEqual({
    allowMarkReadOnLoad: false,
    id: convID,
    skipThreadLoadOnSelection: true,
  })
})

test('missing highlight route params do not skip thread load on selection', () => {
  mockLoaded = false

  render(<NormalWrapper />)

  expect(mockThreadLoadStatusProviderProps).toEqual({
    allowMarkReadOnLoad: true,
    id: convID,
    skipThreadLoadOnSelection: false,
  })
})

test('zero highlight route params do not skip thread load on selection', () => {
  mockLoaded = false
  mockRouteParams = {highlightMessageID: T.Chat.numberToMessageID(0)}

  render(<NormalWrapper />)

  expect(mockThreadLoadStatusProviderProps).toEqual({
    allowMarkReadOnLoad: true,
    id: convID,
    skipThreadLoadOnSelection: false,
  })
})

test('thread search route params disable mark read without skipping thread load', () => {
  mockLoaded = false
  mockRouteParams = {threadSearch: {query: 'needle'}}

  render(<NormalWrapper />)

  expect(mockThreadLoadStatusProviderProps).toEqual({
    allowMarkReadOnLoad: false,
    id: convID,
    skipThreadLoadOnSelection: false,
  })
})

test('matching manage channels action navigates to add channels for the team', () => {
  mockLoaded = false
  const teamID = 'team-id' as T.Teams.TeamID
  mockMeta = {...makeMeta(convID), teamID, teamname: 'keybase'}
  const navigateAppend = getNavigateAppend()

  render(<NormalWrapper />)
  act(() => {
    getManageChannelsListener()({payload: {params: {teamname: 'keybase'}}})
  })

  expect(navigateAppend).toHaveBeenCalledWith({name: 'teamAddToChannels', params: {teamID}})
})

test('manage channels action ignores mismatched team names', () => {
  mockLoaded = false
  mockMeta = {...makeMeta(convID), teamID: 'team-id', teamname: 'keybase'}
  const navigateAppend = getNavigateAppend()

  render(<NormalWrapper />)
  act(() => {
    getManageChannelsListener()({payload: {params: {teamname: 'other-team'}}})
  })

  expect(navigateAppend).not.toHaveBeenCalled()
})

test('manage channels action ignores conversations without a real team ID', () => {
  mockLoaded = false
  mockMeta = {...makeMeta(convID), teamID: T.Teams.noTeamID, teamname: 'keybase'}
  const navigateAppend = getNavigateAppend()

  render(<NormalWrapper />)
  act(() => {
    getManageChannelsListener()({payload: {params: {teamname: 'keybase'}}})
  })

  expect(navigateAppend).not.toHaveBeenCalled()
})

test('manage channels action ignores empty team names', () => {
  mockLoaded = false
  mockMeta = {...makeMeta(convID), teamID: 'team-id', teamname: ''}
  const navigateAppend = getNavigateAppend()

  render(<NormalWrapper />)
  act(() => {
    getManageChannelsListener()({payload: {params: {teamname: ''}}})
  })

  expect(navigateAppend).not.toHaveBeenCalled()
})
