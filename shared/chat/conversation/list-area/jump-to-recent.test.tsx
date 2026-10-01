/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import type * as T from '@/constants/types'
import type * as NavTreeModule from '@/constants/nav-tree'
import type * as RTL from '@testing-library/react'
import type * as FakeNavigatorModule from '@/test/fake-navigator'
import type * as JumpToRecentModule from './jump-to-recent'
import type * as ThreadContext from '../thread-context'

// A phone: the thread is its own screen, which the close must not push or replace. The platform
// globals are read as the app's modules load, so they are flipped before any is required.
const g = globalThis as unknown as {isElectron: boolean; isIOS: boolean; isMobile: boolean}
g.isMobile = true
g.isIOS = false
g.isElectron = false

const mockJumpToRecent = jest.fn()
jest.mock('../center-context', () => ({
  useConversationCenterActions: () => ({jumpToRecent: mockJumpToRecent}),
}))
jest.mock('../thread-context', () => {
  const actual = jest.requireActual<Record<string, unknown>>('../thread-context')
  return {...actual, useConversationThreadSelector: () => ({loaded: true, moreToLoadForward: true})}
})

/* eslint-disable @typescript-eslint/no-require-imports */
const {act, cleanup, renderHook} = require('@testing-library/react') as typeof RTL
const Types = require('@/constants/types') as typeof T
const NavTree = require('@/constants/nav-tree') as typeof NavTreeModule
const FakeNav = require('@/test/fake-navigator') as typeof FakeNavigatorModule
const {useJumpToRecent} = require('./jump-to-recent') as typeof JumpToRecentModule
const {ConversationThreadProvider} = require('../thread-context') as typeof ThreadContext
/* eslint-enable @typescript-eslint/no-require-imports */

const convID = Types.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

afterEach(() => {
  cleanup()
  FakeNav.restoreNavigator()
  mockJumpToRecent.mockClear()
})

// menuUp: a modal route (the phone message menu) is presented above the thread
const installThread = (threadSearch?: {query?: string}, menuUp = false) =>
  FakeNav.installFakeNavigator({
    modalRouteNames: ['chatMessagePopup'],
    rootState: FakeNav.makeRootState({
      above: menuUp ? [{name: 'chatMessagePopup'}] : [],
      tabStack: [{name: 'chatRoot'}, {name: 'chatConversation', params: {conversationIDKey: convID, threadSearch}}],
    }),
  })

const jump = () => {
  const scrollToBottom = jest.fn()
  const {result} = renderHook(() => useJumpToRecent(scrollToBottom, 5), {
    wrapper: (p: {children: React.ReactNode}) => (
      <ConversationThreadProvider id={convID}>{p.children}</ConversationThreadProvider>
    ),
  })
  const button = result.current as React.ReactElement<{onClick: () => void}>
  act(() => {
    button.props.onClick()
  })
  return scrollToBottom
}

const threadParams = (nav: ReturnType<typeof installThread>) =>
  NavTree.visibleScreen(nav.getRootState(), {includeModals: false})?.params as {threadSearch?: object} | undefined

test('jumping to recent closes thread search in place', () => {
  const nav = installThread({query: 'needle'})

  const scrollToBottom = jump()

  expect(scrollToBottom).toHaveBeenCalledTimes(1)
  expect(mockJumpToRecent).toHaveBeenCalledTimes(1)
  expect(threadParams(nav)?.threadSearch).toBeUndefined()
  expect(nav.navigations()).toEqual([])
})

test('jumping to recent with thread search closed leaves navigation alone', () => {
  const nav = installThread()

  jump()

  expect(nav.actions).toEqual([])
})

// the close reads the thread's route past the modal, and changes only that route
test('with a modal up, closes the search behind it and leaves the modal', () => {
  const nav = installThread({query: 'needle'}, true)

  jump()

  expect(threadParams(nav)?.threadSearch).toBeUndefined()
  expect(nav.navigations()).toEqual([])
  expect(NavTree.modalStack(nav.getRootState()).length).toBe(1)
})

test('with a modal up and thread search closed, leaves navigation alone', () => {
  const nav = installThread(undefined, true)

  jump()

  expect(nav.actions).toEqual([])
})
