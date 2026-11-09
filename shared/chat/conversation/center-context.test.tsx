/** @jest-environment jsdom */
/// <reference types="jest" />
import * as React from 'react'
import * as T from '@/constants/types'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import HiddenString from '@/util/hidden-string'
import {makeConversationMeta} from '@/constants/chat/meta'
import {makeMessageText} from '@/constants/chat/message'
import {act, cleanup, render, screen} from '@testing-library/react'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {tick} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'
import {
  ConversationCenterProvider,
  useConversationCenter,
  useConversationCenterActions,
  useConversationRecenterVersion,
} from './center-context'
import {ConversationThreadProvider, useConversationThreadActions} from './thread-context'
import {ConversationThreadLoadStatusProvider} from './thread-load-status-context'
import {closeConversationThreadSearch, toggleConversationThreadSearch} from './thread-navigation'
import {ConversationInputProvider} from './input-area/input-state'
import {useComposerInput} from './input-area/composer'
import {Input} from './input-area/normal/input'
import {setInputIntent, useInputIntentState} from './input-intent-store'

// input.tsx pulls in the native-only halves of the input bar at module scope
jest.mock('@/chat/audio/audio-recorder.native', () => ({__esModule: true, default: () => null}))
jest.mock('@/chat/audio/audio-send.native', () => ({AudioSendWrapper: () => null}))
jest.mock('@/util/expo-document-picker.native', () => ({pickDocumentsAsync: jest.fn()}))

const convX = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convY = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

const getThreadNonblock = 'chat.1.local.getThreadNonblock'
const markAsRead = 'chat.1.local.markAsReadLocal'
const updateUnsentText = 'chat.1.local.updateUnsentText'

let fake: FakeEngine
// the thread loads the center provider asks the service for; held, as only the asking is read here
let loads: ReturnType<FakeEngine['hold']>
// the asks reach the service a macrotask after they are made
const delivered = async () => {
  await act(async () => {
    for (let i = 0; i < 4; i++) await tick()
  })
}
const pivots = async () => {
  await delivered()
  return loads.map(l => (l.params as {query: {messageIDControl: T.RPCChat.MessageIDControl}}).query.messageIDControl)
}

let seenHighlightOrdinal: T.Chat.Ordinal | undefined
let seenCenteredOrdinal: T.Chat.Ordinal | undefined
let seenRecenterVersion: number | undefined
let threadActions: ReturnType<typeof useConversationThreadActions> | undefined
// centerOnMessage as the first render gave it, held the way search holds it
let firstCenterOnMessage: ReturnType<typeof useConversationCenterActions>['centerOnMessage'] | undefined

const Probe = () => {
  const {centeredHighlightOrdinal, centeredOrdinal} = useConversationCenter()
  const recenterVersion = useConversationRecenterVersion()
  const actions = useConversationThreadActions()
  const {centerOnMessage} = useConversationCenterActions()
  const [firstCenter] = React.useState(() => centerOnMessage)
  // captured in an effect, not during render: assigning module state while rendering is the
  // side effect react-hooks/globals rejects
  React.useEffect(() => {
    seenHighlightOrdinal = centeredHighlightOrdinal
    seenCenteredOrdinal = centeredOrdinal
    seenRecenterVersion = recenterVersion
    threadActions = actions
    firstCenterOnMessage = firstCenter
  })
  return null
}

// the composer's input as the input bar mounts it, which shows what reaches the composer
const ComposerInput = () => {
  const {setInput, textChanged} = useComposerInput(undefined, false)
  return <Input multiline={true} onChangeText={textChanged} ref={setInput} />
}
const composerText = () => (screen.getByTestId(TestIDs.CHAT_INPUT) as unknown as {value: string}).value

// The real tree order: ConversationCenterProvider wraps ConversationInputProvider, so the input
// provider's consume effect runs FIRST. If either provider claimed the other's intent types, the
// input provider would silently eat every highlight.
const renderTree = (threadSearch?: {query?: string}) => {
  const {wrapper: Nav} = navigationWrapper({params: {conversationIDKey: convX, threadSearch}, route: 'chatRoot'})
  return render(
    <Nav>
      <ConversationThreadProvider id={convX}>
        {/* the thread's window is not what is under test, so selecting it loads nothing itself */}
        <ConversationThreadLoadStatusProvider id={convX} skipThreadLoadOnSelection={true}>
          <ConversationCenterProvider id={convX}>
            <ConversationInputProvider id={convX}>
              <Probe />
              <ComposerInput />
            </ConversationInputProvider>
          </ConversationCenterProvider>
        </ConversationThreadLoadStatusProvider>
      </ConversationThreadProvider>
    </Nav>
  )
}

const highlight = (n: number) => ({messageID: T.Chat.numberToMessageID(n), type: 'highlight'}) as const

// How many times the thread marks read once a latest-page load arms it: none while mark read is
// blocked.
const markReadsAfterLatestLoad = async () => {
  act(() => {
    threadActions?.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: true,
      fullPass: true,
      messages: [
        makeMessageText({
          author: 'testuser2',
          conversationIDKey: convX,
          id: T.Chat.numberToMessageID(10),
          ordinal: T.Chat.numberToOrdinal(10),
          text: new HiddenString('message 10'),
        }),
      ],
      moreToLoad: false,
      scrollDirection: 'none',
    })
  })
  act(() => {
    threadActions?.markThreadAsRead()
  })
  await delivered()
  return fake.calls.filter(c => c.method === markAsRead).length
}

beforeEach(() => {
  fake = installFakeEngine()
  loads = fake.hold(getThreadNonblock)
  fake.answer(markAsRead, () => undefined)
  fake.answer(updateUnsentText, () => undefined)
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  metasReceived([
    {
      ...makeConversationMeta(),
      conversationIDKey: convX,
      maxVisibleMsgID: T.Chat.numberToMessageID(20),
      readMsgID: T.Chat.numberToMessageID(0),
      trustedState: 'trusted',
    },
  ])
  seenHighlightOrdinal = undefined
  seenCenteredOrdinal = undefined
  seenRecenterVersion = undefined
  threadActions = undefined
  firstCenterOnMessage = undefined
})

afterEach(() => {
  cleanup()
  act(() => {
    resetAllStores()
  })
})

test('a highlight written before mount is consumed on mount', async () => {
  setInputIntent(convX, highlight(42))

  renderTree()

  expect(await pivots()).toEqual([
    expect.objectContaining({mode: T.RPCChat.MessageIDControlMode.centered, pivot: T.Chat.numberToMessageID(42)}),
  ])
  expect(seenHighlightOrdinal).toBe(T.Chat.numberToOrdinal(42))
  expect(useInputIntentState.getState().intents.has(convX)).toBe(false)
  // a highlight blocks mark read, so landing on an old message does not read the thread
  expect(await markReadsAfterLatestLoad()).toBe(0)
})

// the other side of the mark read check above
test('with no highlight a latest-page load marks the thread read', async () => {
  renderTree()

  expect(await markReadsAfterLatestLoad()).toBe(1)
})

test('a highlight written after mount is delivered by the subscription', async () => {
  renderTree()
  expect(await pivots()).toEqual([])

  act(() => {
    setInputIntent(convX, highlight(7))
  })

  expect(await pivots()).toEqual([expect.objectContaining({pivot: T.Chat.numberToMessageID(7)})])
  expect(seenHighlightOrdinal).toBe(T.Chat.numberToOrdinal(7))
})

// The old route-param path deduped on the messageID *value*, so jumping to a message you had
// already jumped to was a silent no-op. Delete-on-consume keys delivery to the write instead.
test('jumping twice to the same message centers both times', async () => {
  renderTree()

  act(() => {
    setInputIntent(convX, highlight(11))
  })
  act(() => {
    setInputIntent(convX, highlight(11))
  })

  expect(await pivots()).toEqual([
    expect.objectContaining({pivot: T.Chat.numberToMessageID(11)}),
    expect.objectContaining({pivot: T.Chat.numberToMessageID(11)}),
  ])
})

// A centred load around message n landing, as applyThreadLoad lands it.
const landCentredLoad = (n: number) => {
  act(() => {
    threadActions?.applyThreadLoad({
      centered: true,
      enableActiveMarkRead: false,
      fullPass: true,
      messages: [
        makeMessageText({
          author: 'testuser2',
          conversationIDKey: convX,
          id: T.Chat.numberToMessageID(n),
          ordinal: T.Chat.numberToOrdinal(n),
          text: new HiddenString(`message ${n}`),
        }),
      ],
      moreToLoad: false,
      scrollDirection: 'none',
    })
  })
}

// Search centres with 'always', through the centerOnMessage it got on its first render.
const searchSelects = (n: number) => {
  act(() => {
    firstCenterOnMessage?.(T.Chat.numberToMessageID(n), 'always')
  })
}

// Reloading would clear the thread and rebuild every row under it, the hit's highlight replaying as
// its row is rebuilt: a search hit selected automatically and then clicked flashed twice.
test('search choosing its centred hit again while it is loaded reloads nothing and asks the list to centre it', async () => {
  renderTree()
  searchSelects(11)
  expect(await pivots()).toHaveLength(1)
  landCentredLoad(11)
  const before = seenRecenterVersion

  searchSelects(11)

  expect(await pivots()).toHaveLength(1)
  expect(seenCenteredOrdinal).toBe(T.Chat.numberToOrdinal(11))
  expect(seenHighlightOrdinal).toBe(T.Chat.numberToOrdinal(11))
  expect(seenRecenterVersion).toBe((before ?? 0) + 1)
})

// A reply quote or the pinned message jumping again flashes the message again, which needs its row
// rebuilt by the reload.
test('a flashing jump to the centred message reloads around it, even with it loaded', async () => {
  renderTree()
  act(() => {
    setInputIntent(convX, highlight(11))
  })
  landCentredLoad(11)
  const before = seenRecenterVersion

  act(() => {
    setInputIntent(convX, highlight(11))
  })

  expect(await pivots()).toEqual([
    expect.objectContaining({pivot: T.Chat.numberToMessageID(11)}),
    expect.objectContaining({pivot: T.Chat.numberToMessageID(11)}),
  ])
  expect(seenRecenterVersion).toBe(before)
})

test('search choosing another hit that is loaded still reloads around it', async () => {
  renderTree()
  searchSelects(11)
  landCentredLoad(11)
  landCentredLoad(12)
  const before = seenRecenterVersion

  searchSelects(12)

  expect(await pivots()).toEqual([
    expect.objectContaining({pivot: T.Chat.numberToMessageID(11)}),
    expect.objectContaining({pivot: T.Chat.numberToMessageID(12)}),
  ])
  expect(seenRecenterVersion).toBe(before)
})

// The two-consumer collision the store's `types` filter exists for.
test('the input provider does not consume a highlight meant for the center provider', async () => {
  setInputIntent(convX, highlight(5))

  renderTree()

  expect(await pivots()).toEqual([expect.objectContaining({pivot: T.Chat.numberToMessageID(5)})])
  expect(composerText()).toBe('')
})

test('the center provider does not consume an injectText meant for the input provider', async () => {
  setInputIntent(convX, {text: 'hello', type: 'injectText'})

  renderTree()

  expect(composerText()).toBe('hello')
  expect(await pivots()).toEqual([])
  // an injected text is the draft now
  expect(fake.calls.filter(c => c.method === updateUnsentText).map(c => (c.params as {text: string}).text)).toEqual([
    'hello',
  ])
  expect(useInputIntentState.getState().intents.has(convX)).toBe(false)
})

test('a highlight for another conversation is left alone', async () => {
  setInputIntent(convY, highlight(3))

  renderTree()

  expect(await pivots()).toEqual([])
  expect(useInputIntentState.getState().intents.get(convY)).toEqual(highlight(3))
})

describe('closing thread search', () => {
  // every close (the search's own Cancel, a Reply, a send) only changes the route
  test('drops the hit it centred, and opening search again does not bring it back', () => {
    renderTree({query: 'needle'})
    act(() => {
      setInputIntent(convX, highlight(42))
    })
    expect(seenHighlightOrdinal).toBe(T.Chat.numberToOrdinal(42))

    act(() => {
      closeConversationThreadSearch(convX)
    })
    expect(seenHighlightOrdinal).toBeUndefined()
    expect(seenCenteredOrdinal).toBeUndefined()

    act(() => {
      toggleConversationThreadSearch(convX)
    })
    expect(seenHighlightOrdinal).toBeUndefined()
    expect(seenCenteredOrdinal).toBeUndefined()
  })
})
