/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'

const convX = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convY = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const mockRequestWindow = jest.fn()
const mockSetMarkReadBlocked = jest.fn()
let mockRouteParams: {threadSearch?: {query?: string}} | undefined

// Both providers under test pull thread/engine plumbing they don't exercise here.
jest.mock('./thread-context', () => ({
  useConversationThreadSetMarkReadBlocked: () => mockSetMarkReadBlocked,
  useConversationThreadStore: () => ({getState: () => ({})}),
}))
jest.mock('./send-actions', () => ({
  useConversationSendActions: () => ({sendGiphyResult: jest.fn(), sendMessage: jest.fn()}),
}))
jest.mock('@/engine/action-listener', () => ({useEngineActionListener: () => {}}))
jest.mock('./thread-window', () => ({useRequestWindow: () => mockRequestWindow}))
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
