/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import type * as T from '@/constants/types'
import type * as NavTreeModule from '@/constants/nav-tree'
import type * as RTL from '@testing-library/react'
import type * as NavigationHarness from '@/test/navigation'
import type * as Navigator from '@/constants/navigator'
import type * as JumpToRecentModule from './jump-to-recent'
import type * as ThreadContext from '../thread-context'
import type * as CenterContext from '../center-context'
import type * as LoadStatus from '../thread-load-status-context'
import type * as CurrentUser from '@/stores/current-user'
import type * as Config from '@/stores/config'
import type * as MetaModule from '@/constants/chat/meta'
import type * as Metadata from '@/chat/inbox/metadata'
import type * as MessageModule from '@/constants/chat/message'
import type * as FakeEngineModule from '@/test/fake-engine'
import type * as Zustand from '@/util/zustand'
import type * as FlushModule from '@/test/flush'
import type HiddenStringType from '@/util/hidden-string'

// A phone: the thread is its own screen, which the close must not push or replace. The platform
// globals are read as the app's modules load, so they are flipped before any is required.
const g = globalThis as unknown as {isElectron: boolean; isIOS: boolean; isMobile: boolean}
g.isMobile = true
g.isIOS = false
g.isElectron = false

const {act, cleanup, renderHook} = require('@testing-library/react') as typeof RTL
const Types = require('@/constants/types') as typeof T
const NavTree = require('@/constants/nav-tree') as typeof NavTreeModule
const Harness = require('@/test/navigation') as typeof NavigationHarness
const {navigationRef} = require('@/constants/navigator') as typeof Navigator
const {useJumpToRecent} = require('./jump-to-recent') as typeof JumpToRecentModule
const {ConversationThreadProvider, useConversationThreadActions} = require('../thread-context') as typeof ThreadContext
const {ConversationCenterProvider} = require('../center-context') as typeof CenterContext
const {ConversationThreadLoadStatusProvider} = require('../thread-load-status-context') as typeof LoadStatus
const {useCurrentUserState} = require('@/stores/current-user') as typeof CurrentUser
const {useConfigState} = require('@/stores/config') as typeof Config
const {makeConversationMeta} = require('@/constants/chat/meta') as typeof MetaModule
const {metasReceived} = require('@/chat/inbox/metadata') as typeof Metadata
const {makeMessageText} = require('@/constants/chat/message') as typeof MessageModule
const {installFakeEngine, uninstallFakeEngine} = require('@/test/fake-engine') as typeof FakeEngineModule
const {resetAllStores} = require('@/util/zustand') as typeof Zustand
const {flush} = require('@/test/flush') as typeof FlushModule
const HiddenString = (require('@/util/hidden-string') as {default: typeof HiddenStringType}).default

const convID = Types.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

// the thread provider builds a thread only for a signed-in account, and loads one only once the
// chat session is up
beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  // the conversation's row is already unboxed, so opening it asks the inbox for nothing
  metasReceived([{...makeConversationMeta(), conversationIDKey: convID, trustedState: 'trusted'}])
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
})

afterEach(() => {
  cleanup()
  act(() => {
    resetAllStores()
  })
})

const textAt = (n: number) =>
  makeMessageText({
    author: 'testuser',
    conversationIDKey: convID,
    id: Types.Chat.numberToMessageID(n),
    ordinal: Types.Chat.numberToOrdinal(n),
    text: new HiddenString(`message ${n}`),
  })

// menuUp: the phone message menu is opened above the thread once it has loaded, as a long press
// does. (A thread that starts under a modal is paused from its first render, so it never runs.)
// centered: the thread is showing a window short of the newest message, as after jumping to a search
// hit, so there is something to jump forward to
const installThread = (threadSearch?: {query?: string}, menuUp = false, centered = true) => {
  const fake = installFakeEngine()
  // what the jump asks the service for; never answered, the test only reads that it was asked
  const loads = fake.hold('chat.1.local.getThreadNonblock')
  const {wrapper: Nav, ...nav} = Harness.navigationWrapper({
    layout: 'phone',
    rootState: Harness.makeRootState({
      above: [{name: 'chatConversation', params: {conversationIDKey: convID, threadSearch}}],
    }),
    route: 'chatConversation',
  })
  const scrollToBottom = jest.fn()
  const {result} = renderHook(
    () => ({actions: useConversationThreadActions(), button: useJumpToRecent(scrollToBottom, 5)}),
    {
      wrapper: (p: {children: React.ReactNode}) => (
        <Nav>
          <ConversationThreadProvider id={convID}>
            {/* the window is put in place below, so selecting the thread loads nothing itself */}
            <ConversationThreadLoadStatusProvider id={convID} skipThreadLoadOnSelection={true}>
              <ConversationCenterProvider id={convID}>{p.children}</ConversationCenterProvider>
            </ConversationThreadLoadStatusProvider>
          </ConversationThreadProvider>
        </Nav>
      ),
    }
  )
  const buttonBeforeLoad = result.current.button
  act(() => {
    result.current.actions.applyThreadLoad({
      centered,
      enableActiveMarkRead: false,
      messages: [textAt(10)],
      moreToLoad: false,
      scrollDirection: 'none',
    })
  })
  if (menuUp) {
    act(() => {
      navigationRef.navigate('chatMessagePopup', {conversationIDKey: convID, messageID: Types.Chat.numberToMessageID(10)})
    })
    nav.clearActions()
  }
  const thread = () => NavTree.visibleScreen(nav.getRootState(), {includeModals: false})
  const threadParams = () => thread()?.params as {threadSearch?: object} | undefined
  const threadKey = () => thread()?.key
  const before = {depth: nav.getRootState()?.routes?.length, key: threadKey()}
  const button = () => result.current.button
  const jump = () => {
    const b = result.current.button as React.ReactElement<{onClick: () => void}>
    act(() => {
      b.props.onClick()
    })
    return scrollToBottom
  }
  // the thread is still the same route at the same depth: nothing was pushed or replaced
  const expectSameScreens = () => {
    expect(nav.getRootState()?.routes?.length).toBe(before.depth)
    expect(threadKey()).toBe(before.key)
  }
  return {...nav, button, buttonBeforeLoad, expectSameScreens, jump, loads, threadParams}
}

test('jumping to recent closes thread search in place', async () => {
  const nav = installThread({query: 'needle'})

  const scrollToBottom = nav.jump()
  await flush()

  expect(scrollToBottom).toHaveBeenCalledTimes(1)
  // the thread asks the service for its newest page
  expect(nav.loads).toHaveLength(1)
  expect(nav.threadParams()?.threadSearch).toBeUndefined()
  nav.expectSameScreens()
})

test('jumping to recent with thread search closed leaves navigation alone', () => {
  const nav = installThread()

  nav.jump()

  expect(nav.actions).toEqual([])
  nav.expectSameScreens()
})

// the close reads the thread's route past the modal, and changes only that route
test('with a modal up, closes the search behind it and leaves the modal', () => {
  const nav = installThread({query: 'needle'}, true)

  nav.jump()

  expect(nav.threadParams()?.threadSearch).toBeUndefined()
  nav.expectSameScreens()
  expect(NavTree.modalStack(nav.getRootState()).map(r => r.name)).toEqual(['chatMessagePopup'])
})

test('with a modal up and thread search closed, leaves navigation alone', () => {
  const nav = installThread(undefined, true)

  nav.jump()

  expect(nav.actions).toEqual([])
  nav.expectSameScreens()
})

test('offers no jump before the thread has loaded, or when it already shows the newest message', () => {
  const centered = installThread()
  expect(centered.buttonBeforeLoad).toBe(false)
  expect(centered.button()).toBeTruthy()
  cleanup()
  uninstallFakeEngine()

  const latest = installThread(undefined, false, false)
  expect(latest.button()).toBe(false)
})
