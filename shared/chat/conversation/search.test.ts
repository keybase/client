/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const username = 'testuser'
const devicename = 'testuser-mac'

const mockCenterOnMessage = jest.fn()
const mockClearCenter = jest.fn()
const mockToggleThreadSearch = jest.fn()
const mockCancelSearch = jest.fn()
type CallMap = Record<string, (p: any) => void>
const mockSearchCalls: Array<{incomingCallMap: CallMap; query: string}> = []
const mockLastOrdinal = {current: T.Chat.numberToOrdinal(0)}

jest.mock('./center-context', () => ({
  useConversationCenterActions: () => ({
    centerOnMessage: mockCenterOnMessage,
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
  mockCenterOnMessage.mockClear()
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
    expect(mockCenterOnMessage).toHaveBeenCalledWith(messageID(10), 'always')
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
    expect(mockCenterOnMessage).not.toHaveBeenCalled()
  })

  test('every move centers on the matching message', () => {
    const {result} = mountWithHits(3)
    mockCenterOnMessage.mockClear()
    act(() => result.current.onUp())
    expect(mockCenterOnMessage).toHaveBeenCalledWith(messageID(11), 'always')
    act(() => result.current.onDown())
    expect(mockCenterOnMessage).toHaveBeenCalledWith(messageID(10), 'always')
  })

  test('selectResult jumps directly to an index', () => {
    const {result} = mountWithHits(3)
    act(() => result.current.selectResult(2))
    expect(result.current.selectedIndex).toBe(2)
    expect(mockCenterOnMessage).toHaveBeenLastCalledWith(messageID(12), 'always')
  })

  test('selectResult out of range still records the index but centers nothing', () => {
    const {result} = mountWithHits(2)
    mockCenterOnMessage.mockClear()
    act(() => result.current.selectResult(7))
    expect(result.current.selectedIndex).toBe(7)
    expect(mockCenterOnMessage).not.toHaveBeenCalled()
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

  test('unmounting cancels the in-flight RPC and ignores later callbacks', () => {
    const {result, unmount} = mountSearch('needle')
    const callMap = activeCallMap()
    unmount()
    expect(mockCancelSearch).toHaveBeenCalled()
    act(() => {
      callMap['chat.1.chatUi.chatSearchHit']!({searchHit: {hitMessage: hitMessage(5)}})
      jest.advanceTimersByTime(20)
    })
    expect(result.current.numHits).toBe(0)
  })
})
