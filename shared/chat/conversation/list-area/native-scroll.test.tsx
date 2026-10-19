/** @jest-environment jsdom */
/// <reference types="jest" />
// What the native adapter schedules, and what cancels it. No list is mounted: the adapter's imperative
// scrolls are recorded, and nothing here stands in for how the list moves.
import type * as React from 'react'
import * as T from '@/constants/types'
import {act, renderHook} from '@testing-library/react'
import type {SharedValue} from 'react-native-reanimated'
import {ComposerProvider} from '../composer-viewport-context'
import {useNativeThreadScroll, type NativeListRef} from './native-scroll'

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardEvents: {addListener: () => ({remove: () => {}})},
}))

const keyboardOffset = -300
const shared = (value: number) => ({value}) as unknown as SharedValue<number>

const newestFirst = (from: number, to: number) => {
  const out: Array<T.Chat.Ordinal> = []
  for (let i = to; i >= from; i--) out.push(T.Chat.numberToOrdinal(i))
  return out
}

type Props = {
  centeredOrdinal: T.Chat.Ordinal | undefined
  containsLatestMessage: boolean
  datasetKey: string
  editingOrdinal: T.Chat.Ordinal | undefined
  messageOrdinals: ReadonlyArray<T.Chat.Ordinal>
}

// The keyboard is up unless asked otherwise, so the list rests over it.
const mount = (opts: {containsLatestMessage?: boolean; keyboardVisible?: boolean} = {}) => {
  const {containsLatestMessage = true, keyboardVisible = true} = opts
  const resting = keyboardVisible ? keyboardOffset : 0
  const scrollToOffset = jest.fn()
  const scrollToItem = jest.fn()
  const clearCenter = jest.fn()
  const loadNewer = jest.fn()
  const loadOlder = jest.fn()
  const listRef: React.RefObject<NativeListRef | null> = {current: {scrollToItem, scrollToOffset}}
  const wrapper = ({children}: {children: React.ReactNode}) => (
    <ComposerProvider
      bottomInset={0}
      keyboardHeight={shared(resting)}
      keyboardProgress={shared(1)}
      measuredHeight={800}
    >
      {children}
    </ComposerProvider>
  )
  const initialProps: Props = {
    centeredOrdinal: undefined,
    containsLatestMessage,
    datasetKey: 'conv1:0',
    editingOrdinal: undefined,
    messageOrdinals: newestFirst(1, 60),
  }
  const hook = renderHook(
    (p: Props) =>
      useNativeThreadScroll({
        centeredOrdinal: p.centeredOrdinal,
        clearCenter,
        containsLatestMessage: p.containsLatestMessage,
        conversationIDKey: T.Chat.stringToConversationIDKey('conv1'),
        datasetKey: p.datasetKey,
        editingOrdinal: p.editingOrdinal,
        isKeyboardVisible: keyboardVisible,
        listRef,
        loadNewer,
        loadOlder,
        loaded: true,
        messageOrdinals: p.messageOrdinals,
      }),
    {initialProps, wrapper}
  )
  let props = initialProps
  return {
    clearCenter,
    hook,
    // Scrolls to the row, whatever for.
    itemScrolls: (item: T.Chat.Ordinal) =>
      scrollToItem.mock.calls.filter(([o]) => (o as {item: T.Chat.Ordinal}).item === item).length,
    loadNewer,
    loadOlder,
    // Pins to the end: the resting offset.
    pins: () => scrollToOffset.mock.calls.filter(([o]) => (o as {offset: number}).offset === resting).length,
    // Scrolls to an offset other than the end: the centring corrector's steps.
    steps: () => scrollToOffset.mock.calls.filter(([o]) => (o as {offset: number}).offset !== resting),
    set: (p: Partial<Props>) => {
      props = {...props, ...p}
      act(() => hook.rerender(props))
    },
  }
}

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})

test('the first load pins the end, and once more 100ms on', () => {
  const m = mount()
  expect(m.pins()).toBe(1)
  act(() => jest.advanceTimersByTime(100))
  expect(m.pins()).toBe(2)
})

test('asking for the bottom just after the first load leaves its retry to pin with the rows as they are then', () => {
  const m = mount()
  act(() => jest.advanceTimersByTime(50))
  act(() => m.hook.result.current.scrollToBottom())
  expect(m.pins()).toBe(2)
  act(() => jest.advanceTimersByTime(50))
  expect(m.pins()).toBe(3)
})

test('a search hit closing before a new message is re-pinned over the keyboard leaves the re-pin to run', () => {
  const m = mount()
  act(() => jest.advanceTimersByTime(1000))
  m.set({centeredOrdinal: T.Chat.numberToOrdinal(30)})
  // Asking for the bottom from the hit hands the end back to the list.
  act(() => m.hook.result.current.scrollToBottom())
  act(() => jest.advanceTimersByTime(1000))
  const before = m.pins()
  m.set({messageOrdinals: newestFirst(1, 61)})
  m.set({centeredOrdinal: undefined})
  act(() => jest.advanceTimersByTime(10))
  expect(m.pins()).toBe(before + 1)
})

test('a drag before a new message is re-pinned leaves the reader where they are', () => {
  const m = mount()
  act(() => jest.advanceTimersByTime(1000))
  const before = m.pins()
  m.set({messageOrdinals: newestFirst(1, 61)})
  act(() => m.hook.result.current.onScrollBeginDrag())
  act(() => jest.advanceTimersByTime(10))
  expect(m.pins()).toBe(before)
})

test('a search hit closing while an edit reveal waits for its row leaves the reveal to retry', () => {
  const m = mount()
  act(() => jest.advanceTimersByTime(1000))
  const hit = T.Chat.numberToOrdinal(30)
  const edited = T.Chat.numberToOrdinal(5)
  m.set({centeredOrdinal: hit})
  m.set({editingOrdinal: edited})
  expect(m.itemScrolls(edited)).toBe(1)
  // The row is outside the rendered window, so the list fails the scroll and the reveal waits to retry.
  act(() => m.hook.result.current.onScrollToIndexFailed({index: 60 - 5}))
  m.set({centeredOrdinal: undefined})
  act(() => jest.advanceTimersByTime(200))
  expect(m.itemScrolls(edited)).toBe(2)
})

test('a drag while an edit reveal waits for its row drops the retry', () => {
  const m = mount()
  act(() => jest.advanceTimersByTime(1000))
  const edited = T.Chat.numberToOrdinal(5)
  m.set({editingOrdinal: edited})
  act(() => m.hook.result.current.onScrollToIndexFailed({index: 60 - 5}))
  act(() => m.hook.result.current.onScrollBeginDrag())
  act(() => jest.advanceTimersByTime(200))
  expect(m.itemScrolls(edited)).toBe(1)
})

test('ending the edit while its reveal waits for its row drops the retry', () => {
  const m = mount()
  act(() => jest.advanceTimersByTime(1000))
  const edited = T.Chat.numberToOrdinal(5)
  m.set({editingOrdinal: edited})
  act(() => m.hook.result.current.onScrollToIndexFailed({index: 60 - 5}))
  m.set({editingOrdinal: undefined})
  act(() => jest.advanceTimersByTime(200))
  expect(m.itemScrolls(edited)).toBe(1)
})

// The list resting at the end over the keyboard, with the edited row laid out well above the part in view.
const restAtEndWithRowAbove = (m: ReturnType<typeof mount>, row: T.Chat.Ordinal) => {
  act(() => jest.advanceTimersByTime(1000))
  act(() => m.hook.result.current.onCellLayout(row, {height: 100, y: 2000}))
  act(() => m.hook.result.current.onScroll(scrollAt(keyboardOffset)))
}
const scrollAt = (y: number) => ({
  nativeEvent: {contentOffset: {y}, contentSize: {height: 6000}, layoutMeasurement: {height: 800}},
})

test('a reveal that brings its row into view is done: a later failure for that row is not retried', () => {
  const m = mount()
  const edited = T.Chat.numberToOrdinal(5)
  restAtEndWithRowAbove(m, edited)
  m.set({editingOrdinal: edited})
  expect(m.itemScrolls(edited)).toBe(1)
  // The reveal's own animated scroll lands with the row in the middle of the part in view.
  act(() => m.hook.result.current.onScroll(scrollAt(1500)))
  act(() => m.hook.result.current.onScrollToIndexFailed({index: 60 - 5}))
  act(() => jest.advanceTimersByTime(200))
  expect(m.itemScrolls(edited)).toBe(1)
})

test('a reveal ends with its edit: editing the row again, already in view, retries nothing of the old one', () => {
  const m = mount()
  const edited = T.Chat.numberToOrdinal(5)
  restAtEndWithRowAbove(m, edited)
  m.set({editingOrdinal: edited})
  expect(m.itemScrolls(edited)).toBe(1)
  m.set({editingOrdinal: undefined})
  // The rows re-lay out with the edited row in view, and it is edited again: nothing to reveal.
  act(() => m.hook.result.current.onCellLayout(edited, {height: 100, y: 0}))
  m.set({editingOrdinal: edited})
  expect(m.itemScrolls(edited)).toBe(1)
  act(() => m.hook.result.current.onScrollToIndexFailed({index: 60 - 5}))
  act(() => jest.advanceTimersByTime(200))
  expect(m.itemScrolls(edited)).toBe(1)
})

// A thread of 60 rows of 100pt, resting at its end in an 800pt view, centring row 30 from a view
// that shows rows 0 to 8: the corrector's first step goes toward it.
const startCentring = () => {
  const m = mount()
  act(() => jest.advanceTimersByTime(1000))
  const scroll = (y: number) =>
    m.hook.result.current.onScroll({
      nativeEvent: {contentOffset: {y}, contentSize: {height: 6000}, layoutMeasurement: {height: 800}},
    })
  act(() => scroll(keyboardOffset))
  m.set({centeredOrdinal: T.Chat.numberToOrdinal(30)})
  act(() => m.hook.result.current.onViewableRange(0, 8))
  expect(m.steps()).toHaveLength(1)
  const landed = (m.steps()[0]![0] as {offset: number}).offset
  // the list reports the rows it shows as it moves, before it reports the scroll
  act(() => m.hook.result.current.onViewableRange(20, 28))
  return {landed, m, scroll}
}

test('centring keeps one scroll in flight: the list showing new rows before it reports the scroll steps nothing', () => {
  const {m} = startCentring()
  expect(m.steps()).toHaveLength(1)
})

test('centring steps again once the list reports its scroll came to rest', () => {
  const {landed, m, scroll} = startCentring()
  act(() => scroll(landed))
  act(() => m.hook.result.current.onMomentumScrollEnd({nativeEvent: {contentOffset: {y: landed}}}))
  expect(m.steps()).toHaveLength(2)
})

test('centring steps again shortly after its scroll lands on a list that reports no rest for it', () => {
  const {landed, m, scroll} = startCentring()
  const target = T.Chat.numberToOrdinal(30)
  const scrolls = () => m.steps().length + m.itemScrolls(target)
  act(() => scroll(landed))
  act(() => jest.advanceTimersByTime(40))
  expect(scrolls()).toBe(1)
  // the next is the corrector's step or its coarse reassert, whichever is due first
  act(() => jest.advanceTimersByTime(10))
  expect(scrolls()).toBe(2)
})

test('centring steps again once a scroll the list reports nothing for has had time to land', () => {
  const {m} = startCentring()
  act(() => jest.advanceTimersByTime(290))
  expect(m.steps()).toHaveLength(1)
  act(() => jest.advanceTimersByTime(10))
  expect(m.steps()).toHaveLength(2)
})

// A window of history, out past the first gate after its rows came in, with its oldest row laid out.
const windowOfHistory = (opts: {keyboardVisible?: boolean} = {}) => {
  const m = mount({containsLatestMessage: false, ...opts})
  act(() => jest.advanceTimersByTime(1001))
  act(() => m.hook.result.current.onCellLayout(T.Chat.numberToOrdinal(1), {height: 100, y: 5900}))
  return m
}
const scrollIn = (y: number, content: number) => ({
  nativeEvent: {contentOffset: {y}, contentSize: {height: content}, layoutMeasurement: {height: 663}},
})

test('a window of history asks for a newer page near its newest row, once a gate', () => {
  const m = windowOfHistory()
  // 900pt past the resting offset, within two screens of the newest row.
  act(() => m.hook.result.current.onScroll(scrollIn(600, 6000)))
  expect(m.loadNewer).toHaveBeenCalledTimes(1)
  act(() => jest.advanceTimersByTime(500))
  act(() => m.hook.result.current.onScroll(scrollIn(600, 6000)))
  expect(m.loadNewer).toHaveBeenCalledTimes(1)
  act(() => jest.advanceTimersByTime(501))
  act(() => m.hook.result.current.onScroll(scrollIn(600, 6000)))
  expect(m.loadNewer).toHaveBeenCalledTimes(2)
})

test('after a jump to a centred row, no newer page is asked for until the reader moves the list', () => {
  const m = windowOfHistory()
  m.set({centeredOrdinal: T.Chat.numberToOrdinal(30)})
  act(() => m.hook.result.current.onScroll(scrollIn(600, 6000)))
  expect(m.loadNewer).not.toHaveBeenCalled()
  // centring settled and the centre closed, the reader still has not moved the list
  act(() => jest.advanceTimersByTime(5000))
  m.set({centeredOrdinal: undefined})
  act(() => jest.advanceTimersByTime(1001))
  act(() => m.hook.result.current.onScroll(scrollIn(600, 6000)))
  expect(m.loadNewer).not.toHaveBeenCalled()
  act(() => m.hook.result.current.onScrollBeginDrag())
  act(() => m.hook.result.current.onScroll(scrollIn(590, 6000)))
  expect(m.loadNewer).toHaveBeenCalledTimes(1)
})

test('a search for the same hit again waits for the reader again', () => {
  const m = windowOfHistory()
  m.set({centeredOrdinal: T.Chat.numberToOrdinal(30)})
  act(() => m.hook.result.current.onScrollBeginDrag())
  // the same hit, reloaded as a fresh window
  m.set({datasetKey: 'conv1:1'})
  act(() => jest.advanceTimersByTime(1001))
  act(() => m.hook.result.current.onCellLayout(T.Chat.numberToOrdinal(1), {height: 100, y: 5900}))
  act(() => m.hook.result.current.onScroll(scrollIn(600, 6000)))
  expect(m.loadNewer).not.toHaveBeenCalled()
})

test('after a jump to a centred row, only a drag or a status-bar tap lets a newer page be asked for', () => {
  const m = windowOfHistory()
  m.set({centeredOrdinal: T.Chat.numberToOrdinal(30)})
  // the list moving with no finger on it (its own centring included) is not the reader
  act(() => m.hook.result.current.onScroll(scrollIn(900, 6000)))
  act(() => m.hook.result.current.onScroll(scrollIn(600, 6000)))
  expect(m.loadNewer).not.toHaveBeenCalled()
  act(() => m.hook.result.current.onScrollToTop({nativeEvent: {contentOffset: {y: 600}}}))
  expect(m.loadNewer).toHaveBeenCalledTimes(1)
})

test('a status-bar tap measures from where it came to rest, not the last scroll event', () => {
  const m = windowOfHistory()
  // the last scroll event seen was far from the newest row
  act(() => m.hook.result.current.onScroll(scrollIn(5000, 6000)))
  expect(m.loadNewer).not.toHaveBeenCalled()
  act(() => m.hook.result.current.onScrollToTop({nativeEvent: {contentOffset: {y: 0}}}))
  expect(m.loadNewer).toHaveBeenCalledTimes(1)
})

test('a reader who scrolls from a centred row to the present lets the centre go', () => {
  const m = windowOfHistory()
  m.set({centeredOrdinal: T.Chat.numberToOrdinal(30)})
  m.set({containsLatestMessage: true})
  // a centred window that already holds the newest message keeps its centre
  expect(m.clearCenter).not.toHaveBeenCalled()
  m.set({containsLatestMessage: false})
  act(() => m.hook.result.current.onScrollBeginDrag())
  m.set({containsLatestMessage: true})
  expect(m.clearCenter).toHaveBeenCalledTimes(1)
})

test('a thread holding the newest message asks for no newer page', () => {
  const m = mount()
  act(() => jest.advanceTimersByTime(1001))
  act(() => m.hook.result.current.onCellLayout(T.Chat.numberToOrdinal(1), {height: 100, y: 5900}))
  act(() => m.hook.result.current.onScroll(scrollIn(600, 6000)))
  act(() => jest.advanceTimersByTime(1001))
  act(() => m.hook.result.current.onScroll(scrollIn(600, 6000)))
  expect(m.loadNewer).not.toHaveBeenCalled()
})

test('an older page asked for does not hold back a newer one', () => {
  const m = windowOfHistory()
  // A short thread: near both its oldest and its newest row.
  act(() => m.hook.result.current.onScroll(scrollIn(600, 2000)))
  expect(m.loadOlder).toHaveBeenCalledTimes(1)
  expect(m.loadNewer).toHaveBeenCalledTimes(1)
})

test('a window of history keeps the end anchor off and anchors on its rows, a reader resting at its newest row too', () => {
  const m = windowOfHistory({keyboardVisible: false})
  expect(m.hook.result.current.maintainVisibleContentPosition).toEqual({minIndexForVisible: 1})
  act(() => m.hook.result.current.onScrollBeginDrag())
  act(() => m.hook.result.current.onScroll(scrollIn(0, 6000)))
  act(() => m.hook.result.current.onScrollEndDrag({nativeEvent: {contentOffset: {y: 0}, velocity: {y: 0}}}))
  expect(m.hook.result.current.maintainVisibleContentPosition).toEqual({minIndexForVisible: 1})
})

test('rows landing at the newest end of a window of history are not re-pinned', () => {
  const m = windowOfHistory()
  const before = m.pins()
  m.set({messageOrdinals: newestFirst(1, 61)})
  act(() => jest.advanceTimersByTime(10))
  expect(m.pins()).toBe(before)
})

test('a reader resting at the newest row of a window of history does not get the end back', () => {
  const m = windowOfHistory()
  act(() => m.hook.result.current.onScrollBeginDrag())
  act(() => m.hook.result.current.onScroll(scrollIn(keyboardOffset, 6000)))
  act(() =>
    m.hook.result.current.onScrollEndDrag({nativeEvent: {contentOffset: {y: keyboardOffset}, velocity: {y: 0}}})
  )
  const before = m.pins()
  // The page bringing the newest message, then a new message after it.
  m.set({containsLatestMessage: true, messageOrdinals: newestFirst(1, 61)})
  act(() => jest.advanceTimersByTime(10))
  m.set({messageOrdinals: newestFirst(1, 62)})
  act(() => jest.advanceTimersByTime(10))
  expect(m.pins()).toBe(before)
})
