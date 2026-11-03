/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import {act, cleanup, render, renderHook} from '@testing-library/react'
import type {RefType as InputRef, Selection} from '../normal/input.shared'
import {useSuggestors} from '.'
import * as T from '@/constants/types'
import {ComposerContext, makeComposer} from '../composer'
import {ConversationInputProvider} from '../input-state'
import {ConversationThreadProvider} from '../../thread-context'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {navigationWrapper} from '@/test/navigation'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

type MockCommandsListProps = {
  filter: string
  inputSnapshot: {text: string}
  onSelected: (item: unknown, final: boolean) => void
}
const mockCommandsList = jest.fn((_p: MockCommandsListProps) => null)
const mockUsersList = jest.fn((_p: {filter: string}) => null)
const mockEmojiList = jest.fn((_p: {filter: string}) => null)
const mockChannelsList = jest.fn((_p: {filter: string}) => null)

// the lists are render stubs that record the filter they were handed; the transformers and the
// bot-command status are the real ones
jest.mock('./commands', () => ({
  ...jest.requireActual<object>('./commands'),
  List: (p: MockCommandsListProps) => mockCommandsList(p),
}))
jest.mock('./channels', () => ({
  ...jest.requireActual<object>('./channels'),
  List: (p: {filter: string}) => mockChannelsList(p),
}))
jest.mock('./emoji', () => ({...jest.requireActual<object>('./emoji'), List: (p: {filter: string}) => mockEmojiList(p)}))
jest.mock('./users', () => ({
  ...jest.requireActual<object>('./users'),
  UsersList: (p: {filter: string}) => mockUsersList(p),
}))
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<Record<string, unknown>>('@/common-adapters')
  return {...actual, AnchoredPopup: (p: {children: React.ReactNode}) => <>{p.children}</>}
})

// the suggestors read the caret through the composer's input; drive it directly so the
// test exercises the word-splitting rather than a real textarea
const makeInput = (getSelection: () => Selection | undefined, showsWrites: boolean) =>
  ({
    clear: jest.fn(),
    focus: jest.fn(),
    getSelection,
    isFocused: () => true,
    replaceText: jest.fn(() => showsWrites),
  }) as unknown as InputRef

// the composer the suggestors read the text from, attached to the input the way the composer
// view attaches it; its onChangeText reports what was typed, as the view's does
const renderSuggestors = (getSelection: () => Selection | undefined, showsWrites = true) => {
  const input = makeInput(getSelection, showsWrites)
  const composer = makeComposer({
    flushDraft: () => {},
    getDraft: () => undefined,
    isReadOnly: () => false,
    saveDraft: () => {},
    takeUnfurlSnapshot: () => ({dismissed: [], failed: []}),
  })
  const view = composer.connect()
  view.setInput(input)
  const {wrapper: Nav} = navigationWrapper({params: {conversationIDKey: convID}, route: 'chatRoot'})
  const {result} = renderHook(
    () =>
      useSuggestors({
        onChangeText: view.textChanged,
        suggestionListStyle: {},
        suggestionOverlayStyle: {},
        suggestionSpinnerStyle: {},
      }),
    {
      wrapper: (p: {children: React.ReactNode}) => (
        <Nav>
          <ConversationThreadProvider id={convID}>
            <ConversationInputProvider id={convID}>
              <ComposerContext value={composer}>{p.children}</ComposerContext>
            </ConversationInputProvider>
          </ConversationThreadProvider>
        </Nav>
      ),
    }
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
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  mockCommandsList.mockClear()
  mockUsersList.mockClear()
  mockEmojiList.mockClear()
  mockChannelsList.mockClear()
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
  resetAllStores()
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

// the command word split must not swallow a later word: with it on, the word at
// the cursor was '@bob hey', the unanchored users marker matched it, and the
// overlay stayed mounted forever swallowing ArrowUp/ArrowDown
test('an @mention inside a command message stops suggesting once the word no longer matches', () => {
  let text = ''
  const result = renderSuggestors(() => ({end: text.length, start: text.length}))

  for (const t of ['/me @bob', '/me @bob ', '/me @bob hey']) {
    text = t
    typeText(result, text)
  }
  renderPopup(result)

  expect(mockUsersList).not.toHaveBeenCalled()
  expect(result.current.suggestionsShowing).toBe(false)
})

test('a pasted command message with a trailing word suggests nothing', () => {
  const text = '/me @bob hey'
  const result = renderSuggestors(() => ({end: text.length, start: text.length}))

  typeText(result, text)

  expect(result.current.suggestionsShowing).toBe(false)
})

// the markers are anchored regexes, so their '^' lands mid-pattern in the split
// lookahead where it can never match, and their capture groups make String.split
// interleave captures with words
test.each([
  [':smi', () => mockEmojiList, 'smi'],
  ['@bob', () => mockUsersList, 'bob'],
  ['#gen', () => mockChannelsList, 'gen'],
])('a command message splits before a later %s marker', (tail, list, filter) => {
  const text = `/me ${tail}`
  const result = renderSuggestors(() => ({end: text.length, start: text.length}))

  typeText(result, text)
  renderPopup(result)

  expect(list().mock.calls.at(-1)?.[0].filter).toBe(filter)
  expect(mockCommandsList).not.toHaveBeenCalled()
})

test('non-command text still splits on plain spaces', () => {
  const text = 'hello there @test'
  const result = renderSuggestors(() => ({end: text.length, start: text.length}))

  typeText(result, text)
  renderPopup(result)

  expect(mockUsersList).toHaveBeenCalled()
  expect(mockUsersList.mock.calls.at(-1)?.[0].filter).toBe('test')
})

// the command list filters on the snapshot, so it has to be the text the input shows
test('a preview the input does not show leaves the command snapshot on what was typed', () => {
  const text = '/gi'
  const result = renderSuggestors(() => ({end: text.length, start: text.length}), false)
  typeText(result, text)
  renderPopup(result)

  act(() => {
    mockCommandsList.mock.calls.at(-1)?.[0].onSelected({description: '', hasHelpText: false, name: 'giphy', usage: ''}, false)
  })
  renderPopup(result)

  expect(mockCommandsList.mock.calls.at(-1)?.[0].inputSnapshot.text).toBe('/gi')
})
