/// <reference types="jest" />
import type * as Init from './index'
import type * as ConfigStore from '@/stores/config'
import type * as IntentsStore from '@/stores/navigation-intents'
import type * as Types from '../types'

// The init module picks its mobile behavior from the platform globals, so it is loaded fresh
// with them set and the native modules mocked, like location-watch.test.ts does. Everything the
// assertions touch has to come out of the same fresh registry, or the module under test writes
// to a different copy of the stores than the test reads.
const originalGlobals = {isAndroid: global.isAndroid, isIOS: global.isIOS, isMobile: global.isMobile}

type Loaded = {
  init: typeof Init
  useConfigState: (typeof ConfigStore)['useConfigState']
  useNavigationIntentsState: (typeof IntentsStore)['useNavigationIntentsState']
}

const load = (initialURL: string | null): Loaded => {
  global.isMobile = true
  global.isIOS = true
  global.isAndroid = false
  jest.resetModules()
  jest.doMock('./platform', () => ({
    getNative: () => ({
      Linking: {getInitialURL: async () => Promise.resolve(initialURL)},
      guiConfig: '{}',
    }),
  }))
  jest.doMock('./shared', () => ({_onEngineIncoming: () => {}}))
  // pulls in the mobile theme, which needs more of react-native than the test mock has
  jest.doMock('@/fs/common/lifecycle', () => ({}))
  const T = require('../types') as typeof Types
  jest.spyOn(T.RPCGen, 'configGuiSetValueRpcPromise').mockResolvedValue(undefined as never)
  return {
    init: require('./index') as typeof Init,
    useConfigState: (require('@/stores/config') as typeof ConfigStore).useConfigState,
    useNavigationIntentsState: (require('@/stores/navigation-intents') as typeof IntentsStore)
      .useNavigationIntentsState,
  }
}

const inviteLink = 'https://keybase.io/phone-app'
const addPhone = 'keybase://settingsAddPhone'

let unsubscribe: (() => void) | undefined

afterEach(() => {
  unsubscribe?.()
  unsubscribe = undefined
  jest.restoreAllMocks()
  jest.dontMock('./platform')
  jest.dontMock('./shared')
  jest.dontMock('@/fs/common/lifecycle')
  Object.assign(global, originalGlobals)
})

test('an invite link that launches a logged-out app opens add-phone after the signup', async () => {
  const {init, useConfigState, useNavigationIntentsState} = load(inviteLink)
  unsubscribe = init._replayLaunchLinkAfterLogin()

  await init.loadStartupDetails()
  // the router's linking config is off while logged out, so nothing may navigate yet
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()

  // ...the user signs up, which is the only thing that moves loggedIn off false
  useConfigState.getState().dispatch.setLoggedIn(true)
  expect(useNavigationIntentsState.getState().intent?.url).toBe(addPhone)
  // no targetUid: a link can never switch accounts, only a real notification tap can
  expect(useNavigationIntentsState.getState().intent?.targetUid).toBeUndefined()
})

test('the held launch link is replayed once, not on every later login', async () => {
  const {init, useConfigState, useNavigationIntentsState} = load(inviteLink)
  unsubscribe = init._replayLaunchLinkAfterLogin()

  await init.loadStartupDetails()
  useConfigState.getState().dispatch.setLoggedIn(true)
  const id = useNavigationIntentsState.getState().intent?.id
  expect(id).toBeDefined()
  useNavigationIntentsState.getState().dispatch.acknowledge(id!)

  // logging out resets the stores; logging back in must not re-fire the nudge
  useConfigState.getState().dispatch.setLoggedIn(false)
  useConfigState.getState().dispatch.setLoggedIn(true)
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('a launch link for an already logged-in app is left to the linking config', async () => {
  const {init, useConfigState, useNavigationIntentsState} = load(inviteLink)
  unsubscribe = init._replayLaunchLinkAfterLogin()
  useConfigState.setState({loggedIn: true})

  await init.loadStartupDetails()
  // getInitialURL reads the URL itself in this case; holding it too would double-navigate
  useConfigState.getState().dispatch.setLoggedIn(false)
  useConfigState.getState().dispatch.setLoggedIn(true)
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('no launch url means nothing is replayed', async () => {
  const {init, useConfigState, useNavigationIntentsState} = load(null)
  unsubscribe = init._replayLaunchLinkAfterLogin()

  await init.loadStartupDetails()
  useConfigState.getState().dispatch.setLoggedIn(true)
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})
