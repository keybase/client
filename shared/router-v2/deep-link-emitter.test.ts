/// <reference types="jest" />
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {emitDeepLink, enqueuePushTap, pushTapTarget, setInitialURLOnce} from './deep-link-emitter'

const resetNavigationIntents = () => {
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) {
    dispatch.acknowledge(intent.id)
  }
  dispatch.resetState()
}

afterEach(() => {
  resetNavigationIntents()
})

test('normalizes and enqueues a deep link until navigation can consume it', () => {
  emitDeepLink('https://keybase.io/alice')

  expect(useNavigationIntentsState.getState().intent).toMatchObject({
    url: 'keybase://profile/show/alice',
  })
})

test('keeps the latest deep link while navigation is unavailable', () => {
  emitDeepLink('keybase://convid/older-conversation')
  emitDeepLink('keybase://convid/newer-conversation')

  expect(useNavigationIntentsState.getState().intent?.url).toBe(
    'keybase://convid/newer-conversation'
  )
})

test('does not enqueue an unsupported URL', () => {
  emitDeepLink('https://example.com/not-keybase')

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('deduplicates an emitted deep link already handled as the initial URL', () => {
  setInitialURLOnce('keybase://convid/test-conversation')
  emitDeepLink('keybase://convid/test-conversation')

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('removes a queued deep link when the initial URL handles it', () => {
  emitDeepLink('keybase://convid/queued-initial-conversation')
  expect(useNavigationIntentsState.getState().intent?.url).toBe(
    'keybase://convid/queued-initial-conversation'
  )

  setInitialURLOnce('keybase://convid/queued-initial-conversation')

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

describe('pushTapTarget', () => {
  const cases: Array<[string, string, ReturnType<typeof pushTapTarget>]> = [
    [
      'chat with account',
      '{"type":"chat.newmessage","convID":"0000ab","uid":"u1"}',
      {targetUid: 'u1', url: 'keybase://convid/0000ab'},
    ],
    [
      'chat without account',
      '{"type":"chat.newmessage","convID":"0000ab"}',
      {url: 'keybase://convid/0000ab'},
    ],
    ['chat without conversation', '{"type":"chat.newmessage"}', undefined],
    [
      'apns chat with numbers and aps',
      '{"type":"chat.newmessage","convID":"0000ab","uid":"u1","t":1,"aps":{"alert":{"body":"hi"}}}',
      {targetUid: 'u1', url: 'keybase://convid/0000ab'},
    ],
    [
      'a numeric convID becomes a string',
      '{"type":"chat.newmessage","convID":1234}',
      {url: 'keybase://convid/1234'},
    ],
    [
      'the uid is kept verbatim',
      '{"type":"chat.newmessage","convID":"0000ab","uid":"u 1&x"}',
      {targetUid: 'u 1&x', url: 'keybase://convid/0000ab'},
    ],
    [
      'follow with uid',
      '{"type":"follow","username":"testuser","uid":"u1"}',
      {targetUid: 'u1', url: 'keybase://profile/show/testuser'},
    ],
    [
      'follow with targetUID',
      '{"type":"follow","username":"testuser","targetUID":"u2"}',
      {targetUid: 'u2', url: 'keybase://profile/show/testuser'},
    ],
    ['follow without username', '{"type":"follow","uid":"u1"}', undefined],
    ['new device', '{"type":"device.new","uid":"u1","device_id":"d1"}', {targetUid: 'u1', url: 'keybase://devices'}],
    ['revoked device without account', '{"type":"device.revoked","device_id":"d1"}', undefined],
    ['contacts joined', '{"message":"Your contact testuser joined Keybase"}', {url: 'keybase://tabs.peopleTab'}],
    ['read receipt', '{"type":"chat.readmessage","b":0,"message":"Your contact x"}', undefined],
    ['silent chat', '{"type":"chat.newmessageSilent_2","c":"0000ab"}', undefined],
    ['extension', '{"type":"chat.extension","convID":"0000ab"}', undefined],
    ['autoreset', '{"type":"autoreset","uid":"u1"}', undefined],
    ['failed pending', '{"type":"chat.failedpending","convID":"0000ab","uid":""}', undefined],
    ['an unknown type opens nothing', '{"type":"something.new","uid":"u1"}', undefined],
    ['not json', 'not json', undefined],
    ['json that is not an object', '"just a string"', undefined],
  ]

  test.each(cases)('%s', (_name, payload, want) => {
    expect(pushTapTarget(payload)).toEqual(want)
  })
})

test('a foreign link never targets an account', () => {
  emitDeepLink('keybase://convid/0000ab')

  const {intent} = useNavigationIntentsState.getState()
  expect(intent?.url).toBe('keybase://convid/0000ab')
  expect(intent?.targetUid).toBeUndefined()
})

test('a tap targets its account', () => {
  enqueuePushTap('{"type":"chat.newmessage","convID":"0000ab","uid":"uid-other"}')

  const {intent} = useNavigationIntentsState.getState()
  expect(intent?.url).toBe('keybase://convid/0000ab')
  expect(intent?.targetUid).toBe('uid-other')
})

test('a tap for a link a foreign open already queued upgrades that intent', () => {
  emitDeepLink('keybase://convid/0000ab')
  enqueuePushTap('{"type":"chat.newmessage","convID":"0000ab","uid":"uid-other"}')

  expect(useNavigationIntentsState.getState().intent?.targetUid).toBe('uid-other')
})

test('a tap with nothing to open queues nothing', () => {
  enqueuePushTap('{"type":"autoreset","uid":"uid-other"}')

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})
