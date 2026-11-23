/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {flush} from '@/test/flush'
import {fakeError, installFakeEngine} from '@/test/fake-engine'
import {useInboxSearch} from './use-inbox-search'

afterEach(() => {
  cleanup()
  resetAllStores()
})

// Starts a search and lets it reach the service: every earlier search is cancelled first.
const startSearch = async () => {
  const fake = installFakeEngine()
  fake.answer('chat.1.local.cancelActiveInboxSearch', () => undefined)
  const held = fake.hold('chat.1.local.searchInbox')
  const {result} = renderHook(() => useInboxSearch())
  act(() => result.current.startSearch())
  await flush()
  expect(held).toHaveLength(1)
  const fail = (code: T.RPCGen.StatusCode, desc: string) => held[0]!.reply(fakeError(code, desc))
  return {fail, result}
}

test('an inbox search the service fails shows the text results as errored', async () => {
  const {fail, result} = await startSearch()

  fail(T.RPCGen.StatusCode.scgeneric, 'search broke')
  await flush()

  expect(result.current.searchInfo.textStatus).toBe('error')
})

test.each([
  ['a session cancel', T.RPCGen.StatusCode.sccanceled],
  ['an input cancel', T.RPCGen.StatusCode.scinputcanceled],
])('%s of an inbox search is not an error', async (_, code) => {
  const {fail, result} = await startSearch()

  fail(code, 'canceled')
  await flush()

  expect(result.current.searchInfo.textStatus).not.toBe('error')
})

// The service cancels the running inbox search when the next one arrives, so a search that
// reached it after a newer one would cancel the newer one: a superseded query never goes out.
test('a query typed over before its cancel lands never reaches the service', async () => {
  const fake = installFakeEngine()
  fake.answer('chat.1.local.cancelActiveInboxSearch', () => undefined)
  const held = fake.hold('chat.1.local.searchInbox')
  const {result} = renderHook(() => useInboxSearch())
  act(() => result.current.startSearch())
  await flush()

  act(() => result.current.setQuery('a'))
  act(() => result.current.setQuery('ab'))
  await flush()

  expect(held.map(h => (h.params as {query: string}).query)).toEqual(['', 'ab'])
  // the newest search goes out only once the cancel before it has landed
  expect(fake.calls.map(c => c.method).slice(-2)).toEqual([
    'chat.1.local.cancelActiveInboxSearch',
    'chat.1.local.searchInbox',
  ])
})
