/** @jest-environment jsdom */
/// <reference types="jest" />
// The thread provider's own actions, driven through the mounted provider: mark-read gating, the
// load throttle and the scroll gate, the plain store writes, and what mounting, unmounting and
// hiding the provider do to its store.
import * as React from 'react'
import * as Meta from '@/constants/chat/meta'
import * as Metadata from '@/chat/inbox/metadata'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import logger from '@/logger'
import {act, cleanup, render, renderHook} from '@testing-library/react'
import {makeMessageAttachment, makeMessageText} from '@/constants/chat/message'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useShellState} from '@/stores/shell'
import {useUsersState} from '@/stores/users'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {
  ConversationThreadProvider,
  ShownUsernameCacheContext,
  useConversationThreadActions,
  useConversationThreadJumpToRecent,
  useConversationThreadLoadMessagesCentered,
  useConversationThreadLoadNewerMessagesDueToScroll,
  useConversationThreadLoadOlderMessagesDueToScroll,
  useConversationThreadSelectedConversation,
  useConversationThreadStore,
  type ConversationThreadActions,
} from './thread-context'

// the route's focus, both as the screen last rendered it and as navigation reports it now
let mockRouteFocused = true
let mockRouteFocusedNow = true
jest.mock('@react-navigation/core', () => {
  const actual = jest.requireActual<{useNavigation: () => object}>('@react-navigation/core')
  return {
    ...actual,
    useIsFocused: () => mockRouteFocused,
    useNavigation: () => ({...actual.useNavigation(), isFocused: () => mockRouteFocusedNow}),
  }
})
const setRouteFocused = (focused: boolean) => {
  mockRouteFocused = focused
  mockRouteFocusedNow = focused
}

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const otherConvID = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))
let rpc: FakeChatRpc

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

const textAt = (n: number, over?: Partial<T.Chat.MessageText>) =>
  makeMessageText({
    author: 'testuser2',
    conversationIDKey: convID,
    id: T.Chat.numberToMessageID(n),
    ordinal: T.Chat.numberToOrdinal(n),
    text: new HiddenString(`message ${n}`),
    ...over,
  })

const setMeta = (over: Partial<T.Chat.ConversationMeta>, id = convID) => {
  Metadata.metasReceived(
    [{...Meta.makeConversationMeta(), conversationIDKey: id, readMsgID: T.Chat.numberToMessageID(0), ...over}],
    undefined,
    {force: true}
  )
}

const useHarness = () => ({
  actions: useConversationThreadActions(),
  jumpToRecent: useConversationThreadJumpToRecent(),
  loadCentered: useConversationThreadLoadMessagesCentered(),
  loadNewer: useConversationThreadLoadNewerMessagesDueToScroll(),
  loadOlder: useConversationThreadLoadOlderMessagesDueToScroll(),
  selectedConversation: useConversationThreadSelectedConversation(),
  shownUsernameCache: React.useContext(ShownUsernameCacheContext),
  store: useConversationThreadStore(),
})

const renderThread = (id = convID) => {
  const wrapper = ({children}: {children: React.ReactNode}) => (
    <ConversationThreadProvider id={id}>{children}</ConversationThreadProvider>
  )
  const rendered = renderHook(useHarness, {wrapper})
  const h = () => rendered.result.current
  const state = () => h().store.getState()
  return {h, rendered, state}
}

// What a latest-page load that may mark read leaves behind: the window, and mark read armed.
const armWith = (actions: ConversationThreadActions, messages: ReadonlyArray<T.Chat.Message>) => {
  act(() => {
    actions.applyThreadLoad({
      centered: false,
      enableActiveMarkRead: true,
      messages,
      moreToLoad: false,
      scrollDirection: 'none',
    })
  })
}

// jest.useFakeTimers reads as a hook call to the bailout check, which then flags any test body
// that also renders JSX as an uncompiled component.
const fakeTimers = () => {
  jest.useFakeTimers()
}

const markReads = () => rpc.params('markRead')
const loads = () => rpc.params('loadThread')

const run = async (f: () => void) => {
  await act(async () => {
    f()
    await flushPromises()
  })
}

type ConversationThreadStoreApi = ReturnType<typeof useConversationThreadStore>
type Probed = {actions: ConversationThreadActions; store: ConversationThreadStoreApi}
const Probe = (p: {into: (v: Probed) => void}) => {
  const {into} = p
  into({actions: useConversationThreadActions(), store: useConversationThreadStore()})
  return null
}

const HideableThread = (p: {into: (v: Probed) => void; mode: 'hidden' | 'visible'}) => {
  const {into, mode} = p
  return (
    <React.Activity mode={mode}>
      <ConversationThreadProvider id={convID}>
        <Probe into={into} />
      </ConversationThreadProvider>
    </React.Activity>
  )
}

beforeEach(() => {
  setRouteFocused(true)
  rpc = installFakeChatRpc()
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  setMeta({maxVisibleMsgID: T.Chat.numberToMessageID(20)})
})

afterEach(() => {
  cleanup()
  jest.useRealTimers()
  restoreChatRpc()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('mark read gating', () => {
  test('an armed, loaded, latest window marks read at its newest message with an id', async () => {
    const {h} = renderThread()
    armWith(h().actions, [textAt(10), textAt(12), textAt(13, {id: T.Chat.numberToMessageID(0)})])
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([{conversationIDKey: convID, forceUnread: false, msgID: 12}])
  })

  test('nothing is marked before a load arms it', async () => {
    const {h} = renderThread()
    act(() => h().actions.addMessages([textAt(10)]))
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
  })

  test('a window with no message ids marks nothing', async () => {
    const {h} = renderThread()
    armWith(h().actions, [textAt(10, {id: T.Chat.numberToMessageID(0)})])
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
  })

  test('logged out, nothing is marked', async () => {
    const {h} = renderThread()
    armWith(h().actions, [textAt(10)])
    useConfigState.setState({loggedIn: false})
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
  })

  test('an invalid conversation marks nothing', async () => {
    const {h} = renderThread(T.Chat.noConversationIDKey)
    armWith(h().actions, [textAt(10, {conversationIDKey: T.Chat.noConversationIDKey})])
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
  })

  test('a read position already at the newest message is a no-op', async () => {
    setMeta({readMsgID: T.Chat.numberToMessageID(10)})
    const {h} = renderThread()
    armWith(h().actions, [textAt(10)])
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
  })

  test('a window short of the latest message marks nothing', async () => {
    const {h} = renderThread()
    act(() => {
      h().actions.applyThreadLoad({
        centered: true,
        enableActiveMarkRead: true,
        messages: [textAt(10)],
        moreToLoad: false,
        scrollDirection: 'none',
      })
    })
    expect(h().store.getState().moreToLoadForward).toBe(true)
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
  })

  test('app focus: refused while unfocused, marked when focus comes back', async () => {
    const {h} = renderThread()
    armWith(h().actions, [textAt(10)])
    act(() => useShellState.getState().dispatch.changedFocus(false))
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
    await run(() => useShellState.getState().dispatch.changedFocus(true))
    expect(markReads()).toEqual([{conversationIDKey: convID, forceUnread: false, msgID: 10}])
  })

  test('route focus: refused while covered, marked when the route is focused again', async () => {
    const {h, rendered} = renderThread()
    armWith(h().actions, [textAt(10)])
    setRouteFocused(false)
    rendered.rerender()
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
    setRouteFocused(true)
    await run(() => rendered.rerender())
    expect(markReads()).toEqual([{conversationIDKey: convID, forceUnread: false, msgID: 10}])
  })

  test('a load that finishes while <Activity> hides the screen is not marked read; showing it again marks it', async () => {
    let actions: ConversationThreadActions | undefined
    const into = (v: Probed) => {
      actions = v.actions
    }
    const {rerender} = render(<HideableThread into={into} mode="visible" />)
    setRouteFocused(false)
    rerender(<HideableThread into={into} mode="hidden" />)
    armWith(actions!, [textAt(10)])
    await run(() => actions?.markThreadAsRead())
    expect(markReads()).toEqual([])
    setRouteFocused(true)
    await run(() => rerender(<HideableThread into={into} mode="visible" />))
    expect(markReads()).toEqual([{conversationIDKey: convID, forceUnread: false, msgID: 10}])
  })

  test('under StrictMode, showing the screen again marks read once', async () => {
    let actions: ConversationThreadActions | undefined
    const into = (v: Probed) => {
      actions = v.actions
    }
    const tree = (mode: 'hidden' | 'visible') => (
      <React.StrictMode>
        <HideableThread into={into} mode={mode} />
      </React.StrictMode>
    )
    const {rerender} = render(tree('visible'))
    setRouteFocused(false)
    rerender(tree('hidden'))
    armWith(actions!, [textAt(10)])
    setRouteFocused(true)
    await run(() => rerender(tree('visible')))
    expect(markReads()).toEqual([{conversationIDKey: convID, forceUnread: false, msgID: 10}])
  })

  test('a load that finishes after the route loses focus, before the screen renders again, is not marked read', async () => {
    const {h} = renderThread()
    mockRouteFocusedNow = false
    armWith(h().actions, [textAt(10)])
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
  })

  test('coming back into view does nothing unless a load armed mark read', async () => {
    const {h} = renderThread()
    act(() => h().actions.addMessages([textAt(10)]))
    act(() => useShellState.getState().dispatch.setActive(false))
    await run(() => useShellState.getState().dispatch.setActive(true))
    expect(markReads()).toEqual([])
  })

  test('staying in view is not a transition', async () => {
    const {h, rendered} = renderThread()
    armWith(h().actions, [textAt(10)])
    await run(() => rendered.rerender())
    expect(markReads()).toEqual([])
  })

  test('a block refuses mark read and disarms it; lifting it does not re-arm', async () => {
    const {h} = renderThread()
    armWith(h().actions, [textAt(10)])
    act(() => h().actions.setMarkReadBlocked(true))
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
    act(() => h().actions.setMarkReadBlocked(false))
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
    armWith(h().actions, [textAt(11)])
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([{conversationIDKey: convID, forceUnread: false, msgID: 11}])
  })

  test('a load cannot arm through a block, but reaching the bottom going forward lifts it', async () => {
    const {h} = renderThread()
    act(() => h().actions.setMarkReadBlocked(true))
    armWith(h().actions, [textAt(10)])
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
    act(() => {
      h().actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: true,
        messages: [textAt(11)],
        moreToLoad: false,
        scrollDirection: 'forward',
      })
    })
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([{conversationIDKey: convID, forceUnread: false, msgID: 11}])
  })

  test('a forward page with more to come keeps the block', async () => {
    const {h} = renderThread()
    act(() => h().actions.setMarkReadBlocked(true))
    act(() => {
      h().actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: true,
        messages: [textAt(11)],
        moreToLoad: true,
        scrollDirection: 'forward',
      })
    })
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
  })

  test('a load that disables mark read disarms it', async () => {
    const {h} = renderThread()
    armWith(h().actions, [textAt(10)])
    act(() => {
      h().actions.applyThreadLoad({
        centered: false,
        disableActiveMarkRead: true,
        enableActiveMarkRead: true,
        messages: [textAt(11)],
        moreToLoad: false,
        scrollDirection: 'none',
      })
    })
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
  })

  test('addMessages marks read only when asked', async () => {
    const {h} = renderThread()
    armWith(h().actions, [textAt(10)])
    await run(() => h().actions.addMessages([textAt(11)]))
    expect(markReads()).toEqual([])
    await run(() => h().actions.addMessages([textAt(12)], {markAsRead: true}))
    expect(markReads()).toEqual([{conversationIDKey: convID, forceUnread: false, msgID: 12}])
  })

  test('a reaction update asks to mark read only when it found a target', async () => {
    const {h} = renderThread()
    armWith(h().actions, [textAt(10)])
    await run(() => h().actions.updateReactions([{targetMsgID: T.Chat.numberToMessageID(99)}]))
    expect(markReads()).toEqual([])
    await run(() =>
      h().actions.updateReactions([
        {targetMsgID: T.Chat.numberToMessageID(99)},
        {reactions: new Map(), targetMsgID: T.Chat.numberToMessageID(10)},
      ])
    )
    expect(markReads()).toEqual([{conversationIDKey: convID, forceUnread: false, msgID: 10}])
  })

  test('messagesClear disarms mark read', async () => {
    const {h} = renderThread()
    armWith(h().actions, [textAt(10)])
    act(() => h().actions.messagesClear())
    act(() => h().actions.addMessages([textAt(11)]))
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([])
  })
})

describe('applyThreadLoad', () => {
  const load = (
    actions: ConversationThreadActions,
    p: Partial<Parameters<ConversationThreadActions['applyThreadLoad']>[0]>
  ) =>
    act(() => {
      actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [],
        moreToLoad: false,
        scrollDirection: 'none',
        ...p,
      })
    })

  test('each direction sets only its own more-to-load flag', () => {
    const {h, state} = renderThread()
    load(h().actions, {messages: [textAt(10)], moreToLoad: true})
    expect([state().moreToLoadBack, state().moreToLoadForward, state().loaded]).toEqual([true, false, true])
    load(h().actions, {messages: [textAt(9)], moreToLoad: false, scrollDirection: 'back'})
    expect([state().moreToLoadBack, state().moreToLoadForward]).toEqual([false, false])
    load(h().actions, {messages: [textAt(11)], moreToLoad: true, scrollDirection: 'forward'})
    expect([state().moreToLoadBack, state().moreToLoadForward]).toEqual([false, true])
  })

  test('a centered load reaching maxVisibleMsgID is the latest window when asked to check', () => {
    const {h, state} = renderThread()
    load(h().actions, {centered: true, forceContainsLatestCalc: true, messages: [textAt(20)]})
    expect(state().moreToLoadForward).toBe(false)
  })

  test('a centered load short of maxVisibleMsgID, or not asked to check, has more forward', () => {
    const {h, state} = renderThread()
    load(h().actions, {centered: true, forceContainsLatestCalc: true, messages: [textAt(19)]})
    expect(state().moreToLoadForward).toBe(true)
    const other = renderThread()
    load(other.h().actions, {centered: true, messages: [textAt(20)]})
    expect(other.state().moreToLoadForward).toBe(true)
  })

  test('an empty pass with no prune marks loaded but leaves the window undefined', () => {
    const {h, state} = renderThread()
    load(h().actions, {})
    expect(state().loaded).toBe(true)
    expect(state().messageOrdinals).toBeUndefined()
  })
})

describe('load throttle', () => {
  test('scroll loads inside 500ms collapse to the first and the last', () => {
    jest.useFakeTimers()
    const {h} = renderThread()
    act(() => {
      h().actions.loadMoreMessages({numberOfMessagesToLoad: 1, reason: 'scroll back', scrollDirection: 'back'})
      h().actions.loadMoreMessages({numberOfMessagesToLoad: 2, reason: 'scroll back', scrollDirection: 'back'})
      h().actions.loadMoreMessages({numberOfMessagesToLoad: 3, reason: 'scroll back', scrollDirection: 'back'})
    })
    expect(loads().map(p => p.pagination?.num)).toEqual([1])
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(loads().map(p => p.pagination?.num)).toEqual([1, 3])
  })

  test('a centered, message-id or jump-to-recent load runs at once and drops the pending one', () => {
    jest.useFakeTimers()
    const {h} = renderThread()
    const pending = () => {
      h().actions.loadMoreMessages({numberOfMessagesToLoad: 1, reason: 'scroll back', scrollDirection: 'back'})
      h().actions.loadMoreMessages({numberOfMessagesToLoad: 2, reason: 'scroll back', scrollDirection: 'back'})
    }
    act(pending)
    act(() => h().actions.loadMoreMessages({reason: 'jump to recent'}))
    act(pending)
    act(() =>
      h().actions.loadMoreMessages({
        messageIDControl: {mode: T.RPCChat.MessageIDControlMode.newermessages, num: 5, pivot: T.Chat.numberToMessageID(3)},
        reason: 'pivot',
      })
    )
    act(pending)
    act(() =>
      h().actions.loadMoreMessages({
        centeredMessageID: {conversationIDKey: convID, highlightMode: 'flash', messageID: T.Chat.numberToMessageID(4)},
        reason: 'centered',
      })
    )
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    // each pending pair ran its first call; none of the trailing second calls (num 2) ever ran
    expect(loads().map(p => p.pagination?.num ?? p.messageIDControl?.num)).toEqual([1, 100, 1, 5, 1, 100])
  })

  test('cancel drops the pending load', () => {
    jest.useFakeTimers()
    const {h} = renderThread()
    act(() => {
      h().actions.loadMoreMessages({numberOfMessagesToLoad: 1, reason: 'scroll back', scrollDirection: 'back'})
      h().actions.loadMoreMessages({numberOfMessagesToLoad: 2, reason: 'scroll back', scrollDirection: 'back'})
      h().actions.loadMoreMessages.cancel()
      jest.advanceTimersByTime(1000)
    })
    expect(loads()).toHaveLength(1)
  })

  test('unmounting drops the pending load', () => {
    jest.useFakeTimers()
    const {h, rendered} = renderThread()
    act(() => {
      h().actions.loadMoreMessages({numberOfMessagesToLoad: 1, reason: 'scroll back', scrollDirection: 'back'})
      h().actions.loadMoreMessages({numberOfMessagesToLoad: 2, reason: 'scroll back', scrollDirection: 'back'})
    })
    rendered.unmount()
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(loads()).toHaveLength(1)
  })
})

describe('scroll gate', () => {
  const back = () => loads().filter(p => p.pagination?.next === 'deadbeef')
  const forward = () => loads().filter(p => p.pagination?.previous === 'deadbeef')

  test('older: nothing at the top of the thread or with no rows', () => {
    const {h} = renderThread()
    act(() => h().loadOlder(5))
    expect(back()).toHaveLength(0)
    act(() => {
      h().actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [textAt(10)],
        moreToLoad: true,
        scrollDirection: 'none',
      })
    })
    act(() => h().loadOlder(0))
    expect(back()).toHaveLength(0)
    act(() => h().loadOlder(5))
    expect(back().map(p => p.pagination?.num)).toEqual([100])
  })

  test('older: the same row count inside 500ms is refused, after it or a new count is not', () => {
    jest.useFakeTimers()
    const {h} = renderThread()
    act(() => {
      h().actions.applyThreadLoad({
        centered: false,
        enableActiveMarkRead: false,
        messages: [textAt(10)],
        moreToLoad: true,
        scrollDirection: 'none',
      })
    })
    act(() => h().loadOlder(5))
    act(() => h().loadOlder(5))
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(back()).toHaveLength(1)
    act(() => h().loadOlder(5))
    expect(back()).toHaveLength(2)
    act(() => {
      jest.advanceTimersByTime(100)
      h().loadOlder(6)
      jest.advanceTimersByTime(1000)
    })
    expect(back()).toHaveLength(3)
  })

  test('newer: gated the same way, without a more-to-load check', () => {
    jest.useFakeTimers()
    const {h} = renderThread()
    act(() => h().loadNewer(0))
    expect(forward()).toHaveLength(0)
    act(() => h().loadNewer(5))
    act(() => h().loadNewer(5))
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(forward().map(p => p.pagination?.num)).toEqual([100])
  })

  test('scroll options reach the load', () => {
    const {h} = renderThread()
    const onThreadLoadStatus = jest.fn()
    rpc.on('loadThread', p => {
      p.onThreadStatus?.({typ: T.RPCChat.UIChatThreadStatusTyp.server})
      return {offline: false}
    })
    act(() => h().loadNewer(5, {onThreadLoadStatus}))
    expect(onThreadLoadStatus).toHaveBeenCalledWith(convID, T.RPCChat.UIChatThreadStatusTyp.server)
  })
})

describe('centered, jump to recent and selected conversation', () => {
  test('a centered load clears the window, drops the username cache and pivots on the message', () => {
    const {h, state} = renderThread()
    act(() => h().actions.addMessages([textAt(10)]))
    h().shownUsernameCache?.set(T.Chat.numberToOrdinal(10), 'testuser2')
    const clearVersion = state().clearVersion
    act(() => h().loadCentered(T.Chat.numberToMessageID(5), 'always'))
    expect(state().clearVersion).toBe(clearVersion + 1)
    expect(state().messageMap.size).toBe(0)
    expect(h().shownUsernameCache?.size).toBe(0)
    expect(loads().at(-1)?.messageIDControl).toEqual({
      mode: T.RPCChat.MessageIDControlMode.centered,
      num: 100,
      pivot: T.Chat.numberToMessageID(5),
    })
  })

  test('jump to recent lifts a mark-read block before it clears and reloads', async () => {
    const {h} = renderThread()
    act(() => h().actions.setMarkReadBlocked(true))
    act(() => h().jumpToRecent())
    expect(h().store.getState().windowCleared).toBe(true)
    armWith(h().actions, [textAt(10)])
    await run(() => h().actions.markThreadAsRead())
    expect(markReads()).toEqual([{conversationIDKey: convID, forceUnread: false, msgID: 10}])
  })

  test('selecting asks for an unbox, a one-on-one bio and a focused load', () => {
    const unbox = jest.spyOn(Metadata, 'unboxRows')
    const getBio = jest.fn()
    useUsersState.setState(s => ({...s, dispatch: {...s.dispatch, getBio}}))
    Metadata.participantInfoReceived(convID, {
      all: ['testuser', 'testuser2'],
      contactName: new Map(),
      name: ['testuser', 'testuser2'],
    })
    const {h} = renderThread()
    act(() => h().selectedConversation())
    expect(unbox).toHaveBeenCalledWith([convID])
    expect(getBio).toHaveBeenCalledWith('testuser2')
    expect(loads()).toHaveLength(1)
  })

  test('selecting with skipThreadLoad does not load; no bio for groups or SBS', () => {
    const getBio = jest.fn()
    useUsersState.setState(s => ({...s, dispatch: {...s.dispatch, getBio}}))
    Metadata.participantInfoReceived(convID, {
      all: ['testuser', 'someone@twitter'],
      contactName: new Map(),
      name: ['testuser', 'someone@twitter'],
    })
    const {h} = renderThread()
    act(() => h().selectedConversation({skipThreadLoad: true}))
    expect(getBio).not.toHaveBeenCalled()
    expect(loads()).toHaveLength(0)
  })
})

describe('store writes', () => {
  test('addMessages bumps the live version only for a live update', () => {
    const {h, state} = renderThread()
    act(() => h().actions.addMessages([textAt(10)]))
    expect(state().liveUpdateVersion).toBe(0)
    act(() => h().actions.addMessages([textAt(11)], {liveUpdate: true}))
    expect(state().liveUpdateVersion).toBe(1)
    expect(state().messageOrdinals).toEqual([10, 11])
  })

  test('a reaction update bumps the live version only when it found a target', () => {
    const {h, state} = renderThread()
    act(() => h().actions.addMessages([textAt(10)]))
    act(() => h().actions.updateReactions([{targetMsgID: T.Chat.numberToMessageID(99)}]))
    expect(state().liveUpdateVersion).toBe(0)
    act(() => h().actions.updateReactions([{reactions: new Map(), targetMsgID: T.Chat.numberToMessageID(10)}]))
    expect(state().liveUpdateVersion).toBe(1)
  })

  test('deleteMessages defaults to every type and bumps the live version when asked', () => {
    const {h, state} = renderThread()
    act(() => h().actions.addMessages([textAt(10), textAt(11), textAt(12)]))
    act(() => h().actions.deleteMessages({messageIDs: [T.Chat.numberToMessageID(10)]}))
    expect(state().messageOrdinals).toEqual([11, 12])
    expect(state().liveUpdateVersion).toBe(0)
    act(() => h().actions.deleteMessages({liveUpdate: true, ordinals: [T.Chat.numberToOrdinal(11)]}))
    expect(state().messageOrdinals).toEqual([12])
    expect(state().liveUpdateVersion).toBe(1)
    act(() =>
      h().actions.deleteMessages({
        deletableMessageTypes: new Set(['attachment']),
        upToMessageID: T.Chat.numberToMessageID(13),
      })
    )
    expect(state().messageOrdinals).toEqual([12])
  })

  test('explodeMessages explodes and bumps the live version when asked', () => {
    const {h, state} = renderThread()
    act(() => h().actions.addMessages([textAt(10)]))
    act(() => h().actions.explodeMessages([T.Chat.numberToMessageID(10)], 'testuser', true))
    const m = state().messageMap.get(T.Chat.numberToOrdinal(10))
    expect(m?.exploded).toBe(true)
    expect(m?.explodedBy).toBe('testuser')
    expect(state().liveUpdateVersion).toBe(1)
  })

  test('an errored outbox row is retried locally and with the service', async () => {
    const {h, state} = renderThread()
    const outboxID = T.Chat.stringToOutboxID('outbox-1')
    act(() =>
      h().actions.addMessages([
        textAt(10, {id: T.Chat.numberToMessageID(0), outboxID, submitState: 'pending'}),
      ])
    )
    act(() => h().actions.setMessageErrored(outboxID, 'nope', 3))
    let m = state().messageMap.get(T.Chat.numberToOrdinal(10))
    expect([m?.submitState, m?.errorReason, m?.errorTyp]).toEqual(['failed', 'nope', 3])
    await run(() => h().actions.retryMessage(outboxID))
    m = state().messageMap.get(T.Chat.numberToOrdinal(10))
    expect([m?.submitState, m?.errorReason]).toEqual(['pending', undefined])
    expect(rpc.calls('retryPost')).toEqual([[outboxID]])
  })

  test('retrying an outbox id the thread does not hold warns and asks nothing', async () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})
    const {h} = renderThread()
    await run(() => h().actions.retryMessage(T.Chat.stringToOutboxID('nope')))
    expect(rpc.calls('retryPost')).toEqual([])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('retryMessage: no message for outbox id'))
  })

  test('setMessageSubmitState writes the row', () => {
    const {h, state} = renderThread()
    act(() => h().actions.addMessages([textAt(10)]))
    act(() => h().actions.setMessageSubmitState(T.Chat.numberToOrdinal(10), 'editing'))
    expect(state().messageMap.get(T.Chat.numberToOrdinal(10))?.submitState).toBe('editing')
  })

  test('the optimistic reaction map is added to, decorated and removed from', () => {
    const {h, state} = renderThread()
    const outboxID = T.Chat.stringToOutboxID('r1')
    const reaction = {
      add: true,
      decorated: '',
      emoji: ':+1:',
      targetMsgID: T.Chat.numberToMessageID(10),
      targetOrdinal: T.Chat.numberToOrdinal(10),
      timestamp: 1,
      username: 'testuser',
    }
    act(() => h().actions.addOptimisticReaction(outboxID, reaction))
    act(() => h().actions.updateOptimisticReactionDecorated(outboxID, 'decorated'))
    expect(state().optimisticReactionMap.get(outboxID)).toEqual({...reaction, decorated: 'decorated'})
    const before = state()
    act(() => h().actions.updateOptimisticReactionDecorated(T.Chat.stringToOutboxID('none'), 'x'))
    expect(state()).toBe(before)
    act(() => h().actions.removeOptimisticReaction(outboxID))
    expect(state().optimisticReactionMap.size).toBe(0)
  })

  test('typing replaces the set only when it changed', () => {
    const {h, state} = renderThread()
    act(() => h().actions.setTyping(new Set(['testuser2'])))
    const first = state()
    expect([...first.typing]).toEqual(['testuser2'])
    act(() => h().actions.setTyping(new Set(['testuser2'])))
    expect(state()).toBe(first)
    act(() => h().actions.setTyping(new Set()))
    expect(state().typing.size).toBe(0)
  })

  test('payment and request info land in their maps', () => {
    const {h, state} = renderThread()
    const payment = {paymentID: 'p1'} as unknown as T.Chat.ChatPaymentInfo
    const request = {amount: '1'} as unknown as T.Chat.ChatRequestInfo
    act(() => h().actions.receivePaymentInfo(T.Chat.numberToMessageID(10), payment))
    act(() => h().actions.receiveRequestInfo(T.Chat.numberToMessageID(11), request))
    expect(state().accountsInfoMap.get(T.Chat.numberToMessageID(10))).toEqual(payment)
    expect(state().accountsInfoMap.get(T.Chat.numberToMessageID(11))).toEqual(request)
    expect(state().paymentStatusMap.get('p1' as T.Wallets.PaymentID)).toEqual(payment)
  })

  test('unfurl prompts collect domains per message and clear one at a time', () => {
    const {h, state} = renderThread()
    const id = T.Chat.numberToMessageID(10)
    act(() => {
      h().actions.showUnfurlPrompt(id, 'a.com')
      h().actions.showUnfurlPrompt(id, 'b.com')
    })
    expect([...(state().unfurlPrompt.get(id) ?? [])]).toEqual(['a.com', 'b.com'])
    act(() => h().actions.clearUnfurlPrompt(id, 'a.com'))
    expect([...(state().unfurlPrompt.get(id) ?? [])]).toEqual(['b.com'])
    const before = state()
    act(() => h().actions.clearUnfurlPrompt(T.Chat.numberToMessageID(99), 'a.com'))
    expect(state()).toBe(before)
  })

  test('coin flip statuses are keyed by game', () => {
    const {h, state} = renderThread()
    const status = {gameID: 'g1'} as unknown as T.RPCChat.UICoinFlipStatus
    act(() => h().actions.updateCoinFlipStatuses([status]))
    expect(state().flipStatusMap.get('g1')).toEqual(status)
  })

  test('attachment downloads and mobile saving write the row', () => {
    const {h, state} = renderThread()
    const ordinal = T.Chat.numberToOrdinal(10)
    act(() =>
      h().actions.addMessages([
        makeMessageAttachment({conversationIDKey: convID, id: T.Chat.numberToMessageID(10), ordinal}),
      ])
    )
    const row = () => state().messageMap.get(ordinal) as T.Chat.MessageAttachment
    act(() => h().actions.startAttachmentDownload(ordinal))
    expect(row().transferState).toBe('downloading')
    act(() => h().actions.updateAttachmentDownloadProgress(10, 5, 10))
    expect(row().transferProgress).toBe(0.5)
    act(() => h().actions.failAttachmentDownload(ordinal, 'boom'))
    expect(row().transferErrMsg).toBe('boom')
    act(() => h().actions.finishAttachmentDownload(ordinal, '/tmp/file'))
    expect([row().downloadPath, row().transferProgress, row().transferErrMsg]).toEqual(['/tmp/file', 1, undefined])
    act(() => h().actions.setAttachmentMobileSaving(ordinal, true))
    expect(row().transferState).toBe('mobileSaving')
  })

  test('getSnapshot reads the live store', () => {
    const {h, state} = renderThread()
    act(() => h().actions.addMessages([textAt(10)]))
    expect(h().actions.getSnapshot()).toBe(state())
  })
})

describe('window gate', () => {
  test('claiming does nothing without a clear, or once someone holds the gate', () => {
    const {h, state} = renderThread()
    act(() => h().actions.claimWindowGate(1))
    expect(state().windowGateOwner).toBeUndefined()
    act(() => h().actions.messagesClear())
    act(() => h().actions.claimWindowGate(2))
    act(() => h().actions.claimWindowGate(3))
    expect(state().windowGateOwner).toBe(2)
  })

  test('an unclaimed gate is released by anyone; a claimed one only by its owner', () => {
    const {h, state} = renderThread()
    act(() => h().actions.messagesClear())
    act(() => h().actions.clearWindowGate(9))
    expect(state().windowCleared).toBe(false)
    act(() => h().actions.messagesClear())
    act(() => h().actions.claimWindowGate(2))
    act(() => h().actions.clearWindowGate(3))
    expect(state().windowCleared).toBe(true)
    act(() => h().actions.clearWindowGate(2))
    expect([state().windowCleared, state().windowGateOwner]).toEqual([false, undefined])
  })

  test('clearing without a gate up leaves the state object alone', () => {
    const {h, state} = renderThread()
    const before = state()
    act(() => h().actions.clearWindowGate(1))
    expect(state()).toBe(before)
  })
})

describe('exploding mode', () => {
  test('a new store starts from the gregor exploding item for its conversation', () => {
    useConfigState.setState({
      gregorPushState: [
        {item: {body: new TextEncoder().encode('300'), category: `exploding:${convID}`}},
      ] as unknown as ReturnType<typeof useConfigState.getState>['gregorPushState'],
    })
    expect(renderThread().state().explodingMode).toBe(300)
    expect(renderThread(otherConvID).state().explodingMode).toBe(0)
  })

  test('a local change persists: off clears the item, a time sets it', async () => {
    const {h, state} = renderThread()
    await run(() => h().actions.setExplodingMode(0))
    await run(() => h().actions.setExplodingMode(60))
    expect(state().explodingMode).toBe(60)
    expect(rpc.log.map(l => l.method)).toEqual(['clearExplodingMode', 'setExplodingMode'])
  })
})

describe('provider lifecycle', () => {
  test('a remount gets a fresh store', () => {
    const first = renderThread()
    act(() => first.h().actions.addMessages([textAt(10)]))
    const firstStore = first.h().store
    first.rendered.unmount()
    const second = renderThread()
    expect(second.h().store).not.toBe(firstStore)
    expect(second.state().messageMap.size).toBe(0)
  })

  test('a rerender keeps the same store and actions', () => {
    const {h, rendered} = renderThread()
    const {actions, store} = h()
    rendered.rerender()
    expect(h().actions).toBe(actions)
    expect(h().store).toBe(store)
  })

  test('a nested provider for the same conversation reuses the outer one', () => {
    let outer: Partial<Probed> = {}
    let inner: Partial<Probed> = {}
    render(
      <ConversationThreadProvider id={convID}>
        <Probe into={v => (outer = v)} />
        <ConversationThreadProvider id={convID}>
          <Probe into={v => (inner = v)} />
        </ConversationThreadProvider>
      </ConversationThreadProvider>
    )
    expect(inner.store).toBe(outer.store)
    expect(inner.actions).toBe(outer.actions)
  })

  test('two conversations have independent stores', () => {
    const a = renderThread()
    const b = renderThread(otherConvID)
    act(() => a.h().actions.addMessages([textAt(10)]))
    act(() => b.h().actions.setTyping(new Set(['testuser2'])))
    expect(a.state().messageMap.size).toBe(1)
    expect(b.state().messageMap.size).toBe(0)
    expect(a.state().typing.size).toBe(0)
  })

  test('hiding the provider drops a pending load but keeps the store', () => {
    fakeTimers()
    let actions: ConversationThreadActions | undefined
    let store: ConversationThreadStoreApi | undefined
    const into = (v: Probed) => {
      actions = v.actions
      store = v.store
    }
    const {rerender} = render(<HideableThread into={into} mode="visible" />)
    act(() => {
      actions?.addMessages([textAt(10)])
      actions?.loadMoreMessages({numberOfMessagesToLoad: 1, reason: 'scroll back', scrollDirection: 'back'})
      actions?.loadMoreMessages({numberOfMessagesToLoad: 2, reason: 'scroll back', scrollDirection: 'back'})
    })
    const storeBefore = store
    rerender(<HideableThread into={into} mode="hidden" />)
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(loads()).toHaveLength(1)
    rerender(<HideableThread into={into} mode="visible" />)
    expect(store).toBe(storeBefore)
    expect(store?.getState().messageMap.size).toBe(1)
  })
})
