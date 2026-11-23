/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, renderHook} from '@testing-library/react'
import type * as T from '@/constants/types'
import {useScrollUnbox, type ViewableItemsData} from './list-helpers'

const conv = (id: string) => ({item: {conversationIDKey: id as T.Chat.ConversationIDKey, type: 'small'}})
const viewable = (...items: Array<{item: unknown}>) =>
  ({changed: [], viewableItems: items} as unknown as ViewableItemsData)
const divider = {item: {type: 'divider'}}

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})

test('with unboxFirstViewNow, the first view of conversations unboxes at once and later ones are debounced', () => {
  const onVisible = jest.fn()
  const {result} = renderHook(() => useScrollUnbox(onVisible, 200, true))

  act(() => result.current(viewable(conv('a'), conv('b'))))
  expect(onVisible).toHaveBeenCalledTimes(1)
  expect(onVisible).toHaveBeenLastCalledWith(['a', 'b'])

  act(() => result.current(viewable(conv('c'))))
  expect(onVisible).toHaveBeenCalledTimes(1)
  act(() => jest.advanceTimersByTime(200))
  expect(onVisible).toHaveBeenCalledTimes(2)
  expect(onVisible).toHaveBeenLastCalledWith(['c'])
})

test('a first view with no conversations in it leaves the immediate unbox for the next one', () => {
  const onVisible = jest.fn()
  const {result} = renderHook(() => useScrollUnbox(onVisible, 200, true))

  act(() => result.current(viewable(divider)))
  act(() => result.current(viewable(divider, conv('a'))))
  expect(onVisible).toHaveBeenCalledTimes(1)
  expect(onVisible).toHaveBeenLastCalledWith(['a'])
  // the empty view's debounced call was dropped
  act(() => jest.advanceTimersByTime(200))
  expect(onVisible).toHaveBeenCalledTimes(1)
})

test('without unboxFirstViewNow every view is debounced', () => {
  const onVisible = jest.fn()
  const {result} = renderHook(() => useScrollUnbox(onVisible, 1000))

  act(() => result.current(viewable(conv('a'))))
  expect(onVisible).not.toHaveBeenCalled()
  act(() => jest.advanceTimersByTime(1000))
  expect(onVisible).toHaveBeenCalledTimes(1)
  expect(onVisible).toHaveBeenLastCalledWith(['a'])
})
