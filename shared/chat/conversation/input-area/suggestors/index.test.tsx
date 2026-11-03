/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import '@/test/viewport.desktop'
import {act, cleanup, render, renderHook} from '@testing-library/react'
import type {RefType as InputRef, Selection} from '../normal/input.shared'
import {useSuggestors} from '.'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {ComposerContext, makeComposer} from '../composer'
import {ConversationInputProvider} from '../input-state'
import {ConversationThreadProvider} from '../../thread-context'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {navigationWrapper} from '@/test/navigation'
import {setupOverlayDom} from '@/test/overlay-dom.desktop'
import {installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {metasReceived, participantInfoReceived} from '@/chat/inbox/metadata'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import * as TestIDs from '@/tests/e2e/shared/test-ids'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

type MockCommandsListProps = {
  filter: string
  inputSnapshot: {text: string}
  onSelected: (item: unknown, final: boolean) => void
}
const mockCommandsList = jest.fn((_p: MockCommandsListProps) => null)

// the command list is a render stub that records what it was handed: the snapshot it filters on is
// not something its rows show. Its transformer and the bot-command status are the real ones, and
// the other lists are the real ones, over the conversation set up below
jest.mock('./commands', () => ({
  ...jest.requireActual<object>('./commands'),
  List: (p: MockCommandsListProps) => mockCommandsList(p),
}))

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

// the popup as it shows once the service has answered what the lists load
const renderPopup = async (result: {current: ReturnType<typeof useSuggestors>}) => {
  render(<>{result.current.popup}</>)
  await flush()
}

// the suggestion rows on screen, by what each reads
const rows = () =>
  [...document.querySelectorAll(`[data-testid^="${TestIDs.CHAT_SUGGESTION_ROW}"]`)].map(r => r.textContent)

const channelRow = (teamname: string, channelname: string): T.RPCChat.UIInboxBigTeamRow => ({
  channel: {channelname, convID: `${teamname}-${channelname}`, draft: null, isMuted: false, teamname},
  state: T.RPCChat.UIInboxBigTeamRowTyp.channel,
})

// the popup is the real one, portaled where the desktop app portals it
setupOverlayDom()

beforeEach(() => {
  jest.useFakeTimers()
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  mockCommandsList.mockClear()
  // a group chat with alice and bob, who share the team alpha with testuser
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID, teamType: 'adhoc'}])
  const participants = ['testuser', 'alice', 'bob']
  participantInfoReceived(convID, {all: participants, contactName: new Map(), name: participants})
  useInboxLayoutState.getState().dispatch.updateLayout(
    JSON.stringify({
      bigTeams: [channelRow('alpha', 'general'), channelRow('alpha', 'random')],
      smallTeams: [],
      totalSmallTeams: 0,
    } satisfies T.RPCChat.UIInboxLayout)
  )
  const fake = installFakeEngine()
  fake.answer('chat.1.local.getMutualTeamsLocal', () => ({offline: false, teams: [{name: 'alpha', teamID: 'team-alpha'}]}))
  fake.answer('chat.1.local.userEmojis', () => ({emojis: {emojis: []}}))
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
  resetAllStores()
})

// bot command names contain a space (`keybot cancel`), so the command-mode word
// split has to be on for the very first trigger. pasted text arrives in a single
// change event and never gets a follow-up keystroke to widen the word
test('a pasted multi-word bot command filters on the whole command name', async () => {
  const text = '!keybot cancel'
  const result = renderSuggestors(() => ({end: text.length, start: text.length}))

  typeText(result, text)
  await renderPopup(result)

  expect(mockCommandsList).toHaveBeenCalled()
  expect(mockCommandsList.mock.calls.at(-1)?.[0].filter).toBe('keybot cancel')
})

test('typing a multi-word bot command a character at a time ends on the same filter', async () => {
  const full = '!keybot cancel'
  let text = ''
  const result = renderSuggestors(() => ({end: text.length, start: text.length}))

  for (const c of full) {
    text += c
    typeText(result, text)
  }
  await renderPopup(result)

  expect(mockCommandsList.mock.calls.at(-1)?.[0].filter).toBe('keybot cancel')
})

// the command word split must not swallow a later word: with it on, the word at
// the cursor was '@bob hey', the unanchored users marker matched it, and the
// overlay stayed mounted forever swallowing ArrowUp/ArrowDown
test('an @mention inside a command message stops suggesting once the word no longer matches', async () => {
  let text = ''
  const result = renderSuggestors(() => ({end: text.length, start: text.length}))

  for (const t of ['/me @bob', '/me @bob ', '/me @bob hey']) {
    text = t
    typeText(result, text)
  }
  await renderPopup(result)

  expect(rows()).toEqual([])
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
  [':smi', (shown: Array<string | null>) => expect(shown).toContainEqual(expect.stringMatching(/smile$/))],
  ['@bob', (shown: Array<string | null>) => expect(shown).toEqual(['bob'])],
  ['#gen', (shown: Array<string | null>) => expect(shown).toEqual(['alpha #general'])],
])('a command message splits before a later %s marker', async (tail, expectRows) => {
  const text = `/me ${tail}`
  const result = renderSuggestors(() => ({end: text.length, start: text.length}))

  typeText(result, text)
  await renderPopup(result)

  expectRows(rows())
  expect(mockCommandsList).not.toHaveBeenCalled()
})

test('non-command text still splits on plain spaces', async () => {
  const text = 'hello there @test'
  const result = renderSuggestors(() => ({end: text.length, start: text.length}))

  typeText(result, text)
  await renderPopup(result)

  expect(rows()).toEqual(['testuser'])
})

// the command list filters on the snapshot, so it has to be the text the input shows
test('a preview the input does not show leaves the command snapshot on what was typed', async () => {
  const text = '/gi'
  const result = renderSuggestors(() => ({end: text.length, start: text.length}), false)
  typeText(result, text)
  await renderPopup(result)

  act(() => {
    mockCommandsList.mock.calls.at(-1)?.[0].onSelected({description: '', hasHelpText: false, name: 'giphy', usage: ''}, false)
  })
  await renderPopup(result)

  expect(mockCommandsList.mock.calls.at(-1)?.[0].inputSnapshot.text).toBe('/gi')
})
