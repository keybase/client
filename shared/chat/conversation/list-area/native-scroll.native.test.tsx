/** @jest-environment jsdom */
/// <reference types="jest" />
// Pins where the native thread list scrolls, and when, by mounting it over a fake FlatList that
// records every imperative scroll and hands back its props so the tests can fire the callbacks the
// real list would (viewable items, scroll, content size, drag, scroll-to-index failure). The list's
// declarative scrolling (maintainVisibleContentPosition) is pinned as the config it hands the list,
// not simulated.
import type * as React from 'react'
import {Activity, StrictMode} from 'react'
import '@/constants'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {ThreadRefsContext} from '../normal/context'
import * as H from './native-list-harness.native'
import {emptyThread, makeStore, threadTransitions, useStore} from './list-test-store'

jest.mock('react-native', () => require('./native-list-harness.native').reactNativeModule)
jest.mock('react-native-keyboard-controller', () => require('./native-list-harness.native').nativeOnlyModule)
jest.mock('react-native-reanimated', () => require('./native-list-harness.native').nativeOnlyModule)
jest.mock('@/common-adapters', () => require('./native-list-harness.native').commonAdaptersModule)
jest.mock('../composer-viewport-context', () => require('./native-list-harness.native').composerViewportModule)
jest.mock('../thread-context', () => require('./native-list-harness.native').threadContextModule)
jest.mock('../center-context', () => require('./native-list-harness.native').centerContextModule)
jest.mock('./jump-to-recent', () => require('./native-list-harness.native').jumpToRecentModule)
jest.mock('./catch-up', () => require('./native-list-harness.native').catchUpModule)
jest.mock('../thread-load-status-context', () => ({useThreadLoadStatusOptionsGetter: () => () => ({})}))
jest.mock('../messages/special-top-message', () => () => null)
jest.mock('../messages/special-bottom-message', () => () => null)
jest.mock('../messages/separator', () => ({__esModule: true, NativeSeparator: () => null, default: () => null}))
jest.mock('../messages/wrapper', () => ({MessageRow: () => null}))
jest.mock('../input-area/input-state', () => require('./native-list-harness.native').inputStateModule)
jest.mock('../input-area/normal/typing', () => ({mobileTypingContainerHeight: 18}))
jest.mock('@legendapp/list/react', () => ({LegendList: () => null}))
jest.mock('@/util/storeless-actions', () => ({copyToClipboard: () => {}}))
jest.mock('@/stores/current-user', () => ({
  useCurrentUserState: (selector: (s: {username: string}) => unknown) => selector({username: 'testuser'}),
}))

// The list picks its platform when the module loads, so it is required with isMobile set.
let ThreadList: React.ComponentType = () => null
const originalIsMobile = global.isMobile
beforeAll(() => {
  global.isMobile = true
  ThreadList = (require('.') as {default: React.ComponentType}).default
})
afterAll(() => {
  global.isMobile = originalIsMobile
})

const ord = T.Chat.numberToOrdinal

// A screen pushed over the conversation hides it the way native-stack does, with Activity, which
// unmounts its effects; coming back re-mounts them with nothing changed.
const screenStore = makeStore({hidden: false})
const Harness = () => {
  const hidden = useStore(screenStore, s => s.hidden)
  return (
    <Activity mode={hidden ? 'hidden' : 'visible'}>
      <ThreadRefsContext value={H.threadRefsValue}>
        <ThreadList />
      </ThreadRefsContext>
    </Activity>
  )
}
const hideAndShow = () => {
  update(() => {
    screenStore.set({hidden: true})
  })
  update(() => {
    screenStore.set({hidden: false})
  })
}

const update = (fn: () => void) => {
  act(fn)
}

const tick = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

const keyboardHeight = 300
const openKeyboard = () => {
  H.anchor.keyboardHeight.value = -keyboardHeight
  H.anchor.keyboardProgress.value = 1
  H.keyboardStore.set({isVisible: true})
}
const closeKeyboard = () => {
  H.anchor.keyboardHeight.value = 0
  H.anchor.keyboardProgress.value = 0
  H.keyboardStore.set({isVisible: false})
}

// The thread's own transitions; thread-transitions.test.tsx holds them to the real thread store.
const clearThread = () => H.threadStore.set(threadTransitions.cleared(H.threadStore.get()))
const loadThread = (from: number, to: number) =>
  H.threadStore.set(threadTransitions.loaded(H.threadStore.get(), H.range(from, to)))
// Choosing a search hit: the centre is set and the thread cleared together, and the reload around
// the target follows.
const centreOn = (n: number) => {
  update(() => {
    H.setCenter(ord(n))
    clearThread()
  })
}

// Opens a conversation holding ordinals from..to, optionally centered and with the keyboard up. An
// unloaded one has no rows yet.
const open = (
  p: {center?: number; from?: number; keyboard?: boolean; loaded?: boolean; strict?: boolean; to?: number} = {}
) => {
  const {center, from = 1, keyboard = false, loaded = true, strict = false, to = 60} = p
  update(() => {
    if (loaded) H.threadStore.set({loaded, messageOrdinals: to >= from ? H.range(from, to) : []})
    if (center !== undefined) H.setCenter(ord(center))
    if (keyboard) openKeyboard()
  })
  render(
    strict ? (
      <StrictMode>
        <Harness />
      </StrictMode>
    ) : (
      <Harness />
    )
  )
}

const props = () => {
  const p = H.listProps.current
  if (!p) throw new Error('list not rendered')
  return p
}

const setOrdinals = (from: number, to: number) => {
  update(() => {
    H.threadStore.set({messageOrdinals: H.range(from, to)})
  })
}

const viewableItems = (first: number, last: number) => {
  const data = props().data
  const items: Array<{index: number; item: T.Chat.Ordinal}> = []
  for (let i = first; i <= last; i++) items.push({index: i, item: data[i]!})
  return items
}
// Reports the rows at data indices first..last as viewable, in view at all. Data is newest first.
const viewable = (first: number, last: number) => {
  update(() => {
    props().viewabilityConfigCallbackPairs[0]!.onViewableItemsChanged({viewableItems: viewableItems(first, last)})
  })
}
// Reports the rows at data indices first..last as wholly in view.
const fullyViewable = (first: number, last: number) => {
  update(() => {
    props().viewabilityConfigCallbackPairs[1]!.onViewableItemsChanged({viewableItems: viewableItems(first, last)})
  })
}

// The viewport shows ten 100pt rows.
const viewportHeight = 1000
const scrolled = (y: number, height: number) => {
  update(() => {
    props().onScroll({
      nativeEvent: {contentOffset: {y}, contentSize: {height}, layoutMeasurement: {height: viewportHeight}},
    })
  })
}

const drag = () => {
  update(() => {
    props().onScrollBeginDrag()
  })
}

// The reader lifting their finger at offset y; a fling follows when they let go moving.
const dragEnded = (y: number, fling = false) => {
  update(() => {
    props().onScrollEndDrag({nativeEvent: {contentOffset: {y}, velocity: {x: 0, y: fling ? 1.5 : 0}}})
  })
}
// The fling that follows coming to rest at offset y.

const flingEnded = (y: number) => {
  update(() => {
    props().onMomentumScrollEnd({nativeEvent: {contentOffset: {y}}})
  })
}

// FlatList reporting that a scroll to ordinal n's row failed, by the row's data index.
const scrollToIndexFailed = (n: number) => {
  update(() => {
    props().onScrollToIndexFailed({index: props().data.indexOf(ord(n))})
  })
}

const scrollsOnly = () => H.log.filter(([kind]) => kind === 'scrollToOffset' || kind === 'scrollToItem')
const clearLog = () => {
  H.log.length = 0
}

// The resting offset is min(keyboardHeight + bottomInset, 0) with keyboardHeight negative while open.
const toBottom = ['scrollToOffset', {animated: false, offset: 0}]
const toBottomOverKeyboard = ['scrollToOffset', {animated: false, offset: H.bottomInset - keyboardHeight}]
const coarse = (n: number) => ['scrollToItem', {animated: false, item: ord(n), viewPosition: 0.5}]
const toOffset = (offset: number) => ['scrollToOffset', {animated: false, offset}]
const markRead = ['markThreadAsRead']

const mvpClosed = {autoscrollToTopThreshold: 1, minIndexForVisible: 0}
const mvpNoAutoscroll = {minIndexForVisible: 0}

beforeEach(() => {
  jest.useFakeTimers()
  H.resetHarness()
  screenStore.reset({hidden: false})
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

describe('opening a conversation', () => {
  test('marks it read and scrolls to the resting offset now and again 100ms later', async () => {
    open()
    expect(H.log).toEqual([markRead, toBottom])
    await tick(99)
    expect(H.log).toEqual([markRead, toBottom])
    await tick(1)
    expect(H.log).toEqual([markRead, toBottom, toBottom])
    await tick(5000)
    expect(H.log).toEqual([markRead, toBottom, toBottom])
  })

  test('hands the list its data newest first, inverted, keyed by conversation', () => {
    open({to: 3})
    expect(props().data).toEqual(H.ords(3, 2, 1))
    expect(props()['inverted']).toBe(true)
    expect(H.listMounts.count).toBe(1)
  })

  test('with the keyboard up the resting offset clears it', async () => {
    open({keyboard: true})
    await tick(100)
    expect(H.log).toEqual([markRead, toBottomOverKeyboard, toBottomOverKeyboard])
  })

  test('waits for the load to finish', async () => {
    open({loaded: false})
    await tick(1000)
    expect(H.log).toEqual([])
    update(() => loadThread(1, 60))
    expect(H.log).toEqual([markRead, toBottom])
    await tick(100)
    expect(H.log).toEqual([markRead, toBottom, toBottom])
  })

  test('an empty conversation is marked read but has no end to scroll to', async () => {
    open({to: 0})
    await tick(1000)
    expect(H.log).toEqual([markRead])
  })

  test('happens once per conversation, even when the thread reloads', async () => {
    open()
    await tick(200)
    clearLog()
    update(() => clearThread())
    update(() => loadThread(1, 60))
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('a conversation switch remounts the list and runs the first-load scroll for the new one', async () => {
    open({keyboard: true})
    await tick(200)
    clearLog()
    update(() => {
      H.threadStore.set({
        conversationIDKey: T.Chat.stringToConversationIDKey('conv2'),
        messageOrdinals: H.range(1, 80),
      })
    })
    expect(H.listMounts.count).toBe(2)
    // More rows than before with the keyboard up, but a switch is not an append.
    await tick(0)
    expect(H.log).toEqual([markRead, toBottomOverKeyboard])
    await tick(100)
    expect(H.log).toEqual([markRead, toBottomOverKeyboard, toBottomOverKeyboard])
  })

  test('the 100ms retry is skipped while a centre requested in between is still loading', async () => {
    open()
    await tick(10)
    centreOn(30)
    await tick(1000)
    expect(H.log).toEqual([markRead, toBottom])
  })

  test('the 100ms retry is skipped if a centre arrives in between', async () => {
    open()
    await tick(10)
    centreOn(30)
    update(() => loadThread(1, 60))
    await tick(1000)
    expect(H.log).toEqual([markRead, toBottom, coarse(30), coarse(30)])
  })
})

describe('scrolls scheduled for later', () => {
  test('a drag before the first load\'s 100ms retry cancels it', async () => {
    open()
    await tick(10)
    drag()
    await tick(1000)
    expect(H.log).toEqual([markRead, toBottom])
  })

  test('a conversation switch cancels the old conversation\'s retry', async () => {
    open()
    await tick(10)
    update(() => {
      H.threadStore.reset({
        ...threadTransitions.loaded(emptyThread, H.range(1, 80)),
        conversationIDKey: T.Chat.stringToConversationIDKey('conv2'),
        moreToLoadForward: false,
      })
    })
    await tick(1000)
    expect(H.log).toEqual([markRead, toBottom, markRead, toBottom, toBottom])
  })

  test('unmounting cancels every one', () => {
    open({center: 30, keyboard: true})
    scrolled(0, 6000)
    viewable(0, 9)
    setOrdinals(1, 61)
    scrollToIndexFailed(30)
    cleanup()
    expect(jest.getTimerCount()).toBe(0)
  })

  test('under StrictMode, whose effect re-mount is the same, the first load still gets its retry', async () => {
    open({strict: true})
    await tick(1000)
    expect(H.log).toEqual([markRead, toBottom, toBottom, toBottom])
  })
})

describe('opening centred on a target', () => {
  test('coarse-scrolls to it at 50ms and 250ms, and nowhere else', async () => {
    open({center: 30})
    expect(H.log).toEqual([markRead])
    await tick(50)
    expect(H.log).toEqual([markRead, coarse(30)])
    await tick(200)
    expect(H.log).toEqual([markRead, coarse(30), coarse(30)])
    await tick(5000)
    expect(H.log).toEqual([markRead, coarse(30), coarse(30)])
  })

  test('centring waits for the load', async () => {
    open({center: 30, loaded: false})
    await tick(1000)
    expect(H.log).toEqual([])
    update(() => loadThread(1, 60))
    expect(H.log).toEqual([markRead])
    await tick(50)
    expect(H.log).toEqual([markRead, coarse(30)])
    await tick(1000)
    expect(H.log).toEqual([markRead, coarse(30), coarse(30)])
  })

  test('a target that moves on before it is loaded is centred once it arrives', async () => {
    open({center: 30})
    await tick(10)
    centreOn(500)
    await tick(1000)
    // The first target's reasserts see the target moved on and skip.
    expect(H.log).toEqual([markRead])
    update(() => loadThread(450, 550))
    await tick(1000)
    expect(H.log).toEqual([markRead, coarse(500), coarse(500)])
  })

  test('a newer target that is loaded is centred on its own schedule', async () => {
    open({center: 30})
    await tick(10)
    centreOn(40)
    update(() => loadThread(1, 60))
    await tick(1000)
    expect(H.log).toEqual([markRead, coarse(40), coarse(40)])
  })
})

describe('the closed-loop corrector', () => {
  // Target 30 of 1..60 sits at data index 30. Rows 0..9 in view centre on 4.5, 25.5 rows short, and
  // the average row is 6000/60 = 100 high, damped by 0.9.
  const firstStep = 25.5 * 100 * 0.9

  test('steps toward the target on each viewable change and on its 50/250/500/900ms ladder', async () => {
    open({center: 30})
    scrolled(0, 6000)
    viewable(0, 9)
    expect(scrollsOnly()).toEqual([toOffset(firstStep)])
    clearLog()
    // The list reports no new offset, so every step is computed from the same one.
    await tick(50)
    expect(scrollsOnly()).toEqual([coarse(30), toOffset(firstStep)])
    await tick(200)
    expect(scrollsOnly()).toEqual([coarse(30), toOffset(firstStep), coarse(30), toOffset(firstStep)])
    clearLog()
    await tick(250)
    expect(scrollsOnly()).toEqual([toOffset(firstStep)])
    await tick(400)
    expect(scrollsOnly()).toEqual([toOffset(firstStep), toOffset(firstStep)])
    clearLog()
    await tick(5000)
    expect(scrollsOnly()).toEqual([])
  })

  test('steps from the reported offset and never below the resting offset', () => {
    open({center: 30})
    scrolled(1000, 6000)
    viewable(0, 9)
    // Overshot: rows 40..49 in view, 14.5 rows past the target.
    scrolled(4000, 6000)
    viewable(40, 49)
    scrolled(100, 6000)
    viewable(40, 49)
    expect(scrollsOnly()).toEqual([
      toOffset(1000 + firstStep),
      toOffset(4000 - 14.5 * 100 * 0.9),
      toOffset(0),
    ])
  })

  test('stops once the target is within half a row of the middle', async () => {
    open({center: 30})
    scrolled(0, 6000)
    viewable(0, 9)
    scrolled(firstStep, 6000)
    viewable(25, 35)
    clearLog()
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([coarse(30), coarse(30)])
  })

  test('gives up after 13 steps', () => {
    open({center: 30})
    scrolled(0, 6000)
    for (let i = 0; i < 20; i++) viewable(0, 9)
    expect(scrollsOnly()).toHaveLength(13)
  })

  test('a drag stops it, and the coarse reasserts already scheduled', async () => {
    open({center: 30})
    scrolled(0, 6000)
    drag()
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([])
  })

  test('a drag between the coarse reasserts cancels the second', async () => {
    open({center: 30})
    await tick(50)
    drag()
    await tick(1000)
    expect(scrollsOnly()).toEqual([coarse(30)])
  })

  test('waits for the list to report its offset and size before its first step', () => {
    open({center: 30})
    viewable(0, 9)
    expect(scrollsOnly()).toEqual([])
    scrolled(0, 6000)
    viewable(0, 9)
    expect(scrollsOnly()).toEqual([toOffset(firstStep)])
  })

  // The new conversation's list is a new FlatList: the old one's offset and sizes say nothing about it.
  test('after a conversation switch, steps from the new list\'s offset and sizes, not the old one\'s', () => {
    open({center: 30})
    scrolled(3000, 6000)
    update(() => {
      H.threadStore.reset({
        ...threadTransitions.loaded(emptyThread, H.range(1, 60)),
        clearVersion: 1,
        conversationIDKey: T.Chat.stringToConversationIDKey('conv2'),
        moreToLoadForward: false,
      })
    })
    clearLog()
    viewable(0, 9)
    expect(scrollsOnly()).toEqual([])
    scrolled(0, 6000)
    viewable(0, 9)
    expect(scrollsOnly()).toEqual([toOffset(firstStep)])
  })

  test('does nothing before the list reports a viewable range', async () => {
    open({center: 30})
    await tick(1000)
    expect(scrollsOnly()).toEqual([coarse(30), coarse(30)])
  })
})

describe('a centre requested after opening', () => {
  test('waits for the reload that brings its target', async () => {
    open()
    await tick(200)
    clearLog()
    centreOn(500)
    await tick(1000)
    expect(H.log).toEqual([])
    update(() => loadThread(450, 550))
    await tick(1000)
    expect(H.log).toEqual([coarse(500), coarse(500)])
  })

  test('rows changing under a centred target go on correcting within its schedule, without a coarse scroll', async () => {
    open({center: 50, from: 21, to: 80})
    await tick(300)
    scrolled(0, 6000)
    clearLog()
    // More rows arrive around the target while it is still settling. It keeps its index in the
    // newest-first data.
    setOrdinals(1, 80)
    viewable(0, 9)
    expect(scrollsOnly()).toEqual([toOffset(25.5 * (6000 / 80) * 0.9)])
    // The 500ms and 900ms rungs of the schedule the target started with; nothing restarts it.
    await tick(1000)
    expect(scrollsOnly()).toHaveLength(3)
    expect(scrollsOnly().filter(([kind]) => kind === 'scrollToItem')).toEqual([])
  })

  test('rows changing under a centred target do not renew its 13 steps', () => {
    open({center: 50, from: 21, to: 80})
    scrolled(0, 6000)
    // New messages keep arriving while it settles, each followed by a viewable change.
    for (let i = 1; i <= 20; i++) {
      setOrdinals(21, 80 + i)
      viewable(0, 9)
    }
    expect(scrollsOnly().filter(([kind]) => kind === 'scrollToOffset')).toHaveLength(13)
  })

  test('once the corrector has centred the target, older rows loading under it leave the reader there', async () => {
    open({center: 50, from: 21, to: 80})
    await tick(1000)
    scrolled(3000, 6000)
    // Target 50 sits at data index 30, dead centre of rows 25..35.
    viewable(25, 35)
    clearLog()
    setOrdinals(1, 80)
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([])
  })

  test('once the corrector\'s schedule has run out, older rows loading under the target leave the reader there', async () => {
    open({center: 50, from: 21, to: 80})
    scrolled(0, 6000)
    viewable(0, 9)
    await tick(1000)
    clearLog()
    setOrdinals(1, 80)
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([])
  })

  test('a target among the newest rows, which cannot reach the middle, settles without a step', async () => {
    open({center: 78, from: 21, to: 80})
    scrolled(0, 6000)
    viewable(0, 9)
    await tick(100)
    expect(scrollsOnly()).toEqual([coarse(78)])
    clearLog()
    setOrdinals(1, 80)
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([coarse(78)])
  })

  test('with the keyboard up, a target among the newest rows settles at the resting offset without a step', async () => {
    open({center: 59, keyboard: true})
    const resting = H.bottomInset - keyboardHeight
    scrolled(resting, 6000)
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([coarse(59), coarse(59)])
  })

  test('with the keyboard up, a step toward the newest stops at the resting offset', () => {
    open({center: 57, keyboard: true})
    const resting = H.bottomInset - keyboardHeight
    // Rows 2..11 in view centre on 6.5; target 57 sits at data index 3, 3.5 rows newer.
    scrolled(resting + 200, 6000)
    viewable(2, 11)
    expect(scrollsOnly()).toEqual([toOffset(resting)])
  })

  test('a target among the oldest rows, which cannot reach the middle, settles without a step', async () => {
    open({center: 22, from: 21, to: 80})
    scrolled(5000, 6000)
    viewable(50, 59)
    await tick(100)
    expect(scrollsOnly()).toEqual([coarse(22)])
    clearLog()
    setOrdinals(21, 81)
    viewable(50, 59)
    await tick(1000)
    expect(scrollsOnly()).toEqual([coarse(22)])
  })

  test('once the corrector runs out of steps, older rows loading under the target leave the reader there', async () => {
    open({center: 50, from: 21, to: 80})
    await tick(1000)
    scrolled(0, 6000)
    for (let i = 0; i < 14; i++) viewable(0, 9)
    clearLog()
    setOrdinals(1, 80)
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([])
  })

  test('after a drag, older rows loading under a centred target leave the reader where they are', async () => {
    open({center: 50, from: 21, to: 80})
    await tick(1000)
    scrolled(0, 6000)
    drag()
    viewable(0, 9)
    clearLog()
    // Scrolling up loads older rows.
    setOrdinals(1, 80)
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([])
  })

  test('after a drag, a new message under a centred target leaves the reader where they are', async () => {
    open({center: 50, from: 21, to: 80})
    await tick(1000)
    scrolled(0, 6000)
    drag()
    viewable(0, 9)
    clearLog()
    setOrdinals(21, 81)
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([])
  })

  test('after asking for the bottom from a hit still settling, a new message leaves the reader there', async () => {
    open({center: 50, from: 21, to: 80})
    await tick(1000)
    scrolled(0, 6000)
    clearLog()
    act(() => H.threadRefs.current?.scrollToBottom())
    viewable(0, 9)
    setOrdinals(21, 81)
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([toBottom])
  })
})

describe('choosing a hit again', () => {
  test('after dragging away from the same hit, its reload centres it again', async () => {
    open({center: 30})
    await tick(1000)
    scrolled(0, 6000)
    drag()
    viewable(0, 9)
    clearLog()
    centreOn(30)
    update(() => loadThread(1, 60))
    await tick(1000)
    // Moved toward, and the corrector steps from the range last reported.
    expect(scrollsOnly().filter(([kind]) => kind === 'scrollToItem')).toEqual([coarse(30), coarse(30)])
    expect(scrollsOnly()).toContainEqual(toOffset(25.5 * 100 * 0.9))
  })

  test('in another conversation on the same ordinal, it is centred there too', async () => {
    open({center: 30})
    await tick(1000)
    clearLog()
    update(() => {
      H.threadStore.reset({
        clearVersion: 1,
        conversationIDKey: T.Chat.stringToConversationIDKey('conv2'),
        loaded: false,
        messageOrdinals: undefined,
        moreToLoadForward: false,
      })
    })
    update(() => loadThread(1, 60))
    await tick(1000)
    expect(H.log).toEqual([markRead, coarse(30), coarse(30)])
  })
})

describe('asking for the bottom before a hit loads', () => {
  test('leaves the reader at the bottom once the hit arrives', async () => {
    open()
    await tick(200)
    centreOn(30)
    clearLog()
    act(() => H.threadRefs.current?.scrollToBottom())
    update(() => loadThread(1, 60))
    await tick(1000)
    expect(scrollsOnly()).toEqual([toBottom])
  })
})

describe('a screen pushed over a centred conversation', () => {
  test('after a drag away from the hit, coming back keeps the position', async () => {
    open({center: 30})
    await tick(1000)
    scrolled(0, 6000)
    drag()
    viewable(0, 9)
    clearLog()
    hideAndShow()
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([])
  })

  test('after the hit settled and the reader asked for the bottom, coming back keeps the position', async () => {
    open({center: 30})
    await tick(1000)
    scrolled(3000, 6000)
    viewable(25, 35)
    act(() => H.threadRefs.current?.scrollToBottom())
    scrolled(0, 6000)
    viewable(0, 9)
    clearLog()
    hideAndShow()
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([])
  })

  test('under StrictMode, whose effect re-mount is the same, centring still runs its schedule', async () => {
    open({center: 30, strict: true})
    scrolled(0, 6000)
    viewable(0, 9)
    clearLog()
    await tick(1000)
    expect(scrollsOnly()).toEqual([
      coarse(30),
      toOffset(25.5 * 100 * 0.9),
      coarse(30),
      toOffset(25.5 * 100 * 0.9),
      toOffset(25.5 * 100 * 0.9),
      toOffset(25.5 * 100 * 0.9),
    ])
  })

  test('the first load is not repeated', async () => {
    open()
    await tick(1000)
    clearLog()
    hideAndShow()
    await tick(1000)
    expect(H.log).toEqual([])
  })
})

describe('closing thread search (clearing the centre)', () => {
  test('leaves the list where it is, not at the newest', async () => {
    open({center: 30})
    await tick(1000)
    clearLog()
    update(() => {
      H.setCenter(undefined)
    })
    await tick(5000)
    expect(H.log).toEqual([])
  })

  test('stops a centring under way', async () => {
    open({center: 30})
    scrolled(0, 6000)
    update(() => {
      H.setCenter(undefined)
    })
    clearLog()
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([])
  })

  test('lets the same target be centred again', async () => {
    open({center: 30})
    await tick(1000)
    update(() => {
      H.setCenter(undefined)
    })
    clearLog()
    centreOn(30)
    update(() => loadThread(1, 60))
    await tick(1000)
    expect(H.log).toEqual([coarse(30), coarse(30)])
  })
})

describe('appending', () => {
  test('with the keyboard up re-pins to the resting offset once MVCP has adjusted', async () => {
    open({keyboard: true})
    await tick(200)
    clearLog()
    setOrdinals(1, 61)
    expect(H.log).toEqual([])
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
    await tick(1000)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })

  // A drag dismisses the keyboard; the reader reopens it by tapping the composer.
  test('with the keyboard reopened after dragging into history, a new message leaves the reader there', async () => {
    open({keyboard: true})
    await tick(200)
    drag()
    update(closeKeyboard)
    dragEnded(2000)
    flingEnded(3000)
    update(openKeyboard)
    clearLog()
    setOrdinals(1, 61)
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('with the keyboard reopened after flinging back down to the newest, a new message re-pins', async () => {
    open({keyboard: true})
    await tick(200)
    drag()
    update(closeKeyboard)
    flingEnded(3000)
    drag()
    dragEnded(1000, true)
    flingEnded(0)
    update(openKeyboard)
    clearLog()
    setOrdinals(1, 61)
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })

  test('a drag let go at the newest, with no fling, hands the end back too', async () => {
    open({keyboard: true})
    await tick(200)
    drag()
    update(closeKeyboard)
    flingEnded(3000)
    drag()
    dragEnded(2)
    update(openKeyboard)
    clearLog()
    setOrdinals(1, 61)
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })

  // Whose end it is is decided where the list comes to rest, not where the finger lifts.
  test('a flick from the newest into history leaves the reader there when a new message arrives', async () => {
    open({keyboard: true})
    await tick(200)
    drag()
    dragEnded(H.bottomInset - keyboardHeight + 2, true)
    flingEnded(3000)
    clearLog()
    setOrdinals(1, 61)
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('while a flick from the newest is still carrying the list, a new message leaves the reader be', async () => {
    open({keyboard: true})
    await tick(200)
    drag()
    dragEnded(H.bottomInset - keyboardHeight + 2, true)
    clearLog()
    setOrdinals(1, 61)
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('a flick from history that comes to rest at the newest hands the end back', async () => {
    open({keyboard: true})
    await tick(200)
    drag()
    dragEnded(2000, true)
    flingEnded(H.bottomInset - keyboardHeight)
    clearLog()
    setOrdinals(1, 61)
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })

  test('with the keyboard still up, coming to rest over it counts as the newest', async () => {
    open({keyboard: true})
    await tick(200)
    drag()
    flingEnded(3000)
    drag()
    flingEnded(H.bottomInset - keyboardHeight)
    clearLog()
    setOrdinals(1, 61)
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })

  test('with the keyboard still up, coming to rest short of it is not the newest', async () => {
    open({keyboard: true})
    await tick(200)
    drag()
    flingEnded(H.bottomInset - keyboardHeight + 100)
    clearLog()
    setOrdinals(1, 61)
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('with the keyboard reopened after leaving a centred hit, a new message leaves the reader there', async () => {
    open({center: 30})
    await tick(1000)
    update(() => {
      H.setCenter(undefined)
    })
    update(openKeyboard)
    clearLog()
    setOrdinals(1, 61)
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('with the keyboard up, older rows arriving are not an append', async () => {
    open({from: 21, keyboard: true, to: 80})
    await tick(200)
    clearLog()
    setOrdinals(1, 80)
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('with the keyboard up, older and newer rows arriving together re-pin', async () => {
    open({from: 21, keyboard: true, to: 80})
    await tick(200)
    clearLog()
    setOrdinals(1, 81)
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })

  test('two appends before the re-pin fires give one re-pin', async () => {
    open({keyboard: true})
    await tick(200)
    clearLog()
    setOrdinals(1, 61)
    setOrdinals(1, 62)
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })

  // One decision per append, taken when the re-pin would fire, with the keyboard as it is then.
  test('the keyboard opening before the re-pin would fire re-pins over it', async () => {
    open()
    await tick(200)
    clearLog()
    setOrdinals(1, 61)
    update(openKeyboard)
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })

  test('the keyboard closing before the re-pin fires cancels it', async () => {
    open({keyboard: true})
    await tick(200)
    clearLog()
    setOrdinals(1, 61)
    update(closeKeyboard)
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('with the keyboard down is left to the list', async () => {
    open()
    await tick(200)
    clearLog()
    setOrdinals(1, 61)
    await tick(1000)
    expect(H.log).toEqual([])
    expect(props().maintainVisibleContentPosition).toEqual(mvpClosed)
  })

  test('with the keyboard up, the newest page refilling a thread cleared by jump to recent is not an append', async () => {
    open({keyboard: true})
    await tick(200)
    clearLog()
    update(() => clearThread())
    update(() => loadThread(1, 61))
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('with the keyboard up, the reload around a hit is not an append', async () => {
    open({keyboard: true})
    await tick(200)
    clearLog()
    centreOn(30)
    update(() => loadThread(1, 60))
    await tick(1000)
    expect(scrollsOnly()).toEqual([coarse(30), coarse(30)])
  })

  test('with the keyboard up, a new message leaves the reader on a centred hit', async () => {
    open({center: 30, keyboard: true})
    await tick(1000)
    clearLog()
    setOrdinals(1, 61)
    await tick(1000)
    expect(scrollsOnly()).not.toContainEqual(toBottomOverKeyboard)
  })

  test('with the keyboard up, a new message after asking for the bottom from a hit re-pins', async () => {
    open({center: 30, keyboard: true})
    await tick(1000)
    act(() => H.threadRefs.current?.scrollToBottom())
    clearLog()
    setOrdinals(1, 61)
    await tick(0)
    expect(scrollsOnly()).toEqual([toBottomOverKeyboard])
  })

  test('fewer rows is not an append', async () => {
    open({keyboard: true})
    await tick(200)
    clearLog()
    setOrdinals(1, 59)
    await tick(1000)
    expect(H.log).toEqual([])
  })
})

describe('editing', () => {
  const revealed = (n: number) => ['scrollToItem', {animated: true, item: ord(n), viewPosition: 0.5}]

  test('reveals the message being edited, animated', async () => {
    open()
    await tick(200)
    clearLog()
    update(() => H.inputStore.set({editing: ord(15)}))
    expect(H.log).toEqual([revealed(15)])
  })

  test('once per edit, not on every change to the rows', async () => {
    open()
    await tick(200)
    clearLog()
    update(() => H.inputStore.set({editing: ord(15)}))
    setOrdinals(1, 61)
    await tick(1000)
    expect(scrollsOnly()).toEqual([revealed(15)])
  })

  test('editing the same message again after stopping reveals it again', async () => {
    open()
    await tick(200)
    clearLog()
    update(() => H.inputStore.set({editing: ord(15)}))
    update(() => H.inputStore.set({editing: undefined}))
    update(() => H.inputStore.set({editing: ord(15)}))
    expect(H.log).toEqual([revealed(15), revealed(15)])
  })

  test('a message outside the rows is revealed once it loads', async () => {
    open({from: 21, to: 80})
    await tick(200)
    clearLog()
    update(() => H.inputStore.set({editing: ord(15)}))
    expect(H.log).toEqual([])
    update(() => loadThread(1, 20))
    expect(H.log).toEqual([revealed(15)])
    update(() => loadThread(81, 90))
    await tick(1000)
    expect(scrollsOnly()).toEqual([revealed(15)])
  })

  test('with the keyboard up, revealing a message out of view leaves the reader on it when a new message arrives', async () => {
    open({keyboard: true})
    await tick(200)
    viewable(0, 9)
    update(() => H.inputStore.set({editing: ord(15)}))
    clearLog()
    setOrdinals(1, 61)
    await tick(1000)
    expect(H.log).toEqual([])
  })

  // Rows 60..51 in view, the newest at the bottom; the oldest of them, 51, is cut off at the top.
  test.each([
    ['in the middle of the view', 59],
    ['the newest, with the list at its end', 60],
  ])('with the keyboard up, a message already wholly in view (%s) is not scrolled to, and a new message re-pins', async (_name, n) => {
    open({keyboard: true})
    await tick(200)
    scrolled(H.bottomInset - keyboardHeight, 6000)
    viewable(0, 9)
    fullyViewable(0, 8)
    clearLog()
    update(() => H.inputStore.set({editing: ord(n)}))
    expect(H.log).toEqual([])
    setOrdinals(1, 61)
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })

  // Whether a row is wholly in view is measured, not read off its place in the viewable range.
  test.each([
    ['the oldest in view, at the top edge', 9, 51],
    ['the older of two tall rows filling the view', 1, 59],
    ['the newer of two tall rows filling the view', 1, 60],
  ])('with the keyboard up, a message wholly in view (%s) is not scrolled to, and a new message re-pins', async (_name, last, n) => {
    open({keyboard: true})
    await tick(200)
    scrolled(H.bottomInset - keyboardHeight, 6000)
    viewable(0, last)
    fullyViewable(0, last)
    clearLog()
    update(() => H.inputStore.set({editing: ord(n)}))
    expect(H.log).toEqual([])
    setOrdinals(1, 61)
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })

  test.each([
    ['the oldest in view, which may be cut off at the top', 51],
    ['the newest, with the list short of its end', 60],
  ])('with the keyboard up, a message at the edge of the view (%s) is revealed, and takes the reader off the end', async (_name, n) => {
    open({keyboard: true})
    await tick(200)
    scrolled(n === 60 ? 100 : H.bottomInset - keyboardHeight, 6000)
    viewable(0, 9)
    if (n === 60) fullyViewable(1, 9)
    else fullyViewable(0, 8)
    clearLog()
    update(() => H.inputStore.set({editing: ord(n)}))
    expect(H.log).toEqual([['scrollToItem', {animated: true, item: ord(n), viewPosition: 0.5}]])
    clearLog()
    setOrdinals(1, 61)
    await tick(1000)
    expect(H.log).toEqual([])
  })
})

// However the reader moved the list, it moved without the list moving itself.
describe('movement the list did not make is the reader', () => {
  const restingOverKeyboard = H.bottomInset - keyboardHeight

  // A tap on the status bar scrolls an inverted list to its newest message, with no drag.
  test('a status-bar tap that carries the reader from history to the newest hands the end back', async () => {
    open({keyboard: true})
    await tick(200)
    scrolled(restingOverKeyboard, 6000)
    drag()
    scrolled(2000, 6000)
    dragEnded(2000)
    update(() => {
      props().onScrollToTop({nativeEvent: {contentOffset: {y: 2000}}})
    })
    scrolled(1000, 6000)
    scrolled(restingOverKeyboard, 6000)
    update(() => {
      props().onScrollToTop({nativeEvent: {contentOffset: {y: restingOverKeyboard}}})
    })
    clearLog()
    setOrdinals(1, 61)
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })

  // VoiceOver's three-finger scroll moves the list with no drag.
  test('a scroll with no drag during a centring ladder stops it', async () => {
    open({center: 30})
    scrolled(0, 6000)
    viewable(0, 9)
    const firstStep = 25.5 * 100 * 0.9
    expect(scrollsOnly()).toEqual([toOffset(firstStep)])
    scrolled(firstStep, 6000)
    scrolled(firstStep - 800, 6000)
    clearLog()
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([])
  })

  // Where a coarse scroll to the row lands is not known, only which way the row lies.
  test('a scroll with no drag against a coarse scroll to the target still under way stops centring', async () => {
    open({center: 30})
    viewable(0, 9)
    await tick(50)
    expect(scrollsOnly()).toEqual([coarse(30)])
    scrolled(0, 6000)
    scrolled(2000, 6000)
    scrolled(1000, 6000)
    clearLog()
    await tick(1000)
    expect(scrollsOnly()).toEqual([])
  })

  test('a scroll with no drag into history takes the end: a new message with the keyboard up leaves the reader there', async () => {
    open({keyboard: true})
    await tick(200)
    scrolled(restingOverKeyboard, 6000)
    scrolled(1500, 6000)
    clearLog()
    setOrdinals(1, 61)
    await tick(1000)
    expect(H.log).toEqual([])
  })

  // The keyboard lifts the list with it wherever it is, here off a hit still being centred.
  test('the keyboard opening moves the list with its resting offset, which is the list\'s own: centring goes on', async () => {
    open({center: 30})
    scrolled(0, 6000)
    viewable(0, 9)
    const firstStep = 25.5 * 100 * 0.9
    scrolled(firstStep, 6000)
    update(openKeyboard)
    scrolled(firstStep - keyboardHeight + H.bottomInset, 6000)
    clearLog()
    await tick(50)
    expect(scrollsOnly()).toContainEqual(coarse(30))
  })

  test('rows changing size move the list as its anchor holds them, which is the list\'s own', async () => {
    open({keyboard: true})
    await tick(200)
    scrolled(restingOverKeyboard, 6000)
    scrolled(restingOverKeyboard + 150, 6150)
    clearLog()
    setOrdinals(1, 61)
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })

  // With the keyboard down, the anchor itself scrolls a new message into view.
  test('while the list holds the end, its anchor bringing the newest into view is its own', async () => {
    open()
    // Past the first load's own scrolls.
    await tick(1100)
    scrolled(0, 6000)
    scrolled(100, 6100)
    scrolled(40, 6100)
    scrolled(0, 6100)
    expect(props().maintainVisibleContentPosition).toEqual(mvpClosed)
    update(openKeyboard)
    clearLog()
    setOrdinals(1, 61)
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })
})

describe('the list\'s own scrolls coming to rest', () => {
  // An animated scroll of the list's own ending reports a rest on iOS as a fling's end does.
  test('a reveal ending at the resting offset does not hand the end back while a hit is centred', async () => {
    open({center: 30, keyboard: true})
    await tick(1000)
    viewable(25, 35)
    update(() => H.inputStore.set({editing: ord(58)}))
    flingEnded(H.bottomInset - keyboardHeight)
    clearLog()
    setOrdinals(1, 61)
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('a scroll of the list\'s own supersedes a reader\'s fling: the rest that follows is the list\'s', async () => {
    open({keyboard: true})
    await tick(200)
    drag()
    dragEnded(2000)
    act(() => H.threadRefs.current?.scrollToBottom())
    update(() => H.inputStore.set({editing: ord(15)}))
    flingEnded(H.bottomInset - keyboardHeight)
    clearLog()
    setOrdinals(1, 61)
    await tick(1000)
    expect(H.log).toEqual([])
  })
})

describe('a safe-area inset change', () => {
  const newInset = 50
  const toBottomOverKeyboardAtNewInset = ['scrollToOffset', {animated: false, offset: newInset - keyboardHeight}]
  const changeInset = () => {
    update(() => {
      H.insetStore.set({bottomInset: newInset})
    })
  }

  test('before the first-load retry fires, the retry uses the inset as it is then', async () => {
    open({keyboard: true})
    await tick(10)
    changeInset()
    await tick(1000)
    expect(H.log).toEqual([markRead, toBottomOverKeyboard, toBottomOverKeyboardAtNewInset])
  })

  test('before the keyboard-up append re-pin fires, the re-pin still fires, for the new inset', async () => {
    open({keyboard: true})
    await tick(200)
    clearLog()
    setOrdinals(1, 61)
    changeInset()
    await tick(1000)
    expect(H.log).toEqual([toBottomOverKeyboardAtNewInset])
  })

  test('ThreadRefs scrollToBottom uses the inset as it is now', async () => {
    open({keyboard: true})
    await tick(200)
    changeInset()
    clearLog()
    act(() => H.threadRefs.current?.scrollToBottom())
    expect(H.log).toEqual([toBottomOverKeyboardAtNewInset])
  })

  test('does not restart a centring under way', async () => {
    open({center: 30})
    await tick(10)
    changeInset()
    await tick(1000)
    expect(H.log).toEqual([markRead, coarse(30), coarse(30)])
  })
})

describe('loading older messages', () => {
  // Data is newest first, so the last viewable index is the oldest row on screen.
  const loads = () => H.log.filter(([kind]) => kind === 'loadOlderMessages')

  test('a long thread loads within 10 rows of its oldest, once the 1s gate has passed', async () => {
    open()
    viewable(40, 48)
    viewable(40, 49)
    expect(loads()).toEqual([])
    await tick(1001)
    viewable(40, 48)
    expect(loads()).toEqual([])
    viewable(40, 49)
    expect(loads()).toEqual([['loadOlderMessages', 60]])
    viewable(40, 59)
    expect(loads()).toEqual([['loadOlderMessages', 60]])
    await tick(1001)
    viewable(40, 59)
    expect(loads()).toEqual([
      ['loadOlderMessages', 60],
      ['loadOlderMessages', 60],
    ])
  })

  test('a short thread loads within 1 row of its oldest', async () => {
    open({to: 30})
    await tick(1001)
    viewable(0, 27)
    expect(loads()).toEqual([])
    viewable(0, 28)
    expect(loads()).toEqual([['loadOlderMessages', 30]])
  })

  test('new rows restart the 1s gate and move the threshold', async () => {
    open()
    await tick(1001)
    setOrdinals(1, 80)
    viewable(60, 79)
    expect(loads()).toEqual([])
    await tick(1001)
    viewable(60, 68)
    expect(loads()).toEqual([])
    viewable(60, 69)
    expect(loads()).toEqual([['loadOlderMessages', 80]])
  })

  test('catch-up hears the oldest row in view', () => {
    open()
    viewable(0, 9)
    expect(H.log).toContainEqual(['oldestVisible', ord(51)])
  })

  test('the viewability pairs keep their identity, as FlatList requires', () => {
    open()
    const first = props().viewabilityConfigCallbackPairs
    setOrdinals(1, 61)
    update(() => {
      H.setCenter(ord(30))
    })
    expect(props().viewabilityConfigCallbackPairs).toBe(first)
    expect(first.map(p => p.viewabilityConfig)).toEqual([
      {viewAreaCoveragePercentThreshold: 0},
      {itemVisiblePercentThreshold: 100},
    ])
  })
})

// After a jump to an old search hit the thread holds a window of history, and newer messages are
// loaded as the reader scrolls down toward the newest row loaded, as on desktop.
describe('loading newer messages', () => {
  // Data is newest first, so the first viewable index is the newest row on screen.
  const loads = () => H.log.filter(([kind]) => kind === 'loadNewerMessages')
  const openOnOldHit = (p: {keyboard?: boolean} = {}) => {
    open({center: 30, keyboard: p.keyboard})
    update(() => H.threadStore.set({moreToLoadForward: true}))
  }

  test('a long window loads within 10 rows of its newest, once the 1s gate has passed', async () => {
    openOnOldHit()
    await tick(1001)
    viewable(11, 20)
    expect(loads()).toEqual([])
    viewable(10, 19)
    expect(loads()).toEqual([['loadNewerMessages', 60]])
    viewable(0, 9)
    expect(loads()).toEqual([['loadNewerMessages', 60]])
    await tick(1001)
    viewable(0, 9)
    expect(loads()).toEqual([
      ['loadNewerMessages', 60],
      ['loadNewerMessages', 60],
    ])
  })

  test('a short window loads within 1 row of its newest', async () => {
    open({center: 20, to: 30})
    update(() => H.threadStore.set({moreToLoadForward: true}))
    await tick(1001)
    viewable(2, 29)
    expect(loads()).toEqual([])
    viewable(1, 28)
    expect(loads()).toEqual([['loadNewerMessages', 30]])
  })

  test('a thread holding the newest message loads nothing newer', async () => {
    open({center: 30})
    await tick(1001)
    viewable(0, 9)
    expect(loads()).toEqual([])
  })

  test('the rows of a load landing restart the 1s gate', async () => {
    openOnOldHit()
    await tick(1001)
    viewable(0, 9)
    setOrdinals(1, 80)
    viewable(0, 9)
    expect(loads()).toEqual([['loadNewerMessages', 60]])
    await tick(1001)
    viewable(0, 9)
    expect(loads()).toEqual([
      ['loadNewerMessages', 60],
      ['loadNewerMessages', 80],
    ])
  })

  // A page of newer rows lands at the visual bottom of the inverted list; the list's content-position
  // anchor holds the rows in view where they are, so nothing may scroll for the page, the last one
  // (which brings the newest message) included.
  test.each([
    ['with the keyboard down, a page', false, true],
    ['with the keyboard up, a page', true, true],
    ['with the keyboard down, the last page', false, false],
    ['with the keyboard up, the last page', true, false],
  ])('%s landing leaves the reader where they are, even resting at the newest row loaded', async (_name, keyboard, more) => {
    openOnOldHit({keyboard})
    await tick(1001)
    update(() => H.setCenter(undefined))
    drag()
    dragEnded(keyboard ? H.bottomInset - keyboardHeight : 0)
    viewable(0, 9)
    clearLog()
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 80), moreToLoadForward: more}))
    await tick(1000)
    expect(scrollsOnly()).toEqual([])
    const landing = H.listCommits.find(c => c.data.length === 80)
    expect(landing?.maintainVisibleContentPosition).toEqual(mvpNoAutoscroll)
  })

  test('the anchor autoscrolls new messages into view again once the thread holds the newest', async () => {
    openOnOldHit()
    update(() => H.setCenter(undefined))
    expect(props().maintainVisibleContentPosition).toEqual(mvpNoAutoscroll)
    update(() => H.threadStore.set({messageOrdinals: H.range(1, 80), moreToLoadForward: false}))
    expect(props().maintainVisibleContentPosition).toEqual(mvpNoAutoscroll)
    setOrdinals(1, 81)
    expect(props().maintainVisibleContentPosition).toEqual(mvpClosed)
    // Back at the newest, a new message over the keyboard is re-pinned as ever.
    update(openKeyboard)
    drag()
    dragEnded(H.bottomInset - keyboardHeight)
    clearLog()
    setOrdinals(1, 82)
    await tick(0)
    expect(H.log).toEqual([toBottomOverKeyboard])
  })
})

describe('scroll-to-index failures', () => {
  test('retry the current target 200ms later, at most six times per target', async () => {
    open({center: 30})
    await tick(1000)
    clearLog()
    scrollToIndexFailed(30)
    await tick(199)
    expect(H.log).toEqual([])
    await tick(1)
    expect(H.log).toEqual([coarse(30)])
    for (let i = 0; i < 8; i++) scrollToIndexFailed(30)
    await tick(200)
    expect(H.log).toHaveLength(6)
  })

  test('a drag cancels a pending retry', async () => {
    open({center: 30})
    await tick(1000)
    clearLog()
    scrollToIndexFailed(30)
    drag()
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('a new target gets a fresh batch of retries', async () => {
    open({center: 30})
    for (let i = 0; i < 6; i++) scrollToIndexFailed(30)
    await tick(1000)
    centreOn(40)
    update(() => loadThread(1, 60))
    await tick(1000)
    clearLog()
    scrollToIndexFailed(40)
    await tick(200)
    expect(H.log).toEqual([coarse(40)])
  })

  test('a row nothing scrolled to is not retried', async () => {
    open()
    await tick(200)
    clearLog()
    scrollToIndexFailed(30)
    await tick(1000)
    expect(H.log).toEqual([])
  })

  const revealed = (n: number) => ['scrollToItem', {animated: true, item: ord(n), viewPosition: 0.5}]

  test('a failed reveal is retried as the same reveal', async () => {
    open()
    await tick(200)
    clearLog()
    update(() => H.inputStore.set({editing: ord(15)}))
    scrollToIndexFailed(15)
    await tick(200)
    expect(H.log).toEqual([revealed(15), revealed(15)])
  })

  test('while centred, a failed reveal retries the reveal on its own budget and leaves the centre its own', async () => {
    open({center: 30})
    await tick(1000)
    clearLog()
    update(() => H.inputStore.set({editing: ord(15)}))
    for (let i = 0; i < 8; i++) scrollToIndexFailed(15)
    await tick(200)
    expect(H.log).toEqual(Array(7).fill(revealed(15)))
    clearLog()
    scrollToIndexFailed(30)
    await tick(200)
    expect(H.log).toEqual([coarse(30)])
  })
})

describe('maintainVisibleContentPosition', () => {
  test('autoscrolls only when nothing is centred, the thread has rows and the keyboard is down', () => {
    open()
    const closed = props().maintainVisibleContentPosition
    expect(closed).toEqual(mvpClosed)
    update(() => {
      H.setCenter(ord(30))
    })
    expect(props().maintainVisibleContentPosition).toEqual(mvpNoAutoscroll)
    update(() => {
      H.setCenter(ord(500))
    })
    expect(props().maintainVisibleContentPosition).toEqual(mvpNoAutoscroll)
    update(() => {
      H.setCenter(undefined)
    })
    // The same object each time: the prop is never unset or rebuilt, only swapped.
    expect(props().maintainVisibleContentPosition).toBe(closed)
    update(openKeyboard)
    expect(props().maintainVisibleContentPosition).toEqual(mvpNoAutoscroll)
    update(closeKeyboard)
    expect(props().maintainVisibleContentPosition).toBe(closed)
    update(() => {
      H.threadStore.set({messageOrdinals: []})
    })
    expect(props().maintainVisibleContentPosition).toEqual(mvpNoAutoscroll)
  })
})

describe('ThreadRefs and jump to recent', () => {
  test('scrollToBottom goes to the resting offset for the keyboard as it is now', async () => {
    open()
    await tick(200)
    clearLog()
    act(() => H.threadRefs.current?.scrollToBottom())
    // The shared value moves without a render, as reanimated moves it.
    H.anchor.keyboardHeight.value = -keyboardHeight
    act(() => H.threadRefs.current?.scrollToBottom())
    expect(H.log).toEqual([toBottom, toBottomOverKeyboard])
  })

  test('scrollUp and scrollDown do nothing', async () => {
    open()
    await tick(200)
    clearLog()
    act(() => {
      H.threadRefs.current?.scrollUp()
      H.threadRefs.current?.scrollDown()
    })
    expect(H.log).toEqual([])
  })

  test('jump to recent scrolls to the resting offset, even from a centred target', async () => {
    open({center: 30})
    await tick(1000)
    clearLog()
    act(() => H.jumpToRecent.scroll?.())
    expect(H.log).toEqual([toBottom])
  })
})
