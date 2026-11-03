/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'
import * as Chat from '@/constants/chat'
import {act, cleanup, render} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {formatTimeForConversationList} from '@/util/timestamp'
import {signIn, threadWrapper} from '@/test/thread-tree'
import {OrangeLineContext} from '../orange-line-context'
import Separator, {NativeSeparator} from './separator'

const ord = T.Chat.numberToOrdinal
const older = ord(10)
const newer = ord(20)
const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

// The line is a 1px bar painted with the orange theme token, so its presence is what proves the
// separator drew an unread boundary rather than merely rendering something.
const drewOrangeLine = (container: HTMLElement) => container.innerHTML.includes('var(--color-orange)')

// The thread the separator reads: two messages, the unread boundary sitting between them, so the
// separator above `newer` is the one that must draw the orange line. They land in the thread's own
// store after it mounts, as a load's messages do.
const renderInThread = (children: React.ReactNode, messages?: Array<T.Chat.Message>) => {
  const thread = threadWrapper(convID)
  const rendered = render(<OrangeLineContext value={newer}>{children}</OrangeLineContext>, {
    wrapper: thread.wrapper,
  })
  const ms = messages ?? [
    Chat.makeMessageText({ordinal: older}),
    Chat.makeMessageText({ordinal: newer}),
  ]
  act(() => {
    thread.store().setState({
      messageMap: new Map(ms.map(m => [m.ordinal, m])),
      messageOrdinals: ms.map(m => m.ordinal),
    })
  })
  return rendered
}

beforeEach(() => {
  signIn()
})
afterEach(() => {
  cleanup()
  act(() => {
    resetAllStores()
  })
})

test('draws the orange line for the message below the unread boundary', () => {
  const {container} = renderInThread(<Separator trailingItem={newer} />)
  expect(drewOrangeLine(container)).toBe(true)
})

// react-native's VirtualizedListCellRenderer only ever passes {highlighted, leadingItem} to
// ItemSeparatorComponent -- there is no trailingItem on native.
test('draws the orange line when the list supplies react-native separator props', () => {
  const {container} = renderInThread(<NativeSeparator leadingItem={newer} />)
  expect(drewOrangeLine(container)).toBe(true)
})

test('leaves the older message of the pair alone', () => {
  const {container} = renderInThread(<NativeSeparator leadingItem={older} />)
  expect(drewOrangeLine(container)).toBe(false)
})

test('draws nothing before the thread has its messages', () => {
  const thread = threadWrapper(convID)
  const {container} = render(
    <OrangeLineContext value={newer}>
      <Separator trailingItem={newer} />
    </OrangeLineContext>,
    {wrapper: thread.wrapper}
  )
  expect(drewOrangeLine(container)).toBe(false)
})

// On desktop the line carries the time of a message old enough when no username header above it
// already dates the run
test('labels the line with the time when the same author kept talking hours ago', () => {
  const timestamp = Date.now() - 1000 * 60 * 60 * 3
  const {container} = renderInThread(<Separator trailingItem={newer} />, [
    Chat.makeMessageText({author: 'testuser-mac', ordinal: older, timestamp: timestamp - 1000}),
    Chat.makeMessageText({author: 'testuser-mac', ordinal: newer, timestamp}),
  ])
  expect(drewOrangeLine(container)).toBe(true)
  expect(container.textContent).toContain(formatTimeForConversationList(timestamp))
})
