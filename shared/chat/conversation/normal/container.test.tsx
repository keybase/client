/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, render, screen} from '@testing-library/react'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import logger from '@/logger'
import * as React from 'react'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {routeChatNotification} from '@/chat/notification-router'
import {metasReceived} from '@/chat/inbox/metadata'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {getThreadNonblock, paramsOf, threadLoadOf, type ThreadLoad} from '@/test/fake-thread-load'
import {flush, settle} from '@/test/flush'
import {navigationWrapper, type InstalledNavigation} from '@/test/navigation'
import {useShellState} from '@/stores/shell'
import {OrangeLineContext, setConversationOrangeLine} from '../orange-line-context'
import {consumeInputIntent, setInputIntent, useInputIntentState} from '../input-intent-store'
import {ConversationThreadProvider, useConversationThreadJumpToRecent} from '../thread-context'
import NormalWrapper from './container'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))
const noOrangeLine = T.Chat.numberToOrdinal(0)
const getUnreadline = 'chat.1.local.getUnreadline'
const markAsRead = 'chat.1.local.markAsReadLocal'

const makeMeta = (
  conversationIDKey: T.Chat.ConversationIDKey,
  readMsgID = 1,
  maxVisibleMsgID = 1
): T.Chat.ConversationMeta => ({
  ...Meta.makeConversationMeta(),
  conversationIDKey,
  maxVisibleMsgID: T.Chat.numberToMessageID(maxVisibleMsgID),
  readMsgID: T.Chat.numberToMessageID(readMsgID),
})

// what the inbox says about the conversation
const setMeta = (meta: T.Chat.ConversationMeta) => {
  act(() => {
    metasReceived([meta], undefined, {force: true})
  })
}

function mockNormal() {
  return React.createElement(OrangeLineContext.Consumer, {
    children: (orangeLine: T.Chat.Ordinal) =>
      React.createElement('div', {'data-testid': 'orange-line'}, String(orangeLine)),
  })
}

function mockPassthroughProvider({children}: {children: React.ReactNode}) {
  return React.createElement(React.Fragment, null, children)
}

// The thread itself and the providers around it that the orange line does not read: render stubs
jest.mock('.', () => {
  return {__esModule: true, default: mockNormal}
})

jest.mock('../team-hooks', () => {
  return {ChatTeamProvider: mockPassthroughProvider}
})

jest.mock('../center-context', () => {
  return {ConversationCenterProvider: mockPassthroughProvider}
})

jest.mock('../input-area/input-state', () => {
  return {ConversationInputProvider: mockPassthroughProvider}
})

// its focus goes through the composer, which the passthrough input provider above does not make
jest.mock('./context', () => {
  return {ThreadRefsProvider: mockPassthroughProvider}
})

jest.mock('@/common-adapters/markdown/maybe-mention/context', () => {
  return {MaybeMentionProvider: mockPassthroughProvider}
})

let fake: FakeEngine

// The thread loads the provider issues on selection: held until the test lets them land, which is
// when the thread reads as loaded
let heldLoads: Array<{params: unknown; reply: (a: unknown) => void}>
// Lands every load held so far (or only the first `count`): a full pass with the newest message,
// 5, then, once its handler has run, the answer
const landLoads = async (count?: number) => {
  const loads = heldLoads.splice(0, count ?? heldLoads.length)
  for (const held of loads) {
    const load: ThreadLoad = threadLoadOf(fake, held.params)
    await act(async () => {
      await load.full(
        JSON.stringify({
          messages: [{placeholder: {hidden: false, messageID: 5}, state: T.RPCChat.MessageUnboxedState.placeholder}],
          pagination: {last: true, num: 50},
        })
      )
    })
    await settleAll()
    held.reply({offline: false})
  }
  await settleAll()
}

const unreadlineAnswers = (...ids: ReadonlyArray<number>) => {
  const queue = [...ids]
  let last: number | undefined
  fake.answer(getUnreadline, () => {
    last = queue.length ? queue.shift() : last
    return {unreadlineID: last ?? null}
  })
}
const unreadlineAnswer = (id: number | undefined) => {
  fake.answer(getUnreadline, () => ({unreadlineID: id ?? null}))
}
const unreadlineCalls = () =>
  paramsOf(fake, getUnreadline).map((p: {convID: Uint8Array; readMsgID: number}) => [
    T.Chat.conversationIDToKey(p.convID),
    T.Chat.numberToMessageID(p.readMsgID),
  ])

const expectOrangeLine = (orangeLine: T.Chat.Ordinal) => {
  expect(screen.getByTestId('orange-line').textContent).toBe(String(orangeLine))
}

// the engine's handler timer, the hops to the service and back, and React's commits
const settleAll = async () => {
  await flush()
  await act(settle)
  await flush()
}
const flushOrangeLine = settleAll

// The engine hands the service's chatShowManageChannels to the action bus the screen subscribes to
const showManageChannels = (teamname: string) =>
  notifyEngineActionListeners({
    payload: {params: {teamname}},
    type: 'chat.1.chatUi.chatShowManageChannels',
  } as never)

const expectUnreadlineReadMsgID = (readMsgID: number) => {
  expect(unreadlineCalls().at(-1)).toEqual([convID, T.Chat.numberToMessageID(readMsgID)])
}

// the thread's jump to recent, which clears the window and reloads the newest page
const probe: {jumpToRecent?: () => void} = {}
const JumpToRecentProbe = () => {
  const jump = useConversationThreadJumpToRecent()
  React.useEffect(() => {
    probe.jumpToRecent = () => jump()
  }, [jump])
  return null
}

let nav: Omit<InstalledNavigation, 'setRootState' | 'unmount'>
let Nav: ReturnType<typeof navigationWrapper>['wrapper']
const screenFor = (id: T.Chat.ConversationIDKey) => (
  <Nav>
    <ConversationThreadProvider key={id} id={id}>
      <JumpToRecentProbe />
      <NormalWrapper />
    </ConversationThreadProvider>
  </Nav>
)
// the thread as its conversation screen mounts it; `loaded` lands its first load before returning
const renderThread = async (opts?: {id?: T.Chat.ConversationIDKey; loaded?: boolean; routeParams?: object}) => {
  const id = opts?.id ?? convID
  const {wrapper, ...recorder} = navigationWrapper({
    params: {conversationIDKey: id, ...opts?.routeParams},
    route: 'chatRoot',
  })
  nav = recorder
  Nav = wrapper
  const rendered = render(screenFor(id))
  await settleAll()
  if (opts?.loaded ?? true) {
    await landLoads()
  }
  return {...rendered, rerenderThread: (next: T.Chat.ConversationIDKey) => rendered.rerender(screenFor(next))}
}

beforeEach(() => {
  fake = installFakeEngine()
  heldLoads = fake.hold(getThreadNonblock)
  fake.answer(markAsRead, () => {})
  // selecting the thread asks the inbox to unbox its row
  fake.answer('chat.1.local.requestInboxUnbox', () => {})
  probe.jumpToRecent = undefined
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  metasReceived([makeMeta(convID)], undefined, {force: true})
  useShellState.setState({active: true, appFocused: true, mobileAppState: 'active'})
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

const switchAccount = () => {
  act(() => {
    useCurrentUserState.getState().dispatch.setBootstrap({
      deviceID: 'device-id2',
      deviceName: 'testuser-mac',
      uid: 'uid2',
      username: 'testuser2',
    })
  })
}

// lands the thread load the visible screen issued, with the shell in another state so the screen
// re-renders, as the loaded flip and an app-state change did in the app
const landLoadsAndBackground = async () => {
  act(() => {
    useShellState.setState({mobileAppState: 'background'})
  })
  await landLoads()
}

test('orange line stays fixed across unreadline refreshes while the thread stays mounted', async () => {
  const initialOrangeLine = T.Chat.numberToOrdinal(10)
  unreadlineAnswers(10, 20, 30)

  await renderThread()
  expectOrangeLine(initialOrangeLine)

  act(() => {
    useShellState.setState({active: false})
  })
  await flushOrangeLine()
  expectOrangeLine(initialOrangeLine)

  setMeta(makeMeta(convID, 1, 30))
  await flushOrangeLine()
  expectOrangeLine(initialOrangeLine)
})

test('orange line resets after switching to another thread', async () => {
  unreadlineAnswers(10, 40)

  const {rerenderThread} = await renderThread()
  expectOrangeLine(T.Chat.numberToOrdinal(10))

  setMeta(makeMeta(otherConvID, 1, 40))
  rerenderThread(otherConvID)
  await settleAll()
  await landLoads()

  expectOrangeLine(T.Chat.numberToOrdinal(40))
})

test('loaded gate defers fetching the orange line until the thread has loaded', async () => {
  unreadlineAnswer(12)

  await renderThread({loaded: false})
  expect(unreadlineCalls()).toEqual([])
  expectOrangeLine(noOrangeLine)

  await landLoadsAndBackground()

  expect(unreadlineCalls()).toHaveLength(1)
  expectOrangeLine(T.Chat.numberToOrdinal(12))
})

test('initial load uses the read message ID from mount even if meta changes before load', async () => {
  unreadlineAnswer(15)
  setMeta(makeMeta(convID, 5))

  await renderThread({loaded: false})
  setMeta(makeMeta(convID, 99))
  await landLoadsAndBackground()

  expect(unreadlineCalls()).toHaveLength(1)
  expectUnreadlineReadMsgID(5)
  expectOrangeLine(T.Chat.numberToOrdinal(15))
})

test('the read position is latched when localization lands, not when the load finishes', async () => {
  // The DB-nuke order: the conversation is unlocalized and the thread is still loading, so the
  // loaded gate skips the fetch when localization lands. The load then finishing flips `loaded`
  // and issues mark-read in the same breath, so by the next render the meta can already carry the
  // advanced read position. Asking the service about that one puts the unreadline at the newest
  // message and the thread shows no divider at all; the position from the moment localization
  // landed is the only one that means anything here.
  unreadlineAnswer(6)
  setMeta(makeMeta(convID, -1))

  await renderThread({loaded: false})
  expect(unreadlineCalls()).toEqual([])

  // Localization lands while the thread load is still in flight.
  setMeta(makeMeta(convID, 5, 9))
  await flushOrangeLine()
  expect(unreadlineCalls()).toEqual([])

  // The load finishes, and the mark-read it issues has already moved the read position.
  setMeta(makeMeta(convID, 9, 9))
  await landLoads()

  expect(unreadlineCalls()).toHaveLength(1)
  expectUnreadlineReadMsgID(5)
  expectOrangeLine(T.Chat.numberToOrdinal(6))
})

test('a thread reload does not refetch the orange line against the stale mount read position', async () => {
  unreadlineAnswer(0)
  setMeta(makeMeta(convID, 2606, 2606))

  await renderThread()

  expect(unreadlineCalls()).toHaveLength(1)
  expectUnreadlineReadMsgID(2606)
  expectOrangeLine(noOrangeLine)

  // you send a message; searching clears the thread and jumping to recent reloads it
  setMeta(makeMeta(convID, 2607, 2607))
  unreadlineAnswer(2607)
  act(() => {
    probe.jumpToRecent?.()
  })
  await settleAll()
  expect(heldLoads).toHaveLength(1)
  await landLoads()

  expect(unreadlineCalls()).toHaveLength(1)
  expectOrangeLine(noOrangeLine)
})

test('an unknown read position draws no orange line rather than one above everything', async () => {
  // A negative read position means the conversation's meta has not landed yet
  // (emptyConversationMeta reads -1), which a DB nuke makes the norm. The old code clamped it to 0,
  // and the service answers 0 with "everything is unread", pinning the line above the oldest
  // message - and since the state is set once, that answer used to stick for the life of the mount.
  // 0 itself is a real read position and is still asked about; see the zero-value test below.
  unreadlineAnswer(8)
  setMeta(makeMeta(convID, -5))

  await renderThread()

  expect(unreadlineCalls()).toEqual([])
  expectOrangeLine(noOrangeLine)
})

test('an unknown read position is not asked about', async () => {
  // -1 is emptyConversationMeta's "not localized yet", the norm right after a DB nuke. The old code
  // clamped it to 0, so the service answered "everything is unread" and pinned the line above the
  // oldest message - and since the state is set once, that answer stuck.
  unreadlineAnswer(8)
  setMeta(makeMeta(convID, -1))

  await renderThread()

  expect(unreadlineCalls()).toEqual([])
  expectOrangeLine(noOrangeLine)
})

test('an inactive conversation with an unknown read position is not asked about either', async () => {
  // The inactive refresh passes the live readMsgID rather than the mount-time one, so it reaches
  // loadOrangeLine with -1 directly and needs its own guard.
  unreadlineAnswer(8)
  setMeta(makeMeta(convID, -1))
  useShellState.setState({active: false})

  await renderThread()

  expect(unreadlineCalls()).toEqual([])
})

test('a zero read position is a real answer and is still asked about', async () => {
  // ReaderInfo reports 0 for a conversation you have genuinely never read - every first open of a
  // new channel or DM. "Everything is unread" is the correct answer there, so suppressing the
  // request would silently drop the orange line for exactly those conversations. Only a negative
  // read position means "not known yet".
  unreadlineAnswer(8)
  setMeta(makeMeta(convID, 0))

  await renderThread()

  expect(unreadlineCalls()).toContainEqual([convID, T.Chat.numberToMessageID(0)])
})

test('zero unreadline responses render as no orange line', async () => {
  unreadlineAnswer(0)
  await renderThread()
  expectOrangeLine(noOrangeLine)
})

test('missing unreadline responses render as no orange line', async () => {
  unreadlineAnswer(undefined)
  await renderThread()
  expectOrangeLine(noOrangeLine)
})

test('an explicit orange line sets the line when no line exists yet', async () => {
  unreadlineAnswer(30)
  const localOrdinal = T.Chat.numberToOrdinal(50.001)

  await renderThread({loaded: false})

  expect(unreadlineCalls()).toEqual([])
  expectOrangeLine(noOrangeLine)

  act(() => {
    setConversationOrangeLine(convID, localOrdinal)
  })

  expectOrangeLine(localOrdinal)
})

test('explicit orange line requests from outside the thread move an existing orange line', async () => {
  unreadlineAnswer(10)
  await renderThread()
  expectOrangeLine(T.Chat.numberToOrdinal(10))

  act(() => {
    setConversationOrangeLine(convID, T.Chat.numberToOrdinal(50))
  })

  expectOrangeLine(T.Chat.numberToOrdinal(50))
})

test('explicit orange line requests for other threads are ignored', async () => {
  unreadlineAnswer(10)
  await renderThread()
  expectOrangeLine(T.Chat.numberToOrdinal(10))

  act(() => {
    setConversationOrangeLine(otherConvID, T.Chat.numberToOrdinal(50))
  })

  expectOrangeLine(T.Chat.numberToOrdinal(10))
})

test('stale explicit orange line requests from before mount do not override the loaded line', async () => {
  act(() => {
    setConversationOrangeLine(convID, T.Chat.numberToOrdinal(50))
  })
  unreadlineAnswer(10)

  await renderThread()

  expectOrangeLine(T.Chat.numberToOrdinal(10))
})

test('orange line captured while active is hidden while the mobile app state is non-active', async () => {
  unreadlineAnswer(10)
  await renderThread()
  expectOrangeLine(T.Chat.numberToOrdinal(10))

  act(() => {
    useShellState.setState({mobileAppState: 'background'})
  })
  expectOrangeLine(noOrangeLine)

  act(() => {
    useShellState.setState({mobileAppState: 'active'})
  })
  expectOrangeLine(T.Chat.numberToOrdinal(10))
})

test('inactive unreadline refreshes use the latest read message ID', async () => {
  unreadlineAnswer(0)
  await renderThread()

  expect(unreadlineCalls()).toHaveLength(1)
  expectUnreadlineReadMsgID(1)

  setMeta(makeMeta(convID, 7, 30))
  act(() => {
    useShellState.setState({active: false})
  })
  await flushOrangeLine()

  expect(unreadlineCalls()).toHaveLength(2)
  expectUnreadlineReadMsgID(7)
})

test('active max visible message changes do not refresh the orange line', async () => {
  unreadlineAnswer(10)
  await renderThread()

  setMeta(makeMeta(convID, 2, 30))
  await flushOrangeLine()

  expect(unreadlineCalls()).toHaveLength(1)
  expectOrangeLine(T.Chat.numberToOrdinal(10))
})

// What the real load-status provider does with NormalWrapper's options: on selection it loads the
// thread (reason 'focused') unless told to skip it, and the load may mark the thread read.
const loadReasons = () => paramsOf(fake, getThreadNonblock).map((p: {reason: number}) => p.reason)

// skipThreadLoadOnSelection only: a pending highlight means the center provider is about to issue
// a centered load, so the plain 'focused' load would be a wasted fetch.
//
// allowMarkReadOnLoad must stay TRUE here. It is read live by reloadStaleThread on every
// ChatThreadsStale/ChatInboxSynced, and the highlight's mark-read block lives in thread-context,
// which releases it once the user scrolls to the latest message or jumps to recent. Deriving this
// prop from the one-shot highlight froze it past that release: after jumping to a message and
// scrolling to the bottom, the next stale reload (mobile background -> foreground is the everyday
// trigger) came back with allowMarkAsRead:false and the conversation stayed badged as unread.
test('a pending highlight intent skips thread load but leaves mark-read allowed', async () => {
  unreadlineAnswer(0)
  setMeta(makeMeta(convID, 1, 5))
  setInputIntent(convID, {messageID: T.Chat.numberToMessageID(123), type: 'highlight'})

  await renderThread({loaded: false})
  expect(loadReasons()).toEqual([])

  // a stale-thread reload, the everyday trigger, still marks the thread read
  fake.answer('chat.1.local.getInboxNonblock', () => ({}))
  act(() => {
    routeChatNotification({
      payload: {params: {updates: [{convID: T.Chat.keyToConversationID(convID), updateType: 0}]}},
      type: 'chat.1.NotifyChat.ChatThreadsStale',
    } as never)
  })
  await settleAll()
  expect(loadReasons()).toHaveLength(1)
  await landLoads()
  expect(paramsOf(fake, markAsRead)).toEqual([
    expect.objectContaining({conversationID: T.Chat.keyToConversationID(convID), forceUnread: false}),
  ])
})

// Peek, not consume: ConversationCenterProvider (a stub here) is the real consumer, so the intent
// has to survive NormalWrapper's read.
test('reading the pending highlight leaves it in the store for the center provider', async () => {
  setInputIntent(convID, {messageID: T.Chat.numberToMessageID(123), type: 'highlight'})

  await renderThread({loaded: false})

  expect(useInputIntentState.getState().intents.get(convID)).toEqual({
    messageID: T.Chat.numberToMessageID(123),
    type: 'highlight',
  })
})

test('no pending highlight intent does not skip thread load on selection', async () => {
  await renderThread({loaded: false})
  expect(loadReasons()).toEqual([T.RPCChat.GetThreadReason.general])
})

// A highlight for a different conversation must not change this one's load options.
test('a pending highlight for another conversation does not skip thread load on selection', async () => {
  setInputIntent(otherConvID, {messageID: T.Chat.numberToMessageID(123), type: 'highlight'})
  await renderThread({loaded: false})
  expect(loadReasons()).toHaveLength(1)
})

// The peek must run in a useState initializer keyed on the conversation, not a useMemo React may
// drop and recompute: a recompute after ConversationCenterProvider consumed reads an empty mailbox.
// Re-rendering with the intent already consumed must not change what the provider was mounted with.
test('the mount-time highlight decision survives a re-render after the intent is consumed', async () => {
  setInputIntent(convID, {messageID: T.Chat.numberToMessageID(123), type: 'highlight'})

  const {rerenderThread} = await renderThread({loaded: false})
  // ConversationCenterProvider is a stub here, so drain the mailbox the way it would
  act(() => {
    consumeInputIntent(convID, ['highlight'])
  })
  rerenderThread(convID)
  await settleAll()

  expect(loadReasons()).toEqual([])
})

test('thread search route params disable mark read without skipping thread load', async () => {
  unreadlineAnswer(0)
  setMeta(makeMeta(convID, 1, 5))

  await renderThread({routeParams: {threadSearch: {query: 'needle'}}})

  expect(loadReasons()).toHaveLength(1)
  expect(paramsOf(fake, markAsRead)).toEqual([])
})

test('without thread search the same load marks the thread read', async () => {
  unreadlineAnswer(0)
  setMeta(makeMeta(convID, 1, 5))

  await renderThread()

  expect(loadReasons()).toHaveLength(1)
  expect(paramsOf(fake, markAsRead)).toHaveLength(1)
})

describe('the manage channels action', () => {
  const teamID = 'team-id' as T.Teams.TeamID
  const expectNavigated = (navigated: boolean) => {
    if (navigated) {
      expect(nav.visibleScreen()).toMatchObject({name: 'teamAddToChannels', params: {teamID}})
    } else {
      expect(nav.visibleScreen()?.name).toBe('chatRoot')
    }
  }

  test('matching the team navigates to add channels for the team', async () => {
    setMeta({...makeMeta(convID), teamID, teamname: 'keybase'})
    await renderThread({loaded: false})
    act(() => {
      showManageChannels('keybase')
    })
    await flush()
    expectNavigated(true)
  })

  test('ignores mismatched team names', async () => {
    setMeta({...makeMeta(convID), teamID, teamname: 'keybase'})
    await renderThread({loaded: false})
    act(() => {
      showManageChannels('other-team')
    })
    await flush()
    expectNavigated(false)
  })

  test('ignores conversations without a real team ID', async () => {
    setMeta({...makeMeta(convID), teamID: T.Teams.noTeamID, teamname: 'keybase'})
    await renderThread({loaded: false})
    act(() => {
      showManageChannels('keybase')
    })
    await flush()
    expectNavigated(false)
  })

  test('ignores empty team names', async () => {
    setMeta({...makeMeta(convID), teamID, teamname: ''})
    await renderThread({loaded: false})
    act(() => {
      showManageChannels('')
    })
    await flush()
    expectNavigated(false)
  })
})

test('the unreadline request carries exactly the conversation and read position', async () => {
  unreadlineAnswer(10)
  setMeta(makeMeta(convID, 7))

  await renderThread()

  expect(paramsOf(fake, getUnreadline)).toEqual([
    {
      convID: T.Chat.keyToConversationID(convID),
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      readMsgID: 7,
    },
  ])
})

test('a rejected unreadline request is only logged, leaves no orange line, and a later refresh can still set one', async () => {
  let failed = false
  fake.answer(getUnreadline, () => {
    if (!failed) {
      failed = true
      return fakeError(T.RPCGen.StatusCode.scgeneric, 'unreadline failed')
    }
    return {unreadlineID: 15}
  })
  const error = jest.spyOn(logger, 'error').mockImplementation(() => {})

  await renderThread()

  expect(unreadlineCalls()).toHaveLength(1)
  expect(error).toHaveBeenCalledWith('ignorePromise error', expect.objectContaining({desc: 'unreadline failed'}))
  expectOrangeLine(noOrangeLine)

  // an inactive refresh asks again, and its answer fills the still-empty line
  act(() => {
    useShellState.setState({active: false})
  })
  setMeta(makeMeta(convID, 1, 20))
  await flushOrangeLine()

  expect(unreadlineCalls().length).toBeGreaterThan(1)
  expectOrangeLine(T.Chat.numberToOrdinal(15))
})

// an account switch keeps the screen up until the provider rebuilds its thread for the next account
describe('a screen whose thread has retired', () => {
  test('asks for no unread line when its load lands after it retired', async () => {
    unreadlineAnswer(10)

    await renderThread({loaded: false})
    switchAccount()
    await settleAll()
    // the retired thread's own load, not the one the next account's thread then issued
    await landLoads(1)

    expect(unreadlineCalls()).toEqual([])
    expectOrangeLine(noOrangeLine)
  })

  test('drops an unread line that answers after it retired', async () => {
    const held = fake.hold(getUnreadline)

    await renderThread()
    expect(unreadlineCalls()).toHaveLength(1)

    switchAccount()
    held[0]!.reply({unreadlineID: 10})
    await flushOrangeLine()

    // the next account's thread has its own line, which nothing asked about yet
    expectOrangeLine(noOrangeLine)
  })
})
