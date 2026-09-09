/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const username = 'testuser'
const devicename = 'testuser-mac'

type CenterOutcome = 'centered' | 'clamped' | 'not-found'
// Centering answers with the outcome; unless a test says otherwise the hit was reached.
const mockCenterOn = jest.fn<Promise<CenterOutcome>, [T.Chat.MessageID, string]>()
const mockClearCenter = jest.fn()
const mockToggleThreadSearch = jest.fn()
const mockCancelSearch = jest.fn()
type CallMap = Record<string, (p: any) => void>
const mockSearchCalls: Array<{incomingCallMap: CallMap; query: string}> = []
const mockLastOrdinal = {current: T.Chat.numberToOrdinal(0)}

jest.mock('./centering', () => ({
  useConversationCenterActions: () => ({
    centerOn: mockCenterOn,
    clearCenter: mockClearCenter,
    jumpToRecent: () => {},
  }),
}))

jest.mock('./thread-context', () => ({
  useConversationThreadID: () => 'conv',
  useConversationThreadSelector: (selector: (s: unknown) => unknown) =>
    selector({messageOrdinals: [mockLastOrdinal.current]}),
  useConversationThreadToggleSearch: () => mockToggleThreadSearch,
}))

jest.mock('../search-rpc', () => ({
  cancelActiveThreadSearchRPC: async () => {
    mockCancelSearch()
    await Promise.resolve()
  },
  searchInboxRPC: async (p: {incomingCallMap: CallMap; query: string}) => {
    mockSearchCalls.push(p)
    // the real RPC only settles when the service is done; hits arrive over the callmap
    await new Promise<void>(() => {})
  },
}))

import {threadSearchKey, useCommon} from './search'

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

const mountSearch = (initialQuery = '') =>
  renderHook(() => useCommon({conversationIDKey, initialQuery, style: undefined}))

const activeCallMap = () => mockSearchCalls.at(-1)!.incomingCallMap

// The service streams hits over the callmap; anything not flushed by a `done`
// waits on a 16ms coalescing timer.
const deliverHits = (...messages: Array<T.RPCChat.UIMessage>) => {
  act(() => {
    const callMap = activeCallMap()
    messages.forEach(m => callMap['chat.1.chatUi.chatSearchHit']!({searchHit: {hitMessage: m}}))
    jest.advanceTimersByTime(20)
  })
}

const deliverDone = () => {
  act(() => {
    activeCallMap()['chat.1.chatUi.chatSearchDone']!({})
  })
}

beforeEach(() => {
  mockCenterOn.mockResolvedValue('centered')
  jest.useFakeTimers()
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: devicename,
    uid: 'uid',
    username,
  })
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
  mockSearchCalls.length = 0
  mockCenterOn.mockClear()
  mockCenterOn.mockResolvedValue('centered')
  mockClearCenter.mockClear()
  mockToggleThreadSearch.mockClear()
  mockCancelSearch.mockClear()
  mockLastOrdinal.current = T.Chat.numberToOrdinal(0)
  resetAllStores()
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
  test('an empty query sits idle and starts no RPC', () => {
    const {result} = mountSearch()
    expect(result.current.status).toBe('initial')
    expect(result.current.inProgress).toBe(false)
    expect(result.current.hasResults).toBe(false)
    expect(result.current.numHits).toBe(0)
    expect(result.current.text).toBe('')
    expect(mockSearchCalls).toHaveLength(0)
  })

  test('an initial query prefills the input and searches immediately', () => {
    const {result} = mountSearch('needle')
    expect(result.current.text).toBe('needle')
    expect(result.current.status).toBe('inprogress')
    expect(result.current.inProgress).toBe(true)
    expect(mockSearchCalls.map(c => c.query)).toEqual(['needle'])
  })
})

describe('hit ingestion', () => {
  test('streamed hits are mapped down to author, summary and timestamp', () => {
    const {result} = mountSearch('needle')
    deliverHits(
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

  test('hits stay pending until the coalescing timer fires', () => {
    const {result} = mountSearch('needle')
    act(() => {
      activeCallMap()['chat.1.chatUi.chatSearchHit']!({searchHit: {hitMessage: hitMessage(5)}})
    })
    expect(result.current.numHits).toBe(0)
    act(() => {
      jest.advanceTimersByTime(20)
    })
    expect(result.current.numHits).toBe(1)
  })

  test('a repeated message id is only counted once', () => {
    const {result} = mountSearch('needle')
    deliverHits(hitMessage(5), hitMessage(6))
    deliverHits(hitMessage(5), hitMessage(7))
    expect(result.current.numHits).toBe(3)
    expect(result.current.hits.map(h => h.summary)).toEqual(['hello', 'hello', 'hello'])
  })

  test('an inbox hit batch replaces whatever streamed in before it', () => {
    const {result} = mountSearch('needle')
    deliverHits(hitMessage(5), hitMessage(6))
    expect(result.current.numHits).toBe(2)
    act(() => {
      activeCallMap()['chat.1.chatUi.chatSearchInboxHit']!({
        searchHit: {hits: [{hitMessage: hitMessage(9, {bodySummary: 'batched'})}]},
      })
      jest.advanceTimersByTime(20)
    })
    expect(result.current.hits).toEqual([{author: username, summary: 'batched', timestamp: 1000}])
  })

  test('unparseable hits are dropped rather than counted', () => {
    const {result} = mountSearch('needle')
    deliverHits(
      hitMessage(4, {messageBody: {messageType: T.RPCChat.MessageType.none}}),
      hitMessage(5, {bodySummary: 'real'})
    )
    expect(result.current.hits).toEqual([{author: username, summary: 'real', timestamp: 1000}])
  })
})

describe('status', () => {
  test('the inbox start callback flips an idle search to in progress', () => {
    const {result} = mountSearch('needle')
    deliverDone()
    expect(result.current.status).toBe('done')
    act(() => {
      activeCallMap()['chat.1.chatUi.chatSearchInboxStart']!({})
    })
    expect(result.current.status).toBe('inprogress')
    expect(result.current.inProgress).toBe(true)
  })

  test('done with no hits still reports results so the UI can say "no results"', () => {
    const {result} = mountSearch('needle')
    expect(result.current.hasResults).toBe(false)
    deliverDone()
    expect(result.current.status).toBe('done')
    expect(result.current.numHits).toBe(0)
    expect(result.current.hasResults).toBe(true)
  })

  test('hits count as results even before the search finishes', () => {
    const {result} = mountSearch('needle')
    deliverHits(hitMessage(5))
    expect(result.current.status).toBe('inprogress')
    expect(result.current.hasResults).toBe(true)
  })

  test('done flushes hits that are still sitting in the pending buffer', () => {
    const {result} = mountSearch('needle')
    act(() => {
      activeCallMap()['chat.1.chatUi.chatSearchHit']!({searchHit: {hitMessage: hitMessage(5)}})
    })
    expect(result.current.numHits).toBe(0)
    deliverDone()
    expect(result.current.numHits).toBe(1)
    expect(result.current.status).toBe('done')
  })
})

describe('submitting', () => {
  test('a new submit clears prior hits and starts a fresh RPC', () => {
    const {result} = mountSearch('needle')
    deliverHits(hitMessage(5))
    deliverDone()
    expect(result.current.numHits).toBe(1)

    act(() => result.current.onChangedText('haystack'))
    act(() => result.current.submitSearch())

    expect(mockSearchCalls.map(c => c.query)).toEqual(['needle', 'haystack'])
    expect(result.current.numHits).toBe(0)
    expect(result.current.status).toBe('inprogress')
    expect(result.current.selectedIndex).toBe(0)
  })

  test('submitting an empty query goes straight to done without an RPC', () => {
    const {result} = mountSearch()
    act(() => result.current.submitSearch())
    expect(mockSearchCalls).toHaveLength(0)
    expect(result.current.status).toBe('done')
  })

  test('callbacks from a superseded search are ignored', () => {
    const {result} = mountSearch('needle')
    const stale = activeCallMap()
    act(() => result.current.onChangedText('haystack'))
    act(() => result.current.submitSearch())

    act(() => {
      stale['chat.1.chatUi.chatSearchHit']!({searchHit: {hitMessage: hitMessage(5)}})
      stale['chat.1.chatUi.chatSearchDone']!({})
    })

    expect(result.current.numHits).toBe(0)
    expect(result.current.status).toBe('inprogress')
  })
})

describe('navigation', () => {
  const mountWithHits = (count: number) => {
    const rendered = mountSearch('needle')
    deliverHits(...Array.from({length: count}, (_, i) => hitMessage(10 + i)))
    deliverDone()
    return rendered
  }

  test('the first hit is auto-selected and centered', () => {
    const {result} = mountWithHits(3)
    expect(result.current.selectedIndex).toBe(0)
    expect(mockCenterOn).toHaveBeenCalledWith(messageID(10), 'always')
  })

  test('onUp walks forward through the hits and wraps at the end', () => {
    const {result} = mountWithHits(3)
    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(1)
    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(2)
    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(0)
  })

  test('onDown walks backward and wraps to the last hit', () => {
    const {result} = mountWithHits(3)
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(2)
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(1)
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(0)
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(2)
  })

  test('a single hit stays put in both directions', () => {
    const {result} = mountWithHits(1)
    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(0)
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(0)
  })

  test('navigation is inert with no hits', () => {
    const {result} = mountSearch('needle')
    deliverDone()
    act(() => result.current.onUp())
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(0)
    expect(mockCenterOn).not.toHaveBeenCalled()
  })

  test('every move centers on the matching message', () => {
    const {result} = mountWithHits(3)
    mockCenterOn.mockClear()
    act(() => result.current.onUp())
    expect(mockCenterOn).toHaveBeenCalledWith(messageID(11), 'always')
    act(() => result.current.onDown())
    expect(mockCenterOn).toHaveBeenCalledWith(messageID(10), 'always')
  })

  test('selectResult jumps directly to an index', () => {
    const {result} = mountWithHits(3)
    act(() => result.current.selectResult(2))
    expect(result.current.selectedIndex).toBe(2)
    expect(mockCenterOn).toHaveBeenLastCalledWith(messageID(12), 'always')
  })

  test('selectResult out of range leaves the selection where it was', () => {
    const {result} = mountWithHits(2)
    act(() => result.current.selectResult(1))
    mockCenterOn.mockClear()
    act(() => result.current.selectResult(7))
    // a bogus index would surface as `8 of 2` and send the up/down walk adrift
    expect(result.current.selectedIndex).toBe(1)
    expect(mockCenterOn).not.toHaveBeenCalled()
  })

  test('onUp steps over a hit it cannot center on instead of wedging', () => {
    const {result} = mountSearch('needle')
    // the middle hit has no usable id, so it can never be selected
    deliverHits(hitMessage(10), hitMessage(0), hitMessage(12))
    deliverDone()
    expect(result.current.numHits).toBe(3)
    expect(result.current.selectedIndex).toBe(0)

    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(2)
    expect(mockCenterOn).toHaveBeenLastCalledWith(messageID(12), 'always')
    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(0)
  })

  test('onDown steps over a hit it cannot center on instead of wedging', () => {
    const {result} = mountSearch('needle')
    deliverHits(hitMessage(10), hitMessage(0), hitMessage(12))
    deliverDone()
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(2)
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(0)
  })

  // The counter used to advance on `!!message.id` alone, so a hit the thread could not produce -
  // expunged, or outside what the centered load came back with - left `n of m` claiming a row that
  // never rendered.
  test('a hit the thread cannot produce hands the counter back', async () => {
    const {result} = mountWithHits(3)
    expect(result.current.selectedIndex).toBe(0)
    mockCenterOn.mockResolvedValue('not-found')

    act(() => result.current.onUp())
    // taken optimistically, so the counter answers the keypress
    expect(result.current.selectedIndex).toBe(1)
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.selectedIndex).toBe(0)
  })

  test('the retreat takes the centre back with it, not just the counter', async () => {
    // centerOn cleared and reloaded the thread around a message it turned out not to hold. Handing
    // the counter back without moving the centre leaves the reader on a window centered on nothing
    // while `n of m` names a row somewhere else.
    const {result} = mountWithHits(3)
    expect(result.current.selectedIndex).toBe(0)
    mockCenterOn.mockClear()
    mockCenterOn.mockResolvedValueOnce('not-found')
    mockCenterOn.mockResolvedValue('centered')

    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(1)
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.selectedIndex).toBe(0)
    // Re-centred on the hit it came from, rather than left pointing at the missing one.
    expect(mockCenterOn).toHaveBeenLastCalledWith(messageID(10), 'always')
  })

  test('a retreat with nowhere to go gives up the centre', async () => {
    // The first hit of a fresh search is selected as select(0, 0), so there is no earlier hit to
    // fall back to. Holding a centre the thread cannot show is worse than holding none.
    mockCenterOn.mockResolvedValue('not-found')
    mockClearCenter.mockClear()
    const {result} = mountWithHits(3)
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.selectedIndex).toBe(0)
    expect(mockClearCenter).toHaveBeenCalled()
  })

  test('a hit the list could only clamp onto still counts as reached', async () => {
    // A hit within half a viewport of either end of the thread cannot be put in the middle, but it
    // is on screen and it is where the reader was sent.
    const {result} = mountWithHits(3)
    mockCenterOn.mockResolvedValue('clamped')

    act(() => result.current.onUp())
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.selectedIndex).toBe(1)
  })

  test('a later selection owns the counter, however the earlier one settled', async () => {
    const {result} = mountWithHits(3)
    let settleFirst: ((outcome: CenterOutcome) => void) | undefined
    mockCenterOn.mockReturnValueOnce(
      new Promise<CenterOutcome>(resolve => {
        settleFirst = resolve
      })
    )

    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(1)
    act(() => result.current.onUp())
    expect(result.current.selectedIndex).toBe(2)
    await act(async () => {
      settleFirst?.('not-found')
      await Promise.resolve()
    })
    expect(result.current.selectedIndex).toBe(2)
  })

  test('a walk with nothing selectable leaves the selection alone', () => {
    const {result} = mountSearch('needle')
    deliverHits(hitMessage(0), hitMessage(0, {bodySummary: 'other'}))
    deliverDone()
    mockCenterOn.mockClear()
    act(() => result.current.onUp())
    act(() => result.current.onDown())
    expect(result.current.selectedIndex).toBe(0)
    expect(mockCenterOn).not.toHaveBeenCalled()
  })
})

describe('enter key', () => {
  test('enter re-runs the search when the text changed', () => {
    const {result} = mountSearch('needle')
    deliverHits(hitMessage(10), hitMessage(11))
    deliverDone()
    act(() => result.current.onChangedText('haystack'))
    act(() => result.current.onEnter())
    expect(mockSearchCalls.map(c => c.query)).toEqual(['needle', 'haystack'])
    expect(result.current.selectedIndex).toBe(0)
  })

  test('enter on unchanged text advances the selection instead of researching', () => {
    const {result} = mountSearch('needle')
    deliverHits(hitMessage(10), hitMessage(11))
    deliverDone()
    act(() => result.current.onEnter())
    expect(mockSearchCalls).toHaveLength(1)
    expect(result.current.selectedIndex).toBe(1)
  })
})

describe('teardown', () => {
  test('closing the search clears the centered message first', () => {
    const {result} = mountSearch()
    act(() => result.current.onToggleThreadSearch())
    expect(mockClearCenter).toHaveBeenCalled()
    expect(mockToggleThreadSearch).toHaveBeenCalled()
  })

  test('unmounting cancels the in-flight RPC and drops the pending flush', () => {
    const {unmount} = mountSearch('needle')
    act(() => {
      activeCallMap()['chat.1.chatUi.chatSearchHit']!({searchHit: {hitMessage: hitMessage(5)}})
    })
    // the hit is parked on the 16ms coalescing timer
    expect(jest.getTimerCount()).toBe(1)
    unmount()
    expect(mockCancelSearch).toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })
})
