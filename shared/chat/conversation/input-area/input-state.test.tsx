/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import logger from '@/logger'
import {metasReceived, useInboxMetadataState} from '@/chat/inbox/metadata'
import type * as React from 'react'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {act, cleanup, render, renderHook} from '@testing-library/react'
import {Freeze} from 'react-freeze'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import {setInputIntent, useInputIntentState} from '../input-intent-store'
import {setThreadInputCommandStatus, setThreadInputEditing, setThreadInputReplyTo} from '@/constants/router'
import {useCurrentUserState} from '@/stores/current-user'
import Input from './normal'
import type {PlatformInputProps, Selection} from './normal/input.shared'
import {ConversationInputProvider, useConversationInput, type ConversationInputState} from './input-state'
import {FakeComposerInputView, makeFakeComposerInput, type FakeComposerInput} from '@/test/fake-composer-input'
import {ConversationThreadProvider, useConversationThreadActions} from '../thread-context'
import {suppressedURLsOf, takeSuppressSnapshot, useUnfurlPreviewState} from '../unfurl-preview-state'
import {ThreadRefsContext, ThreadRefsProvider} from '../normal/context'

const getSuppressedURLs = (c: T.Chat.ConversationIDKey) => suppressedURLsOf(takeSuppressSnapshot(c))

// jest.mock factories may only close over mock-prefixed names
let mockOnClear: (() => void) | undefined
let mockPlatformInputProps: PlatformInputProps | undefined
let mockNullInputRef = false
// what the stand-in input is showing: the real inputs apply a write and, when asked to reflect
// it, echo it back through onChangeText; this one does both synchronously
const mockInput = {focusCount: 0, selection: undefined as Selection | undefined, text: ''}
// the stand-in input's handle: its clear() fires onChangeText('') the way the desktop input does,
// which is what races the send
const mockHandle = () =>
  ({
      blur: () => {},
      clear: () => {
        // the real hook drops suppressions from an effect after the text goes empty; a test
        // can ask for that to happen synchronously inside clear() instead, which is the
        // ordering onSubmit's snapshot has to survive
        mockOnClear?.()
        mockInput.text = ''
        mockInput.selection = undefined
        mockPlatformInputProps?.onChangeText('')
      },
      focus: () => {
        mockInput.focusCount++
      },
      getSelection: () => mockInput.selection,
      insertTyped: () => false,
      isFocused: () => false,
      replaceText: (ti, reflectChange) => {
        mockInput.text = ti.text
        mockInput.selection = ti.selection
        if (reflectChange) {
          mockPlatformInputProps?.onChangeText(ti.text)
        }
        return true
      },
    }) as NonNullable<Parameters<PlatformInputProps['setInputRef']>[0]>
// Stands in for the real composer input, setting its handle the way the real inputs do, as the
// commit is made; mockNullInputRef leaves it unset.
jest.mock('./normal/input', () => ({
  __esModule: true,
  default: function MockPlatformInput(p: PlatformInputProps) {
    mockPlatformInputProps = p
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {useImperativeHandle} = require('react') as typeof React
    useImperativeHandle(mockNullInputRef ? undefined : p.setInputRef, mockHandle)
    return null
  },
}))

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

const makeTextMessage = (override?: Omit<Partial<T.Chat.MessageText>, 'text'> & {text?: string}) =>
  Message.makeMessageText({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(101),
    ordinal: T.Chat.numberToOrdinal(101),
    outboxID: T.Chat.stringToOutboxID('outbox-1'),
    timestamp: 100,
    ...override,
    text: new HiddenString(override?.text ?? 'hello'),
  })

const makeAttachmentMessage = (override?: Partial<T.Chat.MessageAttachment>) =>
  Message.makeMessageAttachment({
    author: 'alice',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(201),
    ordinal: T.Chat.numberToOrdinal(201),
    outboxID: T.Chat.stringToOutboxID('attachment-outbox'),
    timestamp: 100,
    title: 'attachment title',
    ...override,
  })

const makeGiphyResult = (targetUrl = 'https://media.giphy.com/media/target/giphy.gif') => ({
  preferredPreviewUrl: 'https://media.giphy.com/media/preview/giphy.gif',
  previewHeight: 120,
  previewIsVideo: false,
  previewUrl: 'https://media.giphy.com/media/preview/giphy.gif',
  previewWidth: 160,
  targetUrl,
})

const makeRpcOutboxID = (label: string): T.RPCChat.OutboxID => new TextEncoder().encode(label)
const makeOutboxID = (label: string): T.Chat.OutboxID => T.Chat.rpcOutboxIDToOutboxID(makeRpcOutboxID(label))

const mockPostText = () => {
  let lastPost: Parameters<typeof T.RPCChat.localPostTextNonblockRpcListener>[0] | undefined
  jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockImplementation(async p => {
    lastPost = p
    await Promise.resolve()
    return {outboxID: makeRpcOutboxID('posted-outbox')}
  })
  return () => lastPost
}

const wrapperFor = (id: T.Chat.ConversationIDKey) =>
  function Wrapper(p: React.PropsWithChildren) {
    return (
      <ConversationThreadProvider id={id}>
        <ConversationInputProvider id={id}>{p.children}</ConversationInputProvider>
      </ConversationThreadProvider>
    )
  }

// the provider-only harness: a fake input stands in for the composer so what an action puts
// into the composer can be read back off it
const fakeInputWrapperFor = (id: T.Chat.ConversationIDKey, fake: FakeComposerInput) =>
  function Wrapper(p: React.PropsWithChildren) {
    return (
      <ConversationThreadProvider id={id}>
        <ConversationInputProvider id={id}>
          <FakeComposerInputView fake={fake} />
          {p.children}
        </ConversationInputProvider>
      </ConversationThreadProvider>
    )
  }

const renderInput = (id = convID) => {
  const composerInput = makeFakeComposerInput()
  const rendered = renderHook(() => useConversationInput(s => s), {
    wrapper: fakeInputWrapperFor(id, composerInput),
  })
  return {composerInput, result: rendered.result, unmount: rendered.unmount}
}

function renderComposer(id = convID) {
  return render(<Input />, {wrapper: wrapperFor(id)})
}

type InputHandles = {
  input: ReturnType<typeof useConversationInput<ConversationInputState>>
  thread: ReturnType<typeof useConversationThreadActions>
}

const InputProbe = (p: {onRender: (h: InputHandles) => void}) => {
  p.onRender({input: useConversationInput(s => s), thread: useConversationThreadActions()})
  return null
}

function renderComposerWithProbe(onRender: (h: InputHandles) => void, id = convID) {
  return render(
    <>
      <Input />
      <InputProbe onRender={onRender} />
    </>,
    {wrapper: wrapperFor(id)}
  )
}

const renderInputWithThreadActions = (id = convID) => {
  const composerInput = makeFakeComposerInput()
  const {result} = renderHook(
    () => ({
      input: useConversationInput(s => s),
      threadActions: useConversationThreadActions(),
    }),
    {wrapper: fakeInputWrapperFor(id, composerInput)}
  )
  return {composerInput, result}
}

const notifyInputEngineAction = (action: Parameters<typeof notifyEngineActionListeners>[0]) => {
  act(() => {
    notifyEngineActionListeners(action)
  })
}

beforeEach(() => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
})

afterEach(() => {
  mockPlatformInputProps = undefined
  mockOnClear = undefined
  mockNullInputRef = false
  mockInput.focusCount = 0
  mockInput.selection = undefined
  mockInput.text = ''
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('setEditing last picks the latest editable local message and injects its content', () => {
  const attachmentOrdinal = T.Chat.numberToOrdinal(703)
  const {composerInput, result} = renderInputWithThreadActions()

  act(() => {
    result.current.threadActions.addMessages(
      [
        makeTextMessage({
          author: 'bob',
          id: T.Chat.numberToMessageID(701),
          ordinal: T.Chat.numberToOrdinal(701),
          outboxID: T.Chat.stringToOutboxID('someone-else'),
        }),
        makeTextMessage({
          exploded: true,
          id: T.Chat.numberToMessageID(702),
          ordinal: T.Chat.numberToOrdinal(702),
          outboxID: T.Chat.stringToOutboxID('exploded-self'),
          text: 'ignore me',
        }),
        makeAttachmentMessage({
          id: T.Chat.numberToMessageID(703),
          ordinal: attachmentOrdinal,
          outboxID: T.Chat.stringToOutboxID('editable-attachment'),
          title: 'picked attachment title',
        }),
      ],
      {markAsRead: false}
    )
  })

  act(() => {
    result.current.input.dispatch.setEditing('last')
  })

  expect(result.current.input.editing).toBe(attachmentOrdinal)
  expect(composerInput.text).toBe('picked attachment title')
})

test('setEditing clear resets editing state and clears unsent text', () => {
  const editOrdinal = T.Chat.numberToOrdinal(704)
  const {composerInput, result} = renderInputWithThreadActions()

  act(() => {
    result.current.threadActions.addMessages(
      [
        makeTextMessage({
          id: T.Chat.numberToMessageID(704),
          ordinal: editOrdinal,
          outboxID: T.Chat.stringToOutboxID('editable-text'),
          text: 'explicit edit text',
        }),
      ],
      {markAsRead: false}
    )
  })

  act(() => {
    result.current.input.dispatch.setEditing(editOrdinal)
    result.current.input.dispatch.setEditing('clear')
  })

  expect(result.current.input.editing).toBe(T.Chat.numberToOrdinal(0))
  expect(composerInput.text).toBe('')
})

test('setEditing explicit ordinal selects editable text and ignores missing messages', () => {
  const editOrdinal = T.Chat.numberToOrdinal(704)
  const {composerInput, result} = renderInputWithThreadActions()

  act(() => {
    result.current.threadActions.addMessages(
      [
        makeTextMessage({
          id: T.Chat.numberToMessageID(704),
          ordinal: editOrdinal,
          outboxID: T.Chat.stringToOutboxID('editable-text'),
          text: 'explicit edit text',
        }),
      ],
      {markAsRead: false}
    )
  })

  act(() => {
    result.current.input.dispatch.setEditing(editOrdinal)
  })

  expect(result.current.input.editing).toBe(editOrdinal)
  expect(composerInput.text).toBe('explicit edit text')

  act(() => {
    result.current.input.dispatch.setEditing(T.Chat.numberToOrdinal(999))
  })

  expect(result.current.input.editing).toBe(editOrdinal)
  expect(composerInput.text).toBe('explicit edit text')
})

test('input injection is scoped to the owning provider', () => {
  const input = renderInput()
  const otherInput = renderInput(otherConvID)

  act(() => {
    input.result.current.dispatch.injectIntoInput('prefill from share')
  })

  expect(input.composerInput.text).toBe('prefill from share')
  expect(otherInput.composerInput.text).toBe('')

  act(() => {
    input.result.current.dispatch.injectIntoInput('')
  })

  expect(input.composerInput.text).toBe('')
})

test('sendComposerText sends reply context and clears transient composer state', async () => {
  const replyOrdinal = T.Chat.numberToOrdinal(801)
  const replyMessageID = T.Chat.numberToMessageID(801)
  const getLastPost = mockPostText()
  const {composerInput, result} = renderInputWithThreadActions()
  act(() => {
    result.current.threadActions.addMessages(
      [
        makeTextMessage({
          id: replyMessageID,
          ordinal: replyOrdinal,
          outboxID: T.Chat.stringToOutboxID('reply-target'),
          text: 'reply target',
        }),
      ],
      {markAsRead: false}
    )
  })
  act(() => {
    result.current.input.dispatch.setReplyTo(replyOrdinal)
    result.current.input.dispatch.setCommandMarkdown({body: '**markdown**', title: 'Command'})
    result.current.input.dispatch.setGiphyWindow(true)
    result.current.input.dispatch.injectIntoInput('reply text')
  })

  act(() => {
    result.current.input.dispatch.sendComposerText('sent reply')
  })
  await flushPromises()

  expect(result.current.input.replyTo).toBe(T.Chat.numberToOrdinal(0))
  expect(result.current.input.commandMarkdown).toBeUndefined()
  expect(result.current.input.giphyWindow).toBe(false)
  // the composer's submit clears the text; the send leaves it to that
  expect(composerInput.text).toBe('reply text')
  expect(getLastPost()?.params.body).toBe('sent reply')
  expect(getLastPost()?.params.replyTo).toBe(replyMessageID)
})

test('sendComposerText restores text when a stellar flow is canceled', async () => {
  const getLastPost = mockPostText()
  const {composerInput, result} = renderInput()

  act(() => {
    result.current.dispatch.sendComposerText('restore me')
  })
  await flushPromises()
  act(() => {
    getLastPost()?.incomingCallMap['chat.1.chatUi.chatStellarDone']?.({canceled: true})
  })

  expect(composerInput.text).toBe('restore me')
})

test('sendComposerText edits the selected message and clears edit state', async () => {
  const editOrdinal = T.Chat.numberToOrdinal(901)
  const editMessageID = T.Chat.numberToMessageID(901)
  const editPost = jest.spyOn(T.RPCChat, 'localPostEditNonblockRpcPromise').mockResolvedValue({
    outboxID: makeRpcOutboxID('edit-outbox'),
  })
  const {result} = renderInputWithThreadActions()
  act(() => {
    result.current.threadActions.addMessages(
      [
        makeTextMessage({
          id: editMessageID,
          ordinal: editOrdinal,
          outboxID: makeOutboxID('edit-target'),
          text: 'old text',
        }),
      ],
      {markAsRead: false}
    )
  })
  act(() => {
    result.current.input.dispatch.setEditing(editOrdinal)
    result.current.input.dispatch.setReplyTo(T.Chat.numberToOrdinal(705))
    result.current.input.dispatch.setGiphyWindow(true)
    result.current.input.dispatch.setCommandMarkdown({body: 'edit markdown'})
  })

  act(() => {
    result.current.input.dispatch.sendComposerText('new text')
  })
  await flushPromises()

  expect(result.current.input.editing).toBe(T.Chat.numberToOrdinal(0))
  expect(result.current.input.replyTo).toBe(T.Chat.numberToOrdinal(0))
  expect(result.current.input.giphyWindow).toBe(false)
  expect(result.current.input.commandMarkdown).toBeUndefined()
  expect(editPost).toHaveBeenCalledWith(
    expect.objectContaining({
      body: 'new text',
      target: expect.objectContaining({messageID: editMessageID}),
    })
  )
})

test('giphy engine events and send path update the input owner', async () => {
  const replyOrdinal = T.Chat.numberToOrdinal(1001)
  const replyMessageID = T.Chat.numberToMessageID(1001)
  const getLastPost = mockPostText()
  const trackGiphy = jest.spyOn(T.RPCChat, 'localTrackGiphySelectRpcPromise').mockResolvedValue({})
  const {composerInput, result} = renderInputWithThreadActions()
  const giphyResult = makeGiphyResult()

  act(() => {
    result.current.threadActions.addMessages(
      [
        makeTextMessage({
          id: replyMessageID,
          ordinal: replyOrdinal,
          outboxID: T.Chat.stringToOutboxID('giphy-reply-target'),
        }),
      ],
      {markAsRead: false}
    )
    result.current.input.dispatch.injectIntoInput('/giphy cats')
  })
  notifyInputEngineAction({
    payload: {params: {clearInput: true, convID, show: true}},
    type: 'chat.1.chatUi.chatGiphyToggleResultWindow',
  } as never)
  notifyInputEngineAction({
    payload: {params: {convID, results: {galleryUrl: 'https://giphy.com/search/cats', results: [giphyResult]}}},
    type: 'chat.1.chatUi.chatGiphySearchResults',
  } as never)
  act(() => {
    result.current.input.dispatch.setReplyTo(replyOrdinal)
  })

  expect(result.current.input.giphyWindow).toBe(true)
  expect(composerInput.text).toBe('')
  expect(result.current.input.giphyResult?.results).toEqual([giphyResult])

  act(() => {
    result.current.input.dispatch.sendGiphyResult(giphyResult)
  })
  await flushPromises()

  expect(trackGiphy).toHaveBeenCalledWith({result: giphyResult})
  expect(getLastPost()?.params.body).toBe(giphyResult.targetUrl)
  expect(getLastPost()?.params.replyTo).toBe(replyMessageID)
  expect(result.current.input.replyTo).toBe(T.Chat.numberToOrdinal(0))
  expect(result.current.input.giphyWindow).toBe(false)
  expect(composerInput.text).toBe('')
})

test('sendComposerText sends dismissed unfurl urls as unfurlSuppress', async () => {
  const getLastPost = mockPostText()
  useUnfurlPreviewState.getState().dispatch.dismiss(convID, ['http://a.com'])
  const {result} = renderInput()

  act(() => {
    result.current.dispatch.sendComposerText('hi http://a.com', {dismissed: ['http://a.com'], failed: []})
  })
  await flushPromises()

  expect(getLastPost()?.params.unfurlSuppress).toEqual(['http://a.com'])
  expect(getSuppressedURLs(convID)).toEqual([])
})

// a send that carries no snapshot is not the composer sending its own text -- a coinflip
// resend goes through the same action -- so it must not pick up the composer's dismissals,
// nor clear them when it lands
test('a send with no snapshot leaves the composer dismissals alone', async () => {
  const getLastPost = mockPostText()
  useUnfurlPreviewState.getState().dispatch.dismiss(convID, ['http://a.com'])
  const {result} = renderInput()

  act(() => {
    result.current.dispatch.sendComposerText('/flip 2')
  })
  await flushPromises()

  expect(getLastPost()?.params.unfurlSuppress).toEqual([])
  expect(getSuppressedURLs(convID)).toEqual(['http://a.com'])
})

test('onSubmit sends dismissed unfurl urls even though clearing the composer drops them', async () => {
  jest.useFakeTimers()
  try {
    const getLastPost = mockPostText()
    jest.spyOn(T.RPCChat, 'localUpdateTypingRpcPromise').mockResolvedValue(undefined)
    jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
    jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise').mockResolvedValue([
      {
        unfurl: {generic: {siteName: 'a', title: 'a', url: 'http://a.com'}, unfurlType: T.RPCChat.UnfurlType.generic},
        url: 'http://a.com',
      } as T.RPCChat.UnfurlPreviewInfo,
    ])
    renderComposer()

    const text = 'look at http://a.com'
    act(() => {
      mockPlatformInputProps?.onChangeText(text)
    })
    // let the preview debounce fire so the hook holds a preview for this url
    await act(async () => {
      jest.advanceTimersByTime(600)
      await flushPromises()
    })

    // the card's X
    act(() => {
      useUnfurlPreviewState.getState().dispatch.dismiss(convID, ['http://a.com'])
    })
    expect(getSuppressedURLs(convID)).toEqual(['http://a.com'])

    // more than the 200ms draft throttle since the last keystroke, so clearing the composer
    // runs updateDraft's leading edge synchronously and the hook drops the dismissal
    act(() => {
      mockPlatformInputProps?.onSubmit()
    })
    expect(getSuppressedURLs(convID)).toEqual([])

    await act(async () => {
      jest.advanceTimersByTime(1)
      await flushPromises()
    })

    expect(getLastPost()?.params.body).toBe(text)
    expect(getLastPost()?.params.unfurlSuppress).toEqual(['http://a.com'])
  } finally {
    jest.useRealTimers()
  }
})

test('onSubmit snapshots the dismissals before the composer clears them', async () => {
  jest.useFakeTimers()
  try {
    mockOnClear = () => useUnfurlPreviewState.getState().dispatch.keepOnly(convID, [])
    const getLastPost = mockPostText()
    jest.spyOn(T.RPCChat, 'localUpdateTypingRpcPromise').mockResolvedValue(undefined)
    jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
    jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise').mockResolvedValue([])
    renderComposer()
    act(() => {
      useUnfurlPreviewState.getState().dispatch.dismiss(convID, ['http://a.com'])
    })

    act(() => {
      mockPlatformInputProps?.onChangeText('look at http://a.com')
    })
    act(() => {
      mockPlatformInputProps?.onSubmit()
    })
    // the clear has already emptied the store by now: only a snapshot taken ahead of it
    // still has the dismissal to send
    expect(getSuppressedURLs(convID)).toEqual([])

    await act(async () => {
      jest.advanceTimersByTime(1)
      await flushPromises()
    })

    expect(getLastPost()?.params.unfurlSuppress).toEqual(['http://a.com'])
  } finally {
    jest.useRealTimers()
  }
})

// the snapshot owns only what it took: a dismissal made while the send was in flight
// belongs to the next message, and clearing it would unfurl a card the user just declined
test('a landed send leaves a dismissal made while it was in flight alone', async () => {
  mockPostText()
  const {result} = renderInput()

  act(() => {
    result.current.dispatch.sendComposerText('hi http://wsj.com', {dismissed: [], failed: ['http://wsj.com']})
  })
  useUnfurlPreviewState.getState().dispatch.dismiss(convID, ['http://wsj.com'])
  await flushPromises()

  expect(getSuppressedURLs(convID)).toEqual(['http://wsj.com'])
})

// an edit posts as MessageType_EDIT, which the unfurler does not extract urls from, so
// there is nothing to preview and no scrape to pay for
test('no preview is fetched while editing', async () => {
  const spy = jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise').mockResolvedValue([])
  jest.spyOn(T.RPCChat, 'localUpdateTypingRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
  jest.useFakeTimers()
  try {
    // the composer and the handles that drive it have to share one provider, or the editing
    // state never reaches the composer under test
    let handles: InputHandles | undefined
    renderComposerWithProbe(h => (handles = h))
    act(() => {
      handles?.thread.addMessages([makeTextMessage({text: 'look at http://a.com'})], {markAsRead: false})
    })
    act(() => {
      mockPlatformInputProps?.onChangeText('look at http://a.com')
    })
    act(() => {
      handles?.input.dispatch.setEditing('last')
    })
    await act(async () => {
      jest.advanceTimersByTime(1000)
      await flushPromises()
    })
    expect(spy).not.toHaveBeenCalled()
  } finally {
    jest.useRealTimers()
  }
})

test('a canceled stellar send restores the dismissed unfurl urls for the resend', async () => {
  // the composer clears its dismissals before the send resolves, so a cancel has to put
  // the snapshot back or the restored text re-unfurls what the user dismissed
  jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatStellarDone']?.({canceled: true})
    await Promise.resolve()
    return {outboxID: makeRpcOutboxID('posted-outbox')}
  })
  const {result} = renderInput()

  act(() => {
    result.current.dispatch.sendComposerText('hi http://a.com', {dismissed: ['http://a.com'], failed: []})
  })
  await flushPromises()

  expect(getSuppressedURLs(convID)).toEqual(['http://a.com'])
})

test('a canceled stellar send leaves a failed preview unrecorded as a dismissal', async () => {
  // a failure is re-derived by the next fetch, a dismissal never is, so restoring one as
  // the other would keep the url suppressed even after it starts scraping again
  jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener').mockImplementation(async p => {
    p.incomingCallMap['chat.1.chatUi.chatStellarDone']?.({canceled: true})
    await Promise.resolve()
    return {outboxID: makeRpcOutboxID('posted-outbox')}
  })
  const {result} = renderInput()

  act(() => {
    result.current.dispatch.sendComposerText('hi http://wsj.com', {dismissed: [], failed: ['http://wsj.com']})
  })
  await flushPromises()

  expect(useUnfurlPreviewState.getState().dismissed.get(convID)).toBeUndefined()
  expect(getSuppressedURLs(convID)).toEqual([])
})

test('a send suppresses what failed to preview as well as what was dismissed', async () => {
  const getLastPost = mockPostText()
  const {result} = renderInput()

  act(() => {
    result.current.dispatch.sendComposerText('hi http://a.com http://wsj.com', {
      dismissed: ['http://a.com'],
      failed: ['http://wsj.com'],
    })
  })
  await flushPromises()

  expect(getLastPost()?.params.unfurlSuppress).toEqual(['http://a.com', 'http://wsj.com'])
})

test('toggleGiphyPrefill toggles the slash command text', () => {
  const {composerInput, result} = renderInput()

  act(() => {
    result.current.dispatch.toggleGiphyPrefill()
  })
  expect(composerInput.text).toBe('/giphy ')

  act(() => {
    result.current.dispatch.setGiphyWindow(true)
  })
  act(() => {
    result.current.dispatch.toggleGiphyPrefill()
  })
  expect(composerInput.text).toBe('')
})

// the gif button reads the window it was rendered with, not a change dispatched in the same batch
test('toggleGiphyPrefill decides from the rendered giphy window', () => {
  const {composerInput, result} = renderInput()
  act(() => {
    result.current.dispatch.injectIntoInput('/giphy cats')
    result.current.dispatch.setGiphyWindow(true)
  })

  act(() => {
    result.current.dispatch.setGiphyWindow(false)
    result.current.dispatch.toggleGiphyPrefill()
  })

  expect(composerInput.text).toBe('')
})

test('command status and markdown engine events are conversation scoped', () => {
  const input = renderInput()
  const otherInput = renderInput(otherConvID)
  const commandStatus = {
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: 'location disabled',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  }
  const commandMarkdown = {body: '*formatted* command output', title: 'Command output'}

  notifyInputEngineAction({
    payload: {
      params: {
        actions: commandStatus.actions,
        convID,
        displayText: commandStatus.displayText,
        typ: commandStatus.displayType,
      },
    },
    type: 'chat.1.chatUi.chatCommandStatus',
  } as never)
  notifyInputEngineAction({
    payload: {params: {convID, md: commandMarkdown}},
    type: 'chat.1.chatUi.chatCommandMarkdown',
  } as never)

  expect(input.result.current.commandStatus).toEqual(commandStatus)
  expect(input.result.current.commandMarkdown).toEqual(commandMarkdown)
  expect(otherInput.result.current.commandStatus).toBeUndefined()
  expect(otherInput.result.current.commandMarkdown).toBeUndefined()

  notifyInputEngineAction({
    payload: {params: {convID, md: null}},
    type: 'chat.1.chatUi.chatCommandMarkdown',
  } as never)

  expect(input.result.current.commandMarkdown).toBeUndefined()

  notifyInputEngineAction({
    payload: {
      params: {
        actions: null,
        convID,
        displayText: 'no actions',
        typ: T.RPCChat.UICommandStatusDisplayTyp.status,
      },
    },
    type: 'chat.1.chatUi.chatCommandStatus',
  } as never)

  expect(input.result.current.commandStatus).toEqual({
    actions: [],
    displayText: 'no actions',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.status,
  })
})

function ThreadActionsProbe(p: {onActions: (actions: ReturnType<typeof useConversationThreadActions>) => void}) {
  p.onActions(useConversationThreadActions())
  return null
}

function InputStateProbe(p: {onState: (state: ConversationInputState) => void}) {
  p.onState(useConversationInput(s => s))
  return null
}

test('an intent written before the provider mounts is delivered on mount', () => {
  setInputIntent(convID, {text: 'prefill from store', type: 'injectText'})

  const {composerInput} = renderInput(convID)

  expect(composerInput.text).toBe('prefill from store')
})

test('a consumed intent does not replay on remount', () => {
  setInputIntent(convID, {text: 'only once', type: 'injectText'})

  const first = renderInput(convID)
  expect(first.composerInput.text).toBe('only once')
  first.unmount()

  const second = renderInput(convID)
  expect(second.composerInput.text).toBe('')
})

test('an intent for one conversation is not delivered to a different conversation provider', () => {
  setInputIntent(convID, {text: 'for convID only', type: 'injectText'})

  const {composerInput} = renderInput(otherConvID)

  expect(composerInput.text).toBe('')
  expect(useInputIntentState.getState().intents.get(convID)).toEqual({
    text: 'for convID only',
    type: 'injectText',
  })
})

test('two setEditing writes before the input provider mounts: the second one applies', () => {
  const composerInput = makeFakeComposerInput()
  const firstOrdinal = T.Chat.numberToOrdinal(211)
  const secondOrdinal = T.Chat.numberToOrdinal(212)
  let threadActions: ReturnType<typeof useConversationThreadActions> | undefined
  let inputState: ConversationInputState | undefined

  const {rerender} = render(
    <ConversationThreadProvider id={convID}>
      <ThreadActionsProbe onActions={actions => (threadActions = actions)} />
    </ConversationThreadProvider>
  )

  act(() => {
    // Only the second ordinal has a backing message, so a bug that let the first
    // (overwritten) write through would leave editing at its empty default instead
    // of silently reproducing the same result as a correct second-write application.
    threadActions?.addMessages(
      [
        makeTextMessage({
          id: T.Chat.numberToMessageID(212),
          ordinal: secondOrdinal,
          outboxID: T.Chat.stringToOutboxID('edit-second-write'),
          text: 'second write text',
        }),
      ],
      {markAsRead: false}
    )
  })

  setInputIntent(convID, {ordinal: firstOrdinal, type: 'setEditing'})
  setInputIntent(convID, {ordinal: secondOrdinal, type: 'setEditing'})

  rerender(
    <ConversationThreadProvider id={convID}>
      <ThreadActionsProbe onActions={actions => (threadActions = actions)} />
      <ConversationInputProvider id={convID}>
        <InputStateProbe onState={state => (inputState = state)} />
        <FakeComposerInputView fake={composerInput} />
      </ConversationInputProvider>
    </ConversationThreadProvider>
  )

  expect(inputState?.editing).toBe(secondOrdinal)
  expect(composerInput.text).toBe('second write text')
})

test('an intent that arrives after mount is delivered without a remount', () => {
  const {composerInput} = renderInput(convID)
  expect(composerInput.text).toBe('')

  act(() => {
    setInputIntent(convID, {text: 'arrived after mount', type: 'injectText'})
  })

  expect(composerInput.text).toBe('arrived after mount')
})

test('commandStatus reaches a mounted provider but is dropped when none is mounted', () => {
  const commandStatusInfo = {
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: 'from store',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  }

  setInputIntent(convID, {info: commandStatusInfo, type: 'commandStatus'})

  const {result} = renderInput(convID)
  expect(result.current.commandStatus).toBeUndefined()

  act(() => {
    setInputIntent(convID, {info: commandStatusInfo, type: 'commandStatus'})
  })

  expect(result.current.commandStatus).toEqual(commandStatusInfo)
})

test('setThreadInputEditing reaches the store with no provider mounted, then applies on mount', () => {
  const composerInput = makeFakeComposerInput()
  const editOrdinal = T.Chat.numberToOrdinal(801)
  let threadActions: ReturnType<typeof useConversationThreadActions> | undefined
  let inputState: ConversationInputState | undefined

  const {rerender} = render(
    <ConversationThreadProvider id={convID}>
      <ThreadActionsProbe onActions={actions => (threadActions = actions)} />
    </ConversationThreadProvider>
  )

  act(() => {
    threadActions?.addMessages(
      [
        makeTextMessage({
          id: T.Chat.numberToMessageID(801),
          ordinal: editOrdinal,
          outboxID: T.Chat.stringToOutboxID('router-setEditing'),
          text: 'router edit text',
        }),
      ],
      {markAsRead: false}
    )
  })

  setThreadInputEditing(convID, editOrdinal)

  rerender(
    <ConversationThreadProvider id={convID}>
      <ThreadActionsProbe onActions={actions => (threadActions = actions)} />
      <ConversationInputProvider id={convID}>
        <InputStateProbe onState={state => (inputState = state)} />
        <FakeComposerInputView fake={composerInput} />
      </ConversationInputProvider>
    </ConversationThreadProvider>
  )

  expect(inputState?.editing).toBe(editOrdinal)
  expect(composerInput.text).toBe('router edit text')
})

test('setThreadInputReplyTo reaches the store with no provider mounted, then applies on mount', () => {
  const replyOrdinal = T.Chat.numberToOrdinal(802)

  setThreadInputReplyTo(convID, replyOrdinal)

  const {result} = renderInput(convID)

  expect(result.current.replyTo).toBe(replyOrdinal)
})

test('setThreadInputCommandStatus reaches a mounted provider', () => {
  const commandStatusInfo = {
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: 'from router, mounted',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  }

  const {result} = renderInput(convID)

  act(() => {
    setThreadInputCommandStatus(convID, commandStatusInfo)
  })

  expect(result.current.commandStatus).toEqual(commandStatusInfo)
})

test('setThreadInputCommandStatus is dropped when no provider is mounted', () => {
  const commandStatusInfo = {
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: 'from router, unmounted',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  }

  setThreadInputCommandStatus(convID, commandStatusInfo)

  const {result} = renderInput(convID)

  expect(result.current.commandStatus).toBeUndefined()
})

// The counterfactual to the test above: hidden is not unmounted, so a registered consumer keeps
// its commandStatus even though it consumes nothing while it is hidden. <Freeze> here is the real
// react-freeze (react-native-screens' DelayedFreeze renders it): a Suspense boundary throwing a
// thenable that never settles, which React hides by tearing down layout effects only. Passive
// effects stay connected, so the registration this provider makes in one survives.
//
// Note what this does NOT claim: the thread beneath the location popup is not hidden at all -
// native-stack forces activityMode 'normal' for the screen under a modal - which is why that
// banner was never being lost. See the registry in input-intent-store.tsx.
test('a commandStatus written while the provider is frozen is applied on thaw', () => {
  const commandStatusInfo = {
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: 'permission denied, thread frozen',
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  }
  let inputState: ConversationInputState | undefined
  const tree = (freeze: boolean) => (
    <ConversationThreadProvider id={convID}>
      <Freeze freeze={freeze}>
        <ConversationInputProvider id={convID}>
          <InputStateProbe onState={state => (inputState = state)} />
        </ConversationInputProvider>
      </Freeze>
    </ConversationThreadProvider>
  )

  const {rerender} = render(tree(false))
  act(() => {
    rerender(tree(true))
  })
  // frozen: the provider renders nothing and its layout effects are torn down
  expect(inputState?.commandStatus).toBeUndefined()

  act(() => {
    setThreadInputCommandStatus(convID, commandStatusInfo)
  })
  act(() => {
    rerender(tree(false))
  })

  expect(inputState?.commandStatus).toEqual(commandStatusInfo)
})

describe('a pending draft save', () => {
  const typeThenWait = (switchAccount: boolean) => {
    jest.useFakeTimers()
    try {
      const saveDraft = jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
      jest.spyOn(T.RPCChat, 'localUpdateTypingRpcPromise').mockResolvedValue(undefined)
      renderComposer()
      act(() => {
        mockPlatformInputProps?.onChangeText('a')
      })
      // inside the 200ms throttle, so this save waits for its trailing edge
      act(() => {
        mockPlatformInputProps?.onChangeText('ab')
      })
      if (switchAccount) {
        act(() => {
          useCurrentUserState.getState().dispatch.setBootstrap({
            deviceID: 'device-id-2',
            deviceName: 'test-device-2',
            uid: 'uid-2',
            username: 'testuser-mac',
          })
        })
      }
      act(() => {
        jest.advanceTimersByTime(250)
      })
      return saveDraft.mock.calls.map(c => c[0].text)
    } finally {
      jest.useRealTimers()
    }
  }

  test('is saved for the account that typed it', () => {
    expect(typeThenWait(false)).toContain('ab')
  })

  test('is not saved for the next account when a switch lands first', () => {
    expect(typeThenWait(true)).not.toContain('ab')
  })
})

describe('a draft typed just before leaving the conversation', () => {
  const typeThenUnmount = (switchAccount: boolean) => {
    jest.useFakeTimers()
    try {
      const saveDraft = jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
      jest.spyOn(T.RPCChat, 'localUpdateTypingRpcPromise').mockResolvedValue(undefined)
      const {unmount} = renderComposer()
      act(() => {
        mockPlatformInputProps?.onChangeText('a')
      })
      // inside the 200ms throttle, so this save is still pending at unmount
      act(() => {
        mockPlatformInputProps?.onChangeText('ab')
      })
      if (switchAccount) {
        act(() => {
          useCurrentUserState.getState().dispatch.setBootstrap({
            deviceID: 'device-id-2',
            deviceName: 'test-device-2',
            uid: 'uid-2',
            username: 'testuser-mac',
          })
        })
      }
      unmount()
      return saveDraft.mock.calls.map(c => c[0].text)
    } finally {
      jest.useRealTimers()
    }
  }

  test('is saved when the composer unmounts', () => {
    expect(typeThenUnmount(false)).toContain('ab')
  })

  test('is not saved for the next account when the unmount comes from a switch', () => {
    expect(typeThenUnmount(true)).not.toContain('ab')
  })
})

describe('the composer text', () => {
  // the provider outlives the composer: mobile thread search, for one, swaps the input out
  // while the conversation stays mounted
  const renderToggle = () => {
    let handles: InputHandles | undefined
    const tree = (showInput: boolean) => (
      <ConversationThreadProvider id={convID}>
        <ConversationInputProvider id={convID}>
          {showInput && <Input />}
          <InputProbe onRender={h => (handles = h)} />
        </ConversationInputProvider>
      </ConversationThreadProvider>
    )
    const utils = render(tree(false))
    return {
      getHandles: () => handles!,
      setShowInput: (show: boolean) => {
        act(() => {
          utils.rerender(tree(show))
        })
      },
    }
  }

  const receiveDraft = (draft: string) => {
    act(() => {
      metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID, draft}], undefined, {force: true})
    })
  }

  beforeEach(() => {
    jest.spyOn(T.RPCChat, 'localUpdateTypingRpcPromise').mockResolvedValue(undefined)
    jest.spyOn(T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
    jest.spyOn(T.RPCChat, 'localUnfurlPreviewLocalRpcPromise').mockResolvedValue([])
  })

  test('an inject reaches the mounted input with the caret at the end', () => {
    let handles: InputHandles | undefined
    renderComposerWithProbe(h => (handles = h))

    act(() => {
      handles?.input.dispatch.injectIntoInput('hello')
    })

    expect(mockInput.text).toBe('hello')
    expect(mockInput.selection).toEqual({end: 5, start: 5})
    expect(mockInput.focusCount).toBe(0)
  })

  test('an inject with focus focuses the input once', () => {
    let handles: InputHandles | undefined
    renderComposerWithProbe(h => (handles = h))

    act(() => {
      handles?.input.dispatch.injectIntoInput('hello', true)
    })

    expect(mockInput.text).toBe('hello')
    expect(mockInput.focusCount).toBe(1)
  })

  test('an injected empty text clears the input', () => {
    let handles: InputHandles | undefined
    renderComposerWithProbe(h => (handles = h))
    act(() => {
      handles?.input.dispatch.injectIntoInput('typed')
    })

    act(() => {
      handles?.input.dispatch.injectIntoInput('')
    })

    expect(mockInput.text).toBe('')
    expect(mockInput.selection).toBeUndefined()
  })

  test('the injected text is echoed back through onChangeText, which saves it as the draft', () => {
    const saveDraft = jest.mocked(T.RPCChat.localUpdateUnsentTextRpcPromise)
    let handles: InputHandles | undefined
    renderComposerWithProbe(h => (handles = h))

    act(() => {
      handles?.input.dispatch.injectIntoInput('echoed')
    })

    expect(saveDraft.mock.calls.map(c => c[0].text)).toContain('echoed')
  })

  test('an inject made while the input is unmounted lands when it mounts, with its focus', () => {
    const {getHandles, setShowInput} = renderToggle()

    act(() => {
      getHandles().input.dispatch.injectIntoInput('queued', true)
    })
    expect(mockInput.text).toBe('')

    setShowInput(true)

    expect(mockInput.text).toBe('queued')
    expect(mockInput.focusCount).toBe(1)
  })

  test('of several injects made while unmounted the last text wins, and any focus request is kept', () => {
    const {getHandles, setShowInput} = renderToggle()

    act(() => {
      getHandles().input.dispatch.injectIntoInput('first', true)
    })
    act(() => {
      getHandles().input.dispatch.injectIntoInput('second')
    })
    setShowInput(true)

    expect(mockInput.text).toBe('second')
    expect(mockInput.focusCount).toBe(1)
  })

  test('an edit started while unmounted fills the input when it mounts', () => {
    const {getHandles, setShowInput} = renderToggle()
    act(() => {
      getHandles().thread.addMessages([makeTextMessage({text: 'edit me later'})], {markAsRead: false})
    })
    act(() => {
      getHandles().input.dispatch.setEditing(T.Chat.numberToOrdinal(101))
    })

    setShowInput(true)

    expect(mockInput.text).toBe('edit me later')
    expect(mockPlatformInputProps?.isEditing).toBe(true)
  })

  test('an inject still waiting when the input mounts beats the draft', () => {
    receiveDraft('saved draft')
    const {getHandles, setShowInput} = renderToggle()
    act(() => {
      getHandles().input.dispatch.injectIntoInput('from an intent')
    })

    setShowInput(true)

    expect(mockInput.text).toBe('from an intent')
  })

  test('an empty inject still waiting when the input mounts clears the draft it loaded', () => {
    receiveDraft('saved draft')
    const {getHandles, setShowInput} = renderToggle()
    act(() => {
      getHandles().input.dispatch.injectIntoInput('')
    })

    setShowInput(true)

    expect(mockInput.text).toBe('')
  })

  test('the draft typed before the input unmounts is reloaded when it mounts again', () => {
    receiveDraft('')
    const {setShowInput} = renderToggle()
    setShowInput(true)
    act(() => {
      mockPlatformInputProps?.onChangeText('a')
    })
    act(() => {
      mockPlatformInputProps?.onChangeText('ab')
    })

    setShowInput(false)
    // flushed on unmount into the inbox meta, which is where the next mount reads it
    expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe('ab')
    mockInput.text = ''

    setShowInput(true)

    expect(mockInput.text).toBe('ab')
  })

  test('an inject into a mounted composer whose input has no handle waits for it', () => {
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    mockNullInputRef = true
    let handles: InputHandles | undefined
    renderComposerWithProbe(h => (handles = h))

    act(() => {
      handles?.input.dispatch.injectIntoInput('not lost')
    })
    expect(mockInput.text).toBe('')
    act(() => {
      mockPlatformInputProps?.setInputRef(mockHandle())
    })

    expect(mockInput.text).toBe('not lost')
    expect(error).not.toHaveBeenCalled()
  })

  test('a composer send empties the input once, when it is submitted', async () => {
    jest.useFakeTimers()
    try {
      const getLastPost = mockPostText()
      let handles: InputHandles | undefined
      renderComposerWithProbe(h => (handles = h))
      act(() => {
        handles?.input.dispatch.injectIntoInput('going out')
      })
      const clears: Array<string> = []
      mockOnClear = () => clears.push(mockInput.text)

      act(() => {
        mockPlatformInputProps?.onSubmit()
      })
      expect(mockInput.text).toBe('')
      await act(async () => {
        jest.advanceTimersByTime(1)
        await flushPromises()
      })

      expect(getLastPost()?.params.body).toBe('going out')
      expect(mockInput.text).toBe('')
      expect(clears).toEqual(['going out'])
    } finally {
      jest.useRealTimers()
    }
  })

  test('a canceled stellar send puts the text back into the input', async () => {
    const getLastPost = mockPostText()
    let handles: InputHandles | undefined
    renderComposerWithProbe(h => (handles = h))

    act(() => {
      handles?.input.dispatch.sendComposerText('+1xlm@testuser')
    })
    await flushPromises()
    expect(mockInput.text).toBe('')
    act(() => {
      getLastPost()?.incomingCallMap['chat.1.chatUi.chatStellarDone']?.({canceled: true})
    })

    expect(mockInput.text).toBe('+1xlm@testuser')
  })

  test('onSubmit ignores an empty composer', () => {
    jest.useFakeTimers()
    try {
      const post = jest.spyOn(T.RPCChat, 'localPostTextNonblockRpcListener')
      renderComposer()
      act(() => {
        mockPlatformInputProps?.onSubmit()
      })
      act(() => {
        jest.advanceTimersByTime(10)
      })
      expect(post).not.toHaveBeenCalled()
      expect(mockInput.focusCount).toBe(0)
    } finally {
      jest.useRealTimers()
    }
  })

  // the mobile send queue collapses the expanded input only after a send
  test('onSubmit says whether it sent: not where the user cannot post', () => {
    jest.useFakeTimers()
    try {
      mockPostText()
      renderComposer()
      act(() => {
        mockPlatformInputProps?.onChangeText('hello')
      })
      act(() => {
        metasReceived([{...Meta.makeConversationMeta(), cannotWrite: true, conversationIDKey: convID}], undefined, {
          force: true,
        })
      })
      let sent: boolean | undefined
      act(() => {
        sent = mockPlatformInputProps?.onSubmit()
      })
      expect(sent).toBe(false)

      act(() => {
        metasReceived([{...Meta.makeConversationMeta(), cannotWrite: false, conversationIDKey: convID}], undefined, {
          force: true,
        })
      })
      act(() => {
        sent = mockPlatformInputProps?.onSubmit()
      })
      expect(sent).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })

  test('onSubmit clears and focuses the input at once and sends on the next tick', async () => {
    jest.useFakeTimers()
    try {
      const getLastPost = mockPostText()
      renderComposer()
      act(() => {
        mockPlatformInputProps?.onChangeText('hello')
      })
      mockInput.text = 'hello'

      act(() => {
        mockPlatformInputProps?.onSubmit()
      })
      expect(mockInput.text).toBe('')
      expect(mockInput.focusCount).toBe(1)
      expect(getLastPost()).toBeUndefined()

      await act(async () => {
        jest.advanceTimersByTime(0)
        await flushPromises()
      })
      expect(getLastPost()?.params.body).toBe('hello')
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('focusing the composer from the thread', () => {
  // what the list and the unfurl preview call to put the user back in the composer
  const renderWithThreadRefs = () => {
    let focusInput: (() => void) | undefined
    const FocusProbe = (p: {onRender: (focus: () => void) => void}) => {
      const {useContext} = require('react') as typeof React
      p.onRender(useContext(ThreadRefsContext).focusInput)
      return null
    }
    const tree = (showInput: boolean) => (
      <ConversationThreadProvider id={convID}>
        <ConversationInputProvider id={convID}>
          <ThreadRefsProvider>
            {showInput && <Input />}
            <FocusProbe onRender={f => (focusInput = f)} />
          </ThreadRefsProvider>
        </ConversationInputProvider>
      </ConversationThreadProvider>
    )
    const utils = render(tree(true))
    return {
      focusInput: () => focusInput?.(),
      setShowInput: (show: boolean) => {
        act(() => {
          utils.rerender(tree(show))
        })
      },
    }
  }

  test('focuses the input the composer attached last', () => {
    const {focusInput} = renderWithThreadRefs()
    const next = {...mockHandle(), focus: jest.fn()}
    act(() => {
      mockPlatformInputProps?.setInputRef(next)
    })
    mockInput.focusCount = 0

    act(() => {
      focusInput()
    })

    expect(next.focus).toHaveBeenCalledTimes(1)
    expect(mockInput.focusCount).toBe(0)
  })

  test('with no input attached, focuses the next one once it attaches', () => {
    const {focusInput, setShowInput} = renderWithThreadRefs()
    setShowInput(false)
    mockInput.focusCount = 0

    act(() => {
      focusInput()
    })
    expect(mockInput.focusCount).toBe(0)
    setShowInput(true)

    expect(mockInput.focusCount).toBe(1)
  })
})
