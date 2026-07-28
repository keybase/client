/// <reference types="jest" />
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {emitDeepLink, setInitialURLOnce} from './deep-link-emitter'

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
