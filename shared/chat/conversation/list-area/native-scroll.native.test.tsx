/** @jest-environment jsdom */
/// <reference types="jest" />
// Pins where the native thread list scrolls, and when, by mounting it over a fake FlatList that
// records every imperative scroll and hands back its props so the tests can fire the callbacks the
// real list would (viewable items, scroll, content size, drag, scroll-to-index failure). The list's
// declarative scrolling (maintainVisibleContentPosition) is pinned as the config it hands the list,
// not simulated.
import type * as React from 'react'
import '@/constants'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {ThreadRefsContext} from '../normal/context'
import * as H from './native-list-harness.native'

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
jest.mock('../input-area/input-state', () => ({useConversationInput: () => undefined}))
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

const Harness = () => (
  <ThreadRefsContext value={H.threadRefsValue}>
    <ThreadList />
  </ThreadRefsContext>
)

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

// Opens a conversation holding ordinals from..to, optionally centered and with the keyboard up.
const open = (
  p: {center?: number; from?: number; keyboard?: boolean; loaded?: boolean; to?: number} = {}
) => {
  const {center, from = 1, keyboard = false, loaded = true, to = 60} = p
  update(() => {
    H.threadStore.set({loaded, messageOrdinals: to >= from ? H.range(from, to) : []})
    if (center !== undefined) H.setCenter(ord(center))
    if (keyboard) openKeyboard()
  })
  render(<Harness />)
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

// Reports the rows at data indices first..last as viewable. Data is newest first.
const viewable = (first: number, last: number) => {
  const data = props().data
  const viewableItems: Array<{index: number; item: T.Chat.Ordinal}> = []
  for (let i = first; i <= last; i++) viewableItems.push({index: i, item: data[i]!})
  update(() => {
    props().onViewableItemsChanged({viewableItems})
  })
}

const scrolled = (y: number, height: number) => {
  update(() => {
    props().onScroll({nativeEvent: {contentOffset: {y}, contentSize: {height}}})
  })
}

const drag = () => {
  update(() => {
    props().onScrollBeginDrag()
  })
}

const scrollToIndexFailed = () => {
  update(() => {
    props().onScrollToIndexFailed({})
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
    update(() => {
      H.threadStore.set({loaded: true})
    })
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
    update(() => {
      H.threadStore.set({loaded: false, messageOrdinals: []})
    })
    update(() => {
      H.threadStore.set({loaded: true, messageOrdinals: H.range(1, 60)})
    })
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

  test('the 100ms retry repeats the end scroll even if a centre arrives in between', async () => {
    open()
    await tick(10)
    update(() => {
      H.setCenter(ord(30))
    })
    await tick(1000)
    expect(H.log).toEqual([markRead, toBottom, coarse(30), toBottom, coarse(30)])
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

  test('centring does not wait for the load; the load then adds nothing', async () => {
    open({center: 30, loaded: false})
    await tick(20)
    update(() => {
      H.threadStore.set({loaded: true})
    })
    await tick(1000)
    expect(H.log).toEqual([markRead, coarse(30), coarse(30)])
  })

  test('the 100ms retry centres whatever target is current by then', async () => {
    open({center: 30})
    await tick(10)
    // Not loaded, so only the retry can reach it.
    update(() => {
      H.setCenter(ord(500))
    })
    await tick(1000)
    // The first target's reasserts see the target moved on and skip.
    expect(H.log).toEqual([markRead, coarse(500), coarse(500)])
    clearLog()
    // Arriving later refines but does not coarse-scroll again.
    setOrdinals(450, 550)
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('a newer target that is loaded is centred on its own schedule', async () => {
    open({center: 30})
    await tick(10)
    update(() => {
      H.setCenter(ord(40))
    })
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

  test('steps from the reported offset and never below 0', () => {
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

  test('a drag stops it, but not the coarse reasserts already scheduled', async () => {
    open({center: 30})
    scrolled(0, 6000)
    drag()
    viewable(0, 9)
    await tick(1000)
    expect(scrollsOnly()).toEqual([coarse(30), coarse(30)])
  })

  test('does nothing before the list reports a viewable range', async () => {
    open({center: 30})
    await tick(1000)
    expect(scrollsOnly()).toEqual([coarse(30), coarse(30)])
  })
})

describe('a centre requested after opening', () => {
  test('is centred once its target is in the loaded rows', async () => {
    open()
    await tick(200)
    clearLog()
    update(() => {
      H.setCenter(ord(30))
    })
    expect(H.log).toEqual([])
    await tick(1000)
    expect(H.log).toEqual([coarse(30), coarse(30)])
  })

  test('waits for a target that is not loaded, through the reload that brings it', async () => {
    open()
    await tick(200)
    clearLog()
    update(() => {
      H.setCenter(ord(500))
    })
    update(() => {
      H.threadStore.set({loaded: false, messageOrdinals: []})
    })
    await tick(1000)
    expect(H.log).toEqual([])
    update(() => {
      H.threadStore.set({loaded: true, messageOrdinals: H.range(450, 550)})
    })
    await tick(1000)
    expect(H.log).toEqual([coarse(500), coarse(500)])
  })

  test('the same target again changes nothing', async () => {
    open({center: 30})
    await tick(1000)
    clearLog()
    update(() => {
      H.setCenter(ord(30))
    })
    await tick(1000)
    expect(H.log).toEqual([])
  })

  test('rows changing under a centred target re-arm the corrector without a coarse scroll', async () => {
    open({center: 50, from: 21, to: 80})
    await tick(1000)
    scrolled(0, 6000)
    drag()
    viewable(0, 9)
    clearLog()
    // Scrolling up loads older rows. The target keeps its index in the newest-first data.
    setOrdinals(1, 80)
    viewable(0, 9)
    expect(scrollsOnly()).toEqual([toOffset(25.5 * (6000 / 80) * 0.9)])
    await tick(1000)
    expect(scrollsOnly()).toHaveLength(5)
    expect(scrollsOnly().filter(([kind]) => kind === 'scrollToItem')).toEqual([])
  })
})

describe('clearing the centre', () => {
  test('leaves the list where it is', async () => {
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
    update(() => {
      H.setCenter(ord(30))
    })
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

  test('with the keyboard up re-pins wherever the reader has scrolled to', async () => {
    open({keyboard: true})
    await tick(200)
    scrolled(3000, 6000)
    viewable(30, 39)
    clearLog()
    setOrdinals(1, 61)
    await tick(0)
    expect(scrollsOnly()).toEqual([toBottomOverKeyboard])
  })

  test('with the keyboard up, older rows count too', async () => {
    open({from: 21, keyboard: true, to: 80})
    await tick(200)
    clearLog()
    setOrdinals(1, 80)
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

  test('fewer rows is not an append', async () => {
    open({keyboard: true})
    await tick(200)
    clearLog()
    setOrdinals(1, 59)
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

  test('the viewable-items callback keeps its identity, as FlatList requires', () => {
    open()
    const first = props().onViewableItemsChanged
    setOrdinals(1, 61)
    update(() => {
      H.setCenter(ord(30))
    })
    expect(props().onViewableItemsChanged).toBe(first)
  })
})

describe('scroll-to-index failures', () => {
  test('retry the current target 200ms later, at most six times per target', async () => {
    open({center: 30})
    await tick(1000)
    clearLog()
    scrollToIndexFailed()
    await tick(199)
    expect(H.log).toEqual([])
    await tick(1)
    expect(H.log).toEqual([coarse(30)])
    for (let i = 0; i < 8; i++) scrollToIndexFailed()
    await tick(200)
    expect(H.log).toHaveLength(6)
  })

  test('a new target gets a fresh batch of retries', async () => {
    open({center: 30})
    for (let i = 0; i < 6; i++) scrollToIndexFailed()
    await tick(1000)
    update(() => {
      H.setCenter(ord(40))
    })
    await tick(1000)
    clearLog()
    scrollToIndexFailed()
    await tick(200)
    expect(H.log).toEqual([coarse(40)])
  })

  test('with no target, the retry scrolls nowhere', async () => {
    open()
    await tick(200)
    clearLog()
    scrollToIndexFailed()
    await tick(1000)
    expect(H.log).toEqual([])
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
