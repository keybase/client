/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {installListenerEngine, uninstallListenerEngine} from '@/test/fake-listener-engine'
import {runSearchInbox} from './search'

type SearchState = Parameters<Parameters<Parameters<typeof runSearchInbox>[0]['updateIfCurrent']>[0]>[0]

afterEach(() => {
  uninstallListenerEngine()
  resetAllStores()
})

test('a thread search the service fails stops searching', async () => {
  const engine = installListenerEngine()
  let state: SearchState = {hits: [], status: 'inprogress'}
  const done = runSearchInbox({
    conversationIDKey: T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4])),
    deviceName: 'testuser-mac',
    getLastOrdinal: () => T.Chat.numberToOrdinal(0),
    onDone: () => {},
    pendingHitsRef: {current: []},
    pendingReplaceHitsRef: {current: undefined},
    query: 'hello',
    scheduleFlush: () => {},
    updateIfCurrent: updater => {
      state = updater(state)
    },
    username: 'testuser',
  })
  engine.fail('chat.1.local.searchInbox', T.RPCGen.StatusCode.scgeneric, 'search broke')
  await done

  expect(state.status).toBe('done')
})
