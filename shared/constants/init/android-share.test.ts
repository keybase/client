/// <reference types="jest" />
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {useRouterState, type NavState} from '@/stores/router'
import {resetAllStores} from '@/util/zustand'
import {navigationRef, setNavigator, type Navigator} from '@/constants/navigator'

const mockNative = {
  acks: new Array<number>(),
  held: undefined as undefined | {id: number; text?: string; localPaths?: Array<string>; droppedCount: number},
}
jest.mock('react-native-kb', () => ({
  ackIncomingShare: (id: number) => {
    mockNative.acks.push(id)
    if (mockNative.held?.id === id) mockNative.held = undefined
  },
  peekIncomingShare: (id: number) => {
    const held = mockNative.held
    return held?.id === id ? {droppedCount: held.droppedCount, localPaths: held.localPaths, text: held.text} : null
  },
}))

import {onAndroidShareHeld, readAndroidShare, resetAndroidShareForTest, subscribeAndroidShareOpener} from './android-share'

// Root states: the tabs alone, the share modal above them, a conversation pushed above the tabs,
// and pickers pushed above the share (which pauses the share screen, but its route stays).
type Root = {index: number; routes: Array<{key: string; name: string; params?: object}>}
const tabs: Root = {index: 0, routes: [{key: 'l', name: 'loggedIn'}]}
const withShare = (id: number, under: Root = tabs): Root => ({
  index: under.routes.length,
  routes: [...under.routes, {key: `s${id}`, name: 'incomingShareNew', params: {androidShareID: id}}],
})
const withConversation: Root = {
  index: 1,
  routes: [...tabs.routes, {key: 'c', name: 'chatConversation'}],
}
const withPickers = (id: number): Root => ({
  index: 3,
  routes: [...withShare(id).routes, {key: 'p1', name: 'destinationPicker'}, {key: 'p2', name: 'destinationPicker'}],
})

// The navigator: it records each opening and, like the real one, commits it as the next state.
let root: Root = tabs
let opened: Array<string> = []
const setState = (s: Root) => {
  root = s
  useRouterState.getState().dispatch.setNavState(s as unknown as NavState)
}
const open = (how: string, id: number, under: Root) => {
  opened.push(`${how} ${id}`)
  setState(withShare(id, under))
  return true
}
const fakeNavigator = {
  getRootState: () => root,
  navigateAppend: (screen: {params: {androidShareID: number}}) => open('push', screen.params.androidShareID, root),
  showAboveTabs: (tab: string, screen: {params: {androidShareID: number}}) => {
    expect(tab).toBe(Tabs.chatTab)
    return open('over tabs', screen.params.androidShareID, tabs)
  },
} as unknown as Navigator

const hold = (id: number) => {
  mockNative.held = {droppedCount: 0, id, text: `share ${id}`}
  onAndroidShareHeld(id)
}
const ready = () => {
  useConfigState.getState().dispatch.setLoggedIn(true)
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true)
}
// A new NavigationContainer: its own handle in navigationRef.
const newNavigator = () => {
  navigationRef.current = {} as typeof navigationRef.current
}
let unsubscribe = () => {}

beforeEach(() => {
  mockNative.acks = []
  mockNative.held = undefined
  opened = []
  root = tabs
  resetAndroidShareForTest()
  newNavigator()
  setNavigator(fakeNavigator)
  unsubscribe = subscribeAndroidShareOpener()
})

afterEach(() => {
  unsubscribe()
  setNavigator()
  resetAllStores()
})

test('a held share opens over the chat tab once logged in with the navigator ready', () => {
  hold(1)
  expect(opened).toEqual([])
  ready()
  expect(opened).toEqual(['over tabs 1'])
})

test('a share resets to the chat tab with the share above it, whatever was pushed', () => {
  ready()
  setState(withConversation)
  hold(1)
  expect(opened).toEqual(['over tabs 1'])
  expect(root.routes.map(r => r.name)).toEqual(['loggedIn', 'incomingShareNew'])
})

test('a newer share replaces the screen of the one it supersedes', () => {
  ready()
  hold(1)
  hold(2)
  expect(root.routes.map(r => r.name)).toEqual(['loggedIn', 'incomingShareNew'])
  expect(opened).toEqual(['over tabs 1', 'over tabs 2'])
})

test('a pending link or tap for this account goes first; the share opens once it was followed', () => {
  ready()
  const {dispatch} = useNavigationIntentsState.getState()
  dispatch.enqueue('keybase://convid/0000ab')
  hold(1)
  expect(opened).toEqual([])
  setState(withConversation)
  dispatch.acknowledge(useNavigationIntentsState.getState().intent!.id)
  expect(opened).toEqual(['over tabs 1'])
})

test('a tap waiting on a switch to another account does not hold the share up', () => {
  ready()
  useCurrentUserState.setState({uid: 'uid-me'})
  useNavigationIntentsState.getState().dispatch.enqueue('keybase://convid/0000ab', {pushTapID: 5, targetUid: 'uid-other'})
  hold(1)
  expect(opened).toEqual(['over tabs 1'])
})

test('a share is opened once: it is shown while its route is in the state', () => {
  ready()
  hold(1)
  setState({...withShare(1)})
  setState(withPickers(1))
  useConfigState.getState().dispatch.setLoggedIn(true)
  expect(opened).toEqual(['over tabs 1'])
})

test('a share navigated to is not navigated to again before its state commits', () => {
  setNavigator({
    ...fakeNavigator,
    showAboveTabs: () => {
      opened.push('over tabs, not yet committed')
      return true
    },
  } as Navigator)
  ready()
  hold(1)
  // Any store change in the meantime runs the opener again.
  useConfigState.setState(s => ({allowAnimatedEmojis: !s.allowAnimatedEmojis}))
  expect(opened).toEqual(['over tabs, not yet committed'])
  setState(withShare(1))
  expect(opened).toHaveLength(1)
})

test('a share screen paused under pushed screens keeps its share; clearModals then finishes it', () => {
  ready()
  hold(1)
  setState(withPickers(1))
  expect(mockNative.acks).toEqual([])
  // Copy here: clearModals resets the root to the tabs.
  setState(tabs)
  expect(mockNative.acks).toEqual([1])
  expect(readAndroidShare(1)).toBeUndefined()
  newNavigator()
  setState({...tabs})
  expect(opened).toEqual(['over tabs 1'])
})

test('a reset that drops the share route finishes the share', () => {
  ready()
  hold(1)
  setState({index: 0, routes: [{key: 'x', name: 'loggedIn'}]})
  expect(mockNative.acks).toEqual([1])
})

test('a new navigator is not leaving the share: it is opened again there', () => {
  ready()
  hold(1)
  newNavigator()
  setState(tabs)
  expect(mockNative.acks).toEqual([])
  expect(opened).toEqual(['over tabs 1', 'over tabs 1'])
})

test('no state is no navigator: nothing is left or opened again', () => {
  ready()
  hold(1)
  useRouterState.getState().dispatch.setNavState(undefined as unknown as NavState)
  useConfigState.getState().dispatch.setLoggedIn(true)
  expect(mockNative.acks).toEqual([])
  expect(opened).toEqual(['over tabs 1'])
})

test('logging out ends a held share: whoever logs in next may not be who it was shared to', () => {
  ready()
  hold(1)
  useConfigState.getState().dispatch.setLoggedIn(false)
  setState({index: 0, routes: [{key: 'o', name: 'loggedOut'}]})
  expect(mockNative.acks).toEqual([1])

  ready()
  setState(tabs)
  expect(opened).toEqual(['over tabs 1'])
})

test('a share made while logged out is not ended by staying logged out, and opens after login', () => {
  hold(1)
  useConfigState.getState().dispatch.setLoggedIn(false)
  expect(mockNative.acks).toEqual([])
  ready()
  expect(opened).toEqual(['over tabs 1'])
})

test('an account switch is not leaving the share: it opens again in the account switched to', () => {
  ready()
  hold(1)
  useConfigState.setState({userSwitching: true})
  useConfigState.getState().dispatch.setLoggedIn(false)
  setState({index: 0, routes: [{key: 'o', name: 'loggedOut'}]})
  expect(mockNative.acks).toEqual([])

  useConfigState.setState({userSwitching: false})
  ready()
  expect(opened).toEqual(['over tabs 1'])
  setState(tabs)
  expect(mockNative.acks).toEqual([])
  expect(opened).toEqual(['over tabs 1', 'over tabs 1'])
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
