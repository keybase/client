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

type Props = {centeredOrdinal: T.Chat.Ordinal | undefined; messageOrdinals: ReadonlyArray<T.Chat.Ordinal>}

const mount = () => {
  const scrollToOffset = jest.fn()
  const listRef: React.RefObject<NativeListRef | null> = {current: {scrollToItem: jest.fn(), scrollToOffset}}
  const wrapper = ({children}: {children: React.ReactNode}) => (
    <ComposerProvider
      bottomInset={0}
      keyboardHeight={shared(keyboardOffset)}
      keyboardProgress={shared(1)}
      measuredHeight={800}
    >
      {children}
    </ComposerProvider>
  )
  const initialProps: Props = {centeredOrdinal: undefined, messageOrdinals: newestFirst(1, 60)}
  const hook = renderHook(
    (p: Props) =>
      useNativeThreadScroll({
        centeredOrdinal: p.centeredOrdinal,
        containsLatestMessage: true,
        conversationIDKey: T.Chat.stringToConversationIDKey('conv1'),
        datasetKey: 'conv1:0',
        editingOrdinal: undefined,
        isKeyboardVisible: true,
        listRef,
        loadNewer: () => {},
        loadOlder: () => {},
        loaded: true,
        messageOrdinals: p.messageOrdinals,
      }),
    {initialProps, wrapper}
  )
  let props = initialProps
  return {
    hook,
    // Pins to the end: the resting offset over the keyboard.
    pins: () => scrollToOffset.mock.calls.filter(([o]) => (o as {offset: number}).offset === keyboardOffset).length,
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
