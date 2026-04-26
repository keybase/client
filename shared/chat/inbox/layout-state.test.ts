/// <reference types="jest" />

let mockIsPhone = false
let mockLoggedIn = true
let mockUsername = 'alice'
const mockLoggerInfo = jest.fn()

jest.mock('@/constants/platform', () => ({
  get isPhone() {
    return mockIsPhone
  },
}))

jest.mock('@/logger', () => ({
  __esModule: true,
  default: {
    info: (...args: Array<unknown>) => mockLoggerInfo(...args),
  },
}))

jest.mock('@/stores/config', () => ({
  useConfigState: {
    getState: () => ({
      loggedIn: mockLoggedIn,
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
  mockIsPhone = false
  mockLoggedIn = true
  mockUsername = 'alice'
  mockLoggerInfo.mockClear()
  useInboxLayoutState.getState().dispatch.resetState()
  jest.spyOn(T.RPCChat, 'localRequestInboxLayoutRpcPromise').mockResolvedValue(undefined)
})

afterEach(() => {
  useInboxLayoutState.getState().dispatch.resetState()
  jest.restoreAllMocks()
})

test('refresh forces desktop reselect until layout has loaded', async () => {
  const {dispatch} = useInboxLayoutState.getState()

  await dispatch.refresh('bootstrap')
  expect(T.RPCChat.localRequestInboxLayoutRpcPromise).toHaveBeenLastCalledWith({
    reselectMode: T.RPCChat.InboxLayoutReselectMode.force,
  })

  dispatch.updateLayout(JSON.stringify(emptyLayout))
  await dispatch.refresh('inboxStale')

  expect(T.RPCChat.localRequestInboxLayoutRpcPromise).toHaveBeenLastCalledWith({
    reselectMode: T.RPCChat.InboxLayoutReselectMode.default,
  })
})

test('refresh uses default reselect on phones even before layout has loaded', async () => {
  mockIsPhone = true

  await useInboxLayoutState.getState().dispatch.refresh('bootstrap')

  expect(T.RPCChat.localRequestInboxLayoutRpcPromise).toHaveBeenCalledWith({
    reselectMode: T.RPCChat.InboxLayoutReselectMode.default,
  })
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
  expect(mockLoggerInfo).toHaveBeenCalledWith(expect.stringContaining('failed to JSON parse inbox layout'))
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

test('resetState restores the initial layout store and keeps dispatch usable', () => {
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
})
