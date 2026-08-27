/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import {act, cleanup, render, renderHook} from '@testing-library/react'
import type {RefType as InputRef, Selection} from '../normal/input.shared'
import {useSuggestors} from '.'

const mockCommandsList = jest.fn((_p: {filter: string}) => null)
const mockUsersList = jest.fn((_p: {filter: string}) => null)

jest.mock('./commands', () => ({
  List: (p: {filter: string}) => mockCommandsList(p),
  transformer: jest.fn(),
  useBotCommandsUpdateState: () => ({
    conversationIDKey: 'conv',
    settings: new Map<string, unknown>(),
    status: 0,
  }),
}))
jest.mock('./channels', () => ({List: () => null, transformer: jest.fn()}))
jest.mock('./emoji', () => ({List: () => null, transformer: jest.fn()}))
jest.mock('./users', () => ({UsersList: (p: {filter: string}) => mockUsersList(p), transformer: jest.fn()}))
jest.mock('../../thread-context', () => ({useConversationThreadID: () => 'conv'}))
jest.mock('../input-state', () => ({useConversationInput: () => false}))
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<Record<string, unknown>>('@/common-adapters')
  return {...actual, Popup: (p: {children: React.ReactNode}) => <>{p.children}</>}
})

// the suggestors read the caret through the input ref; drive it directly so the
// test exercises the word-splitting rather than a real textarea
const makeInputRef = (getSelection: () => Selection | undefined) => ({
  current: {
    getSelection,
    isFocused: () => true,
    transformText: jest.fn(),
  } as unknown as InputRef,
})

const renderSuggestors = (getSelection: () => Selection | undefined) => {
  const inputRef = makeInputRef(getSelection)
  const {result} = renderHook(() =>
    useSuggestors({
      inputRef,
      onChangeText: jest.fn(),
      suggestionListStyle: {},
      suggestionOverlayStyle: {},
      suggestionSpinnerStyle: {},
    })
  )
  return result
}

// mirrors what the input does: one change event carrying the whole text, then the
// suggestors' settle timeout. a paste only ever gets one of these
const typeText = (result: {current: ReturnType<typeof useSuggestors>}, text: string) => {
  act(() => {
    result.current.onChangeText(text)
  })
  act(() => {
    jest.advanceTimersByTime(5)
  })
}

const renderPopup = (result: {current: ReturnType<typeof useSuggestors>}) => {
  render(<>{result.current.popup}</>)
}

beforeEach(() => {
  jest.useFakeTimers()
  mockCommandsList.mockClear()
  mockUsersList.mockClear()
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

// bot command names contain a space (`keybot cancel`), so the command-mode word
// split has to be on for the very first trigger. pasted text arrives in a single
// change event and never gets a follow-up keystroke to widen the word
test('a pasted multi-word bot command filters on the whole command name', () => {
  const text = '!keybot cancel'
  const result = renderSuggestors(() => ({end: text.length, start: text.length}))

  typeText(result, text)
  renderPopup(result)

  expect(mockCommandsList).toHaveBeenCalled()
  expect(mockCommandsList.mock.calls.at(-1)?.[0].filter).toBe('keybot cancel')
})

test('typing a multi-word bot command a character at a time ends on the same filter', () => {
  const full = '!keybot cancel'
  let text = ''
  const result = renderSuggestors(() => ({end: text.length, start: text.length}))

  for (const c of full) {
    text += c
    typeText(result, text)
  }
  renderPopup(result)

  expect(mockCommandsList.mock.calls.at(-1)?.[0].filter).toBe('keybot cancel')
})

test('non-command text still splits on plain spaces', () => {
  const text = 'hello there @test'
  const result = renderSuggestors(() => ({end: text.length, start: text.length}))

  typeText(result, text)
  renderPopup(result)

  expect(mockUsersList).toHaveBeenCalled()
  expect(mockUsersList.mock.calls.at(-1)?.[0].filter).toBe('test')
})
