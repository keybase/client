/** @jest-environment jsdom */
/// <reference types="jest" />
// Phone layout: the thread is a root-level screen pushed above the tab navigator.
jest.mock('@/constants/chat/layout', () => ({isSplit: false, threadRouteName: 'chatConversation'}))

import * as T from '@/constants/types'
import {navigateToPendingThread, navigateToThread} from '@/constants/router'
import {navigationRef} from '@/constants/navigator'
import {installNavigation, makeRootState, type MountedNavigation} from '@/test/navigation'
import {useInboxMetadataState} from '@/chat/inbox/metadata-store'
import {useCurrentUserState} from '@/stores/current-user'
import {useInputIntentState} from '@/chat/conversation/input-intent-store'

let nav: MountedNavigation

type Spec = {name: string; params?: object}

// A phone's tree with these screens above the tab bar, mounted.
const showing = (above: Array<Spec> = []) => {
  nav = installNavigation({layout: 'phone', rootState: makeRootState({above, tab: 'tabs.chatTab'})})
}

// Runs `cb` at the moment the app dispatches, before the library handles the action.
const onDispatch = (cb: () => void) => {
  const dispatch = navigationRef.dispatch
  navigationRef.dispatch = action => {
    cb()
    dispatch(action)
  }
}

const visible = () => nav.visibleScreen()
const rootDepth = () => nav.getRootState()?.routes?.length

const pendingRoute = {
  name: 'chatConversation',
  params: {conversationIDKey: T.Chat.pendingWaitingConversationIDKey},
}

const realConvID = 'ff00ff00' as T.Chat.ConversationIDKey
const otherConvID = 'aa11aa11' as T.Chat.ConversationIDKey

beforeEach(() => {
  useInputIntentState.getState().dispatch.resetState()
})

// Creating a conversation parks the thread screen on PENDING-WAITING while the RPC runs, so the
// resolved conv is the same chat arriving on the same screen. react-native-screens always animates
// a replace on iOS, so a StackActions.replace here (like a push) makes one new chat read as two
// pushes: the blank pending thread slides in, then the real one slides in over it.
test('pending -> resolved conversation retargets the live screen instead of animating a new one', () => {
  showing([pendingRoute])
  const key = visible()?.key

  navigateToThread(realConvID, 'justCreated')

  expect(nav.types()).toEqual(['SET_PARAMS'])
  expect(nav.actions[0]?.source).toBe(key)
  expect(visible()).toMatchObject({key, params: {conversationIDKey: realConvID}})
})

test('no thread on screen still pushes the conversation', () => {
  showing()

  navigateToThread(realConvID, 'justCreated')

  expect(nav.types()).toEqual(['PUSH'])
  expect(visible()).toMatchObject({name: 'chatConversation', params: {conversationIDKey: realConvID}})
})

// The old `sameVisibleThread && highlightMessageID` early return is gone, so every call issued
// while already on that thread falls through to the bottom `else`. That must never read as a
// second push. The guarantee comes from `replace` itself (visibleConvo === conversationIDKey
// forces a setParams retarget), not from the visible route's params object happening to have the
// same keys as the ones this call builds - a route built elsewhere (a deep link, see the next
// test) can have a completely different params shape and this must still not push.
test('reissuing navigateToThread on the same visible thread retargets instead of pushing', () => {
  showing([
    {
      name: 'chatConversation',
      params: {conversationIDKey: realConvID, createConversationError: undefined, threadSearch: undefined},
    },
  ])
  const key = visible()?.key
  const depth = rootDepth()

  navigateToThread(realConvID, 'createdMessagePrivately')

  expect(nav.types()).toEqual(['SET_PARAMS'])
  expect(nav.actions[0]?.source).toBe(key)
  expect(visible()).toMatchObject({key, params: {conversationIDKey: realConvID}})
  expect(rootDepth()).toBe(depth)
})

// A conversation opened via a `keybase://convid/<id>` deep link lands on chatConversation with
// only {conversationIDKey} as params (router-v2/linking.tsx's makeChatConversationState) - one
// key, not the four this file's own params objects always carry. shallowEqual bails on a
// key-count mismatch before comparing values, so navigateAppend's dupe guard alone cannot be
// trusted to catch this shape; the fix must not push a duplicate regardless.
test('reissuing navigateToThread on a deep-linked thread (single-key params) does not push a duplicate', () => {
  showing([{name: 'chatConversation', params: {conversationIDKey: realConvID}}])
  const key = visible()?.key
  const depth = rootDepth()

  navigateToThread(realConvID, 'createdMessagePrivately')

  expect(nav.types()).toEqual(['SET_PARAMS'])
  expect(nav.actions[0]?.source).toBe(key)
  expect(visible()).toMatchObject({key, params: {conversationIDKey: realConvID}})
  expect(rootDepth()).toBe(depth)
})

// Same shape as the deep-link case above, but reached by a reason that never carried an intent -
// this hole predates the intent-store work (a plain re-navigate to the same deep-linked thread
// already pushed a duplicate), so it's covered independently of that migration.
test('a plain re-navigate to a deep-linked thread does not push a duplicate', () => {
  showing([{name: 'chatConversation', params: {conversationIDKey: realConvID}}])
  const key = visible()?.key
  const depth = rootDepth()

  navigateToThread(realConvID, 'focused')

  expect(nav.types()).toEqual(['SET_PARAMS'])
  expect(nav.actions[0]?.source).toBe(key)
  expect(rootDepth()).toBe(depth)
})

// The options object replaced a positional tail (highlightMessageID, threadSearchQuery,
// createConversationError). An `intent` is written to the input-intent bus before the navigation
// dispatches, because the thread mounts during that dispatch and consumes on mount.
test('the options object writes the intent before navigating and forwards threadSearchQuery', () => {
  showing()
  const messageID = T.Chat.numberToMessageID(99)
  const order: Array<string> = []
  onDispatch(() => {
    order.push(`intent:${String(useInputIntentState.getState().intents.has(realConvID))}`)
  })

  navigateToThread(realConvID, 'justCreated', {
    intent: {messageID, type: 'highlight'},
    threadSearchQuery: 'needle',
  })

  expect(order).toEqual(['intent:true'])
  expect(useInputIntentState.getState().intents.get(realConvID)).toEqual({
    messageID,
    type: 'highlight',
  })
  expect(nav.types()).toEqual(['PUSH'])
  expect(visible()?.params).toMatchObject({
    conversationIDKey: realConvID,
    threadSearch: {query: 'needle'},
  })
})

// The intent write sits below every early return that aborts the navigation. An intent written
// on an aborted navigation would sit in the mailbox and fire on some later, unrelated mount.
test('an aborted navigation writes no intent', () => {
  showing()

  navigateToThread(realConvID, 'findNewestConversation', {
    intent: {messageID: T.Chat.numberToMessageID(99), type: 'highlight'},
  })

  expect(nav.actions).toEqual([])
  expect(useInputIntentState.getState().intents.size).toBe(0)
})

// The prefill callers - send-to-chat, incoming-share, attachment-get-titles and the two
// reply-privately paths - hand their text to this option instead of writing the bus themselves,
// so that the write-before-navigate ordering is owned here rather than honoured by convention in
// five places. A caller whose text is optional passes undefined rather than skipping the nav.
test('an injectText intent is written before navigating, and an undefined one writes nothing', () => {
  showing()
  const order: Array<string> = []
  onDispatch(() => {
    order.push(`intent:${String(useInputIntentState.getState().intents.has(realConvID))}`)
  })

  navigateToThread(realConvID, 'justCreated', {intent: {text: 'prefill me', type: 'injectText'}})

  expect(order).toEqual(['intent:true'])
  expect(useInputIntentState.getState().intents.get(realConvID)).toEqual({
    text: 'prefill me',
    type: 'injectText',
  })

  navigateToThread(otherConvID, 'justCreated', {intent: undefined})

  expect(useInputIntentState.getState().intents.has(otherConvID)).toBe(false)
})

test('no options writes no intent', () => {
  showing()

  navigateToThread(realConvID, 'justCreated')

  expect(useInputIntentState.getState().intents.size).toBe(0)
})

test('the pending thread is seeded with the participants we already know', () => {
  useCurrentUserState.setState({username: 'testuser'})
  showing()

  navigateToPendingThread(['testuser-mac'])

  const seeded = useInboxMetadataState.getState().participants.get(T.Chat.pendingWaitingConversationIDKey)
  expect(seeded?.name).toEqual(['testuser', 'testuser-mac'])
  expect(visible()).toMatchObject({
    name: 'chatConversation',
    params: {conversationIDKey: T.Chat.pendingWaitingConversationIDKey},
  })
})

// navigateToThread writes the intent before dispatching, because the thread consumes on mount and
// a write afterwards would miss it. The dispatch can still not happen - here the container has not
// mounted, the shape of a navigateToThread arriving from a push notification or an engine handler
// before the nav container is ready. A durable intent left behind by a navigation that never
// occurred would fire on some later, unrelated mount of that conversation.
test('a navigation that cannot dispatch leaves no intent behind', () => {
  nav = installNavigation({layout: 'phone', ready: false})
  const convID = T.Chat.stringToConversationIDKey('conv-no-navigator')
  navigateToThread(convID, 'push', {
    intent: {messageID: T.Chat.numberToMessageID(7), type: 'highlight'},
  })

  expect(nav.actions).toEqual([])
  expect(useInputIntentState.getState().intents.get(convID)).toBeUndefined()
})

test('a navigation that does dispatch keeps the intent for the mount to consume', () => {
  showing()
  const convID = T.Chat.stringToConversationIDKey('conv-with-navigator')
  navigateToThread(convID, 'push', {
    intent: {messageID: T.Chat.numberToMessageID(7), type: 'highlight'},
  })

  expect(nav.actions.length).toBeGreaterThan(0)
  expect(visible()).toMatchObject({name: 'chatConversation', params: {conversationIDKey: convID}})
  expect(useInputIntentState.getState().intents.get(convID)).toEqual({
    messageID: T.Chat.numberToMessageID(7),
    type: 'highlight',
  })
})
