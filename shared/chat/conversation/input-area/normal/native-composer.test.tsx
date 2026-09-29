/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import type * as T from '@/constants/types'
import type * as RTL from '@testing-library/react'
import type * as NormalInput from '.'
import type * as InputStateModule from '../input-state'
import type * as ComposerModule from '../composer'
import type * as ThreadContext from '../../thread-context'
import type * as Zustand from '@/util/zustand'
import type * as UsePicker from '@/chat/emoji-picker/use-picker'
import type * as CurrentUser from '@/stores/current-user'
import type * as MessageModule from '@/constants/chat/message'
import type * as HiddenStringModule from '@/util/hidden-string'
import type * as Metadata from '@/chat/inbox/metadata'
import type * as MetaModule from '@/constants/chat/meta'
import type * as FakeInput from '@/test/fake-composer-input'
import type * as LoggerModule from '@/logger'

// The composer picks its native or desktop half when its module loads, so the platform globals
// have to be flipped before anything from the app is required. isIOS stays off: the iOS theme
// needs DynamicColorIOS, which the react-native test stub does not have.
const g = globalThis as unknown as {isElectron: boolean; isIOS: boolean; isMobile: boolean}
g.isMobile = true
g.isIOS = false
g.isElectron = false

type TextInputProps = {
  onChangeText: (s: string) => void
  onSelectionChange: (e: {nativeEvent: {selection: {start: number; end: number}}}) => void
  selection?: {start: number; end?: number}
  value: string
}
let mockTextInput: TextInputProps | undefined
let mockFocused = false
let mockHWKey: ((e: {pressedKey: string}) => void) | undefined
let mockPressables: Array<{children?: unknown; onPress?: () => void; testID?: string}> = []
let mockSuggestionsShowing = false
let mockListHasSelection = true
const mockSelectSuggestion = jest.fn(() => mockListHasSelection)

jest.mock('react-native', () => {
  const actual = jest.requireActual<Record<string, unknown>>('react-native')
  const mockTextInputImpl = (p: TextInputProps & {ref?: (r: unknown) => void}) => {
    mockTextInput = p
    p.ref?.({
      blur: () => {
        mockFocused = false
      },
      clear: () => {},
      focus: () => {
        mockFocused = true
      },
      isFocused: () => mockFocused,
      setNativeProps: () => {},
    })
    return null
  }
  // host components render their children and remember anything tappable, so a test can press
  // an icon or button the way a touch would
  const mockHost = (p: {children?: unknown; onPress?: () => void; testID?: string}) => {
    if (p.onPress) mockPressables.push(p)
    return typeof p.children === 'function' ? null : (p.children ?? null)
  }
  return {
    ...actual,
    Keyboard: {dismiss: () => {}},
    Pressable: mockHost,
    Text: mockHost,
    TextInput: mockTextInputImpl,
    View: mockHost,
  }
})
jest.mock('react-native-kb', () => ({
  onHWKeyPressed: (cb: (e: {pressedKey: string}) => void) => {
    mockHWKey = cb
  },
  registerPasteImage: () => () => {},
  removeOnHWKeyPressed: () => {
    mockHWKey = undefined
  },
}))
jest.mock('@/common-adapters/reanimated', () => {
  const passthrough = (p: {children: React.ReactNode}): React.ReactNode => p.children
  return {
    __esModule: true,
    default: {View: passthrough},
    skipAnimations: true,
    useAnimatedStyle: (f: () => object) => f(),
    useSharedValue: (v: unknown) => ({get: () => v, set: () => {}, value: v}),
    withTiming: (v: unknown) => v,
  }
})
const mockAudioRecorder = jest.fn(() => null)
jest.mock('@/chat/audio/audio-recorder.native', () => ({__esModule: true, default: () => mockAudioRecorder()}))
jest.mock('@/chat/audio/audio-send.native', () => ({AudioSendWrapper: () => null}))
jest.mock('@/util/expo-document-picker.native', () => ({pickDocumentsAsync: jest.fn()}))
jest.mock('./moremenu-popup.native', () => ({__esModule: true, default: () => null}))
// the reply preview's avatar needs more of react-native than the stub has
jest.mock('../../reply-preview', () => ({__esModule: true, default: () => null}))
jest.mock('../suggestors', () => ({
  useSuggestors: (p: {onChangeText: (s: string) => void}) => ({
    getSuggestions: () => (mockSuggestionsShowing ? 'filtered' : 'none'),
    onBlur: () => {},
    onChangeText: p.onChangeText,
    onFocus: () => {},
    onSelectionChange: () => {},
    popup: null,
    selectSuggestion: mockSelectSuggestion,
    suggestionsShowing: mockSuggestionsShowing,
  }),
}))

type Modules = {
  act: typeof RTL.act
  React: typeof React
  Composer: typeof ComposerModule
  cleanup: typeof RTL.cleanup
  render: typeof RTL.render
  Input: typeof NormalInput.default
  InputState: typeof InputStateModule
  Thread: typeof ThreadContext
  T: typeof T
  resetAllStores: typeof Zustand.resetAllStores
  usePickerState: typeof UsePicker.usePickerState
  useCurrentUserState: typeof CurrentUser.useCurrentUserState
}
/* eslint-disable @typescript-eslint/no-require-imports */
const m: Modules = {
  ...(require('@testing-library/react') as Pick<Modules, 'act' | 'cleanup' | 'render'>),
  Composer: require('../composer') as typeof ComposerModule,
  React: require('react') as typeof React,
  Input: (require('.') as typeof NormalInput).default,
  InputState: require('../input-state') as Modules['InputState'],
  T: require('@/constants/types') as typeof T,
  Thread: require('../../thread-context') as Modules['Thread'],
  resetAllStores: (require('@/util/zustand') as typeof Zustand).resetAllStores,
  useCurrentUserState: (require('@/stores/current-user') as typeof CurrentUser).useCurrentUserState,
  usePickerState: (require('@/chat/emoji-picker/use-picker') as typeof UsePicker).usePickerState,
}
/* eslint-enable @typescript-eslint/no-require-imports */
const {act} = m
const {CHAT_SEND_BUTTON} = require('@/tests/e2e/shared/test-ids') as {CHAT_SEND_BUTTON: string}

const convID = m.T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

type InputDispatch = Parameters<Parameters<typeof m.InputState.useConversationInputDispatch>[0]>[0]
let inputDispatch: InputDispatch | undefined
let threadActions: ReturnType<typeof m.Thread.useConversationThreadActions> | undefined
let composer: ComposerModule.Composer | undefined
const Probe = () => {
  composer = m.Composer.useComposer()
  inputDispatch = m.InputState.useConversationInputDispatch(d => d)
  threadActions = m.Thread.useConversationThreadActions()
  return null
}

// runs in the layout phase of the commit that hands it a new run: after that commit has set and
// cleared its refs, before any of its passive effects
const InCommit = (p: {run?: () => void}) => {
  const {run} = p
  m.React.useLayoutEffect(() => {
    run?.()
  }, [run])
  return null
}

// showInput(false) unmounts only the input, as thread search does on mobile; the conversation's
// composer lives on in the provider. inCommit runs inside the commit that shows or hides it.
const renderComposer = () => {
  const {ConversationInputProvider} = m.InputState
  const {ConversationThreadProvider} = m.Thread
  const view = (show: boolean, inCommit?: () => void) => (
    <ConversationThreadProvider id={convID}>
      <ConversationInputProvider id={convID}>
        {show && <m.Input />}
        <Probe />
        <InCommit run={inCommit} />
      </ConversationInputProvider>
    </ConversationThreadProvider>
  )
  const utils = m.render(view(true))
  return {
    ...utils,
    showInput: (show: boolean, inCommit?: () => void) => utils.rerender(view(show, inCommit)),
  }
}

const press = (pred: (p: {children?: unknown; testID?: string}) => boolean) => {
  const target = mockPressables.findLast(pred)
  if (!target) throw new Error('nothing to press')
  act(() => {
    target.onPress?.()
  })
}
const iconGlyph = (type: 'iconfont-add' | 'iconfont-camera' | 'iconfont-emoji' | 'iconfont-mention') => {
  const {iconMeta} = require('@/common-adapters/icon.constants-gen') as {
    iconMeta: Record<string, {charCode?: number}>
  }
  return String.fromCharCode(iconMeta[type]?.charCode ?? 0)
}
const pressIcon = (type: 'iconfont-mention') => {
  const glyph = iconGlyph(type)
  press(p => p.children === glyph)
}
const showsIcon = (type: 'iconfont-add' | 'iconfont-camera' | 'iconfont-emoji' | 'iconfont-mention') => {
  const glyph = iconGlyph(type)
  return mockPressables.some(p => p.children === glyph)
}

// the send runs on a 0ms timer and then awaits its way to the RPC. A 0ms timer set from inside
// another timer's callback is due 1ms later under the fake clock.
const flushSend = async () => {
  await act(async () => {
    jest.advanceTimersByTime(1)
    for (let i = 0; i < 5; i++) {
      await Promise.resolve()
    }
  })
}

const input = () => {
  if (!mockTextInput) throw new Error('TextInput not rendered')
  return mockTextInput
}

const type = (text: string, caret = text.length) => {
  act(() => {
    input().onChangeText(text)
  })
  act(() => {
    input().onSelectionChange({nativeEvent: {selection: {end: caret, start: caret}}})
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(m.T.RPCChat, 'localUpdateTypingRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(m.T.RPCChat, 'localUpdateUnsentTextRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(m.T.RPCChat, 'localUnfurlPreviewLocalRpcPromise').mockResolvedValue([])
  m.useCurrentUserState.getState().dispatch.setBootstrap({
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
  m.cleanup()
  jest.useRealTimers()
  jest.restoreAllMocks()
  m.resetAllStores()
  mockTextInput = undefined
  mockPressables = []
  mockAudioRecorder.mockClear()
  mockFocused = false
  mockSuggestionsShowing = false
  mockListHasSelection = true
  mockSelectSuggestion.mockClear()
  inputDispatch = undefined
  threadActions = undefined
  composer = undefined
})

test('the mention button inserts @ at the caret with no padding', () => {
  renderComposer()
  type('abcd', 2)

  pressIcon('iconfont-mention')

  expect(input().value).toBe('ab@cd')
  expect(input().selection).toEqual({end: 3, start: 3})
})

test('a picked emoji lands at the caret followed by a space', () => {
  renderComposer()
  type('abcd', 2)

  act(() => {
    m.usePickerState.getState().dispatch.updatePickerMap('chatInput', {
      emojiStr: ':smile:',
      renderableEmoji: {aliasForCustom: ':smile:'},
    } as never)
  })

  expect(input().value).toBe('ab:smile: cd')
  expect(input().selection).toEqual({end: 10, start: 10})
  // consumed, so the same emoji can be picked again
  expect(m.usePickerState.getState().pickerMap.get('chatInput')).toBeUndefined()
})

test('an insert before the input has reported a caret goes at the end of the text', () => {
  renderComposer()
  act(() => {
    input().onChangeText('abcd')
  })

  pressIcon('iconfont-mention')

  expect(input().value).toBe('abcd@')
  expect(input().selection).toEqual({end: 5, start: 5})
})

test('hardware shift-enter inserts a newline at the caret', () => {
  renderComposer()
  type('abcd', 2)

  act(() => {
    mockHWKey?.({pressedKey: 'shift-enter'})
  })

  expect(input().value).toBe('ab\ncd')
  expect(input().selection).toEqual({end: 3, start: 3})
})

// the native input only shows reflected writes, so a suggestion preview never reaches it
test('a preview write the input does not show is not what the next send sends', async () => {
  const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener').mockResolvedValue({
    outboxID: new TextEncoder().encode('posted'),
  })
  renderComposer()
  type('hi @te')

  act(() => {
    composer?.replace({selection: {end: 12, start: 12}, text: 'hi @testuser'}, false)
  })
  expect(input().value).toBe('hi @te')
  act(() => {
    mockHWKey?.({pressedKey: 'enter'})
  })
  act(() => {
    jest.advanceTimersByTime(60)
  })
  await flushSend()

  expect(post.mock.calls[0]?.[0].params.body).toBe('hi @te')
})

const makeReadOnly = () => {
  const {metasReceived} = require('@/chat/inbox/metadata') as typeof Metadata
  const Meta = require('@/constants/chat/meta') as typeof MetaModule
  act(() => {
    metasReceived([{...Meta.makeConversationMeta(), cannotWrite: true, conversationIDKey: convID}], undefined, {
      force: true,
    })
  })
}

test('hardware shift-enter on a read-only composer inserts nothing, so enter has nothing to send', async () => {
  const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener')
  makeReadOnly()
  renderComposer()

  act(() => {
    mockHWKey?.({pressedKey: 'shift-enter'})
  })
  act(() => {
    mockHWKey?.({pressedKey: 'enter'})
  })
  act(() => {
    jest.advanceTimersByTime(60)
  })
  await flushSend()

  expect(input().value).toBe('')
  expect(post).not.toHaveBeenCalled()
})

test('hardware enter sends the text 60ms later and clears the composer', async () => {
  const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener').mockResolvedValue({
    outboxID: new TextEncoder().encode('posted'),
  })
  renderComposer()
  type('hello')

  act(() => {
    mockHWKey?.({pressedKey: 'enter'})
  })
  act(() => {
    jest.advanceTimersByTime(59)
  })
  expect(input().value).toBe('hello')

  act(() => {
    jest.advanceTimersByTime(1)
  })
  // cleared at 60ms, the send follows on the next tick
  expect(input().value).toBe('')
  expect(post).not.toHaveBeenCalled()
  await flushSend()

  expect(post).toHaveBeenCalledTimes(1)
  expect(post.mock.calls[0]?.[0].params.body).toBe('hello')
})

// Thread search unmounts the input. Its ref is cleared as that commit is made, and its passive
// effects run later; the 60ms send can fire in between (here, inside the commit). The send saves
// an empty draft at once, over the text saved as the old input went away, and its clear waits for
// the next input, so the sent text does not come back.
test('a queued send that fires as thread search hides the input does not come back as a draft', async () => {
  const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener').mockResolvedValue({
    outboxID: new TextEncoder().encode('posted'),
  })
  /* eslint-disable @typescript-eslint/no-require-imports */
  const {metasReceived, useInboxMetadataState} = require('@/chat/inbox/metadata') as typeof Metadata
  const Meta = require('@/constants/chat/meta') as typeof MetaModule
  /* eslint-enable @typescript-eslint/no-require-imports */
  act(() => {
    metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID, draft: ''}], undefined, {
      force: true,
    })
  })
  const {showInput} = renderComposer()
  type('hello')
  act(() => {
    mockHWKey?.({pressedKey: 'enter'})
  })

  showInput(false, () => {
    jest.advanceTimersByTime(60)
  })
  await flushSend()
  expect(post.mock.calls[0]?.[0].params.body).toBe('hello')
  expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe('')
  showInput(true)
  // the draft save is throttled
  act(() => {
    jest.advanceTimersByTime(200)
  })

  expect(input().value).toBe('')
  expect(composer?.getText()).toBe('')
  expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe('')
})

test('a queued send still goes out when the composer unmounts inside the 60ms, without an error', async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const logger = (require('@/logger') as typeof LoggerModule).default
  const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
  const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener').mockResolvedValue({
    outboxID: new TextEncoder().encode('posted'),
  })
  const {unmount} = renderComposer()
  type('sent while leaving')

  act(() => {
    mockHWKey?.({pressedKey: 'enter'})
  })
  unmount()
  act(() => {
    jest.advanceTimersByTime(60)
  })
  await flushSend()

  expect(post).toHaveBeenCalledTimes(1)
  expect(post.mock.calls[0]?.[0].params.body).toBe('sent while leaving')
  expect(error).not.toHaveBeenCalled()
})

// The clear a send makes after the input unmounted waits for the next input. The draft that input
// loads is the one saved as the old input unmounted, which is the text just sent, so the waiting
// clear is newer than it and still wins: the sent text does not come back as a draft.
test('a send that lands while thread search hides the input does not come back as a draft', async () => {
  const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener').mockResolvedValue({
    outboxID: new TextEncoder().encode('posted'),
  })
  const {metasReceived, useInboxMetadataState} = require('@/chat/inbox/metadata') as typeof Metadata
  const Meta = require('@/constants/chat/meta') as typeof MetaModule
  act(() => {
    metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID, draft: ''}], undefined, {
      force: true,
    })
  })
  const {showInput} = renderComposer()
  type('hello')

  act(() => {
    mockHWKey?.({pressedKey: 'enter'})
  })
  showInput(false)
  expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe('hello')
  act(() => {
    jest.advanceTimersByTime(60)
  })
  await flushSend()
  expect(post.mock.calls[0]?.[0].params.body).toBe('hello')
  showInput(true)
  // the draft save is throttled
  act(() => {
    jest.advanceTimersByTime(200)
  })

  expect(input().value).toBe('')
  expect(composer?.getText()).toBe('')
  expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe('')
})

// the queued send reads the text when the timer fires, so a keystroke inside the 60ms (the
// keyboard committing an autocorrection) is part of the message
test('the queued send picks up text that changed inside the 60ms', async () => {
  const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener').mockResolvedValue({
    outboxID: new TextEncoder().encode('posted'),
  })
  renderComposer()
  type('helo')

  act(() => {
    mockHWKey?.({pressedKey: 'enter'})
  })
  type('hello')
  act(() => {
    jest.advanceTimersByTime(60)
  })
  await flushSend()

  expect(post.mock.calls[0]?.[0].params.body).toBe('hello')
})

// the same rule as desktop Enter: an open list's highlighted suggestion is picked
test('hardware enter picks the highlighted suggestion instead of sending', async () => {
  const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener')
  mockSuggestionsShowing = true
  renderComposer()
  type('hi @te')

  act(() => {
    mockHWKey?.({pressedKey: 'enter'})
  })
  act(() => {
    jest.advanceTimersByTime(100)
  })
  await flushSend()

  expect(mockSelectSuggestion).toHaveBeenCalledTimes(1)
  expect(post).not.toHaveBeenCalled()
})

test('hardware enter with an open list that has nothing to pick queues the send', async () => {
  const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener').mockResolvedValue({
    outboxID: new TextEncoder().encode('posted'),
  })
  mockSuggestionsShowing = true
  mockListHasSelection = false
  renderComposer()
  type('hi @te')

  act(() => {
    mockHWKey?.({pressedKey: 'enter'})
  })
  act(() => {
    jest.advanceTimersByTime(60)
  })
  await flushSend()

  expect(mockSelectSuggestion).toHaveBeenCalledTimes(1)
  expect(post.mock.calls[0]?.[0].params.body).toBe('hi @te')
})

test('hardware shift-enter inserts a newline even while suggestions are showing', () => {
  mockSuggestionsShowing = true
  renderComposer()
  type('hi @te')

  act(() => {
    mockHWKey?.({pressedKey: 'shift-enter'})
  })

  expect(input().value).toBe('hi @te\n')
})

test('an unknown hardware key does nothing', async () => {
  const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener')
  renderComposer()
  type('abcd', 2)

  act(() => {
    mockHWKey?.({pressedKey: 'escape'})
  })
  act(() => {
    jest.advanceTimersByTime(100)
  })
  await flushSend()

  expect(post).not.toHaveBeenCalled()
  expect(input().value).toBe('abcd')
  expect(input().selection).toEqual({end: 2, start: 2})
})

test('hardware enter while editing sends the edit', async () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const {makeMessageText} = require('@/constants/chat/message') as typeof MessageModule
  const HiddenString = (require('@/util/hidden-string') as typeof HiddenStringModule).default
  /* eslint-enable @typescript-eslint/no-require-imports */
  const edit = jest.spyOn(m.T.RPCChat, 'localPostEditNonblockRpcPromise').mockResolvedValue({
    outboxID: new TextEncoder().encode('edited'),
  })
  const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener')
  renderComposer()
  act(() => {
    threadActions?.addMessages(
      [
        makeMessageText({
          author: 'testuser',
          conversationIDKey: convID,
          id: m.T.Chat.numberToMessageID(101),
          isEditable: true,
          ordinal: m.T.Chat.numberToOrdinal(101),
          text: new HiddenString('fix my typo'),
        }),
      ],
      {markAsRead: false}
    )
  })
  act(() => {
    inputDispatch?.setEditing(m.T.Chat.numberToOrdinal(101))
  })
  type('fixed my typo')

  act(() => {
    mockHWKey?.({pressedKey: 'enter'})
  })
  act(() => {
    jest.advanceTimersByTime(60)
  })
  await flushSend()

  expect(post).not.toHaveBeenCalled()
  expect(edit).toHaveBeenCalledTimes(1)
})

test('the send button queues the same send as hardware enter', async () => {
  const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener').mockResolvedValue({
    outboxID: new TextEncoder().encode('posted'),
  })
  renderComposer()
  type('via button')

  press(p => p.testID === CHAT_SEND_BUTTON)
  act(() => {
    jest.advanceTimersByTime(60)
  })
  await flushSend()

  expect(post.mock.calls[0]?.[0].params.body).toBe('via button')
  expect(input().value).toBe('')
})

test('an injected text lands synchronously with the caret at its end', () => {
  renderComposer()

  act(() => {
    inputDispatch?.injectIntoInput('prefilled', true)
  })

  expect(input().value).toBe('prefilled')
  expect(input().selection).toEqual({end: 9, start: 9})
  expect(mockFocused).toBe(true)
})

test('a keystroke or a caret move leaves the same input attached to the composer', () => {
  const {recordComposerAttaches} = require('@/test/fake-composer-input') as typeof FakeInput
  const attaches = recordComposerAttaches(m.Composer)
  renderComposer()
  expect(attaches).toHaveLength(1)

  type('hello')
  act(() => {
    input().onSelectionChange({nativeEvent: {selection: {end: 2, start: 2}}})
  })

  expect(attaches).toHaveLength(1)
})

test('an empty queued send does nothing', () => {
  const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener')
  renderComposer()

  act(() => {
    mockHWKey?.({pressedKey: 'enter'})
  })
  act(() => {
    jest.advanceTimersByTime(100)
  })

  expect(post).not.toHaveBeenCalled()
})

test('starting an edit fills the input and focuses it', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const {makeMessageText} = require('@/constants/chat/message') as typeof MessageModule
  const HiddenString = (require('@/util/hidden-string') as typeof HiddenStringModule).default
  /* eslint-enable @typescript-eslint/no-require-imports */
  renderComposer()
  act(() => {
    threadActions?.addMessages(
      [
        makeMessageText({
          author: 'testuser',
          conversationIDKey: convID,
          id: m.T.Chat.numberToMessageID(101),
          isEditable: true,
          ordinal: m.T.Chat.numberToOrdinal(101),
          text: new HiddenString('fix my typo'),
        }),
      ],
      {markAsRead: false}
    )
  })

  act(() => {
    inputDispatch?.setEditing(m.T.Chat.numberToOrdinal(101))
  })

  expect(input().value).toBe('fix my typo')
  expect(mockFocused).toBe(true)
})

describe('typing and the saved draft', () => {
  const typingSent = () =>
    (m.T.RPCChat.localUpdateTypingRpcPromise as unknown as jest.Mock<unknown, [{typing: boolean}]>).mock.calls.map(
      c => c[0].typing
    )
  const draftsSaved = () =>
    (m.T.RPCChat.localUpdateUnsentTextRpcPromise as unknown as jest.Mock<unknown, [{text: string}]>).mock.calls.map(
      c => c[0].text
    )
  const receiveDraft = (draft: string) => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const {metasReceived} = require('@/chat/inbox/metadata') as typeof Metadata
    const Meta = require('@/constants/chat/meta') as typeof MetaModule
    /* eslint-enable @typescript-eslint/no-require-imports */
    act(() => {
      metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID, draft}], undefined, {force: true})
    })
  }

  test('a saved draft loads without saying the user is typing, and is not saved again', () => {
    receiveDraft('saved draft')
    renderComposer()
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(input().value).toBe('saved draft')
    expect(typingSent()).toEqual([])
    expect(draftsSaved()).toEqual([])
  })

  test('an injected text says nothing about typing, and is saved as the draft', () => {
    receiveDraft('')
    renderComposer()

    act(() => {
      inputDispatch?.injectIntoInput('shared text')
    })
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(typingSent()).toEqual([])
    expect(draftsSaved()).toEqual(['shared text'])
  })

  test('what was typed in the last 200ms is saved as the input goes away', () => {
    receiveDraft('')
    const {showInput} = renderComposer()
    type('h')
    type('he')
    expect(draftsSaved()).toEqual(['h'])

    showInput(false)

    expect(draftsSaved()).toEqual(['h', 'he'])
  })

  // Leaving the conversation inside the 60ms send queue unmounts the input and the provider
  // together. The send still goes out, and the draft it leaves is empty, so the text does not come
  // back to be sent twice.
  test('a queued send that fires after the conversation is left leaves an empty draft', async () => {
    const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener').mockResolvedValue({
      outboxID: new TextEncoder().encode('posted'),
    })
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {useInboxMetadataState} = require('@/chat/inbox/metadata') as typeof Metadata
    receiveDraft('')
    const {unmount} = renderComposer()
    type('hello')
    press(p => p.testID === CHAT_SEND_BUTTON)

    unmount()
    act(() => {
      jest.advanceTimersByTime(60)
    })
    await flushSend()

    expect(post.mock.calls[0]?.[0].params.body).toBe('hello')
    expect(draftsSaved().at(-1)).toBe('')
    expect(useInboxMetadataState.getState().metas.get(convID)?.draft).toBe('')
  })

  test('typing says so, and is saved', () => {
    receiveDraft('')
    renderComposer()

    type('h')

    expect(typingSent()).toEqual([true])
    expect(draftsSaved()).toEqual(['h'])
  })
})

// An edit borrows the composer: its text is never the draft, and the draft the user had before
// it is left alone on the service and comes back when the edit ends. Same as desktop.
describe('editing and the draft', () => {
  const draftsSaved = () =>
    (m.T.RPCChat.localUpdateUnsentTextRpcPromise as unknown as jest.Mock<unknown, [{text: string}]>).mock.calls.map(
      c => c[0].text
    )
  const inboxDraft = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const {useInboxMetadataState} = require('@/chat/inbox/metadata') as typeof Metadata
    return useInboxMetadataState.getState().metas.get(convID)?.draft
  }
  const receiveDraft = (draft: string) => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const {metasReceived} = require('@/chat/inbox/metadata') as typeof Metadata
    const Meta = require('@/constants/chat/meta') as typeof MetaModule
    /* eslint-enable @typescript-eslint/no-require-imports */
    act(() => {
      metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convID, draft}], undefined, {force: true})
    })
  }
  const addMessage = () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const {makeMessageText} = require('@/constants/chat/message') as typeof MessageModule
    const HiddenString = (require('@/util/hidden-string') as typeof HiddenStringModule).default
    /* eslint-enable @typescript-eslint/no-require-imports */
    act(() => {
      threadActions?.addMessages(
        [
          makeMessageText({
            author: 'testuser',
            conversationIDKey: convID,
            id: m.T.Chat.numberToMessageID(101),
            isEditable: true,
            ordinal: m.T.Chat.numberToOrdinal(101),
            text: new HiddenString('fix my typo'),
          }),
        ],
        {markAsRead: false}
      )
    })
  }
  const startEdit = () => {
    addMessage()
    act(() => {
      inputDispatch?.setEditing(m.T.Chat.numberToOrdinal(101))
    })
  }

  test('leaving mid-edit keeps the draft the user had, and it comes back', () => {
    receiveDraft('my draft')
    const {unmount} = renderComposer()
    expect(input().value).toBe('my draft')
    startEdit()
    expect(input().value).toBe('fix my typo')
    type('fixed my typo')
    // past the throttle's trailing edge while still editing
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(draftsSaved()).toEqual([])

    unmount()
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(draftsSaved()).toEqual([])
    expect(inboxDraft()).toBe('my draft')
    renderComposer()
    expect(input().value).toBe('my draft')
  })

  test('hiding the input mid-edit saves nothing', () => {
    receiveDraft('')
    const {showInput} = renderComposer()
    startEdit()
    type('fixed my typo')

    showInput(false)
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(draftsSaved()).toEqual([])
    expect(inboxDraft()).toBe('')
  })

  test('cancelling puts back the draft the user had, and saves nothing', () => {
    receiveDraft('my draft')
    renderComposer()
    startEdit()
    type('fixed my typo')

    act(() => {
      inputDispatch?.setEditing('clear')
    })
    act(() => {
      jest.advanceTimersByTime(1000)
    })

    expect(input().value).toBe('my draft')
    expect(draftsSaved()).toEqual([])
    expect(inboxDraft()).toBe('my draft')
  })

  test('a reply is not an edit: its text is saved as the draft, and when leaving', () => {
    receiveDraft('')
    const {unmount} = renderComposer()
    addMessage()
    act(() => {
      inputDispatch?.setReplyTo(m.T.Chat.numberToOrdinal(101))
    })
    type('r')
    type('re')

    unmount()

    expect(draftsSaved()).toEqual(['r', 're'])
    expect(inboxDraft()).toBe('re')
  })
})

describe('read-only, like desktop', () => {
  // a stellar send the user cancels puts its text back even where the user can't post
  test('text put back into it shows no Send button', () => {
    makeReadOnly()
    renderComposer()

    act(() => {
      composer?.restore('+1xlm@testuser')
    })

    expect(input().value).toBe('+1xlm@testuser')
    expect(mockPressables.some(p => p.testID === CHAT_SEND_BUTTON)).toBe(false)
  })

  test('the emoji and mention buttons are hidden', () => {
    makeReadOnly()
    renderComposer()

    expect(showsIcon('iconfont-emoji')).toBe(false)
    expect(showsIcon('iconfont-mention')).toBe(false)
  })

  test('the emoji and mention buttons show where the user can post', () => {
    renderComposer()

    expect(showsIcon('iconfont-emoji')).toBe(true)
    expect(showsIcon('iconfont-mention')).toBe(true)
  })

  test('the camera, add and audio buttons are hidden', () => {
    makeReadOnly()
    renderComposer()

    expect(showsIcon('iconfont-camera')).toBe(false)
    expect(showsIcon('iconfont-add')).toBe(false)
    expect(mockAudioRecorder).not.toHaveBeenCalled()
  })

  test('the camera, add and audio buttons show where the user can post', () => {
    renderComposer()

    expect(showsIcon('iconfont-camera')).toBe(true)
    expect(showsIcon('iconfont-add')).toBe(true)
    expect(mockAudioRecorder).toHaveBeenCalled()
  })

  test('an injected text is not written, so enter has nothing to send', async () => {
    const post = jest.spyOn(m.T.RPCChat, 'localPostTextNonblockRpcListener')
    makeReadOnly()
    renderComposer()

    act(() => {
      inputDispatch?.injectIntoInput('shared text', true)
    })

    expect(input().value).toBe('')
    expect(composer?.getText()).toBe('')
    act(() => {
      mockHWKey?.({pressedKey: 'enter'})
    })
    act(() => {
      jest.advanceTimersByTime(60)
    })
    await flushSend()
    expect(post).not.toHaveBeenCalled()
  })

  test('starting an edit does not fill it', () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const {makeMessageText} = require('@/constants/chat/message') as typeof MessageModule
    const HiddenString = (require('@/util/hidden-string') as typeof HiddenStringModule).default
    /* eslint-enable @typescript-eslint/no-require-imports */
    makeReadOnly()
    renderComposer()
    act(() => {
      threadActions?.addMessages(
        [
          makeMessageText({
            author: 'testuser',
            conversationIDKey: convID,
            id: m.T.Chat.numberToMessageID(101),
            isEditable: true,
            ordinal: m.T.Chat.numberToOrdinal(101),
            text: new HiddenString('fix my typo'),
          }),
        ],
        {markAsRead: false}
      )
    })

    act(() => {
      inputDispatch?.setEditing(m.T.Chat.numberToOrdinal(101))
    })

    expect(input().value).toBe('')
    expect(composer?.getText()).toBe('')
  })

  test('a saved draft is not written into it either', () => {
    const {metasReceived} = require('@/chat/inbox/metadata') as typeof Metadata
    const Meta = require('@/constants/chat/meta') as typeof MetaModule
    act(() => {
      metasReceived(
        [{...Meta.makeConversationMeta(), cannotWrite: true, conversationIDKey: convID, draft: 'saved'}],
        undefined,
        {force: true}
      )
    })
    renderComposer()

    expect(input().value).toBe('')
    expect(composer?.getText()).toBe('')
  })
})
