/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {flush} from '@/test/flush'
import {installListenerEngine, uninstallListenerEngine} from '@/test/fake-listener-engine'
import {useInboxSearch} from './use-inbox-search'

afterEach(() => {
  cleanup()
  uninstallListenerEngine()
  resetAllStores()
})

// Starts a search and lets it reach the service: every earlier search is cancelled first.
const startSearch = async () => {
  const engine = installListenerEngine()
  const {result} = renderHook(() => useInboxSearch())
  act(() => result.current.startSearch())
  const cancels = () =>
    engine.calls.filter(c => c.method === 'chat.1.local.cancelActiveInboxSearch').length
  for (let settled = 0; settled < cancels(); settled++) {
    engine.succeed('chat.1.local.cancelActiveInboxSearch')
  }
  await flush()
  engine.pending('chat.1.local.searchInbox')
  return {engine, result}
}

test('an inbox search the service fails shows the text results as errored', async () => {
  const {engine, result} = await startSearch()

  engine.fail('chat.1.local.searchInbox', T.RPCGen.StatusCode.scgeneric, 'search broke')
  await flush()

  expect(result.current.searchInfo.textStatus).toBe('error')
})

test('a cancelled inbox search is not an error', async () => {
  const {engine, result} = await startSearch()

  engine.fail('chat.1.local.searchInbox', T.RPCGen.StatusCode.sccanceled, 'canceled')
  await flush()

  expect(result.current.searchInfo.textStatus).not.toBe('error')
})
