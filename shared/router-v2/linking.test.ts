/// <reference types="jest" />
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {emitDeepLink} from './deep-link-emitter'
import {subscribeNavigationIntents} from './linking'

const setCurrentUser = (uid: string) => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: '',
    deviceName: '',
    uid,
    username: uid,
  })
}

const clearIntent = () => {
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) {
    dispatch.acknowledge(intent.id)
  }
  dispatch.resetState()
}

beforeEach(() => {
  useConfigState.getState().dispatch.setLoggedIn(true)
  useConfigState.getState().dispatch.setUserSwitching(false)
  setCurrentUser('current-uid')
})

afterEach(() => {
  clearIntent()
})

test('waits for navigation readiness before consuming an intent', () => {
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  emitDeepLink('keybase://convid/readiness-conversation')
  expect(listener).not.toHaveBeenCalled()

  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, 'current-uid')

  expect(listener).toHaveBeenCalledTimes(1)
  expect(listener).toHaveBeenCalledWith('keybase://convid/readiness-conversation')
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
  unsubscribe()
})

test('retains an intent across a temporary subscription gap', () => {
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, 'current-uid')
  emitDeepLink('keybase://convid/subscription-gap-conversation')

  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  expect(listener).toHaveBeenCalledTimes(1)
  expect(listener).toHaveBeenCalledWith('keybase://convid/subscription-gap-conversation')
  unsubscribe()
})

test('waits until the intended account is active', () => {
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, 'current-uid')
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  emitDeepLink('keybase://convid/target-account-conversation', {targetUid: 'target-uid'})
  expect(listener).not.toHaveBeenCalled()

  setCurrentUser('target-uid')
  expect(listener).not.toHaveBeenCalled()

  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, 'target-uid')

  expect(listener).toHaveBeenCalledTimes(1)
  expect(listener).toHaveBeenCalledWith('keybase://convid/target-account-conversation')
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
  unsubscribe()
})

test('waits for an account switch to finish', () => {
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, 'current-uid')
  useConfigState.getState().dispatch.setUserSwitching(true)
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  emitDeepLink('keybase://convid/account-switch-conversation', {targetUid: 'current-uid'})
  expect(listener).not.toHaveBeenCalled()

  useConfigState.getState().dispatch.setUserSwitching(false)

  expect(listener).toHaveBeenCalledTimes(1)
  unsubscribe()
})

test('waits for the replacement router after the current account changes', () => {
  const navigationDispatch = useNavigationIntentsState.getState().dispatch
  navigationDispatch.setNavigationReady(true, 'current-uid')
  useConfigState.getState().dispatch.setUserSwitching(true)
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  emitDeepLink('keybase://convid/replacement-router-conversation', {
    targetUid: 'target-uid',
  })
  setCurrentUser('target-uid')

  // The bootstrap UID can change before React commits the keyed router remount.
  // Even if switching is cleared early, the old account's ready router must not
  // consume and acknowledge the target account's intent.
  useConfigState.getState().dispatch.setUserSwitching(false)
  expect(listener).not.toHaveBeenCalled()

  navigationDispatch.setNavigationReady(true, 'target-uid')
  expect(listener).toHaveBeenCalledTimes(1)
  expect(listener).toHaveBeenCalledWith('keybase://convid/replacement-router-conversation')
  unsubscribe()
})

test('uses imperative navigation for URLs outside the linking state config', () => {
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, 'current-uid')
  const listener = jest.fn()
  const handleAppLink = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, handleAppLink)

  emitDeepLink('keybase://team-page/keybase')

  expect(listener).not.toHaveBeenCalled()
  expect(handleAppLink).toHaveBeenCalledWith('keybase://team-page/keybase')
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
  unsubscribe()
})

test('consumes an intent after bootstrap fills in the uid the router readied with', () => {
  // Desktop mounts its NavigationContainer before the bootstrap RPC returns, so
  // onReady stamps readiness with an empty uid. The same container then serves
  // the logged-in user; intents must not be stranded.
  setCurrentUser('')
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, '')
  setCurrentUser('current-uid')

  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  emitDeepLink('keybase://convid/post-bootstrap-conversation')

  expect(listener).toHaveBeenCalledTimes(1)
  expect(listener).toHaveBeenCalledWith('keybase://convid/post-bootstrap-conversation')
  unsubscribe()
})
