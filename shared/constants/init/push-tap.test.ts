/// <reference types="jest" />
import * as T from '@/constants/types'
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {listenForPushTaps} from './shared'

// The native slot, as far as these tests are concerned: a tap replaces whatever is held and gets a
// fresh id, a peek reads without clearing, and an ack clears only when its id is the held tap's.
const mockNative: {
  calls: Array<string>
  held?: {id: number; payload: string}
  lastID: number
  listeners: Array<() => void>
} = {calls: [], lastID: 0, listeners: []}

jest.mock('react-native-kb', () => ({
  ackPushTap: (id: number) => {
    mockNative.calls.push(`ack:${id}`)
    if (mockNative.held?.id === id) mockNative.held = undefined
  },
  addPushTapListener: (cb: () => void) => {
    mockNative.calls.push('listen')
    mockNative.listeners.push(cb)
    return () => {
      mockNative.listeners = mockNative.listeners.filter(l => l !== cb)
    }
  },
  peekPushTap: () => {
    mockNative.calls.push('peek')
    return mockNative.held ? {...mockNative.held} : null
  },
}))

const g = globalThis as unknown as {isAndroid: boolean; isIOS: boolean; isMobile: boolean}
const originalGlobals = {isAndroid: g.isAndroid, isIOS: g.isIOS, isMobile: g.isMobile}

// A tap as native holds it: the payload JSON, a fresh id, and the availability event.
const nativeTap = (payload: object | string) => {
  mockNative.held = {
    id: ++mockNative.lastID,
    payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
  }
  for (const l of mockNative.listeners) l()
  return mockNative.lastID
}

const chatTap = (uid: string) => ({
  convID: '0000ab',
  m: 'boxed-payload',
  t: '2',
  type: 'chat.newmessage',
  uid,
})

const setCurrentUid = (uid: string) => useCurrentUserState.setState({uid})
const acks = () => mockNative.calls.filter(c => c.startsWith('ack:'))
const peeks = () => mockNative.calls.filter(c => c === 'peek')

let stopListening: (() => void) | undefined
let unbox: jest.SpyInstance

beforeEach(() => {
  g.isMobile = true
  g.isAndroid = true
  g.isIOS = false
  mockNative.calls = []
  mockNative.held = undefined
  mockNative.listeners = []
  resetAllStores()
  setCurrentUid('uid-current')
  unbox = jest.spyOn(T.RPCChat, 'localUnboxMobilePushNotificationRpcPromise').mockResolvedValue('')
  jest.spyOn(logger, 'info').mockImplementation(() => {})
})

afterEach(() => {
  stopListening?.()
  stopListening = undefined
  // Consume any leftover intent while the native mock is installed, so its ack lands there.
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) dispatch.acknowledge(intent.id)
  resetAllStores()
  jest.restoreAllMocks()
  Object.assign(g, originalGlobals)
})

test('the listener is attached before the first peek', () => {
  stopListening = listenForPushTaps()

  expect(mockNative.calls.slice(0, 2)).toEqual(['listen', 'peek'])
})

test('a tap held from before JS listened is taken by the first peek', () => {
  const id = nativeTap(chatTap('uid-current'))

  stopListening = listenForPushTaps()

  expect(useNavigationIntentsState.getState().intent).toMatchObject({
    pushTapID: id,
    targetUid: 'uid-current',
    url: 'keybase://convid/0000ab',
  })
  expect(acks()).toEqual([])
})

test('a tap while listening is queued and not acked', () => {
  stopListening = listenForPushTaps()
  const id = nativeTap(chatTap('uid-current'))

  expect(useNavigationIntentsState.getState().intent).toMatchObject({pushTapID: id})
  expect(mockNative.held?.id).toBe(id)
  expect(acks()).toEqual([])
})

test('peek twice without ack returns the same id and queues one intent', () => {
  stopListening = listenForPushTaps()
  const id = nativeTap(chatTap('uid-current'))
  const first = useNavigationIntentsState.getState().intent

  // a second availability event, as a JS reload or a repeated event would cause
  for (const l of mockNative.listeners) l()

  expect(peeks()).toHaveLength(3)
  expect(mockNative.held?.id).toBe(id)
  expect(useNavigationIntentsState.getState().intent).toBe(first)
  expect(acks()).toEqual([])
})

test('ack with a stale id is a no-op and the newer held tap stays', () => {
  stopListening = listenForPushTaps()
  const older = nativeTap(chatTap('uid-current'))
  // a newer tap replaces the held one; its different URL supersedes the queued intent, which acks
  // the older id against a slot that no longer holds it
  const newer = nativeTap({type: 'device.new', uid: 'uid-current'})

  expect(acks()).toEqual([`ack:${older}`])
  expect(mockNative.held?.id).toBe(newer)
  expect(useNavigationIntentsState.getState().intent).toMatchObject({
    pushTapID: newer,
    url: 'keybase://devices',
  })
})

test('consuming the intent acks the current id and the next peek is empty', () => {
  stopListening = listenForPushTaps()
  const id = nativeTap(chatTap('uid-current'))

  const {intent, dispatch} = useNavigationIntentsState.getState()
  dispatch.acknowledge(intent!.id)

  expect(acks()).toEqual([`ack:${id}`])
  expect(mockNative.held).toBeUndefined()
  for (const l of mockNative.listeners) l()
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('a tap that opens nothing is acked at once', () => {
  stopListening = listenForPushTaps()
  const id = nativeTap({type: 'autoreset', uid: 'uid-current'})

  expect(acks()).toEqual([`ack:${id}`])
  expect(mockNative.held).toBeUndefined()
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('a payload that is not JSON is acked at once', () => {
  stopListening = listenForPushTaps()
  const id = nativeTap('not json')

  expect(acks()).toEqual([`ack:${id}`])
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('the taken tap is logged as [PushTap] took a tap link', () => {
  const info = jest.spyOn(logger, 'info').mockImplementation(() => {})
  stopListening = listenForPushTaps()
  nativeTap(chatTap('uid-current'))

  expect(info).toHaveBeenCalledWith('[PushTap] took a tap link:', 'keybase://convid/0000ab')
})

describe('unboxing a tapped chat push', () => {
  test('an Android tap for the current account unboxes its message', () => {
    stopListening = listenForPushTaps()
    nativeTap(chatTap('uid-current'))

    expect(unbox).toHaveBeenCalledTimes(1)
    expect(unbox).toHaveBeenCalledWith({
      convID: '0000ab',
      membersType: T.RPCChat.ConversationMembersType.impteamnative,
      payload: 'boxed-payload',
    })
  })

  test('taking the same tap twice unboxes it once', () => {
    stopListening = listenForPushTaps()
    nativeTap(chatTap('uid-current'))
    for (const l of mockNative.listeners) l()

    expect(unbox).toHaveBeenCalledTimes(1)
  })

  test('an Android tap for another account unboxes once that account is current', () => {
    stopListening = listenForPushTaps()
    nativeTap(chatTap('uid-other'))

    expect(unbox).not.toHaveBeenCalled()

    setCurrentUid('')
    expect(unbox).not.toHaveBeenCalled()
    setCurrentUid('uid-other')

    expect(unbox).toHaveBeenCalledTimes(1)
  })

  test('a tap dropped before its account is current never unboxes', () => {
    stopListening = listenForPushTaps()
    nativeTap(chatTap('uid-other'))
    const {intent, dispatch} = useNavigationIntentsState.getState()
    // the switch failed or the user logged out, and account-link-switch gave the tap up
    dispatch.acknowledge(intent!.id)

    setCurrentUid('uid-other')

    expect(unbox).not.toHaveBeenCalled()
  })

  test('a tap superseded before its account is current never unboxes', () => {
    stopListening = listenForPushTaps()
    nativeTap(chatTap('uid-other'))
    nativeTap({type: 'device.new', uid: 'uid-current'})

    setCurrentUid('uid-other')

    expect(unbox).not.toHaveBeenCalled()
  })

  test('a tap consumed as its account becomes current still unboxes', () => {
    // the router, subscribed first, consumes the intent the moment its account is current
    const stopRouter = useCurrentUserState.subscribe(s => {
      const {intent, dispatch} = useNavigationIntentsState.getState()
      if (intent?.targetUid === s.uid) dispatch.acknowledge(intent.id)
    })
    stopListening = listenForPushTaps()
    nativeTap(chatTap('uid-other'))

    setCurrentUid('uid-other')
    stopRouter()

    expect(useNavigationIntentsState.getState().intent).toBeUndefined()
    expect(unbox).toHaveBeenCalledTimes(1)
  })

  test('a cold Android tap waits for a logged-in account before unboxing', () => {
    setCurrentUid('')
    nativeTap({convID: '0000ab', m: 'boxed-payload', t: '2', type: 'chat.newmessage'})
    stopListening = listenForPushTaps()

    expect(unbox).not.toHaveBeenCalled()

    setCurrentUid('uid-current')

    expect(unbox).toHaveBeenCalledTimes(1)
  })

  test('iOS never unboxes a tap', () => {
    g.isAndroid = false
    g.isIOS = true
    stopListening = listenForPushTaps()
    nativeTap(chatTap('uid-current'))

    expect(unbox).not.toHaveBeenCalled()
  })

  test('a tap without a boxed payload or members type does not unbox', () => {
    stopListening = listenForPushTaps()
    nativeTap({convID: '0000ab', type: 'chat.newmessage', uid: 'uid-current'})

    expect(unbox).not.toHaveBeenCalled()
  })
})
