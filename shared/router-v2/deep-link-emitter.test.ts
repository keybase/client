/// <reference types="jest" />
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {emitDeepLink, enqueuePushTapRoute, setInitialURLOnce} from './deep-link-emitter'

// react-native-kb's native tap slot; only its ack is reached from here.
const mockAckPushTap = jest.fn()
jest.mock('react-native-kb', () => ({ackPushTap: (id: number) => mockAckPushTap(id)}))

// A push tap's id must not repeat across tests any more than it does across taps.
let nextTapID = 8000
const tapID = () => ++nextTapID

const resetNavigationIntents = () => {
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) {
    dispatch.acknowledge(intent.id)
  }
  dispatch.resetState()
}

beforeEach(() => {
  mockAckPushTap.mockClear()
})

afterEach(() => {
  resetNavigationIntents()
  jest.restoreAllMocks()
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

test('a foreign link never targets an account', () => {
  emitDeepLink('keybase://convid/0000ab')

  const {intent} = useNavigationIntentsState.getState()
  expect(intent?.url).toBe('keybase://convid/0000ab')
  expect(intent?.targetUid).toBeUndefined()
})

test('a tap targets its account', () => {
  enqueuePushTapRoute({id: tapID(), targetUid: 'uid-other', url: 'keybase://convid/0000ab'})

  const {intent} = useNavigationIntentsState.getState()
  expect(intent?.url).toBe('keybase://convid/0000ab')
  expect(intent?.targetUid).toBe('uid-other')
})

test('a tap for a link a foreign open already queued upgrades that intent', () => {
  emitDeepLink('keybase://convid/0000ab')
  enqueuePushTapRoute({id: tapID(), targetUid: 'uid-other', url: 'keybase://convid/0000ab'})

  expect(useNavigationIntentsState.getState().intent?.targetUid).toBe('uid-other')
})

// The resolver leaves targetUid empty for a route no account owns, and an empty one must not
// read as a target: an intent with one is what account-link-switch acts on.
test('a tap with no account is not a targeted intent', () => {
  enqueuePushTapRoute({id: tapID(), targetUid: '', url: 'keybase://tabs.peopleTab'})

  const {intent} = useNavigationIntentsState.getState()
  expect(intent?.url).toBe('keybase://tabs.peopleTab')
  expect(intent?.targetUid).toBeUndefined()
})
