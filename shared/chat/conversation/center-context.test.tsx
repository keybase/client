/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'

const convX = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convY = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const mockLoadMessagesCentered = jest.fn()
const mockJumpToRecentThread = jest.fn()
const mockSetMarkReadBlocked = jest.fn()
const mockThreadLoadStatusOptions = {isThreadLoadCurrent: () => true, onThreadLoadStatus: () => {}}
let mockRouteParams: {threadSearch?: {query?: string}} | undefined

// Both providers under test pull thread/engine plumbing they don't exercise here.
jest.mock('./thread-context', () => ({
  useConversationThreadJumpToRecent: () => mockJumpToRecentThread,
  useConversationThreadLoadMessagesCentered: () => mockLoadMessagesCentered,
  useConversationThreadSetMarkReadBlocked: () => mockSetMarkReadBlocked,
  useConversationThreadStore: () => ({getState: () => ({})}),
}))
jest.mock('./send-actions', () => ({
  useConversationSendActions: () => ({sendGiphyResult: jest.fn(), sendMessage: jest.fn()}),
}))
jest.mock('@/engine/action-listener', () => ({useEngineActionListener: () => {}}))
jest.mock('./thread-load-status-context', () => ({
  useThreadLoadStatusOptionsGetter: () => () => mockThreadLoadStatusOptions,
}))
jest.mock('./thread-search-route', () => ({useChatThreadRouteParams: () => mockRouteParams}))

import {ConversationCenterProvider, useConversationCenter} from './center-context'
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

// The real tree order: ConversationCenterProvider wraps ConversationInputProvider, so the input
// provider's consume effect runs FIRST. If either provider claimed the other's intent types, the
// input provider would silently eat every highlight.
const Tree = ({id}: {id: T.Chat.ConversationIDKey}) => (
  <ConversationCenterProvider id={id}>
    <ConversationInputProvider id={id}>
      <Probe />
    </ConversationInputProvider>
  </ConversationCenterProvider>
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
  expect(mockLoadMessagesCentered).toHaveBeenCalledTimes(1)
  expect(mockLoadMessagesCentered).toHaveBeenCalledWith(
    T.Chat.numberToMessageID(42),
    'flash',
    expect.anything()
  )
  expect(seenHighlightOrdinal).toBe(T.Chat.numberToOrdinal(42))
  expect(useInputIntentState.getState().intents.has(convX)).toBe(false)
})

test('a highlight written after mount is delivered by the subscription', () => {
  render(<Tree id={convX} />)
  expect(mockLoadMessagesCentered).not.toHaveBeenCalled()

  act(() => {
    setInputIntent(convX, highlight(7))
  })

  expect(mockLoadMessagesCentered).toHaveBeenCalledWith(
    T.Chat.numberToMessageID(7),
    'flash',
    expect.anything()
  )
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

  expect(mockLoadMessagesCentered).toHaveBeenCalledTimes(2)
  expect(mockLoadMessagesCentered).toHaveBeenNthCalledWith(
    2,
    T.Chat.numberToMessageID(11),
    'flash',
    expect.anything()
  )
})

// The two-consumer collision the store's `types` filter exists for.
test('the input provider does not consume a highlight meant for the center provider', () => {
  setInputIntent(convX, highlight(5))

  render(<Tree id={convX} />)

  expect(mockLoadMessagesCentered).toHaveBeenCalledWith(
    T.Chat.numberToMessageID(5),
    'flash',
    expect.anything()
  )
  expect(seenUnsentText).toBeUndefined()
})

test('the center provider does not consume an injectText meant for the input provider', () => {
  setInputIntent(convX, {text: 'hello', type: 'injectText'})

  render(<Tree id={convX} />)

  expect(seenUnsentText).toBe('hello')
  expect(mockLoadMessagesCentered).not.toHaveBeenCalled()
  expect(useInputIntentState.getState().intents.has(convX)).toBe(false)
})

test('a highlight for another conversation is left alone', () => {
  setInputIntent(convY, highlight(3))

  render(<Tree id={convX} />)

  expect(mockLoadMessagesCentered).not.toHaveBeenCalled()
  expect(useInputIntentState.getState().intents.get(convY)).toEqual(highlight(3))
})
