/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'

// the real search field and list are electron/native-only; the mocks expose the
// props the picker drives (the typed term, the waiting spinner, the rows)
jest.mock('@/common-adapters', () => {
  const R = jest.requireActual<typeof React>('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    R.createElement('div', null, children)
  const anyStyle: unknown = new Proxy(
    {
      createStyleHook: () => () => ({}),
      globalMargins: new Proxy({}, {get: () => 0}),
      useTheme: () => ({redDark: 'red'}),
    },
    {get: (t: {[key: string]: unknown}, k) => (typeof k === 'string' && k in t ? t[k] : () => ({}))}
  )
  const components: {[key: string]: unknown} = {
    ClickableBox: (p: {children?: React.ReactNode; onClick: () => void}) =>
      R.createElement('button', {onClick: p.onClick}, p.children),
    List: (p: {
      items: ReadonlyArray<unknown>
      renderItem: (index: number, item: unknown) => React.ReactElement
    }) => R.createElement('div', {'data-testid': 'results'}, p.items.map((item, i) => p.renderItem(i, item))),
    SearchFilter: (p: {onChange: (s: string) => void; placeholderText: string; waiting: boolean}) =>
      R.createElement(
        'div',
        null,
        R.createElement('input', {
          onChange: (e: {target: {value: string}}) => p.onChange(e.target.value),
          placeholder: p.placeholderText,
        }),
        R.createElement('span', null, `waiting:${String(p.waiting)}`)
      ),
    Styles: anyStyle,
    Text: (p: {children?: React.ReactNode}) => R.createElement('span', null, p.children),
  }
  return new Proxy(components, {
    get: (t, k) => (k === '__esModule' ? true : typeof k === 'string' && k in t ? t[k] : passThrough),
  })
})
jest.mock('@/chat/avatars', () => ({Avatars: () => null, TeamAvatar: () => null}))

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as Router from '@/constants/router'
import * as T from '@/constants/types'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {resetAllStores} from '@/util/zustand'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import BotTeamPicker from './team-picker'

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

const hit = (name: string, id: number, isTeam = true): T.RPCChat.ConvSearchHit => ({
  convID: new Uint8Array([id]),
  isTeam,
  name,
  parts: isTeam ? null : ['testuser', 'testuser-mac'],
})

const deferred = <R,>() => {
  let settle: {reject: (e: unknown) => void; resolve: (r: R) => void} = {reject: () => {}, resolve: () => {}}
  const promise = new Promise<R>((resolve, reject) => {
    settle = {reject, resolve}
  })
  return {promise, reject: (e: unknown) => settle.reject(e), resolve: (r: R) => settle.resolve(r)}
}

// the field's onChange is debounced by 200ms
const typeTerm = async (term: string) => {
  fireEvent.change(screen.getByPlaceholderText('Search chats and teams...'), {target: {value: term}})
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 250))
    await flushPromises()
  })
}

const waitingAttr = () => (screen.queryByText('waiting:true') ? 'true' : 'false')

let rpc: FakeChatRpc
let info: jest.SpyInstance

beforeEach(() => {
  rpc = installFakeChatRpc()
  info = jest.spyOn(logger, 'info').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  restoreChatRpc()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('BotTeamPicker', () => {
  test('searches with an empty term on mount (no waiting key) and lists the hits', async () => {
    const pending = deferred<ReadonlyArray<T.RPCChat.ConvSearchHit>>()
    rpc.on('searchBotDestinations', async () => pending.promise)

    render(<BotTeamPicker botUsername="helperbot" />)

    expect(rpc.calls('searchBotDestinations')).toEqual([['']])
    expect(waitingAttr()).toBe('true')

    await act(async () => {
      pending.resolve([hit('acme', 1), hit('testuser,testuser-mac', 2, false)])
      await flushPromises()
    })

    expect(waitingAttr()).toBe('false')
    expect(screen.getByText('acme')).toBeTruthy()
    expect(screen.getByText('testuser,testuser-mac')).toBeTruthy()
  })

  test('an empty result renders an empty list', async () => {
    rpc.on('searchBotDestinations', () => [])

    render(<BotTeamPicker botUsername="helperbot" />)
    await act(async () => {
      await flushPromises()
    })

    expect(waitingAttr()).toBe('false')
    expect(screen.getByTestId('results').childElementCount).toBe(0)
  })

  test('typing searches again with the new term', async () => {
    rpc.once('searchBotDestinations', () => [])
    rpc.once('searchBotDestinations', () => [hit('acme', 1)])

    render(<BotTeamPicker botUsername="helperbot" />)
    await act(async () => {
      await flushPromises()
    })
    await typeTerm('ac')

    expect(rpc.calls('searchBotDestinations')).toEqual([[''], ['ac']])
    expect(screen.getByText('acme')).toBeTruthy()
  })

  test('a failed search shows the error text in place of the list and logs', async () => {
    rpc.fail('searchBotDestinations', new RPCError('search broke', 3))

    render(<BotTeamPicker botUsername="helperbot" />)
    await act(async () => {
      await flushPromises()
    })

    expect(waitingAttr()).toBe('false')
    expect(screen.getByText('Something went wrong, please try again.')).toBeTruthy()
    expect(screen.queryByTestId('results')).toBeNull()
    expect(info).toHaveBeenCalledWith(
      'BotTeamPicker: error loading search results: ERROR CODE 3 - search broke'
    )
  })

  // current behaviour: nothing clears the error, so a later successful search stays hidden
  test('the error text sticks after a later successful search', async () => {
    rpc.failOnce('searchBotDestinations', new RPCError('search broke', 3))
    rpc.on('searchBotDestinations', () => [hit('acme', 1)])

    render(<BotTeamPicker botUsername="helperbot" />)
    await act(async () => {
      await flushPromises()
    })
    await typeTerm('ac')

    expect(screen.getByText('Something went wrong, please try again.')).toBeTruthy()
    expect(screen.queryByText('acme')).toBeNull()
  })

  // current behaviour: results are not keyed to the term, so the last one to settle wins
  test('a slower earlier search overwrites the results of a later one', async () => {
    const first = deferred<ReadonlyArray<T.RPCChat.ConvSearchHit>>()
    const second = deferred<ReadonlyArray<T.RPCChat.ConvSearchHit>>()
    rpc.once('searchBotDestinations', async () => first.promise)
    rpc.once('searchBotDestinations', async () => second.promise)

    render(<BotTeamPicker botUsername="helperbot" />)
    await typeTerm('ac')

    await act(async () => {
      second.resolve([hit('acme', 1)])
      await flushPromises()
    })
    expect(screen.getByText('acme')).toBeTruthy()

    await act(async () => {
      first.resolve([hit('stale', 2)])
      await flushPromises()
    })
    expect(screen.queryByText('acme')).toBeNull()
    expect(screen.getByText('stale')).toBeTruthy()
  })

  test('picking a hit opens the install screen for that conversation', async () => {
    const navigateAppend = jest.spyOn(Router, 'navigateAppend').mockImplementation(() => true)
    rpc.on('searchBotDestinations', () => [hit('acme', 7)])

    render(<BotTeamPicker botUsername="helperbot" />)
    await act(async () => {
      await flushPromises()
    })
    fireEvent.click(screen.getByText('acme'))

    expect(navigateAppend).toHaveBeenCalledWith({
      name: 'chatInstallBot',
      params: {botUsername: 'helperbot', conversationIDKey: T.Chat.conversationIDToKey(new Uint8Array([7]))},
    })
  })
})
