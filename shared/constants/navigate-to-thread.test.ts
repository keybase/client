/// <reference types="jest" />
// Phone layout: the thread is a root-level screen pushed above the tab navigator.
jest.mock('@/constants/chat/layout', () => ({isSplit: false, threadRouteName: 'chatConversation'}))

import * as T from '@/constants/types'
import {navigateToPendingThread, navigateToThread, navigationRef, setModalRouteNames} from '@/constants/router'
import {useInboxMetadataState} from '@/chat/inbox/metadata-store'
import {useCurrentUserState} from '@/stores/current-user'

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

beforeEach(() => {
  dispatch.mockClear()
  setModalRouteNames(['chatNewChat'])
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
