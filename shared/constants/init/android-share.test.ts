/** @jest-environment jsdom */
/// <reference types="jest" />
// The Android share opener on the real React Navigation tree (a phone's), fed by the router store
// the way router.tsx feeds it: from each committed state, after React renders.
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import * as NavTree from '@/constants/nav-tree'
import {CommonActions} from '@react-navigation/core'
import {clearModals, navigateAppend} from '@/constants/router'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {useRouterState, type NavState} from '@/stores/router'
import {resetAllStores} from '@/util/zustand'
import {navigationRef} from '@/constants/navigator'
import {installNavigation, makeRootState, renders, type MountedNavigation} from '@/test/navigation'
import {fakeNativeKb, type FakeNativeKbModule} from '@/test/fake-native-kb'

// The share native holds, as far as these tests are concerned: one at a time, read by id, cleared by
// an ack of its id. react-native-kb's own wrapper runs over it.
const mockNative = {
  acks: new Array<number>(),
  held: undefined as undefined | {id: number; text?: string; localPaths?: Array<string>; droppedCount: number},
}
jest.mock('react-native-kb', () => jest.requireActual<FakeNativeKbModule>('@/test/fake-native-kb').realKb())

import {onAndroidShareHeld, readAndroidShare, resetAndroidShareForTest, subscribeAndroidShareOpener} from './android-share'

let nav: MountedNavigation

// Each share the opener showed above the chat tab, in order: our own dispatches, recorded.
const opened = () =>
  nav.actions
    .filter(a => a.type === 'RESET')
    .flatMap(a => {
      const routes = (a.payload?.['routes'] ?? []) as ReadonlyArray<{name: string; params?: {androidShareID?: number}}>
      return routes.filter(r => r.name === 'incomingShareNew').map(r => r.params?.androidShareID)
    })
const rootNames = () => nav.getRootState()?.routes?.map(r => r.name)
const shareShowing = () => nav.visibleScreen()?.params as {androidShareID?: number} | undefined

const hold = (id: number) => {
  mockNative.held = {droppedCount: 0, id, text: `share ${id}`}
  onAndroidShareHeld(id)
}
const ready = () => {
  useConfigState.getState().dispatch.setLoggedIn(true)
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true)
}
const pushPickers = () => {
  navigateAppend({name: 'destinationPicker', params: {index: 0}} as never)
  navigateAppend({name: 'destinationPicker', params: {index: 1}} as never)
}
let unsubscribe = () => {}

beforeEach(() => {
  mockNative.acks = []
  mockNative.held = undefined
  fakeNativeKb.give({
    ackIncomingShare: (id: number) => {
      mockNative.acks.push(id)
      if (mockNative.held?.id === id) mockNative.held = undefined
    },
    heldIncomingShareID: () => mockNative.held?.id ?? 0,
    peekIncomingShare: (id: number) => {
      const held = mockNative.held
      return held?.id === id ? {droppedCount: held.droppedCount, localPaths: held.localPaths, text: held.text} : null
    },
  })
  resetAndroidShareForTest()
  nav = installNavigation({layout: 'phone', rootState: makeRootState({tab: Tabs.peopleTab})})
  unsubscribe = subscribeAndroidShareOpener()
})

afterEach(() => {
  unsubscribe()
  resetAllStores()
})

test('a held share opens over the chat tab once logged in with the navigator ready', async () => {
  hold(1)
  expect(opened()).toEqual([])
  ready()
  expect(opened()).toEqual([1])
  await renders()
  expect(rootNames()).toEqual(['loggedIn', 'incomingShareNew'])
  expect(NavTree.currentTab(nav.getRootState())).toBe(Tabs.chatTab)
  expect(shareShowing()?.androidShareID).toBe(1)
})

test('a share held before JS listened is asked for once it does, and opens', () => {
  unsubscribe()
  resetAndroidShareForTest()
  mockNative.held = {droppedCount: 0, id: 3, text: 'share 3'}
  unsubscribe = subscribeAndroidShareOpener()
  ready()
  expect(opened()).toEqual([3])
})

test('a share resets to the chat tab with the share above it, whatever was pushed', async () => {
  ready()
  navigateAppend({name: 'chatConversation', params: {conversationIDKey: 'C'}} as never)
  await renders()
  expect(rootNames()).toEqual(['loggedIn', 'chatConversation'])
  hold(1)
  await renders()
  expect(opened()).toEqual([1])
  expect(rootNames()).toEqual(['loggedIn', 'incomingShareNew'])
})

test('a newer share replaces the screen of the one it supersedes', async () => {
  ready()
  hold(1)
  await renders()
  hold(2)
  await renders()
  expect(rootNames()).toEqual(['loggedIn', 'incomingShareNew'])
  expect(shareShowing()?.androidShareID).toBe(2)
  expect(opened()).toEqual([1, 2])
})

test('a pending link or tap for this account goes first; the share opens once it was followed', async () => {
  ready()
  const {dispatch} = useNavigationIntentsState.getState()
  dispatch.enqueue('keybase://convid/0000ab')
  hold(1)
  expect(opened()).toEqual([])
  navigateAppend({name: 'chatConversation', params: {conversationIDKey: '0000ab'}} as never)
  await renders()
  dispatch.acknowledge(useNavigationIntentsState.getState().intent!.id)
  expect(opened()).toEqual([1])
})

test('a tap waiting on a switch to another account does not hold the share up', () => {
  ready()
  useCurrentUserState.setState({uid: 'uid-me'})
  useNavigationIntentsState.getState().dispatch.enqueue('keybase://convid/0000ab', {pushTapID: 5, targetUid: 'uid-other'})
  hold(1)
  expect(opened()).toEqual([1])
})

test('a share is opened once: it is shown while its route is in the state', async () => {
  ready()
  hold(1)
  await renders()
  pushPickers()
  await renders()
  useConfigState.getState().dispatch.setLoggedIn(true)
  expect(opened()).toEqual([1])
})

// The share is in getRootState() at once, but the state report the opener settles on comes after
// React renders; a store change in between must not open it again.
test('a share navigated to is not navigated to again before its state is reported', async () => {
  ready()
  hold(1)
  useConfigState.setState(s => ({allowAnimatedEmojis: !s.allowAnimatedEmojis}))
  expect(opened()).toEqual([1])
  await renders()
  useConfigState.setState(s => ({allowAnimatedEmojis: !s.allowAnimatedEmojis}))
  expect(opened()).toEqual([1])
})

test('a share screen paused under pushed screens keeps its share; clearModals then finishes it', async () => {
  ready()
  hold(1)
  await renders()
  pushPickers()
  await renders()
  expect(rootNames()).toEqual(['loggedIn', 'incomingShareNew', 'destinationPicker', 'destinationPicker'])
  expect(mockNative.acks).toEqual([])
  clearModals()
  await renders()
  expect(rootNames()).toEqual(['loggedIn'])
  expect(mockNative.acks).toEqual([1])
  expect(readAndroidShare(1)).toBeUndefined()
  // a new navigator does not bring a finished share back
  nav.setRootState(makeRootState())
  await renders()
  expect(opened()).toEqual([1])
})

test('a reset that drops the share route finishes the share', async () => {
  ready()
  hold(1)
  await renders()
  navigationRef.dispatch(CommonActions.reset({index: 0, routes: [{name: 'loggedIn'}]}))
  await renders()
  expect(mockNative.acks).toEqual([1])
})

test('a new navigator is not leaving the share: it is opened again there', async () => {
  ready()
  hold(1)
  await renders()
  nav.setRootState(makeRootState())
  await renders()
  expect(mockNative.acks).toEqual([])
  expect(opened()).toEqual([1, 1])
})

test('no state is no navigator: nothing is left or opened again', async () => {
  ready()
  hold(1)
  await renders()
  useRouterState.getState().dispatch.setNavState(undefined as unknown as NavState)
  useConfigState.getState().dispatch.setLoggedIn(true)
  expect(mockNative.acks).toEqual([])
  expect(opened()).toEqual([1])
})

test('logging out ends a held share: whoever logs in next may not be who it was shared to', async () => {
  ready()
  hold(1)
  await renders()
  useConfigState.getState().dispatch.setLoggedIn(false)
  nav.setLoggedIn(false)
  await renders()
  expect(mockNative.acks).toEqual([1])

  ready()
  nav.setLoggedIn(true)
  await renders()
  expect(opened()).toEqual([1])
})

test('a share made while logged out is not ended by staying logged out, and opens after login', () => {
  hold(1)
  useConfigState.getState().dispatch.setLoggedIn(false)
  expect(mockNative.acks).toEqual([])
  ready()
  expect(opened()).toEqual([1])
})

test('an account switch is not leaving the share: it opens again in the account switched to', async () => {
  ready()
  hold(1)
  await renders()
  useConfigState.setState({userSwitching: true})
  useConfigState.getState().dispatch.setLoggedIn(false)
  nav.setLoggedIn(false)
  await renders()
  expect(mockNative.acks).toEqual([])

  // The switch ends once the new account's navigator is up, which is after login.
  ready()
  useConfigState.setState({userSwitching: false})
  nav.setRootState(makeRootState())
  await renders()
  expect(mockNative.acks).toEqual([])
  expect(opened()).toEqual([1, 1])
})

test('a share is read by its own id only', () => {
  mockNative.held = {droppedCount: 1, id: 2, localPaths: ['/a.pdf']}
  expect(readAndroidShare(1)).toBeUndefined()
  expect(readAndroidShare(2)).toEqual({
    droppedCount: 1,
    items: [{originalPath: '/a.pdf', type: T.RPCGen.IncomingShareType.file}],
  })
  mockNative.held = {droppedCount: 0, id: 3, text: 'hi'}
  expect(readAndroidShare(3)?.items).toEqual([{content: 'hi', type: T.RPCGen.IncomingShareType.text}])
})

test('a switch that never reaches its account ends a held share', () => {
  ready()
  hold(1)
  useConfigState.setState({userSwitching: true})
  useConfigState.getState().dispatch.setLoggedIn(false)
  expect(mockNative.acks).toEqual([])
  useConfigState.setState({userSwitching: false})
  expect(mockNative.acks).toEqual([1])
})
