/// <reference types="jest" />
import * as T from '@/constants/types'
import {useConfigState} from '@/stores/config'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {useRouterState, type NavState} from '@/stores/router'
import {resetAllStores} from '@/util/zustand'
import {navigationRef} from '@/constants/navigator'

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

import {
  androidShareURL,
  onAndroidShareHeld,
  readAndroidShare,
  resetAndroidShareForTest,
  subscribeAndroidShareOpener,
} from './android-share'

let unsubscribe = () => {}
const intents = () => useNavigationIntentsState.getState()
// The share a pending link opens, ignoring the open=<n> that makes each link sent new.
const pendingURL = () => intents().intent?.url.replace(/&open=\d+$/, '')
const consume = () => {
  const {intent, dispatch} = intents()
  if (intent) dispatch.acknowledge(intent.id)
}
const hold = (id: number) => {
  mockNative.held = {droppedCount: 0, id, text: `share ${id}`}
  onAndroidShareHeld(id)
}
const ready = () => {
  useConfigState.getState().dispatch.setLoggedIn(true)
  intents().dispatch.setNavigationReady(true)
}
// Root states: the tabs alone, the share modal above them, and pickers pushed above the share
// (which pauses the share screen, but its route stays).
const tabs = {index: 0, routes: [{key: 'l', name: 'loggedIn'}]}
const withShare = (id: number) => ({
  index: 1,
  routes: [
    {key: 'l', name: 'loggedIn'},
    {key: `s${id}`, name: 'incomingShareNew', params: {androidShareID: id}},
  ],
})
const withPickers = (id: number) => ({
  index: 3,
  routes: [
    ...withShare(id).routes,
    {key: 'p1', name: 'destinationPicker'},
    {key: 'p2', name: 'destinationPicker'},
  ],
})
const setState = (s: object) => useRouterState.getState().dispatch.setNavState(s as unknown as NavState)
// The link was followed: the router consumes it and the state gets its route.
const follow = (id: number) => {
  consume()
  setState(withShare(id))
}
// A new NavigationContainer: its own handle in navigationRef.
const newNavigator = () => {
  navigationRef.current = {} as typeof navigationRef.current
}
const later = (ms: number) => jest.spyOn(Date, 'now').mockReturnValue(Date.now() + ms)

beforeEach(() => {
  mockNative.acks = []
  mockNative.held = undefined
  resetAndroidShareForTest()
  newNavigator()
  unsubscribe = subscribeAndroidShareOpener()
})

afterEach(() => {
  unsubscribe()
  jest.restoreAllMocks()
  resetAllStores()
})

test('the link names the share', () => {
  expect(androidShareURL(7)).toBe('keybase://incoming-share?androidShare=7')
})

test('a held share opens once logged in with the navigator ready', () => {
  hold(1)
  expect(pendingURL()).toBeUndefined()
  ready()
  expect(pendingURL()).toBe(androidShareURL(1))
})

test('a held share waits for whatever else is about to navigate, instead of replacing it', () => {
  ready()
  intents().dispatch.enqueue('keybase://convid/0000ab')
  hold(1)
  expect(pendingURL()).toBe('keybase://convid/0000ab')
  consume()
  expect(pendingURL()).toBe(androidShareURL(1))
})

test('a link that was followed is not sent again before its route shows, however long that takes', () => {
  ready()
  hold(1)
  consume()
  later(60_000)
  useConfigState.getState().dispatch.setLoggedIn(true)
  intents().dispatch.setNavigationReady(true)
  expect(pendingURL()).toBeUndefined()
})

test('a link dropped before it was followed is sent again', () => {
  ready()
  hold(1)
  // Replaced by another link before the router followed it.
  intents().dispatch.enqueue('keybase://convid/0000ab')
  consume()
  expect(pendingURL()).toBe(androidShareURL(1))
})

test('a followed link that never lands is sent once more on the next state, and only once', () => {
  ready()
  setState(tabs)
  hold(1)
  // Followed, but the router never got the share's route into the state.
  consume()
  setState({...tabs})
  expect(pendingURL()).toBe(androidShareURL(1))

  consume()
  setState({...tabs})
  expect(pendingURL()).toBeUndefined()
  setState({...tabs})
  expect(pendingURL()).toBeUndefined()
})

test('a state reported before the link is followed does not count as the link not landing', () => {
  ready()
  setState(tabs)
  hold(1)
  setState({...tabs})
  consume()
  expect(pendingURL()).toBeUndefined()
})

test('a followed link that lands is not sent again', () => {
  ready()
  setState(tabs)
  hold(1)
  follow(1)
  setState(withPickers(1))
  expect(pendingURL()).toBeUndefined()
})

test('shown is read from the state: a share whose route is in it is not sent again', () => {
  ready()
  hold(1)
  follow(1)
  later(60_000)
  intents().dispatch.enqueue('keybase://convid/0000ab')
  consume()
  expect(pendingURL()).toBeUndefined()
})

test('a share screen paused under pushed screens keeps its share; clearModals then finishes it', () => {
  ready()
  hold(1)
  follow(1)
  setState(withPickers(1))
  expect(mockNative.acks).toEqual([])
  // Copy here: clearModals resets the root to the tabs.
  setState(tabs)
  expect(mockNative.acks).toEqual([1])
  expect(readAndroidShare(1)).toBeUndefined()
  newNavigator()
  later(60_000)
  setState({...tabs})
  expect(pendingURL()).toBeUndefined()
})

test('a reset that drops the share route finishes the share', () => {
  ready()
  hold(1)
  follow(1)
  setState({index: 0, routes: [{key: 'x', name: 'loggedIn', state: {index: 0, routes: [{name: 'chatRoot'}]}}]})
  expect(mockNative.acks).toEqual([1])
})

test('a new navigator is not leaving the share: it is opened again there', () => {
  ready()
  hold(1)
  follow(1)
  newNavigator()
  setState(tabs)
  expect(mockNative.acks).toEqual([])
  expect(pendingURL()).toBe(androidShareURL(1))
})

test('logging out is not leaving the share: it opens again after login', () => {
  ready()
  hold(1)
  follow(1)
  useConfigState.getState().dispatch.setLoggedIn(false)
  setState({index: 0, routes: [{key: 'o', name: 'loggedOut'}]})
  expect(mockNative.acks).toEqual([])
  expect(pendingURL()).toBeUndefined()

  // Logging out reset the stores; logging in marks the same navigator ready again.
  ready()
  setState(tabs)
  expect(mockNative.acks).toEqual([])
  expect(pendingURL()).toBe(androidShareURL(1))
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
