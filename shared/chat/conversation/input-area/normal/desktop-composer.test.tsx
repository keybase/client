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
import {metasReceived, useInboxMetadataState} from '@/chat/inbox/metadata'
import {useCurrentUserState} from '@/stores/current-user'
import * as Composer from '../composer'
import {recordComposerAttaches} from '@/test/fake-composer-input'
import Input from '.'
import {List as SuggestionsList} from '../suggestors/common'
import {ConversationInputProvider, useConversationInput, type ConversationInputState} from '../input-state'
import {ConversationThreadProvider, useConversationThreadActions} from '../../thread-context'

jest.mock('@/chat/audio/audio-recorder.native', () => ({__esModule: true, default: () => null}))
jest.mock('@/chat/audio/audio-send.native', () => ({AudioSendWrapper: () => null}))
jest.mock('@/util/expo-document-picker.native', () => ({pickDocumentsAsync: jest.fn()}))

let mockPickEmoji: ((emojiColons: string) => void) | undefined
jest.mock('@/chat/emoji-picker/container', () => ({
  EmojiPickerDesktop: (p: {onPickAction: (emojiColons: string) => void}) => {
    mockPickEmoji = p.onPickAction
    return null
  },
}))
// popups measure their anchor before they render anything, which jsdom cannot do
jest.mock('@/common-adapters', () => {
  const actual = jest.requireActual<Record<string, unknown>>('@/common-adapters')
  const passthrough = (p: {children: React.ReactNode}): React.ReactNode => p.children
  return {...actual, AnchoredPopup: passthrough, Popup: passthrough}
})
type MockUsersListProps = {
  filter: string
  onSelected: (item: {fullName: string; username: string}, final: boolean) => void
}
const mockUsersList = jest.fn((_p: MockUsersListProps): React.ReactElement | null => null)
jest.mock('../suggestors/suggestion-list', () => ({__esModule: true, default: () => null}))
jest.mock('../suggestors/users', () => ({
  UsersList: (p: MockUsersListProps) => mockUsersList(p),
  transformer: jest.requireActual<{transformer: unknown}>('../suggestors/users').transformer,
}))

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const makeTextMessage = (text: string) =>
  Message.makeMessageText({
    author: 'testuser',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(101),
    isEditable: true,
    ordinal: T.Chat.numberToOrdinal(101),
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

const Wrapper = (p: React.PropsWithChildren) => (
  <ConversationThreadProvider id={convID}>
    <ConversationInputProvider id={convID}>{p.children}</ConversationInputProvider>
  </ConversationThreadProvider>
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
  return {getHandles: () => handles!, textarea, utils}
}

const type = (textarea: HTMLTextAreaElement, text: string, caret = text.length) => {
  act(() => {
    fireEvent.change(textarea, {target: {selectionEnd: caret, selectionStart: caret, value: text}})
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(T.RPCChat, 'localUpdateTypingRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise').mockResolvedValue([])
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
  mockPickEmoji = undefined
  mockUsersList.mockClear()
})

test('ArrowUp in an empty composer edits your last message and injects its text', () => {
  const {getHandles, textarea} = renderComposer()
  act(() => {
    getHandles().thread.addMessages([makeTextMessage('last thing I said')], {markAsRead: false})
  })

  act(() => {
    fireEvent.keyDown(textarea, {key: 'ArrowUp'})
  })

  expect(getHandles().input.editing).toBe(T.Chat.numberToOrdinal(101))
  expect(textarea.value).toBe('last thing I said')
  expect(textarea.selectionStart).toBe('last thing I said'.length)
})

test('ArrowUp with text in the composer does not start an edit', () => {
  const {getHandles, textarea} = renderComposer()
  act(() => {
    getHandles().thread.addMessages([makeTextMessage('last thing I said')], {markAsRead: false})
  })
  type(textarea, 'draft')

  act(() => {
    fireEvent.keyDown(textarea, {key: 'ArrowUp'})
  })

  expect(getHandles().input.editing).toBe(T.Chat.numberToOrdinal(0))
  expect(textarea.value).toBe('draft')
})

test('Escape while editing cancels the edit and clears the composer', () => {
  const {getHandles, textarea} = renderComposer()
  act(() => {
    getHandles().thread.addMessages([makeTextMessage('last thing I said')], {markAsRead: false})
  })
  act(() => {
    fireEvent.keyDown(textarea, {key: 'ArrowUp'})
  })

  act(() => {
    fireEvent.keyDown(textarea, {key: 'Escape'})
  })

  expect(getHandles().input.editing).toBe(T.Chat.numberToOrdinal(0))
  expect(textarea.value).toBe('')
})

test('injecting with focus writes the text, parks the caret at the end and focuses', () => {
  const {getHandles, textarea} = renderComposer()
  act(() => {
    textarea.blur()
  })

  act(() => {
    getHandles().input.dispatch.injectIntoInput('hello there', true)
  })
  expect(document.activeElement).toBe(textarea)

  expect(textarea.value).toBe('hello there')
  expect(textarea.selectionStart).toBe(11)
  expect(textarea.selectionEnd).toBe(11)
})

test('a write shows in the textarea at once, caret included', () => {
  const {getHandles, textarea} = renderComposer()

  act(() => {
    getHandles().input.dispatch.injectIntoInput('hello there')
  })

  expect(textarea.value).toBe('hello there')
  expect(textarea.selectionStart).toBe(11)
  expect(textarea.selectionEnd).toBe(11)
})

test('a keystroke right after a write is kept', () => {
  const {getHandles, textarea} = renderComposer()

  act(() => {
    getHandles().input.dispatch.injectIntoInput('hello', true)
  })
  type(textarea, `${textarea.value}!`)
  act(() => {
    jest.advanceTimersByTime(500)
  })

  expect(textarea.value).toBe('hello!')
})

test('injecting the spoiler markup selects the placeholder between the markers', () => {
  const {getHandles, textarea} = renderComposer()

  act(() => {
    getHandles().input.dispatch.injectIntoInput('!>spoiler<!')
  })

  expect(textarea.value).toBe('!>spoiler<!')
  expect(textarea.selectionStart).toBe(2)
  expect(textarea.selectionEnd).toBe(9)
})

test('Enter sends the composer text and clears it; shift-Enter is left to the browser and does not send', async () => {
  const post = jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockResolvedValue({
    outboxID: new TextEncoder().encode('posted'),
  })
  const {textarea} = renderComposer()
  type(textarea, 'hello')

  let notPrevented = true
  act(() => {
    notPrevented = fireEvent.keyDown(textarea, {key: 'Enter', shiftKey: true})
  })
  expect(notPrevented).toBe(true)
  expect(post).not.toHaveBeenCalled()
  expect(textarea.value).toBe('hello')

  act(() => {
    fireEvent.keyDown(textarea, {key: 'Enter'})
  })
  // cleared first, the send waits for the clear to land
  expect(post).not.toHaveBeenCalled()
  await act(async () => {
    jest.advanceTimersByTime(0)
    await Promise.resolve()
  })

  expect(post).toHaveBeenCalledTimes(1)
  expect(post.mock.calls[0]?.[0].params.body).toBe('hello')
  expect(textarea.value).toBe('')
})

test('Enter in an empty composer sends nothing', () => {
  const post = jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener')
  const {textarea} = renderComposer()

  act(() => {
    fireEvent.keyDown(textarea, {key: 'Enter'})
  })
  act(() => {
    jest.advanceTimersByTime(200)
  })

  expect(post).not.toHaveBeenCalled()
})

test('a keystroke typed before the send goes out is kept', async () => {
  const post = jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockResolvedValue({
    outboxID: new TextEncoder().encode('posted'),
  })
  const {textarea} = renderComposer()
  type(textarea, 'hello')
  act(() => {
    fireEvent.keyDown(textarea, {key: 'Enter'})
  })
  expect(textarea.value).toBe('')

  type(textarea, 'n')
  await act(async () => {
    jest.advanceTimersByTime(0)
    await Promise.resolve()
  })

  expect(post.mock.calls[0]?.[0].params.body).toBe('hello')
  expect(textarea.value).toBe('n')
})

test('picking an emoji mid-text inserts it and its space at the caret, with the caret after the space', () => {
  const {textarea, utils} = renderComposer()
  type(textarea, 'abcd', 2)

  act(() => {
    fireEvent.click(utils.container.querySelector('.icon-gen-iconfont-emoji') ?? textarea)
  })
  expect(mockPickEmoji).toBeDefined()
  act(() => {
    mockPickEmoji?.(':smile:')
  })

  expect(textarea.value).toBe('ab:smile: cd')
  expect(textarea.selectionStart).toBe('ab:smile: '.length)
  expect(document.activeElement).toBe(textarea)
})

test('picking an emoji at the end of the text reads as emoji plus space', () => {
  const {textarea, utils} = renderComposer()
  type(textarea, 'hi ')

  act(() => {
    fireEvent.click(utils.container.querySelector('.icon-gen-iconfont-emoji') ?? textarea)
  })
  act(() => {
    mockPickEmoji?.(':wave:')
  })

  expect(textarea.value).toBe('hi :wave: ')
  expect(textarea.selectionStart).toBe(textarea.value.length)
})

test('the suggestors see text injected into the composer', () => {
  const {getHandles, textarea} = renderComposer()

  act(() => {
    getHandles().input.dispatch.injectIntoInput('hey @te', true)
  })
  expect(document.activeElement).toBe(textarea)
  // the suggestors settle on a 1ms timer after the change lands
  act(() => {
    jest.advanceTimersByTime(5)
  })

  expect(mockUsersList).toHaveBeenCalled()
  expect(mockUsersList.mock.calls.at(-1)?.[0].filter).toBe('te')
})

test('picking a suggested user rewrites the word at the caret', () => {
  const {textarea} = renderComposer()
  act(() => {
    textarea.focus()
  })
  type(textarea, 'hi @te and more', 6)
  act(() => {
    jest.advanceTimersByTime(5)
  })
  const onSelected = mockUsersList.mock.calls.at(-1)?.[0].onSelected
  expect(onSelected).toBeDefined()

  act(() => {
    onSelected?.({fullName: '', username: 'testuser'}, true)
  })

  expect(textarea.value).toBe('hi @testuser and more')
  expect(textarea.selectionStart).toBe('hi @testuser'.length)
})

// arrowing through the list previews each pick in the text without reporting it as typed
test('a previewed suggestion shows in the input and a later pick replaces the previewed word', () => {
  const saveDraft = jest.mocked(T.RPCChat.localUpdateUnsentTextRpcPromise)
  const {textarea} = renderComposer()
  act(() => {
    textarea.focus()
  })
  type(textarea, 'hi @te')
  act(() => {
    jest.advanceTimersByTime(300)
  })
  saveDraft.mockClear()
  const onSelected = mockUsersList.mock.calls.at(-1)?.[0].onSelected

  act(() => {
    onSelected?.({fullName: '', username: 'testuser'}, false)
  })
  expect(textarea.value).toBe('hi @testuser')
  expect(saveDraft).not.toHaveBeenCalled()

  act(() => {
    onSelected?.({fullName: '', username: 'testuser-mac'}, true)
  })
  expect(textarea.value).toBe('hi @testuser-mac ')
})

// the users list as the shared list over a scripted set of users, which a test refreshes the way
// a participant arriving or leaving does
describe('with the shared suggestion list', () => {
  let setUsers: ((users: Array<string>) => void) | undefined
  const NoRow = () => <></>
  beforeEach(() => {
    mockUsersList.mockImplementation(function ScriptedUsersList(p) {
      const [users, set] = React.useState(['testuser', 'testuser-mac'])
      setUsers = set
      const items = users.map(username => ({fullName: '', username}))
      return (
        <SuggestionsList
          {...(p as unknown as React.ComponentProps<typeof SuggestionsList<{fullName: string; username: string}>>)}
          items={items}
          ItemRenderer={NoRow}
          keyExtractor={u => u.username}
          loading={false}
          rowHeight={20}
        />
      )
    })
  })
  afterEach(() => {
    mockUsersList.mockImplementation(() => null)
    setUsers = undefined
  })

  const openList = () => {
    act(() => {
      jest.advanceTimersByTime(5)
    })
    expect(mockUsersList).toHaveBeenCalled()
  }

  test('a list closed on a preview and opened again does not put back the text from before it', () => {
    const {textarea} = renderComposer()
    act(() => {
      textarea.focus()
    })
    type(textarea, 'hi @te')
    openList()
    act(() => {
      fireEvent.keyDown(textarea, {key: 'ArrowDown'})
    })
    expect(textarea.value).toBe('hi @testuser-mac')
    act(() => {
      fireEvent.keyDown(textarea, {key: 'Escape'})
    })
    act(() => {
      fireEvent.keyDown(textarea, {key: 'ArrowLeft'})
    })
    openList()
    act(() => {
      fireEvent.keyDown(textarea, {key: 'ArrowDown'})
    })

    act(() => {
      setUsers?.(['testuser'])
    })

    expect(textarea.value).toBe('hi @testuser-mac')
    act(() => {
      fireEvent.keyDown(textarea, {key: 'Enter'})
    })
    expect(textarea.value).toBe('hi @testuser-mac ')
  })
})

test('the gif button prefills the giphy command and a second press clears it once the window is up', () => {
  const {getHandles, textarea, utils} = renderComposer()

  act(() => {
    fireEvent.click(utils.container.querySelector('.icon-gen-iconfont-gif') ?? textarea)
  })
  expect(textarea.value).toBe('/giphy ')

  act(() => {
    getHandles().input.dispatch.setGiphyWindow(true)
  })
  act(() => {
    fireEvent.click(utils.container.querySelector('.icon-gen-iconfont-gif') ?? textarea)
  })
  expect(textarea.value).toBe('')
})

const receiveDraft = (draft: string) => {
  act(() => {
    metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID, draft}], undefined, {force: true})
  })
}

test('a keystroke or a caret move leaves the same textarea attached to the composer', () => {
  const attaches = recordComposerAttaches(Composer)
  const {textarea} = renderComposer()
  expect(attaches).toHaveLength(1)

  type(textarea, 'hello')
  type(textarea, 'hello', 2)

  expect(attaches).toHaveLength(1)
})

describe('drafts', () => {
  test('a saved draft loads without saying the user is typing, and is not saved again', () => {
    receiveDraft('saved draft')
    const {textarea} = renderComposer()
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(textarea.value).toBe('saved draft')
    expect(T.RPCChat.localUpdateTypingRpcPromise).not.toHaveBeenCalled()
    expect(T.RPCChat.localUpdateUnsentTextRpcPromise).not.toHaveBeenCalled()
  })

  test('a draft already in the inbox meta is loaded into the composer on mount', () => {
    receiveDraft('saved draft')
    const {textarea} = renderComposer()
  
    expect(textarea.value).toBe('saved draft')
    expect(textarea.selectionStart).toBe('saved draft'.length)
  })

  test('a draft that arrives after mount is loaded once, and later draft updates are not', () => {
    const {textarea} = renderComposer()
      expect(textarea.value).toBe('')

    receiveDraft('late draft')
      expect(textarea.value).toBe('late draft')

    receiveDraft('newer draft from elsewhere')
      expect(textarea.value).toBe('late draft')
  })

  test('a draft arriving after the user already typed does not clobber the text', () => {
    const {textarea} = renderComposer()
    type(textarea, 'typed first')

    receiveDraft('stale draft')
  
    expect(textarea.value).toBe('typed first')
  })

  test('an empty draft marks the draft loaded without touching the composer', () => {
    receiveDraft('')
    const {textarea} = renderComposer()
  
    receiveDraft('arrives later')
  
    expect(textarea.value).toBe('')
  })

  test('typing saves the draft on the leading edge and again at the 200ms trailing edge', () => {
    receiveDraft('')
    const saveDraft = jest.mocked(T.RPCChat.localUpdateUnsentTextRpcPromise)
    const {textarea} = renderComposer()
    // clear the throttle's window from any mount-time save
    act(() => {
      jest.advanceTimersByTime(500)
    })
    saveDraft.mockClear()

    type(textarea, 'a')
    expect(saveDraft.mock.calls.map(c => c[0].text)).toEqual(['a'])
    // the inbox row's draft follows right away so switching back does not reload a stale one
    expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe('a')

    type(textarea, 'ab')
    type(textarea, 'abc')
    expect(saveDraft.mock.calls.map(c => c[0].text)).toEqual(['a'])

    act(() => {
      jest.advanceTimersByTime(200)
    })
    expect(saveDraft.mock.calls.map(c => c[0].text)).toEqual(['a', 'abc'])
    expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe('abc')
  })
})

test('a stellar send the user cancels puts the text back in the composer', async () => {
  let cancel: (() => void) | undefined
  jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockImplementation(async p => {
    cancel = () => p.incomingCallMap['chat.1.chatUi.chatStellarDone']?.({canceled: true})
    await Promise.resolve()
    return {outboxID: new TextEncoder().encode('posted')}
  })
  const {textarea} = renderComposer()
  type(textarea, '+1xlm@testuser')

  act(() => {
    fireEvent.keyDown(textarea, {key: 'Enter'})
  })
  await act(async () => {
    jest.advanceTimersByTime(0)
    await Promise.resolve()
  })
  expect(textarea.value).toBe('')

  act(() => {
    cancel?.()
  })

  expect(textarea.value).toBe('+1xlm@testuser')
})

// Desktop's read-only composer: the textarea can't be typed into, the side buttons are gone, and a
// text the app injects (a share, an edit prefill, a restored stellar send) does not land
describe('read-only', () => {
  const renderReadOnly = () => {
    act(() => {
      metasReceived([{...Meta.makeConversationMeta(), cannotWrite: true, conversationIDKey: convID}], undefined, {
        force: true,
      })
    })
    return renderComposer()
  }
  const hasIcon = (container: HTMLElement, type: string) => !!container.querySelector(`.icon-gen-${type}`)

  test('the textarea is read-only and the gif, emoji, file and exploding buttons are hidden', () => {
    const {textarea, utils} = renderReadOnly()

    expect(textarea.readOnly).toBe(true)
    for (const type of ['iconfont-gif', 'iconfont-emoji', 'iconfont-attachment', 'iconfont-timer']) {
      expect(hasIcon(utils.container, type)).toBe(false)
    }
  })

  test('the same buttons show in a composer that can be written to', () => {
    const {textarea, utils} = renderComposer()

    expect(textarea.readOnly).toBe(false)
    for (const type of ['iconfont-gif', 'iconfont-emoji', 'iconfont-attachment', 'iconfont-timer']) {
      expect(hasIcon(utils.container, type)).toBe(true)
    }
  })

  test('an injected text leaves the read-only textarea unchanged', () => {
    const {getHandles, textarea} = renderReadOnly()

    act(() => {
      getHandles().input.dispatch.injectIntoInput('shared text', true)
    })

    expect(textarea.value).toBe('')
  })

  test('a saved draft does not load into it, and is kept', () => {
    const unsent = jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
    act(() => {
      metasReceived(
        [{...Meta.makeConversationMeta(), cannotWrite: true, conversationIDKey: convID, draft: 'saved'}],
        undefined,
        {force: true}
      )
    })
    const {textarea} = renderComposer()
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(textarea.value).toBe('')
    expect(unsent).not.toHaveBeenCalled()
  })

  test('text typed before the conversation turned read-only is not sent, and stays the draft', () => {
    const unsent = jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
    const post = jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener')
    const meta = {...Meta.makeConversationMeta(), conversationIDKey: convID, draft: ''}
    act(() => {
      metasReceived([meta], undefined, {force: true})
    })
    const {textarea} = renderComposer()
    type(textarea, 'typed before')
    act(() => {
      metasReceived([{...meta, cannotWrite: true, draft: 'typed before'}], undefined, {force: true})
    })

    act(() => {
      fireEvent.keyDown(textarea, {key: 'Enter'})
    })
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(post).not.toHaveBeenCalled()
    expect(textarea.value).toBe('typed before')
    expect(unsent.mock.calls.at(-1)?.[0].text).toBe('typed before')
    expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe('typed before')
  })

  // a first keystroke into the empty composer would otherwise save over the draft
  test('the saved draft loads once the user can post, and typing goes on from it', () => {
    const unsent = jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
    const meta = {...Meta.makeConversationMeta(), conversationIDKey: convID, draft: 'saved'}
    act(() => {
      metasReceived([{...meta, cannotWrite: true}], undefined, {force: true})
    })
    const {textarea} = renderComposer()
    expect(textarea.value).toBe('')

    act(() => {
      metasReceived([{...meta, cannotWrite: false}], undefined, {force: true})
    })
    expect(textarea.value).toBe('saved')
    type(textarea, 'saved!')
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(unsent.mock.calls.at(-1)?.[0].text).toBe('saved!')
  })
})
