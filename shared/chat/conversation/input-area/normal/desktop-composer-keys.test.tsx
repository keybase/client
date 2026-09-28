/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import * as React from 'react'
import * as T from '@/constants/types'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import HiddenString from '@/util/hidden-string'
import {act, cleanup, fireEvent, render} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import * as Meta from '@/constants/chat/meta'
import {metasReceived} from '@/chat/inbox/metadata'
import {useCurrentUserState} from '@/stores/current-user'
import {GlobalKeyEventHandler} from '@/common-adapters/key-event-handler.desktop'
import {ThreadRefsContext} from '@/chat/conversation/normal/context'
import Input from '.'
import {ConversationInputProvider, useConversationInput, type ConversationInputState} from '../input-state'
import {ConversationThreadProvider, useConversationThreadActions} from '../../thread-context'

// Drives every key the desktop composer reacts to through the real textarea and the window-level
// handler, and records what each one did: the edit/reply state, sends, list moves and picks,
// scrolls, the file picker, focus, and whether the browser default was prevented.

jest.mock('@/chat/audio/audio-recorder.native', () => ({__esModule: true, default: () => null}))
jest.mock('@/chat/audio/audio-send.native', () => ({AudioSendWrapper: () => null}))
jest.mock('@/util/expo-document-picker.native', () => ({pickDocumentsAsync: jest.fn()}))
jest.mock('@/chat/emoji-picker/container', () => ({EmojiPickerDesktop: () => null}))
jest.mock('../../reply-preview', () => ({__esModule: true, default: () => null}))
// popups measure their anchor before they render anything, which jsdom cannot do
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<Record<string, unknown>>('@/common-adapters')
  const passthrough = (p: {children: React.ReactNode}): React.ReactNode => p.children
  return {...actual, AnchoredPopup: passthrough, Popup: passthrough}
})

// the users list stands in for every suggestion list: it hands the composer the same handle a
// real list does, saying whether it shows any items, once when it opens, and lets go of it when it
// closes; the pick reports whether anything was highlighted
const mockMove = jest.fn((_up: boolean) => {})
let mockListHasItems = true
let mockListHasSelection = true
const mockSelect = jest.fn(() => mockListHasSelection)
type MockUsersListProps = {
  filter: string
  setListHandle: (h: {hasItems: () => boolean; move: (up: boolean) => void; submit: () => boolean} | undefined) => void
}
const mockUsersList = jest.fn((p: MockUsersListProps) => {
  const {setListHandle} = p
  React.useEffect(() => {
    setListHandle({hasItems: () => mockListHasItems, move: mockMove, submit: mockSelect})
    return () => {
      setListHandle(undefined)
    }
  }, [setListHandle])
  return null
})
jest.mock('../suggestors/users', () => ({
  UsersList: (p: MockUsersListProps) => mockUsersList(p),
  transformer: jest.requireActual<{transformer: unknown}>('../suggestors/users').transformer,
}))

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const lastOrdinal = T.Chat.numberToOrdinal(101)
const noOrdinal = T.Chat.numberToOrdinal(0)

const makeTextMessage = (text: string) =>
  Message.makeMessageText({
    author: 'testuser',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(101),
    isEditable: true,
    ordinal: lastOrdinal,
    outboxID: T.Chat.stringToOutboxID('outbox-1'),
    text: new HiddenString(text),
    timestamp: 100,
  })

type Handles = {
  input: ConversationInputState
  thread: ReturnType<typeof useConversationThreadActions>
}
const Probe = (p: {onRender: (h: Handles) => void}) => {
  p.onRender({input: useConversationInput(s => s), thread: useConversationThreadActions()})
  return null
}

const scrollDown = jest.fn()
const scrollUp = jest.fn()
const threadRefs = {
  focusInput: () => {},
  scrollDown,
  scrollToBottom: () => {},
  scrollUp,
  setInputRef: () => {},
  setScrollRef: () => {},
}

const Wrapper = (p: React.PropsWithChildren) => (
  <GlobalKeyEventHandler>
    <ThreadRefsContext value={threadRefs}>
      <ConversationThreadProvider id={convID}>
        <ConversationInputProvider id={convID}>{p.children}</ConversationInputProvider>
      </ConversationThreadProvider>
    </ThreadRefsContext>
  </GlobalKeyEventHandler>
)

const renderComposer = () => {
  let handles: Handles | undefined
  const utils = render(
    <>
      <Input />
      <Probe onRender={h => (handles = h)} />
    </>,
    {wrapper: Wrapper}
  )
  const textarea = utils.getByTestId(TestIDs.CHAT_INPUT) as HTMLTextAreaElement
  // some other input on the page; cleanup removes it with the container
  const elsewhere = document.createElement('input')
  utils.container.append(elsewhere)
  act(() => {
    handles!.thread.addMessages([makeTextMessage('last thing I said')], {markAsRead: false})
  })
  return {elsewhere, getHandles: () => handles!, textarea}
}

const type = (textarea: HTMLTextAreaElement, text: string, caret = text.length) => {
  act(() => {
    fireEvent.change(textarea, {target: {selectionEnd: caret, selectionStart: caret, value: text}})
  })
}

const select = (textarea: HTMLTextAreaElement, text: string, start: number, end: number) => {
  act(() => {
    fireEvent.change(textarea, {target: {selectionEnd: end, selectionStart: start, value: text}})
  })
}

// the modifiers whose Enter the composer turns into a newline; shift-Enter is the browser's own
const modifiers = [['altKey'], ['ctrlKey'], ['metaKey']] as const

// jsdom has no execCommand. This one does what Chromium's insertText does in a focused, writable
// textarea: replace the selection, put the caret after it, and fire the input event.
const execCommand = jest.fn((command: string, _ui: boolean, value: string) => {
  const el = document.activeElement
  if (command !== 'insertText' || !(el instanceof HTMLTextAreaElement) || el.readOnly) return false
  el.setRangeText(value, el.selectionStart, el.selectionEnd, 'end')
  el.dispatchEvent(new InputEvent('input', {bubbles: true, data: value, inputType: 'insertText'}))
  return true
})

type KeyInit = {altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean}
// returns whether the default was prevented
const keyDown = (target: Element, key: string, init: KeyInit = {}) => {
  let notPrevented = true
  act(() => {
    notPrevented = fireEvent.keyDown(target, {key, ...init})
  })
  return !notPrevented
}

let post: jest.SpyInstance
// a send clears first and posts on a 0ms timer
const flushSend = async () => {
  await act(async () => {
    jest.advanceTimersByTime(0)
    await Promise.resolve()
  })
}

const startEdit = (textarea: HTMLTextAreaElement) => {
  keyDown(textarea, 'ArrowUp')
}

const startReply = (getHandles: () => Handles) => {
  act(() => {
    getHandles().input.dispatch.setReplyTo(lastOrdinal)
  })
}

// the suggestors settle on a 1ms timer after each change
const openSuggestions = (textarea: HTMLTextAreaElement, text: string) => {
  act(() => {
    textarea.focus()
  })
  type(textarea, text)
  act(() => {
    jest.advanceTimersByTime(5)
  })
  expect(mockUsersList).toHaveBeenCalled()
  mockMove.mockClear()
  mockSelect.mockClear()
}

beforeEach(() => {
  jest.useFakeTimers()
  Object.defineProperty(document, 'execCommand', {configurable: true, value: execCommand})
  jest.spyOn(T.RPCChat, 'localUpdateTypingRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise').mockResolvedValue([])
  post = jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockResolvedValue({
    outboxID: new TextEncoder().encode('posted'),
  })
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'testuser',
  })
})

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers()
  })
  cleanup()
  jest.useRealTimers()
  jest.restoreAllMocks()
  resetAllStores()
  mockUsersList.mockClear()
  mockMove.mockClear()
  mockSelect.mockClear()
  execCommand.mockClear()
  mockListHasItems = true
  mockListHasSelection = true
  scrollDown.mockClear()
  scrollUp.mockClear()
})

describe('in the composer, no suggestions', () => {
  test('ArrowUp when empty edits the last message and prevents the default', () => {
    const {getHandles, textarea} = renderComposer()

    expect(keyDown(textarea, 'ArrowUp')).toBe(true)

    expect(getHandles().input.editing).toBe(lastOrdinal)
    expect(textarea.value).toBe('last thing I said')
  })

  test.each([['shiftKey'], ['altKey'], ['ctrlKey'], ['metaKey']] as const)(
    'ArrowUp with %s held does not start an edit',
    modifier => {
      const {getHandles, textarea} = renderComposer()

      expect(keyDown(textarea, 'ArrowUp', {[modifier]: true})).toBe(false)
      expect(keyDown(document.body, 'ArrowUp', {[modifier]: true})).toBe(false)

      expect(getHandles().input.editing).toBe(noOrdinal)
      expect(textarea.value).toBe('')
    }
  )

  test('ArrowUp with text does nothing and leaves the caret move to the browser', () => {
    const {getHandles, textarea} = renderComposer()
    type(textarea, 'draft')

    expect(keyDown(textarea, 'ArrowUp')).toBe(false)

    expect(getHandles().input.editing).toBe(noOrdinal)
  })

  test('ArrowUp in an emptied edit does not restart the edit', () => {
    const {getHandles, textarea} = renderComposer()
    startEdit(textarea)
    type(textarea, '')
    const setEditing = jest.spyOn(getHandles().input.dispatch, 'setEditing')

    expect(keyDown(textarea, 'ArrowUp')).toBe(false)

    expect(setEditing).not.toHaveBeenCalled()
    expect(getHandles().input.editing).toBe(lastOrdinal)
  })

  test('ArrowDown and Tab do nothing', () => {
    const {getHandles, textarea} = renderComposer()

    expect(keyDown(textarea, 'ArrowDown')).toBe(false)
    expect(keyDown(textarea, 'Tab')).toBe(false)

    expect(getHandles().input.editing).toBe(noOrdinal)
    expect(mockMove).not.toHaveBeenCalled()
  })

  test('Enter sends and prevents the default', async () => {
    const {textarea} = renderComposer()
    type(textarea, 'hello')

    expect(keyDown(textarea, 'Enter')).toBe(true)
    await flushSend()

    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0]?.[0].params.body).toBe('hello')
  })

  test.each(modifiers)('Enter with %s types a newline at the caret instead of sending', async modifier => {
    const {textarea} = renderComposer()
    type(textarea, 'ab', 1)

    expect(keyDown(textarea, 'Enter', {[modifier]: true})).toBe(true)
    await flushSend()

    expect(execCommand).toHaveBeenCalledWith('insertText', false, '\n')
    expect(post).not.toHaveBeenCalled()
    expect(textarea.value).toBe('a\nb')
    expect(textarea.selectionStart).toBe(2)
    expect(textarea.selectionEnd).toBe(2)
  })

  test('shift-Enter is left to the browser: not claimed, not typed by the composer, not sent', async () => {
    const {textarea} = renderComposer()
    type(textarea, 'ab', 1)

    expect(keyDown(textarea, 'Enter', {shiftKey: true})).toBe(false)
    await flushSend()

    expect(execCommand).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
    expect(textarea.value).toBe('ab')
  })

  test.each(modifiers)('a read-only composer takes no newline from Enter with %s, so Enter has nothing to send', async modifier => {
    act(() => {
      metasReceived([{...Meta.makeConversationMeta(), cannotWrite: true, conversationIDKey: convID}], undefined, {
        force: true,
      })
    })
    const {textarea} = renderComposer()
    expect(textarea.readOnly).toBe(true)

    expect(keyDown(textarea, 'Enter', {[modifier]: true})).toBe(false)
    keyDown(textarea, 'Enter')
    await flushSend()

    expect(textarea.value).toBe('')
    expect(post).not.toHaveBeenCalled()
  })

  test('with no typed insert available the newline is still written at the caret', async () => {
    Object.defineProperty(document, 'execCommand', {configurable: true, value: undefined})
    const {textarea} = renderComposer()
    type(textarea, 'ab', 1)

    expect(keyDown(textarea, 'Enter', {altKey: true})).toBe(true)
    await flushSend()

    expect(post).not.toHaveBeenCalled()
    expect(textarea.value).toBe('a\nb')
    expect(textarea.selectionStart).toBe(2)
  })

  test.each(modifiers)('Enter with %s replaces the selection with a newline', async modifier => {
    const {textarea} = renderComposer()
    select(textarea, 'aXYb', 1, 3)

    expect(keyDown(textarea, 'Enter', {[modifier]: true})).toBe(true)
    await flushSend()

    expect(post).not.toHaveBeenCalled()
    expect(textarea.value).toBe('a\nb')
    expect(textarea.selectionStart).toBe(2)
  })

  test('an inserted newline is saved in the draft and sent like typed text', async () => {
    const {textarea} = renderComposer()
    const saveDraft = jest.mocked(T.RPCChat.localUpdateUnsentTextRpcPromise)
    type(textarea, 'ab', 1)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    saveDraft.mockClear()

    keyDown(textarea, 'Enter', {altKey: true})
    act(() => {
      jest.advanceTimersByTime(500)
    })

    expect(saveDraft.mock.calls.at(-1)?.[0].text).toBe('a\nb')

    expect(keyDown(textarea, 'Enter')).toBe(true)
    await flushSend()

    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0]?.[0].params.body).toBe('a\nb')
  })

  test('Escape while editing cancels the edit and prevents the default', () => {
    const {getHandles, textarea} = renderComposer()
    startEdit(textarea)

    expect(keyDown(textarea, 'Escape')).toBe(true)

    expect(getHandles().input.editing).toBe(noOrdinal)
    expect(textarea.value).toBe('')
  })

  test('Escape while replying cancels the reply', () => {
    const {getHandles, textarea} = renderComposer()
    startReply(getHandles)
    expect(getHandles().input.replyTo).toBe(lastOrdinal)

    expect(keyDown(textarea, 'Escape')).toBe(true)

    expect(getHandles().input.replyTo).toBe(noOrdinal)
  })

  test('Escape while editing a reply cancels only the edit', () => {
    const {getHandles, textarea} = renderComposer()
    startReply(getHandles)
    startEdit(textarea)

    keyDown(textarea, 'Escape')

    expect(getHandles().input.editing).toBe(noOrdinal)
    expect(getHandles().input.replyTo).toBe(lastOrdinal)
  })

  test('Escape with nothing to cancel does nothing', () => {
    const {getHandles, textarea} = renderComposer()
    type(textarea, 'draft')

    expect(keyDown(textarea, 'Escape')).toBe(false)

    expect(textarea.value).toBe('draft')
    expect(getHandles().input.editing).toBe(noOrdinal)
  })

  test.each([['ctrlKey'], ['metaKey']] as const)('%s-U opens the file picker', modifier => {
    const click = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    const {textarea} = renderComposer()

    expect(keyDown(textarea, 'u', {[modifier]: true})).toBe(false)

    expect(click).toHaveBeenCalledTimes(1)
    expect((click.mock.contexts[0] as HTMLInputElement).type).toBe('file')
  })

  test('a plain u does not open the file picker', () => {
    const click = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    const {textarea} = renderComposer()

    keyDown(textarea, 'u')

    expect(click).not.toHaveBeenCalled()
  })

  test('PageUp and PageDown scroll the thread', () => {
    const {textarea} = renderComposer()

    expect(keyDown(textarea, 'PageUp')).toBe(false)
    expect(scrollUp).toHaveBeenCalledTimes(1)
    expect(scrollDown).not.toHaveBeenCalled()

    expect(keyDown(textarea, 'PageDown')).toBe(false)
    expect(scrollDown).toHaveBeenCalledTimes(1)
  })

  // typing while the input is not focused never opens a list; moving the caret re-checks
  test('ArrowLeft and ArrowRight re-check the word at the caret for suggestions', () => {
    const {textarea} = renderComposer()
    act(() => {
      textarea.blur()
    })
    type(textarea, 'hi @te')
    act(() => {
      jest.advanceTimersByTime(5)
    })
    expect(mockUsersList).not.toHaveBeenCalled()
    act(() => {
      textarea.focus()
    })

    keyDown(textarea, 'a')
    act(() => {
      jest.advanceTimersByTime(5)
    })
    expect(mockUsersList).not.toHaveBeenCalled()

    expect(keyDown(textarea, 'ArrowLeft')).toBe(false)
    act(() => {
      jest.advanceTimersByTime(5)
    })
    expect(mockUsersList).toHaveBeenCalled()
    expect(mockUsersList.mock.calls.at(-1)?.[0].filter).toBe('te')
  })

  test('ArrowRight re-checks too', () => {
    const {textarea} = renderComposer()
    act(() => {
      textarea.blur()
    })
    type(textarea, 'hi @te')
    act(() => {
      textarea.focus()
    })

    keyDown(textarea, 'ArrowRight')
    act(() => {
      jest.advanceTimersByTime(5)
    })
    expect(mockUsersList).toHaveBeenCalled()
  })

  test('keys during an IME composition are ignored until it ends', async () => {
    const {getHandles, textarea} = renderComposer()
    type(textarea, 'hello')
    act(() => {
      fireEvent.compositionStart(textarea)
    })

    expect(keyDown(textarea, 'Enter')).toBe(false)
    await flushSend()
    expect(post).not.toHaveBeenCalled()
    type(textarea, '')
    expect(keyDown(textarea, 'ArrowUp')).toBe(false)
    expect(getHandles().input.editing).toBe(noOrdinal)

    act(() => {
      fireEvent.compositionEnd(textarea)
    })
    type(textarea, 'hello')
    expect(keyDown(textarea, 'Enter')).toBe(true)
    await flushSend()
    expect(post).toHaveBeenCalledTimes(1)
  })
})

describe('in the composer, suggestions open', () => {
  test('ArrowDown and ArrowUp move the highlight and prevent the default', () => {
    const {getHandles, textarea} = renderComposer()
    openSuggestions(textarea, 'hi @te')

    expect(keyDown(textarea, 'ArrowDown')).toBe(true)
    expect(keyDown(textarea, 'ArrowUp')).toBe(true)

    expect(mockMove.mock.calls).toEqual([[false], [true]])
    expect(getHandles().input.editing).toBe(noOrdinal)
  })

  test('Enter picks the highlighted suggestion instead of sending', async () => {
    const {textarea} = renderComposer()
    openSuggestions(textarea, 'hi @te')

    expect(keyDown(textarea, 'Enter')).toBe(true)
    await flushSend()

    expect(mockSelect).toHaveBeenCalledTimes(1)
    expect(post).not.toHaveBeenCalled()
  })

  test('Enter with nothing highlighted falls through to a send', async () => {
    mockListHasSelection = false
    const {textarea} = renderComposer()
    openSuggestions(textarea, 'hi @te')

    expect(keyDown(textarea, 'Enter')).toBe(true)
    await flushSend()

    expect(mockSelect).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0]?.[0].params.body).toBe('hi @te')
  })

  test.each(modifiers)('Enter with %s inserts a newline and neither picks nor sends', async modifier => {
    const {textarea} = renderComposer()
    openSuggestions(textarea, 'hi @te')

    expect(keyDown(textarea, 'Enter', {[modifier]: true})).toBe(true)
    await flushSend()

    expect(mockSelect).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
    expect(textarea.value).toBe('hi @te\n')
  })

  // the echoed change re-runs the suggestion check, which finds no marker on the new line
  test('the list closes once a newline moves the caret past the marker', () => {
    const {textarea} = renderComposer()
    openSuggestions(textarea, 'hi @te')

    keyDown(textarea, 'Enter', {altKey: true})
    act(() => {
      jest.advanceTimersByTime(5)
    })

    expect(keyDown(textarea, 'ArrowDown')).toBe(false)
    expect(mockMove).not.toHaveBeenCalled()
  })

  test('Tab picks when the list is filtered', () => {
    const {textarea} = renderComposer()
    openSuggestions(textarea, 'hi @te')

    expect(keyDown(textarea, 'Tab')).toBe(true)

    expect(mockSelect).toHaveBeenCalledTimes(1)
    expect(mockMove).not.toHaveBeenCalled()
  })

  // a filtered Tab ignores whether anything was picked, so it never sends
  test('a filtered Tab with nothing highlighted does not send', async () => {
    mockListHasSelection = false
    const {textarea} = renderComposer()
    openSuggestions(textarea, 'hi @te')

    keyDown(textarea, 'Tab')
    await flushSend()

    expect(mockSelect).toHaveBeenCalledTimes(1)
    expect(post).not.toHaveBeenCalled()
  })

  test('Tab moves down and shift-Tab moves up when nothing is filtered yet', () => {
    const {textarea} = renderComposer()
    openSuggestions(textarea, 'hi @')
    expect(mockUsersList.mock.calls.at(-1)?.[0].filter).toBe('')

    expect(keyDown(textarea, 'Tab')).toBe(true)
    expect(keyDown(textarea, 'Tab', {shiftKey: true})).toBe(true)

    expect(mockMove.mock.calls).toEqual([[false], [true]])
    expect(mockSelect).not.toHaveBeenCalled()
  })

  test('Escape while editing closes only the list, and the next Escape cancels the edit', () => {
    const {getHandles, textarea} = renderComposer()
    startEdit(textarea)
    openSuggestions(textarea, 'hi @te')

    expect(keyDown(textarea, 'Escape')).toBe(true)

    expect(getHandles().input.editing).toBe(lastOrdinal)
    expect(textarea.value).toBe('hi @te')
    expect(mockMove).not.toHaveBeenCalled()
    expect(mockSelect).not.toHaveBeenCalled()

    expect(keyDown(textarea, 'Escape')).toBe(true)

    expect(getHandles().input.editing).toBe(noOrdinal)
    expect(textarea.value).toBe('')
  })

  test('Escape while replying closes only the list, and the next Escape cancels the reply', () => {
    const {getHandles, textarea} = renderComposer()
    startReply(getHandles)
    openSuggestions(textarea, 'hi @te')

    expect(keyDown(textarea, 'Escape')).toBe(true)
    expect(getHandles().input.replyTo).toBe(lastOrdinal)

    expect(keyDown(textarea, 'Escape')).toBe(true)
    expect(getHandles().input.replyTo).toBe(noOrdinal)
    expect(textarea.value).toBe('hi @te')
  })

  test('Escape with only a list open closes the list, prevents the default and does nothing else', () => {
    const {getHandles, textarea} = renderComposer()
    openSuggestions(textarea, 'hi @te')

    expect(keyDown(textarea, 'Escape')).toBe(true)

    expect(textarea.value).toBe('hi @te')
    expect(getHandles().input.editing).toBe(noOrdinal)
    expect(mockMove).not.toHaveBeenCalled()
    expect(mockSelect).not.toHaveBeenCalled()
    // closed: an arrow no longer reaches the list
    keyDown(textarea, 'ArrowDown')
    expect(mockMove).not.toHaveBeenCalled()
  })

  test('PageUp still scrolls the thread', () => {
    const {textarea} = renderComposer()
    openSuggestions(textarea, 'hi @te')

    expect(keyDown(textarea, 'PageUp')).toBe(false)

    expect(scrollUp).toHaveBeenCalledTimes(1)
  })

  // the list closes on the suggestors' 1ms settle after a change, so a key inside that window
  // still sees it open, and the open list wins
  test('ArrowUp right after emptying the text only moves the list', () => {
    const {getHandles, textarea} = renderComposer()
    openSuggestions(textarea, '@')
    type(textarea, '')

    expect(keyDown(textarea, 'ArrowUp')).toBe(true)

    expect(getHandles().input.editing).toBe(noOrdinal)
    expect(textarea.value).toBe('')
    expect(mockMove.mock.calls).toEqual([[true]])
  })
})

// open while a lookup loads or when nothing matches: the keys that move through a list are still
// the list's, so focus stays in the composer and the caret stays put, but nothing moves
describe('in the composer, a list open with no items', () => {
  test('ArrowDown, ArrowUp and Tab are claimed, and the list is not asked', () => {
    mockListHasItems = false
    const {textarea} = renderComposer()
    openSuggestions(textarea, 'hi @zz')

    expect(keyDown(textarea, 'ArrowDown')).toBe(true)
    expect(keyDown(textarea, 'ArrowUp')).toBe(true)
    expect(keyDown(textarea, 'Tab')).toBe(true)
    expect(keyDown(textarea, 'Tab', {shiftKey: true})).toBe(true)

    expect(mockMove).not.toHaveBeenCalled()
    expect(mockSelect).not.toHaveBeenCalled()
  })

  test('Enter sends without asking the list', async () => {
    mockListHasItems = false
    const {textarea} = renderComposer()
    openSuggestions(textarea, 'hi @zz')

    expect(keyDown(textarea, 'Enter')).toBe(true)
    await flushSend()

    expect(mockSelect).not.toHaveBeenCalled()
    expect(post.mock.calls[0]?.[0].params.body).toBe('hi @zz')
  })
})

describe('outside any input (window keys)', () => {
  const blurAll = (textarea: HTMLTextAreaElement) => {
    act(() => {
      textarea.blur()
    })
  }

  test('ArrowUp with an empty composer edits the last message and prevents the default', () => {
    const {getHandles, textarea} = renderComposer()
    blurAll(textarea)

    expect(keyDown(document.body, 'ArrowUp')).toBe(true)

    expect(getHandles().input.editing).toBe(lastOrdinal)
    // handled, so focus stays where it was
    expect(document.activeElement).not.toBe(textarea)
  })

  test('ArrowUp with a draft focuses the composer instead', () => {
    const {getHandles, textarea} = renderComposer()
    type(textarea, 'draft')
    blurAll(textarea)

    expect(keyDown(document.body, 'ArrowUp')).toBe(false)

    expect(getHandles().input.editing).toBe(noOrdinal)
    expect(document.activeElement).toBe(textarea)
  })

  test('Escape while editing cancels the edit', () => {
    const {getHandles, textarea} = renderComposer()
    startEdit(textarea)
    blurAll(textarea)

    expect(keyDown(document.body, 'Escape')).toBe(true)

    expect(getHandles().input.editing).toBe(noOrdinal)
    expect(document.activeElement).not.toBe(textarea)
  })

  test('Escape while replying cancels the reply', () => {
    const {getHandles, textarea} = renderComposer()
    startReply(getHandles)
    blurAll(textarea)

    expect(keyDown(document.body, 'Escape')).toBe(true)

    expect(getHandles().input.replyTo).toBe(noOrdinal)
  })

  test('ctrl-U opens the file picker without focusing the composer', () => {
    const click = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    const {textarea} = renderComposer()
    blurAll(textarea)

    keyDown(document.body, 'u', {ctrlKey: true})

    expect(click).toHaveBeenCalledTimes(1)
    expect(document.activeElement).not.toBe(textarea)
  })

  test('PageUp and PageDown scroll the thread', () => {
    const {textarea} = renderComposer()
    blurAll(textarea)

    keyDown(document.body, 'PageUp')
    keyDown(document.body, 'PageDown')

    expect(scrollUp).toHaveBeenCalledTimes(1)
    expect(scrollDown).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['Backspace'],
    ['Delete'],
    ['ArrowLeft'],
    ['ArrowRight'],
    ['ArrowDown'],
    ['Enter'],
    ['Escape'],
  ])('%s focuses the composer without preventing the default', async key => {
    const {textarea} = renderComposer()
    type(textarea, 'draft')
    blurAll(textarea)

    expect(keyDown(document.body, key)).toBe(false)
    await flushSend()

    expect(document.activeElement).toBe(textarea)
    expect(post).not.toHaveBeenCalled()
  })

  test.each([['ctrlKey'], ['metaKey']] as const)('%s-V focuses the composer', modifier => {
    const {textarea} = renderComposer()
    blurAll(textarea)

    keyDown(document.body, 'v', {[modifier]: true})

    expect(document.activeElement).toBe(textarea)
  })

  test('a printable key focuses the composer on keypress, not on keydown', () => {
    const {textarea} = renderComposer()
    blurAll(textarea)

    keyDown(document.body, 'a')
    expect(document.activeElement).not.toBe(textarea)

    act(() => {
      fireEvent.keyPress(document.body, {charCode: 97, key: 'a'})
    })
    expect(document.activeElement).toBe(textarea)
  })

  test('keys typed into another input are left alone', () => {
    const click = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    const {elsewhere, getHandles, textarea} = renderComposer()
    act(() => {
      elsewhere.focus()
    })

    expect(keyDown(elsewhere, 'ArrowUp')).toBe(false)
    keyDown(elsewhere, 'u', {ctrlKey: true})
    keyDown(elsewhere, 'PageUp')
    keyDown(elsewhere, 'Enter')

    expect(getHandles().input.editing).toBe(noOrdinal)
    expect(click).not.toHaveBeenCalled()
    expect(scrollUp).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(textarea)
  })

  test('keys in the composer do not also run the window handling', () => {
    const {textarea} = renderComposer()
    act(() => {
      textarea.focus()
    })

    keyDown(textarea, 'PageUp')

    expect(scrollUp).toHaveBeenCalledTimes(1)
  })
})
