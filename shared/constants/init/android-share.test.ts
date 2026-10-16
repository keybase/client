/// <reference types="jest" />
import * as T from '@/constants/types'
import {useConfigState} from '@/stores/config'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {resetAllStores} from '@/util/zustand'

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
  androidShareShown,
  androidShareURL,
  finishAndroidShare,
  onAndroidShareHeld,
  onAndroidShareNavigatorReady,
  readAndroidShare,
  resetAndroidShareForTest,
  subscribeAndroidShareOpener,
} from './android-share'

let unsubscribe = () => {}
const pendingURL = () => useNavigationIntentsState.getState().intent?.url
const consume = () => {
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) dispatch.acknowledge(intent.id)
}
const hold = (id: number) => {
  mockNative.held = {droppedCount: 0, id, text: `share ${id}`}
  onAndroidShareHeld(id)
}
const ready = () => {
  useConfigState.getState().dispatch.setLoggedIn(true)
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true)
}

beforeEach(() => {
  mockNative.acks = []
  mockNative.held = undefined
  resetAndroidShareForTest()
  unsubscribe = subscribeAndroidShareOpener()
})

afterEach(() => {
  unsubscribe()
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
  useNavigationIntentsState.getState().dispatch.enqueue('keybase://convid/0000ab')
  hold(1)
  expect(pendingURL()).toBe('keybase://convid/0000ab')
  consume()
  expect(pendingURL()).toBe(androidShareURL(1))
})

test('a share whose link was dropped by a store reset opens again', () => {
  ready()
  hold(1)
  resetAllStores()
  expect(pendingURL()).toBeUndefined()
  ready()
  expect(pendingURL()).toBe(androidShareURL(1))
})

test('a shown share is not opened again in the same navigator, but is in a new one', () => {
  ready()
  hold(1)
  consume()
  androidShareShown(1)
  useConfigState.getState().dispatch.setLoggedIn(true)
  useNavigationIntentsState.getState().dispatch.enqueue('keybase://convid/0000ab')
  consume()
  expect(pendingURL()).toBeUndefined()

  onAndroidShareNavigatorReady()
  expect(pendingURL()).toBe(androidShareURL(1))
})

test('a finished share is never opened again', () => {
  ready()
  hold(1)
  consume()
  androidShareShown(1)
  finishAndroidShare(1)
  expect(mockNative.acks).toEqual([1])
  // Past the window in which the same link is taken for a duplicate.
  const later = Date.now() + 60_000
  jest.spyOn(Date, 'now').mockReturnValue(later)
  onAndroidShareNavigatorReady()
  jest.restoreAllMocks()
  expect(pendingURL()).toBeUndefined()
  expect(readAndroidShare(1)).toBeUndefined()
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
