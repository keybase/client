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

test('a cancelled inbox search is not an error', async () => {
  const {fail, result} = await startSearch()

  fail(T.RPCGen.StatusCode.sccanceled, 'canceled')
  await flush()

  expect(result.current.searchInfo.textStatus).not.toBe('error')
})
