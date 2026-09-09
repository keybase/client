/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'

const convX = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convY = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const mockRequestWindow = jest.fn()
const mockSetMarkReadBlocked = jest.fn()
let mockRouteParams: {threadSearch?: {query?: string}} | undefined

// A loaded window, so the module's messageID -> ordinal resolution has something real to resolve
// against. 33 deliberately does NOT sit on its own message ID: that is what a message you sent
// looks like once it keeps the fractional ordinal it had in the outbox, and it is the case an
// identity cast from messageID to ordinal gets wrong.
const seededMessages = [
  {id: 3, ordinal: 3},
  {id: 5, ordinal: 5},
  {id: 7, ordinal: 7},
  {id: 11, ordinal: 11},
  {id: 33, ordinal: 32.001},
  {id: 42, ordinal: 42},
]
// Mutable, and read through `getState()` on every poll: 'not-found' is now judged on the reload
// this request asked for having finished, so a test has to be able to land one.
let mockSnapshot = {
  generation: 0,
  loaded: false,
  messageIDToOrdinal: new Map(
    seededMessages.map(m => [T.Chat.numberToMessageID(m.id), T.Chat.numberToOrdinal(m.ordinal)])
  ),
  messageMap: new Map(
    seededMessages.map(m => [
      T.Chat.numberToOrdinal(m.ordinal),
      makeMessageText({
        conversationIDKey: convX,
        id: T.Chat.numberToMessageID(m.id),
        ordinal: T.Chat.numberToOrdinal(m.ordinal),
      }),
    ])
  ),
  messageOrdinals: seededMessages.map(m => T.Chat.numberToOrdinal(m.ordinal)),
  moreToLoadForward: false,
  pendingOutboxToOrdinal: new Map(),
}
const initialSnapshot = mockSnapshot
// The window this request asked for coming back, with or without the message in it.
const landWindow = () => {
  mockSnapshot = {...mockSnapshot, generation: mockSnapshot.generation + 1, loaded: true}
}

// Both providers under test pull thread/engine plumbing they don't exercise here.
jest.mock('./thread-context', () => ({
  useConversationThreadSelector: (selector: (s: unknown) => unknown) => selector(mockSnapshot),
  useConversationThreadSetMarkReadBlocked: () => mockSetMarkReadBlocked,
  useConversationThreadStore: () => ({getState: () => mockSnapshot}),
}))
jest.mock('./send-actions', () => ({
  useConversationSendActions: () => ({sendGiphyResult: jest.fn(), sendMessage: jest.fn()}),
}))
jest.mock('@/engine/action-listener', () => ({useEngineActionListener: () => {}}))
jest.mock('./thread-window', () => ({useRequestWindow: () => mockRequestWindow}))
jest.mock('./thread-search-route', () => ({useChatThreadRouteParams: () => mockRouteParams}))

import {
  type CenterMeasurement,
  type CenterOutcome,
  type CenterScrollAdapter,
  ConversationCenteringProvider,
  runCenterCorrection,
  runEndAnchorCorrection,
  useConversationCenter,
  useConversationCenterActions,
  useConversationCenterScroll,
} from './centering'
import {ConversationInputProvider, useConversationInput} from './input-area/input-state'
import {setInputIntent, useInputIntentState} from './input-intent-store'

let seenHighlightOrdinal: T.Chat.Ordinal | undefined
let seenUnsentText: string | undefined

const Probe = () => {
  const centeredHighlightOrdinal = useConversationCenter().centeredHighlightOrdinal
  const unsentText = useConversationInput(s => s.unsentText)
  // captured in an effect, not during render: assigning module state while rendering is the
  // side effect react-hooks/globals rejects
  React.useEffect(() => {
    seenHighlightOrdinal = centeredHighlightOrdinal
    seenUnsentText = unsentText
  })
  return null
}

// The real tree order: ConversationCenteringProvider wraps ConversationInputProvider, so the input
// provider's consume effect runs FIRST. If either provider claimed the other's intent types, the
// input provider would silently eat every highlight.
const Tree = ({id}: {id: T.Chat.ConversationIDKey}) => (
  <ConversationCenteringProvider id={id}>
    <ConversationInputProvider id={id}>
      <Probe />
    </ConversationInputProvider>
  </ConversationCenteringProvider>
)

const highlight = (n: number) => ({messageID: T.Chat.numberToMessageID(n), type: 'highlight'}) as const

beforeEach(() => {
  mockRouteParams = undefined
  seenHighlightOrdinal = undefined
  seenUnsentText = undefined
})

afterEach(() => {
  cleanup()
  jest.clearAllMocks()
  resetAllStores()
})

test('a highlight written before mount is consumed on mount', () => {
  setInputIntent(convX, highlight(42))

  render(<Tree id={convX} />)

  expect(mockSetMarkReadBlocked).toHaveBeenCalledWith(true)
  expect(mockRequestWindow).toHaveBeenCalledTimes(1)
  expect(mockRequestWindow).toHaveBeenCalledWith({anchor: {centeredOn: T.Chat.numberToMessageID(42)}, reason: 'centered'})
  expect(seenHighlightOrdinal).toBe(T.Chat.numberToOrdinal(42))
  expect(useInputIntentState.getState().intents.has(convX)).toBe(false)
})

test('a highlight written after mount is delivered by the subscription', () => {
  render(<Tree id={convX} />)
  expect(mockRequestWindow).not.toHaveBeenCalled()

  act(() => {
    setInputIntent(convX, highlight(7))
  })

  expect(mockRequestWindow).toHaveBeenCalledWith({anchor: {centeredOn: T.Chat.numberToMessageID(7)}, reason: 'centered'})
  expect(seenHighlightOrdinal).toBe(T.Chat.numberToOrdinal(7))
})

// The old route-param path deduped on the messageID *value*, so jumping to a message you had
// already jumped to was a silent no-op. Delete-on-consume keys delivery to the write instead.
test('jumping twice to the same message centers both times', () => {
  render(<Tree id={convX} />)

  act(() => {
    setInputIntent(convX, highlight(11))
  })
  act(() => {
    setInputIntent(convX, highlight(11))
  })

  expect(mockRequestWindow).toHaveBeenCalledTimes(2)
  expect(mockRequestWindow).toHaveBeenNthCalledWith(2, {anchor: {centeredOn: T.Chat.numberToMessageID(11)}, reason: 'centered'})
})

// The two-consumer collision the store's `types` filter exists for.
test('the input provider does not consume a highlight meant for the center provider', () => {
  setInputIntent(convX, highlight(5))

  render(<Tree id={convX} />)

  expect(mockRequestWindow).toHaveBeenCalledWith({anchor: {centeredOn: T.Chat.numberToMessageID(5)}, reason: 'centered'})
  expect(seenUnsentText).toBeUndefined()
})

test('the center provider does not consume an injectText meant for the input provider', () => {
  setInputIntent(convX, {text: 'hello', type: 'injectText'})

  render(<Tree id={convX} />)

  expect(seenUnsentText).toBe('hello')
  expect(mockRequestWindow).not.toHaveBeenCalled()
  expect(useInputIntentState.getState().intents.has(convX)).toBe(false)
})

test('a highlight for another conversation is left alone', () => {
  setInputIntent(convY, highlight(3))

  render(<Tree id={convX} />)

  expect(mockRequestWindow).not.toHaveBeenCalled()
  expect(useInputIntentState.getState().intents.get(convY)).toEqual(highlight(3))
})

// The header a search hit is really at. A message you sent keeps the fractional ordinal it had in
// the outbox, so its server message ID is not the number its row lives at - the case the old
// messageID-as-ordinal cast got wrong, silently highlighting a row that does not exist.
test('the centered ordinal is resolved through the window, not cast from the message id', () => {
  setInputIntent(convX, highlight(33))

  render(<Tree id={convX} />)

  expect(seenHighlightOrdinal).toBe(T.Chat.numberToOrdinal(32.001))
})

// ==================== the scroll corrector ====================

// A list that answers a fixed script of measurements, so the loop's own rules - the deadband, the
// settle count, the clamp detection, the correction cap - are what is under test rather than a
// scroller.
const scriptedAdapter = (
  script: ReadonlyArray<CenterMeasurement>,
  over: Partial<CenterScrollAdapter> = {}
) => {
  const calls = {scrollToIndex: 0, scrollToOffset: new Array<number>()}
  let next = 0
  const adapter: CenterScrollAdapter = {
    measureTarget: () => script[Math.min(next++, script.length - 1)]!,
    scrollToIndex: () => {
      calls.scrollToIndex += 1
    },
    scrollToOffset: offset => {
      calls.scrollToOffset.push(offset)
    },
    ...over,
  }
  return {adapter, calls}
}

const measured = (offBy: number, scroll: number, tolerance = 8): CenterMeasurement => ({
  kind: 'measured',
  offBy,
  scroll,
  tolerance,
})

const immediately = async () => Promise.resolve()
const ordinal = T.Chat.numberToOrdinal(101)

describe('the centering scroll corrector', () => {
  const run = async (adapter: CenterScrollAdapter, signal = {cancelled: false}) =>
    runCenterCorrection({adapter, ordinal, signal, sleep: immediately})

  test('a row already inside the deadband is centered without touching the scroller', async () => {
    const {adapter, calls} = scriptedAdapter([measured(4, 500)])

    await expect(run(adapter)).resolves.toBe<CenterOutcome>('centered')
    expect(calls.scrollToOffset).toEqual([])
  })

  test('one reading inside the deadband is not enough', async () => {
    // A single reading can be the frame before a row above the target re-measures and moves it
    // again, so the loop wants three in a row.
    const {adapter, calls} = scriptedAdapter([
      measured(4, 500),
      measured(40, 500),
      measured(0, 540),
      measured(0, 540),
      measured(0, 540),
    ])

    await expect(run(adapter)).resolves.toBe<CenterOutcome>('centered')
    expect(calls.scrollToOffset).toEqual([540])
  })

  test('it corrects by the measured offset and settles once the row holds still', async () => {
    const {adapter, calls} = scriptedAdapter([
      measured(120, 1000),
      measured(30, 1120),
      measured(2, 1150),
      measured(2, 1150),
      measured(2, 1150),
    ])

    await expect(run(adapter)).resolves.toBe<CenterOutcome>('centered')
    expect(calls.scrollToOffset).toEqual([1120, 1150])
  })

  test('a hit the scroller cannot reach clamps instead of spinning', async () => {
    // A hit within half a viewport of either end of the thread: the offset we ask for gets clamped,
    // the scroll position does not move, and the row never reaches the middle.
    const {adapter, calls} = scriptedAdapter([measured(120, 0)])

    await expect(run(adapter)).resolves.toBe<CenterOutcome>('clamped')
    // One correction, then three readings that showed it changed nothing.
    expect(calls.scrollToOffset).toEqual([120])
  })

  test('a row outside the rendered window is scrolled to by index first', async () => {
    const {adapter, calls} = scriptedAdapter([
      {kind: 'offscreen'},
      {kind: 'offscreen'},
      measured(0, 700),
      measured(0, 700),
      measured(0, 700),
    ])

    await expect(run(adapter)).resolves.toBe<CenterOutcome>('centered')
    expect(calls.scrollToIndex).toBe(2)
    expect(calls.scrollToOffset).toEqual([])
  })

  test('a stale reading is waited out rather than corrected against', async () => {
    // The native list only reports a viewable range when it moves, and correcting twice off the
    // same reading overshoots.
    const {adapter, calls} = scriptedAdapter([
      {kind: 'pending'},
      {kind: 'pending'},
      measured(60, 300),
      measured(0, 360),
      measured(0, 360),
      measured(0, 360),
    ])

    await expect(run(adapter)).resolves.toBe<CenterOutcome>('centered')
    expect(calls.scrollToOffset).toEqual([360])
  })

  test('a reader who takes the scroll stops the loop where it is', async () => {
    // The loop re-centers for up to ~3s; someone scrolling in that window must win.
    const signal = {cancelled: false}
    let reads = 0
    const {adapter, calls} = scriptedAdapter([measured(120, 1000)], {
      measureTarget: () => {
        if (++reads === 2) {
          signal.cancelled = true
        }
        return measured(120, 1000 + reads * 10)
      },
    })

    await expect(run(adapter, signal)).resolves.toBe<CenterOutcome>('clamped')
    expect(calls.scrollToOffset.length).toBeLessThanOrEqual(2)
  })

  test('a list with a correction budget stops at it', async () => {
    // The native corrector has always been capped: an inverted list of tall image rows can chase a
    // moving target indefinitely otherwise.
    let scroll = 0
    const {adapter, calls} = scriptedAdapter([], {
      maxCorrections: 3,
      measureTarget: () => measured(50, (scroll += 10)),
    })

    await expect(run(adapter)).resolves.toBe<CenterOutcome>('clamped')
    expect(calls.scrollToOffset).toHaveLength(3)
  })

  test('a target that never settles gives up rather than running forever', async () => {
    let scroll = 0
    const {adapter, calls} = scriptedAdapter([], {measureTarget: () => measured(50, (scroll += 10))})

    await expect(run(adapter)).resolves.toBe<CenterOutcome>('clamped')
    // 3000ms of budget at one 50ms poll per correction.
    expect(calls.scrollToOffset).toHaveLength(60)
  })
})

describe('the end anchor corrector', () => {
  const run = async (
    read: () => {isAtEnd: boolean; scroll: number} | undefined,
    scrollToEnd: () => void,
    holdsEndAnchor: () => boolean = () => true
  ) =>
    runEndAnchorCorrection({
      endAnchor: {read, scrollToEnd},
      holdsEndAnchor,
      signal: {cancelled: false},
      sleep: immediately,
    })

  test('a list already at its end is left alone', async () => {
    const scrollToEnd = jest.fn()
    await run(() => ({isAtEnd: true, scroll: 900}), scrollToEnd)
    expect(scrollToEnd).not.toHaveBeenCalled()
  })

  test('it waits for the offset to hold still before correcting', async () => {
    // The header often settles while the list is still running its own initial scroll, and a
    // scroll-to-end issued against that becomes the target the list abandons its bootstrap for.
    const scrolls = [100, 200, 300, 300]
    let reads = 0
    const scrollToEnd = jest.fn()
    await run(() => {
      const scroll = scrolls[Math.min(reads++, scrolls.length - 1)]!
      return {isAtEnd: false, scroll}
    }, scrollToEnd)
    expect(scrollToEnd).toHaveBeenCalled()
    // Two corrections is the whole budget: one for the header, one for whatever re-measured
    // alongside it.
    expect(scrollToEnd).toHaveBeenCalledTimes(2)
  })

  test('it stops as soon as the end stops being ours to hold', async () => {
    const scrollToEnd = jest.fn()
    await run(
      () => ({isAtEnd: false, scroll: 300}),
      scrollToEnd,
      () => false
    )
    expect(scrollToEnd).not.toHaveBeenCalled()
  })
})

// ==================== outcomes, through the provider ====================

const alwaysCentered: CenterScrollAdapter = {
  measureTarget: () => measured(0, 0),
  scrollToIndex: () => {},
  scrollToOffset: () => {},
}

let outcome: CenterOutcome | undefined
const CenterHarness = (p: {adapter?: CenterScrollAdapter; messageID: number}) => {
  const {adapter, messageID} = p
  const {centerOn} = useConversationCenterActions()
  const {registerAdapter} = useConversationCenterScroll()
  React.useEffect(() => {
    registerAdapter(adapter)
  }, [adapter, registerAdapter])
  React.useEffect(() => {
    outcome = undefined
    void centerOn(T.Chat.numberToMessageID(messageID), 'flash').then(o => {
      outcome = o
    })
  }, [centerOn, messageID])
  return null
}

describe('centerOn reports what actually happened', () => {
  beforeEach(() => {
    mockSnapshot = initialSnapshot
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  const drain = async (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 50) {
      await act(async () => {
        jest.advanceTimersByTime(50)
        await Promise.resolve()
      })
    }
  }

  test('a message the thread came back with, and a list that can centre it, is centered', async () => {
    render(
      <ConversationCenteringProvider id={convX}>
        <CenterHarness adapter={alwaysCentered} messageID={42} />
      </ConversationCenteringProvider>
    )
    await drain(500)
    expect(outcome).toBe<CenterOutcome>('centered')
    expect(mockRequestWindow).toHaveBeenCalledWith({
      anchor: {centeredOn: T.Chat.numberToMessageID(42)},
      reason: 'centered',
    })
  })

  test('a message the thread came back without is reported as not found', async () => {
    // The `n of m` counter used to advance for these anyway, because the only thing asked was
    // whether the hit had an id at all.
    render(
      <ConversationCenteringProvider id={convX}>
        <CenterHarness adapter={alwaysCentered} messageID={9999} />
      </ConversationCenteringProvider>
    )
    // The reload lands, and 9999 is not in it.
    landWindow()
    await drain(300)
    expect(outcome).toBe<CenterOutcome>('not-found')
  })

  test('a reload that has not come back yet does not retract the hit', async () => {
    // 'not-found' is the one outcome search hands its counter back on, so a slow RPC must not
    // produce it off a stopwatch: the message may be moments from arriving.
    render(
      <ConversationCenteringProvider id={convX}>
        <CenterHarness adapter={alwaysCentered} messageID={9999} />
      </ConversationCenteringProvider>
    )
    await drain(3300)
    expect(outcome).toBe<CenterOutcome>('clamped')
  })

  test('a list that cannot reach the row reports a clamp rather than a success', async () => {
    const pinned: CenterScrollAdapter = {
      measureTarget: () => measured(500, 0),
      scrollToIndex: () => {},
      scrollToOffset: () => {},
    }
    render(
      <ConversationCenteringProvider id={convX}>
        <CenterHarness adapter={pinned} messageID={42} />
      </ConversationCenteringProvider>
    )
    await drain(500)
    expect(outcome).toBe<CenterOutcome>('clamped')
  })
})

let repeatOutcomes: Array<CenterOutcome> = []
const RepeatHarness = (p: {adapter: CenterScrollAdapter; messageID: number}) => {
  const {adapter, messageID} = p
  const {centerOn} = useConversationCenterActions()
  const {registerAdapter} = useConversationCenterScroll()
  React.useEffect(() => {
    registerAdapter(adapter)
  }, [adapter, registerAdapter])
  React.useEffect(() => {
    repeatOutcomes = []
    const run = async () => {
      repeatOutcomes.push(await centerOn(T.Chat.numberToMessageID(messageID), 'flash'))
      repeatOutcomes.push(await centerOn(T.Chat.numberToMessageID(messageID), 'flash'))
    }
    void run()
  }, [centerOn, messageID])
  return null
}

describe('centering twice on the same row', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  // The second jump reloads the thread just like the first, so it has to steer the list again -
  // and answer. A guard keyed on the ordinal alone leaves the second request hanging until its
  // not-found watchdog fires, which hands the search counter back for a hit that was right there.
  test('the second request is steered and answered too', async () => {
    render(
      <ConversationCenteringProvider id={convX}>
        <RepeatHarness adapter={alwaysCentered} messageID={42} />
      </ConversationCenteringProvider>
    )
    for (let elapsed = 0; elapsed < 1000; elapsed += 50) {
      await act(async () => {
        jest.advanceTimersByTime(50)
        await Promise.resolve()
      })
    }
    expect(repeatOutcomes).toEqual<Array<CenterOutcome>>(['centered', 'centered'])
  })
})
