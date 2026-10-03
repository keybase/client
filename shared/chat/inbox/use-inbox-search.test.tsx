/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import logger from '@/logger'
import {fakeError, installFakeEngine, uninstallFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {makeInboxSearchInfo, nextInboxSearchSelectedIndex, useInboxSearch} from './use-inbox-search'

test('inbox search helpers derive stable defaults', () => {
  const info = makeInboxSearchInfo()

  expect(info.query).toBe('')
  expect(info.selectedIndex).toBe(0)
  expect(info.nameStatus).toBe('initial')
  expect(info.textStatus).toBe('initial')
})

test('inbox search selection movement stays within available results', () => {
  const inboxSearch = makeInboxSearchInfo()
  inboxSearch.nameResults = [{conversationIDKey: '1'} as any, {conversationIDKey: '2'} as any]
  inboxSearch.textResults = [{conversationIDKey: '3', query: 'needle', time: 1} as any]

  let selectedIndex = inboxSearch.selectedIndex
  selectedIndex = nextInboxSearchSelectedIndex({...inboxSearch, selectedIndex}, true)
  expect(selectedIndex).toBe(1)

  selectedIndex = nextInboxSearchSelectedIndex({...inboxSearch, selectedIndex}, true)
  selectedIndex = nextInboxSearchSelectedIndex({...inboxSearch, selectedIndex}, true)
  expect(selectedIndex).toBe(2)

  selectedIndex = nextInboxSearchSelectedIndex({...inboxSearch, selectedIndex}, false)
  selectedIndex = nextInboxSearchSelectedIndex({...inboxSearch, selectedIndex}, false)
  selectedIndex = nextInboxSearchSelectedIndex({...inboxSearch, selectedIndex}, false)
  expect(selectedIndex).toBe(0)
})

test('inbox search selection movement respects visible result counts', () => {
  const inboxSearch = makeInboxSearchInfo()
  inboxSearch.nameResults = [{conversationIDKey: '1'} as any]
  inboxSearch.openTeamsResults = new Array(5).fill({name: 'team'}) as any
  inboxSearch.botsResults = new Array(5).fill({botUsername: 'bot'}) as any
  inboxSearch.textResults = [{conversationIDKey: '2', query: 'needle', time: 1} as any]

  const selectedIndex = nextInboxSearchSelectedIndex(
    {...inboxSearch, selectedIndex: 7},
    true,
    {
      bots: 5,
      names: 1,
      openTeams: 5,
      text: 1,
    }
  )

  expect(selectedIndex).toBe(8)
})

describe('a text search that fails', () => {
  const start = async () => {
    const fake = installFakeEngine()
    fake.answer('chat.1.local.cancelActiveInboxSearch', () => undefined)
    const held = fake.hold('chat.1.local.searchInbox')
    const {result} = renderHook(() => useInboxSearch())
    act(() => result.current.startSearch())
    await flush()
    expect(held).toHaveLength(1)
    return {fake, held, result}
  }

  test("shows the service's error", async () => {
    const logged = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {held, result} = await start()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'search broke'))
    await flush()
    expect(result.current.searchInfo.textStatus).toBe('error')
    expect(logged).toHaveBeenCalledTimes(1)
    uninstallFakeEngine()
    logged.mockRestore()
  })

  // A newer search, or leaving search, cancels it in the service
  test('is quiet when the service cancelled it', async () => {
    const {held, result} = await start()
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.sccanceled, 'context canceled'))
    await flush()
    expect(result.current.searchInfo.textStatus).not.toBe('error')
    uninstallFakeEngine()
  })

  test('shows a lost link as an error', async () => {
    const logged = jest.spyOn(logger, 'error').mockImplementation(() => {})
    const {fake, result} = await start()
    fake.drop()
    await flush()
    expect(result.current.searchInfo.textStatus).toBe('error')
    uninstallFakeEngine()
    logged.mockRestore()
  })
})
