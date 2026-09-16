/// <reference types="jest" />
import type * as PushListener from './push-listener.native'
import type * as PushStore from '@/stores/push'
import type * as ConfigStore from '@/stores/config'
import type * as CurrentUserStore from '@/stores/current-user'
import type * as T from '@/constants/types'

// push-listener and the push store pick their mobile behavior when they load, so each test loads
// them fresh with the mobile globals set and the native module mocked.

type Loaded = {
  configStore: typeof ConfigStore
  currentUserStore: typeof CurrentUserStore
  pushListener: typeof PushListener
  pushStore: typeof PushStore
}

const calls = new Array<string>()
const emitDeepLink = jest.fn()
const switchTab = jest.fn()
const navUpToScreen = jest.fn()
let onNotification: ((n: object) => void) | undefined
const pushSubRemove = jest.fn()
let getInitialNotification: () => Promise<object | null> = async () => Promise.resolve(null)

const currentUid = 'uid-testuser'
const otherUid = 'uid-testuser-mac'
const convID = 'aabbccdd'

const originalGlobals = {isAndroid: global.isAndroid, isIOS: global.isIOS, isMobile: global.isMobile}

const load = (): Loaded => {
  global.isMobile = true
  global.isIOS = true
  global.isAndroid = false
  jest.resetModules()
  jest.doMock('react-native-kb', () => ({
    checkPushPermissions: async () => Promise.resolve(true),
    getInitialNotification: async () => getInitialNotification(),
    getRegistrationToken: async () => Promise.resolve(''),
    iosGetHasShownPushPrompt: async () => Promise.resolve(true),
    onPushNotification: (cb: (n: object) => void) => {
      calls.push('onPushNotification')
      onNotification = cb
      return {remove: pushSubRemove}
    },
    onPushToken: () => ({remove: () => {}}),
    onShareData: () => ({remove: () => {}}),
    pushListenerRegistered: () => {
      calls.push('pushListenerRegistered')
    },
    removeAllPendingNotificationRequests: () => {},
    requestPushPermissions: async () => Promise.resolve(true),
    setApplicationIconBadgeNumber: () => {},
  }))
  jest.doMock('@/router-v2/deep-link-emitter', () => ({
    emitDeepLink,
    normalizeUrl: (url: string) => url,
    setInitialURLOnce: (url: string) => url,
  }))
  jest.doMock('@/constants/router', () => ({
    ...jest.requireActual<object>('@/constants/router'),
    getRootState: () => undefined,
    navUpToScreen,
    switchTab,
  }))
  const loaded = {
    configStore: require('@/stores/config') as typeof ConfigStore,
    currentUserStore: require('@/stores/current-user') as typeof CurrentUserStore,
    pushListener: require('./push-listener.native') as typeof PushListener,
    pushStore: require('@/stores/push') as typeof PushStore,
  }
  const T_ = require('@/constants/types') as typeof T
  jest.spyOn(T_.RPCGen, 'configGuiGetValueRpcPromise').mockResolvedValue({b: true, isNull: false})
  loaded.currentUserStore.useCurrentUserState.setState({uid: currentUid, username: 'testuser'})
  loaded.configStore.useConfigState.setState({
    configuredAccounts: [{hasStoredSecret: true, uid: currentUid, username: 'testuser'}],
    loggedIn: true,
  })
  return loaded
}

const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

afterEach(() => {
  calls.length = 0
  onNotification = undefined
  getInitialNotification = async () => Promise.resolve(null)
  jest.useRealTimers()
  jest.restoreAllMocks()
  jest.clearAllMocks()
  jest.dontMock('react-native-kb')
  jest.dontMock('@/router-v2/deep-link-emitter')
  jest.dontMock('@/constants/router')
  jest.resetModules()
  global.isMobile = originalGlobals.isMobile
  global.isIOS = originalGlobals.isIOS
  global.isAndroid = originalGlobals.isAndroid
})

// every raw push type whose handling can navigate
const navigatingPushes = (userInteraction: boolean) => ({
  'chat.extension': {convID, type: 'chat.extension', userInteraction},
  'chat.newmessage': {convID, m: '', t: 2, type: 'chat.newmessage', userInteraction},
  'chat.newmessage for another account': {
    convID,
    m: '',
    t: 2,
    type: 'chat.newmessage',
    uid: otherUid,
    userInteraction,
  },
  'device.new': {type: 'device.new', uid: currentUid, userInteraction},
  'device.revoked': {type: 'device.revoked', uid: currentUid, userInteraction},
  follow: {type: 'follow', username: 'testuser-mac', userInteraction},
  'settings.contacts': {message: 'Your contact testuser-mac joined Keybase', userInteraction},
})

describe('live pushes', () => {
  test('the native readiness signal comes after the push listener is registered', () => {
    const {pushListener} = load()
    const unsubs = pushListener.initPushListener()
    expect(calls).toEqual(['onPushNotification', 'pushListenerRegistered'])

    for (const unsub of unsubs) unsub()
    expect(pushSubRemove).toHaveBeenCalled()
  })

  test.each(Object.entries(navigatingPushes(false)))('%s without a tap never navigates', async (_, raw) => {
    const {pushListener, pushStore} = load()
    pushListener.initPushListener()
    onNotification?.(raw)
    await flush()

    expect(emitDeepLink).not.toHaveBeenCalled()
    expect(switchTab).not.toHaveBeenCalled()
    expect(navUpToScreen).not.toHaveBeenCalled()
    expect(pushStore.usePushState.getState().pendingPushNotification).toBeUndefined()
  })

  test.each(Object.entries(navigatingPushes(true)))('%s with a tap navigates', async (name, raw) => {
    const {pushListener, pushStore} = load()
    pushListener.initPushListener()
    onNotification?.(raw)
    await flush()

    if (name === 'chat.newmessage for another account') {
      // not a configured account yet: kept until the account list catches up
      expect(pushStore.usePushState.getState().pendingPushNotification?.type).toBe('chat.newmessage')
    } else if (name.startsWith('device.')) {
      expect(switchTab).toHaveBeenCalled()
    } else {
      expect(emitDeepLink).toHaveBeenCalledTimes(1)
    }
  })
})

describe('startup push', () => {
  const tapped = {
    'chat.newmessage': {convID, m: 'payload', t: 2, type: 'chat.newmessage'},
    follow: {type: 'follow', username: 'testuser-mac'},
  }

  // the read races a timer; fake timers keep it from outliving the test
  beforeEach(() => {
    jest.useFakeTimers()
  })

  test.each(Object.entries(tapped))('%s without a tap does not pick the startup screen', async (_, raw) => {
    const {pushListener, pushStore} = load()
    getInitialNotification = async () => Promise.resolve({...raw, userInteraction: false})
    await expect(pushListener.getStartupDetailsFromInitialPush()).resolves.toBeUndefined()
    expect(pushStore.usePushState.getState().pendingPushNotification).toBeUndefined()
  })

  test('chat.newmessage for another account without a tap is not kept pending', async () => {
    const {pushListener, pushStore} = load()
    getInitialNotification = async () =>
      Promise.resolve({...tapped['chat.newmessage'], uid: otherUid, userInteraction: false})
    await expect(pushListener.getStartupDetailsFromInitialPush()).resolves.toBeUndefined()
    expect(pushStore.usePushState.getState().pendingPushNotification).toBeUndefined()
  })

  test('a tapped chat.newmessage for another account is kept pending for the account switch', async () => {
    const {pushListener, pushStore} = load()
    getInitialNotification = async () =>
      Promise.resolve({...tapped['chat.newmessage'], uid: otherUid, userInteraction: true})
    await expect(pushListener.getStartupDetailsFromInitialPush()).resolves.toBeUndefined()
    const pending = pushStore.usePushState.getState().pendingPushNotification
    expect(pending?.type).toBe('chat.newmessage')
    expect(pending && 'forUid' in pending && pending.forUid).toBe(otherUid)
  })

  test('tapped pushes pick the startup screen', async () => {
    const {pushListener} = load()
    getInitialNotification = async () => Promise.resolve({...tapped['chat.newmessage'], userInteraction: true})
    await expect(pushListener.getStartupDetailsFromInitialPush()).resolves.toEqual({
      startupConversation: convID,
      startupPushPayload: 'payload',
    })
    getInitialNotification = async () => Promise.resolve({...tapped.follow, userInteraction: true})
    await expect(pushListener.getStartupDetailsFromInitialPush()).resolves.toEqual({
      startupFollowUser: 'testuser-mac',
    })
  })

  test('a tap that native takes a while to hand over is not lost', async () => {
    const {pushListener} = load()
    getInitialNotification = async () =>
      new Promise(resolve => {
        setTimeout(() => resolve({...tapped['chat.newmessage'], userInteraction: true}), 50)
      })
    const details = pushListener.getStartupDetailsFromInitialPush()
    await jest.advanceTimersByTimeAsync(50)
    await expect(details).resolves.toEqual({startupConversation: convID, startupPushPayload: 'payload'})
  })

  test('startup does not wait forever on native, and a tap that lands later still navigates', async () => {
    const {pushListener} = load()
    getInitialNotification = async () =>
      new Promise(resolve => {
        setTimeout(() => resolve({...tapped['chat.newmessage'], userInteraction: true}), 60_000)
      })
    const details = pushListener.getStartupDetailsFromInitialPush()
    await jest.advanceTimersByTimeAsync(10_000)
    await expect(details).resolves.toBeUndefined()
    expect(emitDeepLink).not.toHaveBeenCalled()

    await jest.advanceTimersByTimeAsync(50_000)
    await flush()
    expect(emitDeepLink).toHaveBeenCalledWith(`keybase://convid/${convID}`, {targetUid: undefined})
  })
})
