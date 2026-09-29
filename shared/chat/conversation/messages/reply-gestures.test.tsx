/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import type * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import type {Props as SwipeableProps} from '@/common-adapters/swipeable-row.shared'
import {ConversationInputProvider} from '../input-area/input-state'
import {ConversationThreadProvider} from '../thread-context'
import {MessageContext} from './ids-context'
import EmojiRow from './emoji-row'
import LongPressable from './wrapper/long-pressable'

// the swipeable row stands in for the native one, remembering what it was handed
let mockSwipeable: SwipeableProps | undefined
jest.mock('@/common-adapters/swipeable-row', () => ({
  __esModule: true,
  default: function MockSwipeable(p: SwipeableProps) {
    mockSwipeable = p
    return null
  },
}))

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const ordinal = T.Chat.numberToOrdinal(101)

const setCannotWrite = (cannotWrite: boolean) => {
  act(() => {
    metasReceived([{...Meta.makeConversationMeta(), cannotWrite, conversationIDKey: convID}], undefined, {
      force: true,
    })
  })
}

const Row = (p: React.PropsWithChildren) => (
  <ConversationThreadProvider id={convID}>
    <ConversationInputProvider id={convID}>
      <MessageContext value={{isHighlighted: false, ordinal}}>{p.children}</MessageContext>
    </ConversationInputProvider>
  </ConversationThreadProvider>
)

const g = globalThis as unknown as {isMobile: boolean}
const wasMobile = g.isMobile

afterEach(() => {
  cleanup()
  g.isMobile = wasMobile
  mockSwipeable = undefined
  act(() => {
    resetAllStores()
  })
})

describe('the hover Reply', () => {
  const hasReply = () => {
    const {container} = render(
      <Row>
        <EmojiRow hasUnfurls={false} messageType="text" />
      </Row>
    )
    return !!container.querySelector('.icon-gen-iconfont-reply')
  }

  test('is offered where the user can post', () => {
    setCannotWrite(false)
    expect(hasReply()).toBe(true)
  })

  test('is not offered where the user cannot post', () => {
    setCannotWrite(true)
    expect(hasReply()).toBe(false)
  })
})

describe('swipe-to-reply', () => {
  const swipeEnabled = () => {
    g.isMobile = true
    render(
      <Row>
        <LongPressable>{null}</LongPressable>
      </Row>
    )
    return mockSwipeable?.enabled !== false
  }

  test('arms where the user can post', () => {
    setCannotWrite(false)
    expect(swipeEnabled()).toBe(true)
  })

  test('does not arm where the user cannot post', () => {
    setCannotWrite(true)
    expect(swipeEnabled()).toBe(false)
  })
})
