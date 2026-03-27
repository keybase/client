/// <reference types="jest" />
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

  store.getState().dispatch.updateFeaturedBots(bots)
  expect(store.getState().featuredBotsMap.get('kb_bot_1')).toEqual(bots[0])
  expect(store.getState().featuredBotsMap.get('kb_bot_2')).toEqual(bots[1])
})

test('featured bot engine updates merge bots into the shared cache', () => {
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
    type: 'keybase.1.NotifyFeaturedBots.featuredBotsUpdate',
  } as any)

  expect(store.getState().featuredBotsMap.get('kb_bot_3')).toEqual(bots[0])
})
