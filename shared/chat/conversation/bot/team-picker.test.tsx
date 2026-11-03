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
import * as NavTree from '@/constants/nav-tree'
import * as T from '@/constants/types'
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {navigationWrapper, renders} from '@/test/navigation'
import BotTeamPicker from './team-picker'

const search = 'chat.1.local.addBotConvSearch'

const hit = (name: string, id: number, isTeam = true): T.RPCChat.ConvSearchHit => ({
  convID: new Uint8Array([id]),
  isTeam,
  name,
  parts: isTeam ? null : ['testuser', 'testuser-mac'],
})

// the field's onChange is debounced by 200ms
const typeTerm = async (term: string) => {
  fireEvent.change(screen.getByPlaceholderText('Search chats and teams...'), {target: {value: term}})
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 250))
  })
  await flush()
}

const waitingAttr = () => (screen.queryByText('waiting:true') ? 'true' : 'false')

let fake: FakeEngine
let info: jest.SpyInstance

beforeEach(() => {
  fake = installFakeEngine()
  info = jest.spyOn(logger, 'info').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('BotTeamPicker', () => {
  test('searches with an empty term on mount (no waiting key) and lists the hits', async () => {
    const held = fake.hold(search)

    render(<BotTeamPicker botUsername="helperbot" />)
    expect(waitingAttr()).toBe('true')
    await flush()
    expect(paramsOf(fake, search)).toEqual([{term: ''}])
    expect(waitingAttr()).toBe('true')

    held[0]!.reply([hit('acme', 1), hit('testuser,testuser-mac', 2, false)])
    await flush()

    expect(waitingAttr()).toBe('false')
    expect(screen.getByText('acme')).toBeTruthy()
    expect(screen.getByText('testuser,testuser-mac')).toBeTruthy()
  })

  test('an empty result renders an empty list', async () => {
    fake.answer(search, () => [])

    render(<BotTeamPicker botUsername="helperbot" />)
    await flush()

    expect(waitingAttr()).toBe('false')
    expect(screen.getByTestId('results').childElementCount).toBe(0)
  })

  test('typing searches again with the new term', async () => {
    fake.answer(search, (p: {term: string}) => (p.term ? [hit('acme', 1)] : []))

    render(<BotTeamPicker botUsername="helperbot" />)
    await flush()
    await typeTerm('ac')

    expect(paramsOf(fake, search)).toEqual([{term: ''}, {term: 'ac'}])
    expect(screen.getByText('acme')).toBeTruthy()
  })

  test('a failed search shows the error text in place of the list and logs', async () => {
    fake.answer(search, () => fakeError(3, 'search broke'))

    render(<BotTeamPicker botUsername="helperbot" />)
    await flush()

    expect(waitingAttr()).toBe('false')
    expect(screen.getByText('Something went wrong, please try again.')).toBeTruthy()
    expect(screen.queryByTestId('results')).toBeNull()
    expect(info).toHaveBeenCalledWith(
      'BotTeamPicker: error loading search results: ERROR CODE 3 - search broke in method chat.1.local.addBotConvSearch'
    )
  })

  // current behaviour: nothing clears the error, so a later successful search stays hidden
  test('the error text sticks after a later successful search', async () => {
    fake.answer(search, (p: {term: string}) => (p.term ? [hit('acme', 1)] : fakeError(3, 'search broke')))

    render(<BotTeamPicker botUsername="helperbot" />)
    await flush()
    await typeTerm('ac')

    expect(screen.getByText('Something went wrong, please try again.')).toBeTruthy()
    expect(screen.queryByText('acme')).toBeNull()
  })

  // current behaviour: results are not keyed to the term, so the last one to settle wins
  test('a slower earlier search overwrites the results of a later one', async () => {
    const held = fake.hold(search)

    render(<BotTeamPicker botUsername="helperbot" />)
    await typeTerm('ac')
    expect(held.map(h => (h.params as {term: string}).term)).toEqual(['', 'ac'])

    held[1]!.reply([hit('acme', 1)])
    await flush()
    expect(screen.getByText('acme')).toBeTruthy()

    held[0]!.reply([hit('stale', 2)])
    await flush()
    expect(screen.queryByText('acme')).toBeNull()
    expect(screen.getByText('stale')).toBeTruthy()
  })

  test('picking a hit opens the install screen for that conversation', async () => {
    fake.answer(search, () => [hit('acme', 7)])
    const {wrapper, ...nav} = navigationWrapper({params: {botUsername: 'helperbot'}, route: 'chatInstallBotPick'})

    render(<BotTeamPicker botUsername="helperbot" />, {wrapper})
    await flush()
    act(() => {
      fireEvent.click(screen.getByText('acme'))
    })
    await renders()

    // the install screen goes up over the picker
    expect(NavTree.modalStack(nav.getRootState()).map(r => ({name: r.name, params: r.params}))).toEqual([
      {name: 'chatInstallBotPick', params: {botUsername: 'helperbot'}},
      {
        name: 'chatInstallBot',
        params: {botUsername: 'helperbot', conversationIDKey: T.Chat.conversationIDToKey(new Uint8Array([7]))},
      },
    ])
  })
})
