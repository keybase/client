/// <reference types="jest" />
let mockSlot = ''
const mockCalls = new Array<string>()
let mockFire: (() => void) | undefined

jest.mock('react-native-kb', () => ({
  onPushTap: (cb: () => void) => {
    mockCalls.push('onPushTap')
    mockFire = cb
    return {
      remove: () => {
        mockCalls.push('remove')
        mockFire = undefined
      },
    }
  },
  takePushTap: () => {
    mockCalls.push('takePushTap')
    const payload = mockSlot
    mockSlot = ''
    return payload
  },
}))

import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {subscribePushTaps} from './push-listener.native'

const chatTap = '{"type":"chat.newmessage","convID":"0000ab","uid":"uid-other"}'

beforeEach(() => {
  mockSlot = ''
  mockCalls.length = 0
  mockFire = undefined
})

afterEach(() => {
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) dispatch.acknowledge(intent.id)
  useNavigationIntentsState.setState({lastHandledIntent: undefined})
})

test('subscribes before it takes the startup tap', () => {
  const unsub = subscribePushTaps()

  expect(mockCalls).toEqual(['onPushTap', 'takePushTap'])

  unsub()
})

test('a startup tap queues a tap intent', () => {
  mockSlot = chatTap
  const unsub = subscribePushTaps()

  expect(useNavigationIntentsState.getState().intent).toMatchObject({
    targetUid: 'uid-other',
    url: 'keybase://convid/0000ab',
  })

  unsub()
})

test('a tap that arrives later is taken on its event', () => {
  const unsub = subscribePushTaps()
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()

  mockSlot = '{"type":"device.new","uid":"uid-other"}'
  mockFire?.()

  expect(useNavigationIntentsState.getState().intent).toMatchObject({
    targetUid: 'uid-other',
    url: 'keybase://devices',
  })

  unsub()
})

test('no tap queues nothing', () => {
  const unsub = subscribePushTaps()

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()

  unsub()
})

test('unsubscribing removes the listener', () => {
  const unsub = subscribePushTaps()
  unsub()

  expect(mockCalls.at(-1)).toBe('remove')
})
