/// <reference types="jest" />
import * as EngineGen from '@/constants/rpc'
import {resetAllStores} from '@/util/zustand'
import {useBotsState} from '../bots'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('featured bots are stored by username and page', () => {
  const store = useBotsState
  const bots = [
    {botUsername: 'kb_bot_1', rank: 3},
    {botUsername: 'kb_bot_2', rank: 1},
  ] as any

  store.getState().dispatch.updateFeaturedBots(bots, 2)
  store.getState().dispatch.setSearchFeaturedAndUsersResults('search', {
    bots,
    users: ['alice'],
  })

  expect(store.getState().featuredBotsPage).toBe(2)
  expect(store.getState().featuredBotsMap.get('kb_bot_1')).toEqual(bots[0])
  expect(store.getState().featuredBotsMap.get('kb_bot_2')).toEqual(bots[1])
  expect(store.getState().botSearchResults.get('search')).toEqual({
    bots,
    users: ['alice'],
  })
})

test('featured bot engine updates merge bots and derive the current page', () => {
  const store = useBotsState
  const bots = [{botUsername: 'kb_bot_3', rank: 10}] as any

  store.getState().dispatch.onEngineIncomingImpl({
    payload: {
      params: {
        bots,
        limit: 10,
        offset: 20,
      },
    },
    type: 'keybase1NotifyFeaturedBotsFeaturedBotsUpdate',
  } as any)

  expect(store.getState().featuredBotsPage).toBe(2)
  expect(store.getState().featuredBotsMap.get('kb_bot_3')).toEqual(bots[0])
  expect(store.getState().featuredBotsLoaded).toBe(true)
})
