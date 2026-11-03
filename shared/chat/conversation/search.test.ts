/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, render, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {setImmediate} from 'node:timers'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {signIn, threadWrapper} from '@/test/thread-tree'
import {ConversationCenterProvider, useConversationCenter} from './center-context'
import {ConversationThreadLoadStatusProvider} from './thread-load-status-context'
import {threadSearchKey, useCommon} from './search'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const username = 'testuser'
const devicename = 'testuser-mac'

const searchInbox = 'chat.1.local.searchInbox'
const cancelActiveSearch = 'chat.1.local.cancelActiveSearch'

let fake: FakeEngine
// the service answers a search only once it is done; hits arrive over its session meanwhile
let searches: ReturnType<FakeEngine['hold']>

const messageID = (n: number) => T.Chat.numberToMessageID(n)

const validUIMessage = (over: Partial<T.RPCChat.UIMessageValid> = {}): T.RPCChat.UIMessage => ({
  state: T.RPCChat.MessageUnboxedState.valid,
  valid: {
    botUsername: '',
    bodySummary: 'hello',
    channelMention: T.RPCChat.ChannelMention.none,
    ctime: 1000 as T.RPCGen.Gregor1.Time,
    etime: 0 as T.RPCGen.Gregor1.Time,
    explodedBy: '',
    hasPairwiseMacs: false,
    isCollapsed: false,
    isDeleteable: true,
    isEditable: true,
    isEphemeral: false,
    isEphemeralExpired: false,
    messageBody: {messageType: T.RPCChat.MessageType.text, text: {body: 'hello'}},
    messageID: messageID(5),
    reactions: {reactions: undefined},
    senderDeviceID: 'devID' as unknown as T.RPCGen.Gregor1.DeviceID,
    senderDeviceName: devicename,
    senderDeviceType: 'desktop',
    senderUID: 'uid' as unknown as T.RPCGen.Gregor1.UID,
    senderUsername: username,
    superseded: false,
    ...over,
  },
})

const hitMessage = (id: number, over: Partial<T.RPCChat.UIMessageValid> = {}) =>
  validUIMessage({messageID: messageID(id), ...over})

// The search as it runs in the app: inside the conversation's thread, its load status and its centre, on the
// conversation route with the search open.
const searchTree = (initialQuery: string) => {
  const thread = threadWrapper(conversationIDKey, {params: {threadSearch: {query: initialQuery}}})
  const {wrapper: Thread} = thread
  function Tree({children}: {children?: React.ReactNode}) {
    return React.createElement(
      Thread,
      null,
      // with the search open the thread does not mark read on load, as NormalThreadProviders says
      React.createElement(
        ConversationThreadLoadStatusProvider,
        {allowMarkReadOnLoad: false, id: conversationIDKey},
        React.createElement(ConversationCenterProvider, {children, id: conversationIDKey})
      )
    )
  }
  return {...thread, Tree}
}

let nav: ReturnType<typeof searchTree>

const mountSearch = (initialQuery = '') => {
  nav = searchTree(initialQuery)
  return renderHook(
    () => ({
      ...useCommon({conversationIDKey, initialQuery, style: undefined}),
      center: useConversationCenter(),
    }),
    {wrapper: nav.Tree}
  )
}

// the GUI's calls cross to the service a macrotask later
const flushIPC = async () => {
  for (let i = 0; i < 4; i++) {
    await act(async () => new Promise<void>(resolve => setImmediate(resolve)))
  }
}

// mounted with a query, its search reached the service
const mountSearching = async (initialQuery: string) => {
  const rendered = mountSearch(initialQuery)
  await flushIPC()
  if (searches.length !== 1) throw new Error('the search never reached the service')
  return rendered
}

const mountWithHit = async () => {
  const rendered = await mountSearching('needle')
  await deliverHits(hitMessage(10))
  await deliverDone()
  return rendered
}

// a searchInbox call's params, as the service decoded them
type SearchCall = {params: {query: string; sessionID: number}}

const queries = () => (searches as Array<SearchCall>).map(c => c.params.query)

// The service calls into the search's session; the listener hands each call to its handler on a
// 0ms timer once the session has acked it.
const pushTo = async (search: SearchCall, method: string, params: object) => {
  const {error} = await fake.push(method, params, {sessionID: search.params.sessionID})
  if (error) throw new Error(`the GUI refused ${method}`)
  act(() => {
    jest.advanceTimersByTime(0)
  })
}
const pushToActive = async (method: string, params: object) => pushTo(searches.at(-1)!, method, params)

const pushHit = async (m: T.RPCChat.UIMessage) =>
  pushToActive('chat.1.chatUi.chatSearchHit', {searchHit: {hitMessage: m}})

// anything not flushed by a `done` waits on a 16ms coalescing timer
const deliverHits = async (...messages: Array<T.RPCChat.UIMessage>) => {
  for (const m of messages) {
    await pushHit(m)
  }
  act(() => {
    jest.advanceTimersByTime(20)
  })
}

const deliverDone = async () => pushToActive('chat.1.chatUi.chatSearchDone', {})

const centeredOn = (id: number) => ({
  centeredHighlightOrdinal: T.Chat.numberToOrdinal(id),
  centeredOrdinal: T.Chat.numberToOrdinal(id),
  hasCenter: true,
})
const noCenter = {centeredHighlightOrdinal: undefined, centeredOrdinal: undefined, hasCenter: false}

beforeEach(() => {
  // only setTimeout and friends: the fake engine's IPC hop runs on node's own setImmediate
  jest.useFakeTimers()
  fake = installFakeEngine()
  searches = fake.hold(searchInbox)
  fake.answer(cancelActiveSearch, () => null)
  signIn(username)
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
  act(() => {
    resetAllStores()
  })
})

describe('threadSearchKey', () => {
  test('keys a mounted search on both the conversation and its initial query', () => {
    expect(threadSearchKey({conversationIDKey, initialQuery: 'needle'})).toBe(`${conversationIDKey}:needle`)
    expect(threadSearchKey({conversationIDKey, initialQuery: ''})).toBe(`${conversationIDKey}:`)
    expect(threadSearchKey({conversationIDKey, initialQuery: 'a'})).not.toBe(
      threadSearchKey({conversationIDKey, initialQuery: 'b'})
    )
  })
})

describe('initial state', () => {
  test('an empty query sits idle and starts no RPC', async () => {
    const {result} = mountSearch()
    await act(async () => {})
    expect(result.current.status).toBe('initial')
    expect(result.current.inProgress).toBe(false)
    expect(result.current.hasResults).toBe(false)
    expect(result.current.numHits).toBe(0)
    expect(result.current.text).toBe('')
    expect(fake.calls).toEqual([])
  })

  test('an initial query prefills the input and searches immediately', async () => {
    const {result} = mountSearch('needle')
    expect(result.current.text).toBe('needle')
    expect(result.current.status).toBe('inprogress')
    expect(result.current.inProgress).toBe(true)
    await flushIPC()
    expect(queries()).toEqual(['needle'])
  })
})

describe('hit ingestion', () => {
  test('streamed hits are mapped down to author, summary and timestamp', async () => {
    const {result} = await mountSearching('needle')
    await deliverHits(
      hitMessage(5, {bodySummary: 'first hit', ctime: 1000 as T.RPCGen.Gregor1.Time}),
      hitMessage(6, {
        bodySummary: 'second hit',
        ctime: 2000 as T.RPCGen.Gregor1.Time,
        senderUsername: 'testuser-mac',
      })
    )
    expect(result.current.numHits).toBe(2)
    expect(result.current.hits).toEqual([
      {author: username, summary: 'first hit', timestamp: 1000},
      {author: 'testuser-mac', summary: 'second hit', timestamp: 2000},
    ])
  })

  test('hits stay pending until the coalescing timer fires', async () => {
    const {result} = await mountSearching('needle')
    await pushHit(hitMessage(5))
    expect(result.current.numHits).toBe(0)
    act(() => {
      jest.advanceTimersByTime(20)
    })
    expect(result.current.numHits).toBe(1)
  })

  test('a repeated message id is only counted once', async () => {
    const {result} = await mountSearching('needle')
    await deliverHits(hitMessage(5), hitMessage(6))
    await deliverHits(hitMessage(5), hitMessage(7))
    expect(result.current.numHits).toBe(3)
    expect(result.current.hits.map(h => h.summary)).toEqual(['hello', 'hello', 'hello'])
  })

  test('an inbox hit batch replaces whatever streamed in before it', async () => {
    const {result} = await mountSearching('needle')
    await deliverHits(hitMessage(5), hitMessage(6))
    expect(result.current.numHits).toBe(2)
    await pushToActive('chat.1.chatUi.chatSearchInboxHit', {
      searchHit: {
        convID: T.Chat.keyToConversationID(conversationIDKey),
        convName: '',
        hits: [{hitMessage: hitMessage(9, {bodySummary: 'batched'}), matches: [], postMessages: [], prevMessages: []}],
        query: 'needle',
        teamType: T.RPCChat.TeamType.none,
        time: 0,
      },
    })
    act(() => {
      jest.advanceTimersByTime(20)
    })
    expect(result.current.hits).toEqual([{author: username, summary: 'batched', timestamp: 1000}])
  })

  test('unparseable hits are dropped rather than counted', async () => {
    const {result} = await mountSearching('needle')
    await deliverHits(
      hitMessage(4, {messageBody: {messageType: T.RPCChat.MessageType.none}}),
      hitMessage(5, {bodySummary: 'real'})
    )
    expect(result.current.hits).toEqual([{author: username, summary: 'real', timestamp: 1000}])
  })
})

describe('status', () => {
  test('the inbox start callback flips an idle search to in progress', async () => {
    const {result} = await mountSearching('needle')
    await deliverDone()
    expect(result.current.status).toBe('done')
    await pushToActive('chat.1.chatUi.chatSearchInboxStart', {})
    expect(result.current.status).toBe('inprogress')
    expect(result.current.inProgress).toBe(true)
  })

  test('done with no hits still reports results so the UI can say "no results"', async () => {
    const {result} = await mountSearching('needle')
    expect(result.current.hasResults).toBe(false)
    await deliverDone()
    expect(result.current.status).toBe('done')
    expect(result.current.numHits).toBe(0)
    expect(result.current.hasResults).toBe(true)
  })

  test('hits count as results even before the search finishes', async () => {
    const {result} = await mountSearching('needle')
    await deliverHits(hitMessage(5))
    expect(result.current.status).toBe('inprogress')
    expect(result.current.hasResults).toBe(true)
  })

  test('done flushes hits that are still sitting in the pending buffer', async () => {
    const {result} = await mountSearching('needle')
    await pushHit(hitMessage(5))
    expect(result.current.numHits).toBe(0)
    await deliverDone()
    expect(result.current.numHits).toBe(1)
    expect(result.current.status).toBe('done')
  })

  test('a search the service fails stops searching', async () => {
    const {result} = await mountSearching('needle')
    act(() => {
      searches[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'search broke'))
    })
    await flushIPC()
    expect(result.current.status).toBe('done')
  })
})

describe('submitting', () => {
  test('a new submit clears prior hits and starts a fresh RPC', async () => {
    const {result} = await mountSearching('needle')
    await deliverHits(hitMessage(5))
    await deliverDone()
    expect(result.current.numHits).toBe(1)

    act(() => result.current.onChangedText('haystack'))
    act(() => result.current.submitSearch())
    await flushIPC()

    expect(queries()).toEqual(['needle', 'haystack'])
    expect(result.current.numHits).toBe(0)
    expect(result.current.status).toBe('inprogress')
    expect(result.current.selectedIndex).toBe(0)
  })

  test('submitting an empty query goes straight to done without an RPC', async () => {
    const {result} = mountSearch()
    act(() => result.current.submitSearch())
    await flushIPC()
    expect(searches).toHaveLength(0)
    expect(result.current.status).toBe('done')
  })

  test('callbacks from a superseded search are ignored', async () => {
    const {result} = await mountSearching('needle')
    const stale = searches[0]!
    act(() => result.current.onChangedText('haystack'))
    act(() => result.current.submitSearch())
    await flushIPC()
    expect(searches).toHaveLength(2)

    await pushTo(stale, 'chat.1.chatUi.chatSearchHit', {searchHit: {hitMessage: hitMessage(5)}})
    await pushTo(stale, 'chat.1.chatUi.chatSearchDone', {})
    act(() => {
      jest.advanceTimersByTime(20)
    })

    expect(result.current.numHits).toBe(0)
    expect(result.current.status).toBe('inprogress')
  })
})

describe('navigation', () => {
  const mountWithHits = async (count: number) => {
    const rendered = await mountSearching('needle')
    await deliverHits(...Array.from({length: count}, (_, i) => hitMessage(10 + i)))
    await deliverDone()
    return rendered
  }

  test('the first hit is auto-selected and centered', async () => {
    const {result} = await mountWithHits(3)
    expect(result.current.selectedIndex).toBe(0)
    expect(result.current.center).toEqual(centeredOn(10))
  })

  test('onUp walks forward through the hits and wraps at the end', async () => {
    const {result} = await mountWithHits(3)
    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(1)
    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(2)
    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(0)
  })

  test('onDown walks backward and wraps to the last hit', async () => {
    const {result} = await mountWithHits(3)
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(2)
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(1)
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(0)
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(2)
  })

  test('a single hit stays put in both directions', async () => {
    const {result} = await mountWithHits(1)
    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(0)
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(0)
  })

  test('navigation is inert with no hits', async () => {
    const {result} = await mountSearching('needle')
    await deliverDone()
    act(() => result.current.onUp())
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(0)
    expect(result.current.center).toEqual(noCenter)
  })

  test('every move centers on the matching message', async () => {
    const {result} = await mountWithHits(3)
    act(() => result.current.onUp())
    expect(result.current.center).toEqual(centeredOn(11))
    act(() => result.current.onDown())
    expect(result.current.center).toEqual(centeredOn(10))
  })

  test('selectResult jumps directly to an index', async () => {
    const {result} = await mountWithHits(3)
    act(() => result.current.selectResult(2))
    expect(result.current.selectedIndex).toBe(2)
    expect(result.current.center).toEqual(centeredOn(12))
  })

  test('selectResult out of range leaves the selection where it was', async () => {
    const {result} = await mountWithHits(2)
    act(() => result.current.selectResult(1))
    act(() => result.current.selectResult(7))
    // a bogus index would surface as `8 of 2` and send the up/down walk adrift
    expect(result.current.selectedIndex).toBe(1)
    expect(result.current.center).toEqual(centeredOn(11))
  })

  test('onUp steps over a hit it cannot center on instead of wedging', async () => {
    const {result} = await mountSearching('needle')
    // the middle hit has no usable id, so it can never be selected
    await deliverHits(hitMessage(10), hitMessage(0), hitMessage(12))
    await deliverDone()
    expect(result.current.numHits).toBe(3)
    expect(result.current.selectedIndex).toBe(0)

    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(2)
    expect(result.current.center).toEqual(centeredOn(12))
    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(0)
  })

  test('onDown steps over a hit it cannot center on instead of wedging', async () => {
    const {result} = await mountSearching('needle')
    await deliverHits(hitMessage(10), hitMessage(0), hitMessage(12))
    await deliverDone()
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(2)
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(0)
  })

  test('a walk with nothing selectable leaves the selection alone', async () => {
    const {result} = await mountSearching('needle')
    await deliverHits(hitMessage(0), hitMessage(0, {bodySummary: 'other'}))
    await deliverDone()
    act(() => result.current.onUp())
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(0)
    expect(result.current.center).toEqual(noCenter)
  })
})

describe('enter key', () => {
  test('enter re-runs the search when the text changed', async () => {
    const {result} = await mountSearching('needle')
    await deliverHits(hitMessage(10), hitMessage(11))
    await deliverDone()
    act(() => result.current.onChangedText('haystack'))
    act(() => result.current.onEnter())
    await flushIPC()
    expect(queries()).toEqual(['needle', 'haystack'])
    expect(result.current.selectedIndex).toBe(0)
  })

  test('enter on unchanged text advances the selection instead of researching', async () => {
    const {result} = await mountSearching('needle')
    await deliverHits(hitMessage(10), hitMessage(11))
    await deliverDone()
    act(() => result.current.onEnter())
    await flushIPC()
    expect(searches).toHaveLength(1)
    expect(result.current.selectedIndex).toBe(1)
  })
})

describe('teardown', () => {
  // the centre provider drops the hit when the route closes, the same for every close
  test('closing the search closes it on the route, which drops the hit, and cancels nothing', async () => {
    const {result} = await mountWithHit()
    expect(result.current.center).toEqual(centeredOn(10))
    act(() => result.current.onToggleThreadSearch())
    await flushIPC()
    expect(nav.visibleScreen()?.params).toEqual({conversationIDKey})
    expect(result.current.center).toEqual(noCenter)
    // the search UI unmounting is what cancels its search
    expect(fake.calls.filter(c => c.method === cancelActiveSearch)).toEqual([])
  })

  test('unmounting cancels the in-flight RPC and drops the pending flush', async () => {
    nav = searchTree('needle')
    let latest: ReturnType<typeof useCommon> | undefined
    function Search() {
      const common = useCommon({conversationIDKey, initialQuery: 'needle', style: undefined})
      React.useEffect(() => {
        latest = common
      })
      return null
    }
    const {rerender} = render(React.createElement(Search), {wrapper: nav.Tree})
    await flushIPC()
    await pushHit(hitMessage(5))
    // the hit is parked on the 16ms coalescing timer
    expect(latest?.numHits).toBe(0)
    const timersWithHitParked = jest.getTimerCount()
    // the search closes; the conversation stays
    rerender(React.createElement(React.Fragment))
    expect(jest.getTimerCount()).toBe(timersWithHitParked - 1)
    await flushIPC()
    expect(fake.calls.filter(c => c.method === cancelActiveSearch)).toHaveLength(1)
  })
})
