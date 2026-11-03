/// <reference types="jest" />

import {afterEach, beforeEach, expect, jest, test} from '@jest/globals'
import * as T from '@/constants/types'
import logger from '@/logger'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
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

let fake: FakeEngine
const layoutRequests = () =>
  fake.calls.filter(c => c.method === 'chat.1.local.requestInboxLayout').map(c => c.params as {reselectMode: unknown})

beforeEach(() => {
  resetAllStores()
  useConfigState.setState({loggedIn: true, userSwitching: false})
  useCurrentUserState.setState({username: 'testuser'})
  fake = installFakeEngine()
  fake.answer('chat.1.local.requestInboxLayout', () => null)
})

afterEach(() => {
  jest.restoreAllMocks()
})

// A forced reselect would name the conversation the user has open as one to replace.
test('refresh never forces a reselect, before or after the layout has loaded', async () => {
  const {dispatch} = useInboxLayoutState.getState()

  await dispatch.refresh('bootstrap')
  dispatch.updateLayout(JSON.stringify(emptyLayout))
  await dispatch.refresh('inboxStale')

  expect(layoutRequests()).toEqual([
    expect.objectContaining({reselectMode: T.RPCChat.InboxLayoutReselectMode.default}),
    expect.objectContaining({reselectMode: T.RPCChat.InboxLayoutReselectMode.default}),
  ])
})

test('refresh is gated on a logged-in user', async () => {
  useConfigState.setState({loggedIn: false})
  await useInboxLayoutState.getState().dispatch.refresh('bootstrap')
  expect(layoutRequests()).toEqual([])

  useConfigState.setState({loggedIn: true})
  useCurrentUserState.setState({username: ''})
  await useInboxLayoutState.getState().dispatch.refresh('bootstrap')
  expect(layoutRequests()).toEqual([])
})

test('refresh does not ask the service while an account switch is under way', async () => {
  useConfigState.setState({userSwitching: true})
  await useInboxLayoutState.getState().dispatch.refresh('bootstrap')
  expect(layoutRequests()).toEqual([])
})

test('updateLayout ignores invalid JSON without changing state', () => {
  const warn = jest.spyOn(logger, 'warn')
  const {dispatch} = useInboxLayoutState.getState()
  dispatch.setRetriedOnCurrentEmpty(true)

  dispatch.updateLayout('{')

  expect(useInboxLayoutState.getState()).toMatchObject({
    hasLoaded: false,
    layout: undefined,
    retriedOnCurrentEmpty: true,
  })
  expect(warn).toHaveBeenCalledWith(
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
  expect(layoutRequests()).toEqual([
    expect.objectContaining({reselectMode: T.RPCChat.InboxLayoutReselectMode.default}),
  ])
})
