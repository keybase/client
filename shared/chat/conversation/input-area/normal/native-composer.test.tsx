/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import type * as T from '@/constants/types'
import type * as RTL from '@testing-library/react'
import type * as NormalInput from '.'
import type * as InputStateModule from '../input-state'
import type * as ThreadContext from '../../thread-context'
import type * as Zustand from '@/util/zustand'
import type * as UsePicker from '@/chat/emoji-picker/use-picker'
import type * as CurrentUser from '@/stores/current-user'
import type * as MessageModule from '@/constants/chat/message'
import type * as HiddenStringModule from '@/util/hidden-string'

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
jest.mock('@/chat/audio/audio-recorder.native', () => ({__esModule: true, default: () => null}))
jest.mock('@/chat/audio/audio-send.native', () => ({AudioSendWrapper: () => null}))
jest.mock('@/util/expo-document-picker.native', () => ({pickDocumentsAsync: jest.fn()}))
jest.mock('./moremenu-popup.native', () => ({__esModule: true, default: () => null}))
jest.mock('../suggestors', () => ({
  useSuggestors: (p: {onChangeText: (s: string) => void}) => ({
    onBlur: () => {},
    onChangeText: p.onChangeText,
    onFocus: () => {},
    onSelectionChange: () => {},
    popup: null,
    suggestionsShowing: false,
  }),
}))

type Modules = {
  act: typeof RTL.act
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
const Probe = () => {
  inputDispatch = m.InputState.useConversationInputDispatch(d => d)
  threadActions = m.Thread.useConversationThreadActions()
  return null
}

const renderComposer = () => {
  const {ConversationInputProvider} = m.InputState
  const {ConversationThreadProvider} = m.Thread
  const utils = m.render(
    <ConversationThreadProvider id={convID}>
      <ConversationInputProvider id={convID}>
        <m.Input />
        <Probe />
      </ConversationInputProvider>
    </ConversationThreadProvider>
  )
  return utils
}

const press = (pred: (p: {children?: unknown; testID?: string}) => boolean) => {
  const target = mockPressables.findLast(pred)
  if (!target) throw new Error('nothing to press')
  act(() => {
    target.onPress?.()
  })
}
const pressIcon = (type: 'iconfont-mention') => {
  const {iconMeta} = require('@/common-adapters/icon.constants-gen') as {
    iconMeta: Record<string, {charCode?: number}>
  }
  const glyph = String.fromCharCode(iconMeta[type]?.charCode ?? 0)
  press(p => p.children === glyph)
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
    username: 'alice',
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
  mockFocused = false
  inputDispatch = undefined
  threadActions = undefined
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

test('an insert before the input has reported a caret goes at the start of the text', () => {
  renderComposer()
  act(() => {
    input().onChangeText('abcd')
  })

  pressIcon('iconfont-mention')

  expect(input().value).toBe('@abcd')
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
          author: 'alice',
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
