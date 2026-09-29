/// <reference types="jest" />

let mockLoggedIn = true
let mockUserSwitching = false
let mockUsername = 'testuser'
const mockLoggerInfo = jest.fn()
const mockLoggerWarn = jest.fn()

jest.mock('@/logger', () => ({
  __esModule: true,
  default: {
    error: () => {},
    info: (...args: Array<unknown>) => mockLoggerInfo(...args),
    warn: (...args: Array<unknown>) => mockLoggerWarn(...args),
  },
}))

jest.mock('@/stores/config', () => ({
  isChatSessionReady: () => mockLoggedIn && !mockUserSwitching,
  useConfigState: {
    getState: () => ({
      loggedIn: mockLoggedIn,
      userSwitching: mockUserSwitching,
    }),
  },
}))

jest.mock('@/stores/current-user', () => ({
  useCurrentUserState: {
    getState: () => ({
      username: mockUsername,
    }),
  },
}))

import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import * as T from '@/constants/types'
import {useInboxLayoutState} from './layout-state'

const emptyLayout: T.RPCChat.UIInboxLayout = {
  bigTeams: [],
  smallTeams: [],
  totalSmallTeams: 0,
}

const layoutWithRows: T.RPCChat.UIInboxLayout = {
  ...emptyLayout,
  totalSmallTeams: 1,
}

beforeEach(() => {
  mockLoggedIn = true
  mockUserSwitching = false
  mockUsername = 'testuser'
  mockLoggerInfo.mockClear()
  mockLoggerWarn.mockClear()
  useInboxLayoutState.getState().dispatch.resetState()
  jest.spyOn(T.RPCChat, 'localRequestInboxLayoutRpcPromise').mockResolvedValue(undefined)
})

afterEach(() => {
  useInboxLayoutState.getState().dispatch.resetState()
  jest.restoreAllMocks()
})

// A forced reselect would name the conversation the user has open as one to replace.
test('refresh never forces a reselect, before or after the layout has loaded', async () => {
  const {dispatch} = useInboxLayoutState.getState()

  await dispatch.refresh('bootstrap')
  dispatch.updateLayout(JSON.stringify(emptyLayout))
  await dispatch.refresh('inboxStale')

  expect(T.RPCChat.localRequestInboxLayoutRpcPromise).toHaveBeenCalledTimes(2)
  for (const call of jest.mocked(T.RPCChat.localRequestInboxLayoutRpcPromise).mock.calls) {
    expect(call[0]).toEqual({reselectMode: T.RPCChat.InboxLayoutReselectMode.default})
  }
})

test('refresh is gated on a logged-in user', async () => {
  mockLoggedIn = false
  await useInboxLayoutState.getState().dispatch.refresh('bootstrap')
  expect(T.RPCChat.localRequestInboxLayoutRpcPromise).not.toHaveBeenCalled()

  mockLoggedIn = true
  mockUsername = ''
  await useInboxLayoutState.getState().dispatch.refresh('bootstrap')
  expect(T.RPCChat.localRequestInboxLayoutRpcPromise).not.toHaveBeenCalled()
})

test('updateLayout ignores invalid JSON without changing state', () => {
  const {dispatch} = useInboxLayoutState.getState()
  dispatch.setRetriedOnCurrentEmpty(true)

  dispatch.updateLayout('{')

  expect(useInboxLayoutState.getState()).toMatchObject({
    hasLoaded: false,
    layout: undefined,
    retriedOnCurrentEmpty: true,
  })
  expect(mockLoggerWarn).toHaveBeenCalledWith(
    expect.stringContaining('failed to JSON parse inbox layout'),
    expect.any(SyntaxError)
  )
})

test('updateLayout does not replace an equivalent layout', () => {
  const {dispatch} = useInboxLayoutState.getState()

  dispatch.updateLayout(JSON.stringify(emptyLayout))
  const firstLayout = useInboxLayoutState.getState().layout

  dispatch.updateLayout(JSON.stringify({...emptyLayout}))

  expect(useInboxLayoutState.getState().hasLoaded).toBe(true)
  expect(useInboxLayoutState.getState().layout).toBe(firstLayout)
})

test('updateLayout resets empty-inbox retry state when rows are present', () => {
  const {dispatch} = useInboxLayoutState.getState()
  dispatch.setRetriedOnCurrentEmpty(true)

  dispatch.updateLayout(JSON.stringify(emptyLayout))
  expect(useInboxLayoutState.getState().retriedOnCurrentEmpty).toBe(true)

  dispatch.updateLayout(JSON.stringify(layoutWithRows))

  expect(useInboxLayoutState.getState().retriedOnCurrentEmpty).toBe(false)
})

test('resetState restores the initial layout store and keeps dispatch usable', async () => {
  const {dispatch} = useInboxLayoutState.getState()
  dispatch.updateLayout(JSON.stringify(layoutWithRows))
  dispatch.setRetriedOnCurrentEmpty(true)

  dispatch.resetState()

  expect(useInboxLayoutState.getState()).toMatchObject({
    dispatch,
    hasLoaded: false,
    layout: undefined,
    retriedOnCurrentEmpty: false,
  })

  await dispatch.refresh('bootstrap')
  expect(T.RPCChat.localRequestInboxLayoutRpcPromise).toHaveBeenCalledWith({
    reselectMode: T.RPCChat.InboxLayoutReselectMode.default,
  })
})
