/// <reference types="jest" />
// Phone layout: the thread is a root-level screen pushed above the tab navigator.
jest.mock('@/constants/chat/layout', () => ({isSplit: false, threadRouteName: 'chatConversation'}))

import * as T from '@/constants/types'
import {navigateToPendingThread, navigateToThread, navigationRef, setModalRouteNames} from '@/constants/router'
import {useInboxMetadataState} from '@/chat/inbox/metadata-store'
import {useCurrentUserState} from '@/stores/current-user'
import {useInputIntentState} from '@/chat/conversation/input-intent-store'

const dispatch = jest.fn()

const loggedIn = {
  key: 'loggedIn-1',
  name: 'loggedIn',
  state: {
    index: 0,
    key: 'tabs-1',
    routes: [
      {
        key: 'chatTab-1',
        name: 'tabs.chatTab',
        state: {index: 0, key: 'chatstack-1', routes: [{key: 'chatRoot-1', name: 'chatRoot'}], type: 'stack'},
      },
    ],
    type: 'tab',
  },
}

const setRootRoutes = (routes: Array<unknown>) => {
  const state = {index: routes.length - 1, key: 'root-1', routeNames: [], routes, stale: false, type: 'stack'}
  // the jest mock's container ref is a plain object, so stub its methods directly
  const nr = navigationRef as unknown as Record<string, unknown>
  nr['current'] = {}
  nr['dispatch'] = dispatch
  nr['getRootState'] = () => state
  nr['isReady'] = () => true
  nr['addListener'] = () => () => {}
}

const pendingRoute = {
  key: 'conv-pending',
  name: 'chatConversation',
  params: {conversationIDKey: T.Chat.pendingWaitingConversationIDKey},
}

const realConvID = 'ff00ff00' as T.Chat.ConversationIDKey
// Distinct per deep-link test: navigateAppend's `_pendingAppend` "uncommitted dupe" cache is
// module-level state that the mocked `addListener` never clears (the real navigator would fire
// its 'state' listener and clear it; this stub's listener never fires), so a later test in this
// file reusing `realConvID` with an equal-shaped params object would be silently caught by that
// leftover cache instead of by the code under test. A conv id used nowhere else sidesteps that.
//
// Not laziness: there is no reset to put in beforeEach. `_pendingAppend` is module-private and
// unexported, and jest.resetModules() would hand each test a fresh copy of constants/router with
// its own `navigationRef`, so the stub installed by setRootRoutes would no longer be the one the
// code under test reads. Distinct ids are the only lever from outside the module.
const deepLinkConvID = 'aa11aa11' as T.Chat.ConversationIDKey
const deepLinkConvID2 = 'bb22bb22' as T.Chat.ConversationIDKey
const optionsConvID = 'cc33cc33' as T.Chat.ConversationIDKey
const optionsConvID2 = 'dd44dd44' as T.Chat.ConversationIDKey
const optionsConvID3 = 'ee55ee55' as T.Chat.ConversationIDKey
const optionsConvID4 = 'ff66ff66' as T.Chat.ConversationIDKey

beforeEach(() => {
  dispatch.mockReset()
  setModalRouteNames(['chatNewChat'])
  useInputIntentState.getState().dispatch.resetState()
})

// Creating a conversation parks the thread screen on PENDING-WAITING while the RPC runs, so the
// resolved conv is the same chat arriving on the same screen. react-native-screens always animates
// a replace on iOS, so a StackActions.replace here (like a push) makes one new chat read as two
// pushes: the blank pending thread slides in, then the real one slides in over it.
test('pending -> resolved conversation retargets the live screen instead of animating a new one', () => {
  setRootRoutes([loggedIn, pendingRoute])

  navigateToThread(realConvID, 'justCreated')

  expect(dispatch).toHaveBeenCalledTimes(1)
  const action = dispatch.mock.calls[0]?.[0] as {type: string; payload: unknown; source?: string}
  expect(action.type).toBe('SET_PARAMS')
  expect(action.source).toBe(pendingRoute.key)
  expect(action.payload).toMatchObject({conversationIDKey: realConvID})
})

test('no thread on screen still pushes the conversation', () => {
  setRootRoutes([loggedIn])

  navigateToThread(realConvID, 'justCreated')

  expect(dispatch).toHaveBeenCalledTimes(1)
  const action = dispatch.mock.calls[0]?.[0] as {type: string; payload: {name: string}}
  expect(action.type).toBe('PUSH')
  expect(action.payload.name).toBe('chatConversation')
})

// The old `sameVisibleThread && highlightMessageID` early return is gone, so every call issued
// while already on that thread falls through to the bottom `else`. That must never read as a
// second push. The guarantee comes from `replace` itself (visibleConvo === conversationIDKey
// forces a setParams retarget), not from the visible route's params object happening to have the
// same keys as the ones this call builds - a route built elsewhere (a deep link, see the next
// test) can have a completely different params shape and this must still not push.
test('reissuing navigateToThread on the same visible thread retargets instead of pushing', () => {
  const visibleThreadRoute = {
    key: 'conv-visible',
    name: 'chatConversation',
    params: {
      conversationIDKey: realConvID,
      createConversationError: undefined,
      threadSearch: undefined,
    },
  }
  setRootRoutes([loggedIn, visibleThreadRoute])

  navigateToThread(realConvID, 'createdMessagePrivately')

  expect(dispatch).toHaveBeenCalledTimes(1)
  const action = dispatch.mock.calls[0]?.[0] as {type: string; payload: unknown; source?: string}
  expect(action.type).toBe('SET_PARAMS')
  expect(action.source).toBe(visibleThreadRoute.key)
  expect(action.payload).toMatchObject({conversationIDKey: realConvID})
})

// A conversation opened via a `keybase://convid/<id>` deep link lands on chatConversation with
// only {conversationIDKey} as params (router-v2/linking.tsx's makeChatConversationState) - one
// key, not the four this file's own params objects always carry. shallowEqual bails on a
// key-count mismatch before comparing values, so navigateAppend's dupe guard alone cannot be
// trusted to catch this shape; the fix must not push a duplicate regardless.
test('reissuing navigateToThread on a deep-linked thread (single-key params) does not push a duplicate', () => {
  const deepLinkedThreadRoute = {
    key: 'conv-deep-link',
    name: 'chatConversation',
    params: {conversationIDKey: deepLinkConvID},
  }
  setRootRoutes([loggedIn, deepLinkedThreadRoute])

  navigateToThread(deepLinkConvID, 'createdMessagePrivately')

  expect(dispatch).toHaveBeenCalledTimes(1)
  const action = dispatch.mock.calls[0]?.[0] as {type: string; payload: unknown; source?: string}
  expect(action.type).toBe('SET_PARAMS')
  expect(action.source).toBe(deepLinkedThreadRoute.key)
  expect(action.payload).toMatchObject({conversationIDKey: deepLinkConvID})
})

// Same shape as the deep-link case above, but reached by a reason that never carried an intent -
// this hole predates the intent-store work (a plain re-navigate to the same deep-linked thread
// already pushed a duplicate), so it's covered independently of that migration.
test('a plain re-navigate to a deep-linked thread does not push a duplicate', () => {
  const deepLinkedThreadRoute = {
    key: 'conv-deep-link-plain',
    name: 'chatConversation',
    params: {conversationIDKey: deepLinkConvID2},
  }
  setRootRoutes([loggedIn, deepLinkedThreadRoute])

  navigateToThread(deepLinkConvID2, 'focused')

  expect(dispatch).toHaveBeenCalledTimes(1)
  const action = dispatch.mock.calls[0]?.[0] as {type: string; payload: unknown; source?: string}
  expect(action.type).toBe('SET_PARAMS')
  expect(action.source).toBe(deepLinkedThreadRoute.key)
})

// The options object replaced a positional tail (highlightMessageID, threadSearchQuery,
// createConversationError). An `intent` is written to the input-intent bus before the navigation
// dispatches, because the thread mounts during that dispatch and consumes on mount.
test('the options object writes the intent before navigating and forwards threadSearchQuery', () => {
  setRootRoutes([loggedIn])
  const messageID = T.Chat.numberToMessageID(99)
  const order: Array<string> = []
  dispatch.mockImplementation(() => {
    order.push(`intent:${String(useInputIntentState.getState().intents.has(optionsConvID))}`)
  })

  navigateToThread(optionsConvID, 'justCreated', {
    intent: {messageID, type: 'highlight'},
    threadSearchQuery: 'needle',
  })

  expect(order).toEqual(['intent:true'])
  expect(useInputIntentState.getState().intents.get(optionsConvID)).toEqual({
    messageID,
    type: 'highlight',
  })
  const action = dispatch.mock.calls[0]?.[0] as {type: string; payload: {params: object}}
  expect(action.type).toBe('PUSH')
  expect(action.payload.params).toMatchObject({
    conversationIDKey: optionsConvID,
    threadSearch: {query: 'needle'},
  })
})

// The intent write sits below every early return that aborts the navigation. An intent written
// on an aborted navigation would sit in the mailbox and fire on some later, unrelated mount.
test('an aborted navigation writes no intent', () => {
  setRootRoutes([loggedIn])

  navigateToThread(optionsConvID, 'findNewestConversation', {
    intent: {messageID: T.Chat.numberToMessageID(99), type: 'highlight'},
  })

  expect(dispatch).not.toHaveBeenCalled()
  expect(useInputIntentState.getState().intents.size).toBe(0)
})

// The prefill callers - send-to-chat, incoming-share, attachment-get-titles and the two
// reply-privately paths - hand their text to this option instead of writing the bus themselves,
// so that the write-before-navigate ordering is owned here rather than honoured by convention in
// five places. A caller whose text is optional passes undefined rather than skipping the nav.
test('an injectText intent is written before navigating, and an undefined one writes nothing', () => {
  setRootRoutes([loggedIn])
  const order: Array<string> = []
  dispatch.mockImplementation(() => {
    order.push(`intent:${String(useInputIntentState.getState().intents.has(optionsConvID3))}`)
  })

  navigateToThread(optionsConvID3, 'justCreated', {intent: {text: 'prefill me', type: 'injectText'}})

  expect(order).toEqual(['intent:true'])
  expect(useInputIntentState.getState().intents.get(optionsConvID3)).toEqual({
    text: 'prefill me',
    type: 'injectText',
  })

  navigateToThread(optionsConvID4, 'justCreated', {intent: undefined})

  expect(useInputIntentState.getState().intents.has(optionsConvID4)).toBe(false)
})

test('no options writes no intent', () => {
  setRootRoutes([loggedIn])

  navigateToThread(optionsConvID2, 'justCreated')

  expect(useInputIntentState.getState().intents.size).toBe(0)
})

// setParams keeps the native screen alive, and iOS never re-measures a header title subview it
// first measured empty - so the pending thread has to have a title before it is shown.
test('the pending thread is seeded with the participants so its header title is never empty', () => {
  useCurrentUserState.setState({username: 'testuser'})
  setRootRoutes([loggedIn])

  navigateToPendingThread(['testuser-mac'])

  const seeded = useInboxMetadataState.getState().participants.get(T.Chat.pendingWaitingConversationIDKey)
  expect(seeded?.name).toEqual(['testuser', 'testuser-mac'])
  const action = dispatch.mock.calls[0]?.[0] as {type: string; payload: {params: object}}
  expect(action.payload.params).toMatchObject({
    conversationIDKey: T.Chat.pendingWaitingConversationIDKey,
  })
})
