/// <reference types="jest" />
// Desktop/tablet split layout: the thread is chatRoot, nested two navigators below the root stack.
jest.mock('@/constants/chat/layout', () => ({isSplit: true, threadRouteName: 'chatRoot'}))

import * as T from '@/constants/types'
import {
  clearThreadInputAction,
  navigationRef,
  setModalRouteNames,
  setThreadInputEditing,
} from '@/constants/router'

const dispatch = jest.fn()
const convID = 'ff00ff00' as T.Chat.ConversationIDKey
const ordinal = T.Chat.numberToOrdinal(101)

const chatStackKey = 'chatstack-1'
const makeLoggedIn = (chatRootParams: object) => ({
  key: 'loggedIn-1',
  name: 'loggedIn',
  state: {
    index: 0,
    key: 'tabs-1',
    routes: [
      {
        key: 'chatTab-1',
        name: 'tabs.chatTab',
        state: {
          index: 0,
          key: chatStackKey,
          routes: [{key: 'chatRoot-1', name: 'chatRoot', params: chatRootParams}],
          type: 'stack',
        },
      },
    ],
    type: 'tab',
  },
})

const modal = {key: 'modal-1', name: 'someModal', params: {}}

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

beforeEach(() => {
  dispatch.mockClear()
  setModalRouteNames(['someModal'])
})

const lastAction = () => dispatch.mock.calls[0]?.[0] as {type: string; source?: string; target?: string}

// navigationRef.dispatch starts at the deepest focused navigator, and useOnAction only bubbles an
// action DOWN when action.target is set. chatRoot lives under the tab navigator, so a source-only
// setParams bubbles up past its stack — a sibling, never an ancestor — and is dropped, silently:
// our onUnhandledAction downgrades react-navigation's warning to logger.info. Naming the owning
// navigator is what lets the action be routed down to the stack that can act on it.
test('editing a message names the navigator that owns the thread route', () => {
  setRootRoutes([makeLoggedIn({conversationIDKey: convID})])

  setThreadInputEditing(convID, ordinal)

  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(lastAction().type).toBe('SET_PARAMS')
  expect(lastAction().source).toBe('chatRoot-1')
  expect(lastAction().target).toBe(chatStackKey)
})

// The visible-thread scan deliberately looks past modals, so the guard passes here. That is exactly
// when the focused navigator is not ours, so this is the case the target has to carry.
test('editing still names the thread stack while a modal holds focus', () => {
  setRootRoutes([makeLoggedIn({conversationIDKey: convID}), modal])

  setThreadInputEditing(convID, ordinal)

  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(lastAction().target).toBe(chatStackKey)
})

test('clearing a consumed input action names the thread stack too', () => {
  setRootRoutes([makeLoggedIn({conversationIDKey: convID, inputAction: {key: 'edit-1', type: 'setEditing'}})])

  clearThreadInputAction('edit-1')

  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(lastAction().type).toBe('SET_PARAMS')
  expect(lastAction().target).toBe(chatStackKey)
})

test('a thread showing another conversation is still left alone', () => {
  setRootRoutes([makeLoggedIn({conversationIDKey: 'aabbccdd' as T.Chat.ConversationIDKey})])

  setThreadInputEditing(convID, ordinal)

  expect(dispatch).not.toHaveBeenCalled()
})
