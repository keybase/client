/// <reference types="jest" />
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {setPushTapAck, useNavigationIntentsState} from '@/stores/navigation-intents'
import {emitDeepLink, enqueuePushTapRoute} from './deep-link-emitter'
import * as Settings from '@/constants/settings'
import * as Tabs from '@/constants/tabs'
import {createLinkingConfig, isHandledByLinkingConfig, subscribeNavigationIntents} from './linking'

// Stands in for react-native-kb's native tap slot; only its ack is reached from here.
const mockAckPushTap = jest.fn()
setPushTapAck(id => mockAckPushTap(id))

const setCurrentUser = (uid: string) => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: '',
    deviceName: '',
    uid,
    username: uid,
  })
}

// A push tap's id must not repeat across tests any more than it does across taps.
let nextTapID = 10_000
const tapID = () => ++nextTapID

const clearIntent = () => {
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) {
    dispatch.acknowledge(intent.id)
  }
  dispatch.resetState()
}

beforeEach(() => {
  mockAckPushTap.mockClear()
  useConfigState.getState().dispatch.setLoggedIn(true)
  useConfigState.getState().dispatch.setUserSwitching(false)
  setCurrentUser('current-uid')
})

afterEach(() => {
  clearIntent()
  jest.restoreAllMocks()
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

  enqueuePushTapRoute({id: tapID(), targetUid: 'target-uid', url: 'keybase://convid/target-account-conversation'})
  expect(listener).not.toHaveBeenCalled()

  setCurrentUser('target-uid')
  expect(listener).not.toHaveBeenCalled()

  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, 'target-uid')

  expect(listener).toHaveBeenCalledTimes(1)
  expect(listener).toHaveBeenCalledWith('keybase://convid/target-account-conversation')
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
  unsubscribe()
})

// Starting a switch resets every store, logging the old account out of them; the switched-to
// account's bootstrap then logs it back in and its router readies before the switch ends.
const landSwitchOn = (uid: string) => {
  setCurrentUser(uid)
  useConfigState.getState().dispatch.setLoggedIn(true)
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, uid)
}

test('waits for an account switch to finish', () => {
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, 'current-uid')
  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  enqueuePushTapRoute({id: tapID(), targetUid: 'current-uid', url: 'keybase://convid/account-switch-conversation'})
  landSwitchOn('current-uid')
  expect(listener).not.toHaveBeenCalled()

  useConfigState.getState().dispatch.setUserSwitching(false)

  expect(listener).toHaveBeenCalledTimes(1)
  unsubscribe()
})

test('waits for the replacement router after the current account changes', () => {
  const navigationDispatch = useNavigationIntentsState.getState().dispatch
  navigationDispatch.setNavigationReady(true, 'current-uid')
  useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
  const listener = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, jest.fn())

  enqueuePushTapRoute({id: tapID(), targetUid: 'target-uid', url: 'keybase://convid/replacement-router-conversation'})
  setCurrentUser('target-uid')
  useConfigState.getState().dispatch.setLoggedIn(true)

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

const getStateFromPath = (path: string) =>
  (createLinkingConfig(jest.fn()).getStateFromPath as (p: string) => unknown)(path)

test('a devices link is consumed by the linking config, not by handleAppLink', () => {
  useNavigationIntentsState.getState().dispatch.setNavigationReady(true, 'current-uid')
  const listener = jest.fn()
  const handleAppLink = jest.fn()
  const unsubscribe = subscribeNavigationIntents(listener, handleAppLink)

  emitDeepLink('keybase://devices')

  expect(isHandledByLinkingConfig('keybase://devices')).toBe(true)
  expect(listener).toHaveBeenCalledWith('keybase://devices')
  expect(handleAppLink).not.toHaveBeenCalled()
  unsubscribe()
})

// isSplit is baked in at module load and this suite loads as desktop, so global.isMobile alone
// gets the tablet shape, not the phone one. Phone coverage lives in linking-phone.test.ts.
test('a devices link opens the devices screen inside the settings tab on tablet', () => {
  const wasMobile = global.isMobile
  global.isMobile = true
  try {
    expect(getStateFromPath('devices')).toEqual({
      index: 0,
      routes: [
        {
          name: 'loggedIn',
          state: {
            index: 0,
            routes: [
              {
                name: Tabs.settingsTab,
                state: {
                  index: 1,
                  routes: [{name: 'settingsRoot'}, {name: Settings.settingsDevicesTab}],
                },
              },
            ],
          },
        },
      ],
    })
  } finally {
    global.isMobile = wasMobile
  }
})

test('a devices link opens the devices tab on desktop', () => {
  expect(getStateFromPath('devices')).toEqual({
    index: 0,
    routes: [{name: 'loggedIn', state: {index: 0, routes: [{name: Tabs.devicesTab}]}}],
  })
})
