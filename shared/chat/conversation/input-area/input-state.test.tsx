/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import logger from '@/logger'
import {metasReceived, useInboxMetadataState} from '@/chat/inbox/metadata'
import * as React from 'react'
import {useContext} from 'react'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import {act, cleanup, render, renderHook, screen} from '@testing-library/react'
import {Freeze} from 'react-freeze'
import {routeChatNotification} from '@/chat/notification-router'
import {resetAllStores} from '@/util/zustand'
import {setInputIntent, useInputIntentState} from '../input-intent-store'
import {
  clearModals,
  setThreadInputCommandStatus,
  setThreadInputEditing,
  setThreadInputReplyTo,
} from '@/constants/router'
import {useCurrentUserState} from '@/stores/current-user'
import Input from './normal'
import type {PlatformInputProps, Selection} from './normal/input.shared'
import {ConversationInputProvider, useConversationInput, type ConversationInputState} from './input-state'
import {useComposerInput, type ComposerInput} from './composer'
import {Input as PlatformTextInput} from './normal/input'
import {CHAT_INPUT} from '@/tests/e2e/shared/test-ids'
import {ConversationThreadProvider, useConversationThreadActions} from '../thread-context'
import {makeRootState, navigationWrapper, type RenderInNavigationOptions} from '@/test/navigation'
import {navigationRef} from '@/constants/navigator'
import * as NavTree from '@/constants/nav-tree'
import {fakeError, installFakeEngine, type FakeAnswer, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {tick} from '@/test/flush'
import type {RPCError} from '@/util/errors'
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
// Stands in for the real composer input bar (the module's default; its low-level Input is the real
// one), setting its handle the way the real inputs do, as the
// commit is made; mockNullInputRef leaves it unset.
// input.tsx pulls in the native-only halves of the input bar at module scope; the desktop low-level
// input used here uses none of them
jest.mock('@/chat/audio/audio-recorder.native', () => ({__esModule: true, default: () => null}))
jest.mock('@/chat/audio/audio-send.native', () => ({AudioSendWrapper: () => null}))
jest.mock('@/util/expo-document-picker.native', () => ({pickDocumentsAsync: jest.fn()}))
jest.mock('./normal/input', () => ({
  ...jest.requireActual<object>('./normal/input'),
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

const isFakeTimers = () => typeof (setTimeout as unknown as {clock?: unknown}).clock === 'object'
// Long enough for a call to cross to the service and its answer back, a few in a row, and for the
// listener to run what the service sent the GUI, which it does on a 0ms timer. The crossing rides
// node:timers' setImmediate, which fake timers leave alone.
const flushPromises = async () => {
  for (let i = 0; i < 4; i++) {
    await tick()
    if (isFakeTimers()) {
      jest.advanceTimersByTime(0)
    } else {
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    await tick()
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

const makeOutboxID = (label: string): T.Chat.OutboxID =>
  T.Chat.rpcOutboxIDToOutboxID(new TextEncoder().encode(label))

const postText = 'chat.1.local.postTextNonblock'
const postEdit = 'chat.1.local.postEditNonblock'
const trackGiphySelect = 'chat.1.local.trackGiphySelect'
const unfurlPreview = 'chat.1.local.unfurlPreviewLocal'
const saveDraft = 'chat.1.local.updateUnsentText'
const setTyping = 'chat.1.local.updateTyping'
const convIDBytes = T.Chat.keyToConversationID(convID)

let fake: FakeEngine
const posted = {outboxID: new Uint8Array([1])}

// what the service received for `method`, once what the GUI sent has crossed to it
const sent = async (method: string) => {
  await act(flushPromises)
  return paramsOf(fake, method)
}

// the service takes each post; returns the last one it received
const mockPostText = () => {
  fake.answer(postText, () => posted)
  return async () => (await sent(postText)).at(-1) as
    | {body: string; replyTo?: T.Chat.MessageID | null; unfurlSuppress: ReadonlyArray<string>}
    | undefined
}

// the service takes each post as text carrying a stellar payment, and the user backs out of it:
// it tells the GUI's session the payment was canceled before it answers
const cancelStellarOnPost = () => {
  fake.answer(postText, async (params: {sessionID: number}) => {
    await fake.push('chat.1.chatUi.chatStellarDone', {canceled: true}, {sessionID: params.sessionID})
    return posted
  })
}

// holds each post; the test plays the service: cancel() reports the stellar payment backed out of
// on the post's session, then answers the post
const holdPostText = () => {
  const held = fake.hold(postText)
  return {
    cancel: async () => {
      const call = held.at(-1)
      if (!call) throw new Error('no post held')
      // the cancel restores the composer's text on a turn the push's own answer may or may
      // not have reached yet, so the whole exchange runs inside act
      await act(async () => {
        await fake.push('chat.1.chatUi.chatStellarDone', {canceled: true}, {sessionID: call.params.sessionID as number})
        call.reply(posted)
        await flushPromises()
      })
    },
    held,
  }
}

const answerPreviews = (answer: () => FakeAnswer) => fake.answer(unfurlPreview, answer)

// The real navigation tree every provider here renders in, as the route its thread is on: the
// conversation on the chat root, unless a test builds another with showRoute before rendering.
let navigation: ReturnType<typeof navigationWrapper>
const showRoute = (p: RenderInNavigationOptions) => {
  navigation = navigationWrapper(p)
  return navigation
}
function Nav(p: React.PropsWithChildren) {
  const Tree = navigation.wrapper
  return <Tree>{p.children}</Tree>
}

const wrapperFor = (id: T.Chat.ConversationIDKey) =>
  function Wrapper(p: React.PropsWithChildren) {
    return (
      <Nav>
        <ConversationThreadProvider id={id}>
          <ConversationInputProvider id={id}>{p.children}</ConversationInputProvider>
        </ConversationThreadProvider>
      </Nav>
    )
  }

// The composer's real low-level input, mounted on the conversation's composer as the input bar
// mounts it, so what an action puts into the composer can be read back off the element. onInput
// sees each handle the input hands the composer.
function ComposerField(p: {onInput?: (input: ComposerInput) => void}) {
  const {onInput} = p
  const {setInput, textChanged} = useComposerInput(undefined, false)
  const ref = React.useCallback(
    (input: ComposerInput | null) => {
      if (input) onInput?.(input)
      setInput(input)
    },
    [onInput, setInput]
  )
  return <PlatformTextInput multiline={true} onChangeText={textChanged} ref={ref} />
}

// The ComposerField the next render mounts: what it shows (the inputs already on screen come before
// it), and how often the composer focused it, through a call-through spy on its handle's focus.
const nextField = () => {
  const index = screen.queryAllByTestId(CHAT_INPUT).length
  const focuses = new Set<jest.SpiedFunction<ComposerInput['focus']>>()
  const onInput = (input: ComposerInput) => {
    focuses.add(jest.spyOn(input, 'focus'))
  }
  return {
    get focusCount() {
      return [...focuses].reduce((n, f) => n + f.mock.calls.length, 0)
    },
    onInput,
    get text() {
      return (screen.getAllByTestId(CHAT_INPUT)[index] as unknown as {value: string}).value
    },
  }
}

const fieldWrapperFor = (id: T.Chat.ConversationIDKey, field: ReturnType<typeof nextField>) =>
  function Wrapper(p: React.PropsWithChildren) {
    return (
      <Nav>
        <ConversationThreadProvider id={id}>
          <ConversationInputProvider id={id}>
            <ComposerField onInput={field.onInput} />
            {p.children}
          </ConversationInputProvider>
        </ConversationThreadProvider>
      </Nav>
    )
  }

const renderInput = (id = convID) => {
  const composerInput = nextField()
  const rendered = renderHook(() => useConversationInput(s => s), {wrapper: fieldWrapperFor(id, composerInput)})
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
  const composerInput = nextField()
  const {result} = renderHook(
    () => ({
      input: useConversationInput(s => s),
      threadActions: useConversationThreadActions(),
    }),
    {wrapper: fieldWrapperFor(id, composerInput)}
  )
  return {composerInput, result}
}

const notifyInputEngineAction = (action: Parameters<typeof routeChatNotification>[0]) => {
  act(() => {
    routeChatNotification(action)
  })
}

beforeEach(() => {
  showRoute({params: {conversationIDKey: convID}, route: 'chatRoot'})
  fake = installFakeEngine()
  // every keystroke saves the draft and reports typing
  fake.answer(saveDraft, () => null)
  fake.answer(setTyping, () => null)
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
    result.current.input.dispatch.reply(replyOrdinal)
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
  expect((await getLastPost())?.body).toBe('sent reply')
  expect((await getLastPost())?.replyTo).toBe(replyMessageID)
})

test('sendComposerText restores text when a stellar flow is canceled', async () => {
  const post = holdPostText()
  const {composerInput, result} = renderInput()

  act(() => {
    result.current.dispatch.sendComposerText('restore me')
  })
  await act(flushPromises)
  expect(post.held).toHaveLength(1)
  await post.cancel()

  expect(composerInput.text).toBe('restore me')
})

test('sendComposerText edits the selected message and clears edit state', async () => {
  const editOrdinal = T.Chat.numberToOrdinal(901)
  const editMessageID = T.Chat.numberToMessageID(901)
  fake.answer(postEdit, () => posted)
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
    result.current.input.dispatch.reply(T.Chat.numberToOrdinal(705))
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
  expect(await sent(postEdit)).toEqual([
    expect.objectContaining({
      body: 'new text',
      conversationID: convIDBytes,
      target: expect.objectContaining({messageID: editMessageID}),
    }),
  ])
})

test('giphy engine events and send path update the input owner', async () => {
  const replyOrdinal = T.Chat.numberToOrdinal(1001)
  const replyMessageID = T.Chat.numberToMessageID(1001)
  const getLastPost = mockPostText()
  fake.answer(trackGiphySelect, () => null)
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
    result.current.input.dispatch.reply(replyOrdinal)
  })

  expect(result.current.input.giphyWindow).toBe(true)
  expect(composerInput.text).toBe('')
  expect(result.current.input.giphyResult?.results).toEqual([giphyResult])

  act(() => {
    result.current.input.dispatch.sendGiphyResult(giphyResult)
  })
  await flushPromises()

  expect(await sent(trackGiphySelect)).toEqual([{result: giphyResult}])
  expect((await getLastPost())?.body).toBe(giphyResult.targetUrl)
  expect((await getLastPost())?.replyTo).toBe(replyMessageID)
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
  // the cancel puts the text back into the input
  await act(flushPromises)

  expect((await getLastPost())?.unfurlSuppress).toEqual(['http://a.com'])
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

  expect((await getLastPost())?.unfurlSuppress).toEqual([])
  expect(getSuppressedURLs(convID)).toEqual(['http://a.com'])
})

test('onSubmit sends dismissed unfurl urls even though clearing the composer drops them', async () => {
  jest.useFakeTimers()
  try {
    const getLastPost = mockPostText()
    answerPreviews(() => [
      {
        unfurl: {generic: {siteName: 'a', title: 'a', url: 'http://a.com'}, unfurlType: T.RPCChat.UnfurlType.generic},
        url: 'http://a.com',
      },
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

    expect((await getLastPost())?.body).toBe(text)
    expect((await getLastPost())?.unfurlSuppress).toEqual(['http://a.com'])
  } finally {
    jest.useRealTimers()
  }
})

test('onSubmit snapshots the dismissals before the composer clears them', async () => {
  jest.useFakeTimers()
  try {
    mockOnClear = () => useUnfurlPreviewState.getState().dispatch.keepOnly(convID, [])
    const getLastPost = mockPostText()
    answerPreviews(() => [])
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

    expect((await getLastPost())?.unfurlSuppress).toEqual(['http://a.com'])
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
  answerPreviews(() => [])
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
    expect(await sent(unfurlPreview)).toEqual([])
  } finally {
    jest.useRealTimers()
  }
})

test('a canceled stellar send restores the dismissed unfurl urls for the resend', async () => {
  // the composer clears its dismissals before the send resolves, so a cancel has to put
  // the snapshot back or the restored text re-unfurls what the user dismissed
  cancelStellarOnPost()
  const {result} = renderInput()

  act(() => {
    result.current.dispatch.sendComposerText('hi http://a.com', {dismissed: ['http://a.com'], failed: []})
  })
  // the cancel puts the text back into the input
  await act(flushPromises)

  expect(getSuppressedURLs(convID)).toEqual(['http://a.com'])
})

test('a canceled stellar send leaves a failed preview unrecorded as a dismissal', async () => {
  // a failure is re-derived by the next fetch, a dismissal never is, so restoring one as
  // the other would keep the url suppressed even after it starts scraping again
  cancelStellarOnPost()
  const {result} = renderInput()

  act(() => {
    result.current.dispatch.sendComposerText('hi http://wsj.com', {dismissed: [], failed: ['http://wsj.com']})
  })
  // the cancel puts the text back into the input
  await act(flushPromises)

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

  expect((await getLastPost())?.unfurlSuppress).toEqual(['http://a.com', 'http://wsj.com'])
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

test('an injectText notice shows as a warning in the command status bar', () => {
  setInputIntent(convID, {notice: "1 item couldn't be prepared.", text: 'shared text', type: 'injectText'})

  const {composerInput, result} = renderInput(convID)

  expect(composerInput.text).toBe('shared text')
  expect(result.current.commandStatus).toEqual({
    actions: [],
    displayText: "1 item couldn't be prepared.",
    displayType: T.RPCChat.UICommandStatusDisplayTyp.warning,
  })
})

test('an injectText with only a notice leaves the composer text alone', () => {
  setInputIntent(convID, {text: 'a draft', type: 'injectText'})
  const {composerInput, result} = renderInput(convID)
  expect(composerInput.text).toBe('a draft')

  act(() => {
    setInputIntent(convID, {notice: "Not sent: a.webp couldn't be converted.", type: 'injectText'})
  })

  expect(composerInput.text).toBe('a draft')
  expect(result.current.commandStatus?.displayText).toBe("Not sent: a.webp couldn't be converted.")
})

test('a shared text (append) goes after the conversation\'s draft instead of replacing it', () => {
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID, draft: 'my draft'}], undefined, {
    force: true,
  })
  setInputIntent(convID, {append: true, text: 'shared text', type: 'injectText'})

  const {composerInput} = renderInput(convID)

  expect(composerInput.text).toBe('my draft\nshared text')
})

test('an injectText without a notice leaves the command status bar alone', () => {
  setInputIntent(convID, {text: 'shared text', type: 'injectText'})

  const {result} = renderInput(convID)

  expect(result.current.commandStatus).toBeUndefined()
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
  const composerInput = nextField()
  const firstOrdinal = T.Chat.numberToOrdinal(211)
  const secondOrdinal = T.Chat.numberToOrdinal(212)
  let threadActions: ReturnType<typeof useConversationThreadActions> | undefined
  let inputState: ConversationInputState | undefined

  const {rerender} = render(
    <ConversationThreadProvider id={convID}>
      <ThreadActionsProbe onActions={actions => (threadActions = actions)} />
    </ConversationThreadProvider>,
    {wrapper: Nav}
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
        <ComposerField onInput={composerInput.onInput} />
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
  const composerInput = nextField()
  const editOrdinal = T.Chat.numberToOrdinal(801)
  let threadActions: ReturnType<typeof useConversationThreadActions> | undefined
  let inputState: ConversationInputState | undefined

  const {rerender} = render(
    <ConversationThreadProvider id={convID}>
      <ThreadActionsProbe onActions={actions => (threadActions = actions)} />
    </ConversationThreadProvider>,
    {wrapper: Nav}
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
        <ComposerField onInput={composerInput.onInput} />
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

  const {rerender} = render(tree(false), {wrapper: Nav})
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
  const typeThenWait = async (switchAccount: boolean) => {
    jest.useFakeTimers()
    try {
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
      return (await sent(saveDraft)).map(p => p.text as string)
    } finally {
      jest.useRealTimers()
    }
  }

  test('is saved for the account that typed it', async () => {
    expect(await typeThenWait(false)).toContain('ab')
  })

  test('is not saved for the next account when a switch lands first', async () => {
    expect(await typeThenWait(true)).not.toContain('ab')
  })
})

// A thread retires for good the first time it finds another account signed in, even if its own
// signs back in before the screen is built again; the composer's draft save is the thread's.
test('a pending draft save from a retired thread asks nothing, even with its account signed back in', async () => {
  jest.useFakeTimers()
  try {
    metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID}], undefined, {force: true})
    let thread: InputHandles['thread'] | undefined
    renderComposerWithProbe(h => (thread = h.thread))
    act(() => {
      mockPlatformInputProps?.onChangeText('a')
    })
    act(() => {
      mockPlatformInputProps?.onChangeText('ab')
    })
    const draftBefore = useInboxMetadataState.getState().metas.get(convID)?.draft
    act(() => {
      const {setBootstrap} = useCurrentUserState.getState().dispatch
      setBootstrap({deviceID: 'device-id-2', deviceName: 'test-device-2', uid: 'uid-2', username: 'testuser-mac'})
      expect(thread?.isRetired()).toBe(true)
      setBootstrap({deviceID: 'device-id', deviceName: 'test-device', uid: 'uid', username: 'testuser'})
    })
    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect((await sent(saveDraft)).map(p => p.text as string)).not.toContain('ab')
    expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe(draftBefore)
  } finally {
    jest.useRealTimers()
  }
})

describe('a draft typed just before leaving the conversation', () => {
  const typeThenUnmount = async (switchAccount: boolean) => {
    jest.useFakeTimers()
    try {
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
      return (await sent(saveDraft)).map(p => p.text as string)
    } finally {
      jest.useRealTimers()
    }
  }

  test('is saved when the composer unmounts', async () => {
    expect(await typeThenUnmount(false)).toContain('ab')
  })

  test('is not saved for the next account when the unmount comes from a switch', async () => {
    expect(await typeThenUnmount(true)).not.toContain('ab')
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
    const utils = render(tree(false), {wrapper: Nav})
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
    answerPreviews(() => [])
  })

  test('the injected text is echoed back through onChangeText, which saves it as the draft', async () => {
    let handles: InputHandles | undefined
    renderComposerWithProbe(h => (handles = h))

    act(() => {
      handles?.input.dispatch.injectIntoInput('echoed')
    })

    expect((await sent(saveDraft)).map(p => p.text as string)).toContain('echoed')
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

      expect((await getLastPost())?.body).toBe('going out')
      expect(mockInput.text).toBe('')
      expect(clears).toEqual(['going out'])
    } finally {
      jest.useRealTimers()
    }
  })

  test('a canceled stellar send puts the text back into the input', async () => {
    const post = holdPostText()
    let handles: InputHandles | undefined
    renderComposerWithProbe(h => (handles = h))

    act(() => {
      handles?.input.dispatch.sendComposerText('+1xlm@testuser')
    })
    await act(flushPromises)
    expect(post.held).toHaveLength(1)
    expect(mockInput.text).toBe('')
    await post.cancel()

    expect(mockInput.text).toBe('+1xlm@testuser')
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
})

describe('focusing the composer from the thread', () => {
  // what the list and the unfurl preview call to put the user back in the composer
  const renderWithThreadRefs = () => {
    let focusInput: (() => void) | undefined
    const FocusProbe = (p: {onRender: (focus: () => void) => void}) => {
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
    const utils = render(tree(true), {wrapper: Nav})
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

describe('reply', () => {
  const replyOrdinal = T.Chat.numberToOrdinal(1201)
  const installThread = (threadSearch?: {query?: string}, conversationIDKey = convID) => {
    // a phone: the thread screen sits in the root stack above the tabs
    const nav = showRoute({
      layout: 'phone',
      rootState: makeRootState({above: [{name: 'chatConversation', params: {conversationIDKey, threadSearch}}]}),
      route: 'chatConversation',
    })
    // the listeners our code holds on the container right now: what it asked of the
    // library, not a model of it
    let stateListeners = 0
    const addListener = navigationRef.addListener.bind(navigationRef)
    jest.spyOn(navigationRef, 'addListener').mockImplementation(((type: 'state', cb: () => void) => {
      const unsub = addListener(type, cb)
      stateListeners++
      let subscribed = true
      return () => {
        if (subscribed) {
          subscribed = false
          stateListeners--
        }
        unsub()
      }
    }) as typeof navigationRef.addListener)
    return {...nav, listenerCount: () => stateListeners}
  }
  // the phone message menu, a modal route, opened above the thread once it is up, as a long press
  // does; it is still up when Reply runs. (A thread that starts under a modal is paused from its
  // first render, so it never runs.)
  const openMenu = (nav: ReturnType<typeof installThread>) => {
    act(() => {
      navigationRef.navigate('chatMessagePopup', {conversationIDKey: convID, messageID: T.Chat.numberToMessageID(1201)})
    })
    nav.clearActions()
  }
  const threadParams = (nav: ReturnType<typeof installThread>) =>
    NavTree.visibleScreen(nav.getRootState(), {includeModals: false})?.params as {threadSearch?: object} | undefined

  test('quotes the message, closes thread search and focuses the composer', () => {
    const nav = installThread({query: 'needle'})
    const {composerInput, result} = renderInput()

    act(() => {
      result.current.dispatch.reply(replyOrdinal)
    })

    expect(result.current.replyTo).toBe(replyOrdinal)
    expect(threadParams(nav)?.threadSearch).toBeUndefined()
    expect(composerInput.focusCount).toBe(1)
  })

  test('under the message menu, closes search behind it and focuses only once the menu is gone', () => {
    const nav = installThread({query: 'needle'})
    const {composerInput, result} = renderInput()
    openMenu(nav)

    act(() => {
      result.current.dispatch.reply(replyOrdinal)
    })
    expect(result.current.replyTo).toBe(replyOrdinal)
    expect(threadParams(nav)?.threadSearch).toBeUndefined()
    expect(composerInput.focusCount).toBe(0)

    act(() => {
      clearModals()
    })

    expect(NavTree.modalStack(nav.getRootState())).toEqual([])
    expect(composerInput.focusCount).toBe(1)
  })

  // one wait at a time: a Reply replaces the one before it
  test('a second Reply under the menu leaves one wait, and focuses once', () => {
    const nav = installThread({query: 'needle'})
    const {composerInput, result} = renderInput()
    openMenu(nav)

    act(() => {
      result.current.dispatch.reply(replyOrdinal)
    })
    act(() => {
      result.current.dispatch.reply(replyOrdinal)
    })
    expect(nav.listenerCount()).toBe(1)

    act(() => {
      clearModals()
    })

    expect(composerInput.focusCount).toBe(1)
    expect(nav.listenerCount()).toBe(0)
  })

  // a menu gone much later is no longer the moment the user asked for the keyboard
  test('a menu that stays up past a second drops the focus', () => {
    const nav = installThread({query: 'needle'})
    const {composerInput, result} = renderInput()
    openMenu(nav)
    // Only the wait's own clock is faked. The stack pauses a covered screen on a timer of its own,
    // which runs the thread's effect cleanups, and those drop the wait too; a phone's native stack
    // keeps the screen under a modal running, so that timer must not fire here.
    jest.useFakeTimers()
    try {
      act(() => {
        result.current.dispatch.reply(replyOrdinal)
      })

      act(() => {
        jest.advanceTimersByTime(1001)
      })
      expect(nav.listenerCount()).toBe(0)
      act(() => {
        clearModals()
      })

      expect(composerInput.focusCount).toBe(0)
    } finally {
      jest.useRealTimers()
    }
  })

  test('leaving the conversation drops the wait', () => {
    const nav = installThread({query: 'needle'})
    const {result, unmount} = renderInput()
    openMenu(nav)
    act(() => {
      result.current.dispatch.reply(replyOrdinal)
    })
    expect(nav.listenerCount()).toBe(1)

    unmount()

    expect(nav.listenerCount()).toBe(0)
  })

  // mobile thread search shows in place of the composer, so a Reply from a hit finds no input;
  // closing search brings the composer back
  test('with no input attached, the input is focused once the composer comes back', () => {
    installThread({query: 'needle'})
    const composerInput = nextField()
    let dispatch: ConversationInputState['dispatch'] | undefined
    const tree = (showInput: boolean) => (
      <ConversationThreadProvider id={convID}>
        <ConversationInputProvider id={convID}>
          {showInput && <ComposerField onInput={composerInput.onInput} />}
          <InputProbe onRender={h => (dispatch = h.input.dispatch)} />
        </ConversationInputProvider>
      </ConversationThreadProvider>
    )
    const {rerender} = render(tree(false), {wrapper: Nav})

    act(() => {
      dispatch?.reply(replyOrdinal)
    })
    expect(composerInput.focusCount).toBe(0)
    act(() => {
      rerender(tree(true))
    })

    expect(composerInput.focusCount).toBe(1)
  })

  // the search UI unmounting is what cancels its search, once
  test('closing thread search leaves cancelling the search to the search UI', async () => {
    const nav = installThread({query: 'needle'})
    const {result} = renderInput()

    act(() => {
      result.current.dispatch.reply(replyOrdinal)
    })

    expect(threadParams(nav)?.threadSearch).toBeUndefined()
    expect(await sent('chat.1.local.cancelActiveSearch')).toEqual([])
  })

  test('leaves navigation alone when thread search is closed', () => {
    const nav = installThread()
    const {composerInput, result} = renderInput()

    act(() => {
      result.current.dispatch.reply(replyOrdinal)
    })

    expect(nav.actions).toEqual([])
    expect(composerInput.focusCount).toBe(1)
  })

  test("does not close another conversation's thread search", () => {
    const nav = installThread({query: 'needle'}, otherConvID)
    const {result} = renderInput()
    openMenu(nav)

    act(() => {
      result.current.dispatch.reply(replyOrdinal)
    })

    expect(nav.actions).toEqual([])
    expect(threadParams(nav)?.threadSearch).toEqual({query: 'needle'})
  })

  test('a Reply from outside the thread (setThreadInputReplyTo) does the same', () => {
    const nav = installThread({query: 'needle'})
    const {composerInput, result} = renderInput()

    act(() => {
      setThreadInputReplyTo(convID, replyOrdinal)
    })

    expect(result.current.replyTo).toBe(replyOrdinal)
    expect(threadParams(nav)?.threadSearch).toBeUndefined()
    expect(composerInput.focusCount).toBe(1)
  })

  test('clearReplyTo drops the reply and nothing else', () => {
    const nav = installThread({query: 'needle'})
    const {composerInput, result} = renderInput()
    act(() => {
      result.current.dispatch.reply(replyOrdinal)
    })
    nav.clearActions()

    act(() => {
      result.current.dispatch.clearReplyTo()
    })

    expect(result.current.replyTo).toBe(T.Chat.numberToOrdinal(0))
    expect(nav.actions).toEqual([])
    expect(composerInput.focusCount).toBe(1)
  })
})

describe('composer typing and draft RPCs', () => {
  const seedMeta = () => {
    metasReceived(
      [{...Meta.makeConversationMeta(), conversationIDKey: convID, tlfname: 'testuser,testuser-mac'}],
      undefined,
      {force: true}
    )
  }

  const type = (text: string) => {
    act(() => {
      mockPlatformInputProps?.onChangeText(text)
    })
  }
  const advance = (ms: number) => {
    act(() => {
      jest.advanceTimersByTime(ms)
    })
  }
  const typing = async () => sent(setTyping)
  const drafts = async () => sent(saveDraft)

  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test('typing is sent on the leading edge, then at most once per 1000ms while text stays non-empty', async () => {
    seedMeta()
    renderComposer()

    type('a')
    expect(await typing()).toEqual([{conversationID: convIDBytes, typing: true}])

    advance(100)
    type('ab')
    advance(100)
    type('abc')
    expect(await typing()).toHaveLength(1)

    // trailing edge of the 1000ms window
    advance(799)
    expect(await typing()).toHaveLength(1)
    advance(1)
    expect(await typing()).toHaveLength(2)
    expect((await typing()).at(-1)).toEqual({conversationID: convIDBytes, typing: true})

    advance(5000)
    expect(await typing()).toHaveLength(2)
  })

  test('emptying the composer cancels a pending typing=true and sends typing=false right away', async () => {
    seedMeta()
    renderComposer()

    type('a')
    advance(100)
    type('ab')
    advance(100)
    type('')
    expect(await typing()).toEqual([
      {conversationID: convIDBytes, typing: true},
      {conversationID: convIDBytes, typing: false},
    ])

    // the cancelled trailing typing=true never goes out
    advance(5000)
    expect(await typing()).toHaveLength(2)
  })

  test('the draft is saved with the conversation id, text and tlf name, throttled to one trailing save per 200ms', async () => {
    seedMeta()
    renderComposer()

    type('a')
    expect(await drafts()).toEqual([
      {conversationID: convIDBytes, text: 'a', tlfName: 'testuser,testuser-mac'},
    ])
    // the local meta draft is updated alongside the save
    expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe('a')

    advance(50)
    type('ab')
    advance(50)
    type('abc')
    expect(await drafts()).toHaveLength(1)

    advance(100)
    expect(await drafts()).toEqual([
      {conversationID: convIDBytes, text: 'a', tlfName: 'testuser,testuser-mac'},
      {conversationID: convIDBytes, text: 'abc', tlfName: 'testuser,testuser-mac'},
    ])
    expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe('abc')

    advance(1000)
    expect(await drafts()).toHaveLength(2)
  })

  test('a pending draft is flushed with its params on unmount', async () => {
    fake.answer('chat.1.local.requestInboxUnbox', () => null)
    seedMeta()
    const {unmount} = renderComposer()

    type('a')
    type('ab')
    expect(await drafts()).toHaveLength(1)
    unmount()
    expect((await drafts()).at(-1)).toEqual({
      conversationID: convIDBytes,
      text: 'ab',
      tlfName: 'testuser,testuser-mac',
    })
  })

  const switchToSecondAccount = () => {
    act(() => {
      useCurrentUserState.getState().dispatch.setBootstrap({
        deviceID: 'device-id-2',
        deviceName: 'test-device-2',
        uid: 'uid-2',
        username: 'testuser-mac',
      })
    })
  }

  test('after an account switch the composer left from the old account neither saves nor updates the draft', async () => {
    seedMeta()
    renderComposer()
    const oldComposer = mockPlatformInputProps
    switchToSecondAccount()

    act(() => {
      oldComposer?.onChangeText('a')
    })
    advance(1000)
    expect(await drafts()).toEqual([])
    expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe('')
  })

  test('after an account switch the composer left from the old account sends no typing', async () => {
    seedMeta()
    renderComposer()
    const oldComposer = mockPlatformInputProps
    switchToSecondAccount()

    act(() => {
      oldComposer?.onChangeText('a')
    })
    advance(1000)
    act(() => {
      oldComposer?.onChangeText('')
    })
    expect(await typing()).toEqual([])
  })

  test('after an account switch the composer is built again and saves for the new account', async () => {
    seedMeta()
    renderComposer()
    switchToSecondAccount()

    type('a')
    advance(1000)
    expect(await drafts()).toEqual([{conversationID: convIDBytes, text: 'a', tlfName: 'testuser,testuser-mac'}])
  })

  test('rejected typing and draft RPCs are only logged, and later keystrokes still send', async () => {
    const typingError = expect.objectContaining({desc: 'typing failed'}) as unknown as RPCError
    const draftError = expect.objectContaining({desc: 'draft failed'}) as unknown as RPCError
    fake.answer(setTyping, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'typing failed'))
    fake.answer(saveDraft, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'draft failed'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    seedMeta()
    renderComposer()

    type('a')
    await act(async () => {
      await flushPromises()
    })
    expect(error).toHaveBeenCalledWith('ignorePromise error', typingError)
    expect(error).toHaveBeenCalledWith('ignorePromise error', draftError)
    // the optimistic local draft is not rolled back
    expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe('a')

    advance(2000)
    type('ab')
    expect(await typing()).toHaveLength(2)
    expect(await drafts()).toHaveLength(2)
    expect((await drafts()).at(-1)).toEqual({
      conversationID: convIDBytes,
      text: 'ab',
      tlfName: 'testuser,testuser-mac',
    })
    await act(async () => {
      await flushPromises()
    })
  })
})
