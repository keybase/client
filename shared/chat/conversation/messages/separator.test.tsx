/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as T from '@/constants/types'
import * as Chat from '@/constants/chat'
import {cleanup, render} from '@testing-library/react'
import {OrangeLineContext} from '../orange-line-context'

const ord = T.Chat.numberToOrdinal
const older = ord(10)
const newer = ord(20)

// The thread the separator reads: two messages, the unread boundary sitting between them, so the
// separator above `newer` is the one that must draw the orange line.
type SeparatorData = {orangeLineAbove: boolean; orangeTime: string; ordinal: T.Chat.Ordinal}
let mockThreadState: unknown

jest.mock('../thread-context', () => ({
  // read via useContext but only consulted for the desktop timestamp label, which these cases
  // don't exercise
  ShownUsernameCacheContext: {},
  useConversationThreadSelector: (sel: (s: unknown) => SeparatorData): SeparatorData =>
    sel(mockThreadState),
}))
jest.mock('@/stores/current-user', () => ({useCurrentUserState: () => 'testuser'}))

import Separator, {NativeSeparator} from './separator'

const Tree = (p: {children: React.ReactNode}) => (
  <OrangeLineContext value={newer}>{p.children}</OrangeLineContext>
)

// The line is a 1px bar painted with the orange theme token, so its presence is what proves the
// separator drew an unread boundary rather than merely rendering something.
const drewOrangeLine = (container: HTMLElement) => container.innerHTML.includes('var(--color-orange)')

beforeEach(() => {
  mockThreadState = {
    messageMap: new Map([
      [older, Chat.makeMessageText({ordinal: older})],
      [newer, Chat.makeMessageText({ordinal: newer})],
    ]),
    messageOrdinals: [older, newer],
  }
})
afterEach(cleanup)

test('draws the orange line for the message below the unread boundary', () => {
  const {container} = render(
    <Tree>
      <Separator trailingItem={newer} />
    </Tree>
  )
  expect(drewOrangeLine(container)).toBe(true)
})

// react-native's VirtualizedListCellRenderer only ever passes {highlighted, leadingItem} to
// ItemSeparatorComponent -- there is no trailingItem on native.
test('draws the orange line when the list supplies react-native separator props', () => {
  const {container} = render(
    <Tree>
      <NativeSeparator leadingItem={newer} />
    </Tree>
  )
  expect(drewOrangeLine(container)).toBe(true)
})

test('leaves the older message of the pair alone', () => {
  const {container} = render(
    <Tree>
      <NativeSeparator leadingItem={older} />
    </Tree>
  )
  expect(drewOrangeLine(container)).toBe(false)
})
