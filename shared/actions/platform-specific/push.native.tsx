import * as Chat2Gen from '../chat2-gen'
import * as ConfigGen from '../config-gen'
import * as Constants from '../../constants/push'
import * as NotificationsGen from '../notifications-gen'
import * as ProfileGen from '../profile-gen'
import * as PushGen from '../push-gen'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import * as WaitingGen from '../waiting-gen'
import * as RouteTreeGen from '../route-tree-gen'
import * as Tabs from '../../constants/tabs'
import logger from '../../logger'
import {NativeEventEmitter} from 'react-native'
import {NativeModules} from '../../util/native-modules.native'
import {isIOS, isAndroid} from '../../constants/platform'
import type * as Container from '../../util/container'
import type * as Types from '../../constants/types/push'

const setApplicationIconBadgeNumber = (n: number) => {
  if (isIOS) {
    PushNotificationIOS.setApplicationIconBadgeNumber(n)
  } else {
    NativeModules.KeybaseEngine.androidSetApplicationIconBadgeNumber?.(n)
  }
}

let lastCount = -1
const updateAppBadge = (action: NotificationsGen.ReceivedBadgeStatePayload) => {
  const count = action.payload.badgeState.bigTeamBadgeCount + action.payload.badgeState.smallTeamBadgeCount
  setApplicationIconBadgeNumber(count)
  // Only do this native call if the count actually changed, not over and over if its zero
  if (isIOS && count === 0 && lastCount !== 0) {
    PushNotificationIOS.removeAllPendingNotificationRequests()
  }
  lastCount = count
}

// Push notifications on android are simple.
// 1. KeybasePushNotificationListenerService.java is our listening service. (https://firebase.google.com/docs/cloud-messaging/android/receive)
// 2. When a notification comes in it is handled only on Go/Java side (native only)
// That's it.

// If you want to pass data along to JS, you do so with an Intent.
// The notification is built with a pending intent (a description of how to build a real Intent obj).
// When you click the notification you fire the Intent, which starts the MainActivity and calls `onNewIntent`.
// Take a look at MainActivity's onNewIntent, onResume, and emitIntent methods.
//
// High level:
// 1. we read the intent that started the MainActivity (in onNewIntent)
// 2. in `onResume` we check if we have an intent, if we do call `emitIntent`
// 3. `emitIntent` eventually calls `RCTDeviceEventEmitter` with a couple different event names for various events
// 4. We subscribe to those events below (e.g. `RNEmitter.addListener('initialIntentFromNotification', evt => {`)

// At startup the flow above can be racy, since we may not have registered the
// event listener before the event is emitted. In that case you can always use
// `getInitialPushAndroid`.
const listenForNativeAndroidIntentNotifications = async (
  emitter: (action: Container.TypedActions) => void
) => {
  const pushToken = (await NativeModules.Utils.androidGetRegistrationToken?.()) ?? ''
  logger.debug('[PushToken] received new token: ', pushToken)
  emitter(PushGen.createUpdatePushToken({token: pushToken}))

  const RNEmitter = new NativeEventEmitter(NativeModules.KeybaseEngine as any)
  RNEmitter.addListener('initialIntentFromNotification', evt => {
    const notification = evt && Constants.normalizePush(evt)
    notification && emitter(PushGen.createNotification({notification}))
  })

  RNEmitter.addListener('onShareData', evt => {
    logger.debug('[ShareDataIntent]', evt)
    emitter(
      ConfigGen.createAndroidShare({
        text: evt.text,
        url: evt.localPath,
      })
    )
  })
}

const listenForPushNotificationsFromJS = (emitter: (action: Container.TypedActions) => void) => {
  const onRegister = (token: string) => {
    logger.debug('[PushToken] received new token: ', token)
    emitter(PushGen.createUpdatePushToken({token}))
  }

  const onNotification = (n: Object) => {
    logger.debug('[onNotification]: ', n)
    const notification = Constants.normalizePush(n)
    if (!notification) {
      return
    }
    emitter(PushGen.createNotification({notification}))
  }

  isIOS && PushNotificationIOS.addEventListener('notification', onNotification)
  isIOS && PushNotificationIOS.addEventListener('localNotification', onNotification)
  isIOS && PushNotificationIOS.addEventListener('register', onRegister)
}

function* setupPushEventLoop() {
  const pushChannel = yield Saga.eventChannel(emitter => {
    if (isAndroid) {
      listenForNativeAndroidIntentNotifications(emitter)
        .then(() => {})
        .catch(() => {})
    } else {
      listenForPushNotificationsFromJS(emitter)
    }

    // we never unsubscribe
    return () => {}
  }, Saga.buffers.expanding(10))

  while (true) {
    const action = yield Saga.take(pushChannel)
    yield Saga.put(action)
  }
}

function* handleLoudMessage(notification: Types.PushNotification) {
  if (notification.type !== 'chat.newmessage') {
    return
  }
  // We only care if the user clicked while in session
  if (!notification.userInteraction) {
    logger.warn('push ignore non userInteraction')
    return
  }

  const {conversationIDKey, unboxPayload, membersType} = notification

  logger.warn('push selecting ', conversationIDKey)
  yield Saga.put(Chat2Gen.createNavigateToThread({conversationIDKey, pushBody: unboxPayload, reason: 'push'}))
  if (unboxPayload && membersType && !isIOS) {
    logger.info('[Push] unboxing message')
    try {
      yield RPCChatTypes.localUnboxMobilePushNotificationRpcPromise({
        convID: conversationIDKey,
        membersType,
        payload: unboxPayload,
        shouldAck: false,
      })
    } catch (e) {
      logger.info('[Push] failed to unbox message from payload')
    }
  }
}

// on iOS the go side handles a lot of push details
function* handlePush(state: Container.TypedState, action: PushGen.NotificationPayload) {
  try {
    const notification = action.payload.notification
    logger.info('[Push]: ' + notification.type || 'unknown')

    switch (notification.type) {
      case 'chat.readmessage':
        logger.info('[Push] read message')
        if (notification.badges === 0) {
          isIOS && PushNotificationIOS.removeAllPendingNotificationRequests()
        }
        break
      case 'chat.newmessageSilent_2':
        // entirely handled by go on ios and in onNotification on Android
        break
      case 'chat.newmessage':
        yield* handleLoudMessage(notification)
        break
      case 'follow':
        // We only care if the user clicked while in session
        if (notification.userInteraction) {
          const {username} = notification
          logger.info('[Push] follower: ', username)
          yield Saga.put(ProfileGen.createShowUserProfile({username}))
        }
        break
      case 'chat.extension':
        {
          const {conversationIDKey} = notification
          yield Saga.put(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'extension'}))
        }
        break
      case 'settings.contacts':
        if (state.config.loggedIn) {
          yield Saga.put(RouteTreeGen.createSwitchTab({tab: Tabs.peopleTab}))
          yield Saga.put(RouteTreeGen.createNavUpToScreen({name: 'peopleRoot'}))
        }
        break
    }
  } catch (e) {
    if (__DEV__) {
      console.error(e)
    }

    logger.error('[Push] unhandled!!')
  }
}

const uploadPushToken = async (state: Container.TypedState) => {
  const {config, push} = state
  const {deviceID} = config
  if (!config.username || !deviceID) {
    return false as const
  }
  const {token} = push
  if (!token) {
    return false as const
  }
  try {
    await RPCTypes.apiserverPostRpcPromise({
      args: [
        {key: 'push_token', value: token},
        {key: 'device_id', value: deviceID},
        {key: 'token_type', value: Constants.tokenType},
      ],
      endpoint: 'device/push_token',
    })

    logger.info('[PushToken] Uploaded to server')
  } catch (e) {
    logger.error("[PushToken] Couldn't save a push token", e)
  }
  return false as const
}

function* deletePushToken(state: Container.TypedState, action: ConfigGen.LogoutHandshakePayload) {
  const waitKey = 'push:deleteToken'
  yield Saga.put(
    ConfigGen.createLogoutHandshakeWait({increment: true, name: waitKey, version: action.payload.version})
  )

  try {
    const deviceID = state.config.deviceID
    if (!deviceID) {
      logger.info('[PushToken] no device id')
      return
    }

    yield RPCTypes.apiserverDeleteRpcPromise({
      args: [
        {key: 'device_id', value: deviceID},
        {key: 'token_type', value: Constants.tokenType},
      ],
      endpoint: 'device/push_token',
    })
    logger.info('[PushToken] deleted from server')
  } catch (e) {
    logger.error('[PushToken] delete failed', e)
  } finally {
    yield Saga.put(
      ConfigGen.createLogoutHandshakeWait({
        increment: false,
        name: waitKey,
        version: action.payload.version,
      })
    )
  }
}

const requestPermissionsFromNative = async () =>
  isIOS ? PushNotificationIOS.requestPermissions() : Promise.resolve()
const askNativeIfSystemPushPromptHasBeenShown = () =>
  isIOS ? NativeModules.PushPrompt?.getHasShownPushPrompt() ?? Promise.resolve(false) : Promise.resolve(false)
const checkPermissionsFromNative = async () =>
  new Promise(resolve => isIOS && PushNotificationIOS.checkPermissions(resolve))
const monsterStorageKey = 'shownMonsterPushPrompt'

const neverShowMonsterAgain = async (
  state: Container.TypedState,
  action: PushGen.ShowPermissionsPromptPayload | PushGen.RejectPermissionsPayload
) => {
  if (state.push.showPushPrompt) {
    return
  }

  if (action.type === PushGen.showPermissionsPrompt && !action.payload.persistSkip) {
    return
  }

  await RPCTypes.configGuiSetValueRpcPromise({
    path: `ui.${monsterStorageKey}`,
    value: {b: true, isNull: false},
  })
}

function* requestPermissions() {
  if (isIOS) {
    const shownPushPrompt = yield askNativeIfSystemPushPromptHasBeenShown()
    if (shownPushPrompt) {
      // we've already shown the prompt, take them to settings
      yield Saga.put(ConfigGen.createOpenAppSettings())
      yield Saga.put(PushGen.createShowPermissionsPrompt({persistSkip: true, show: false}))
      return
    }
  }
  try {
    yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.permissionsRequestingWaitingKey}))
    logger.info('[PushRequesting] asking native')
    const permissions = yield requestPermissionsFromNative()
    logger.info('[PushRequesting] after prompt:', permissions)
    if (permissions && (permissions.alert || permissions.badge)) {
      logger.info('[PushRequesting] enabled')
      yield Saga.put(PushGen.createUpdateHasPermissions({hasPermissions: true}))
    } else {
      logger.info('[PushRequesting] disabled')
      yield Saga.put(PushGen.createUpdateHasPermissions({hasPermissions: false}))
    }
  } finally {
    yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.permissionsRequestingWaitingKey}))
    yield Saga.put(PushGen.createShowPermissionsPrompt({persistSkip: true, show: false}))
  }
}

function* initialPermissionsCheck() {
  const hasPermissions = yield _checkPermissions(null)
  if (hasPermissions) {
    // Get the token
    yield Saga.spawn(requestPermissionsFromNative)
  } else {
    const shownNativePushPromptTask = yield Saga._fork(askNativeIfSystemPushPromptHasBeenShown)
    const shownMonsterPushPromptTask = yield Saga._fork(async () => {
      try {
        const v = await RPCTypes.configGuiGetValueRpcPromise({path: `ui.${monsterStorageKey}`})
        return !!v.b
      } catch (_) {
        return false
      }
    })
    const [shownNativePushPrompt, shownMonsterPushPrompt] = yield Saga.join([
      shownNativePushPromptTask,
      shownMonsterPushPromptTask,
    ])
    logger.info(
      '[PushInitialCheck] shownNativePushPrompt:',
      shownNativePushPrompt,
      'shownMonsterPushPrompt:',
      shownMonsterPushPrompt
    )
    if (!shownNativePushPrompt && !shownMonsterPushPrompt) {
      logger.info('[PushInitialCheck] no permissions, never shown prompt, now show prompt')
      yield Saga.put(PushGen.createShowPermissionsPrompt({show: true}))
    }
  }
}

function* checkPermissions(_: Container.TypedState, action: ConfigGen.MobileAppStatePayload) {
  yield* _checkPermissions(action)
}
// Call when we foreground and on app start, action is null on app start. Returns if you have permissions
function* _checkPermissions(action: ConfigGen.MobileAppStatePayload | null) {
  // Only recheck on foreground, not background
  if (action && action.payload.nextAppState !== 'active') {
    logger.info('[PushCheck] skip on backgrounding')
    return false
  }

  logger.debug(`[PushCheck] checking ${action ? 'on foreground' : 'on startup'}`)
  const permissions = yield checkPermissionsFromNative()
  if (permissions.alert || permissions.badge) {
    const state: Container.TypedState = yield* Saga.selectState()
    if (!state.push.hasPermissions) {
      logger.info('[PushCheck] enabled: getting token')
      yield Saga.put(PushGen.createUpdateHasPermissions({hasPermissions: true}))
      yield requestPermissionsFromNative()
    } else {
      logger.info('[PushCheck] enabled already')
    }
    return true
  } else {
    logger.info('[PushCheck] disabled')
    yield Saga.put(PushGen.createUpdateHasPermissions({hasPermissions: false}))
    return false
  }
}

function* getStartupDetailsFromInitialShare() {
  if (isAndroid) {
    const fileUrl = yield NativeModules.KeybaseEngine.androidGetInitialShareFileUrl?.() ?? Promise.resolve('')
    const text = yield NativeModules.KeybaseEngine.androidGetInitialShareText?.() ?? Promise.resolve('')
    return {fileUrl, text}
  } else {
    return null
  }
}

function* getStartupDetailsFromInitialPush() {
  const {push, pushTimeout}: {push: PushGen.NotificationPayload; pushTimeout: boolean} = yield Saga.race({
    push: isAndroid ? getInitialPushAndroid() : getInitialPushiOS(),
    pushTimeout: Saga.delay(10),
  })
  if (pushTimeout || !push) {
    return null
  }

  const notification = push.payload.notification
  if (notification.type === 'follow') {
    if (notification.username) {
      return {startupFollowUser: notification.username}
    }
  } else if (notification.type === 'chat.newmessage' || notification.type === 'chat.newmessageSilent_2') {
    if (notification.conversationIDKey) {
      return {
        startupConversation: notification.conversationIDKey,
        startupPushPayload: notification.unboxPayload,
      }
    }
  }

  return null
}

const getInitialPushAndroid = async () => {
  const n = await (NativeModules.KeybaseEngine.androidGetInitialBundleFromNotification?.() ??
    Promise.resolve({}))
  const notification = n && Constants.normalizePush(n)
  return notification && PushGen.createNotification({notification})
}

const getInitialPushiOS = async () =>
  new Promise<Container.TypedActions | null | false>(resolve => {
    isIOS &&
      PushNotificationIOS.getInitialNotification().then((n: any) => {
        const notification = Constants.normalizePush(n)
        if (notification) {
          resolve(PushGen.createNotification({notification}))
        }
        resolve(null)
      })
  })

function* pushSaga() {
  // Permissions
  yield* Saga.chainGenerator<PushGen.RequestPermissionsPayload>(
    PushGen.requestPermissions,
    requestPermissions
  )
  yield* Saga.chainAction2([PushGen.showPermissionsPrompt, PushGen.rejectPermissions], neverShowMonsterAgain)
  yield* Saga.chainGenerator<ConfigGen.MobileAppStatePayload>(ConfigGen.mobileAppState, checkPermissions)

  // Token handling
  yield* Saga.chainAction2([PushGen.updatePushToken, ConfigGen.bootstrapStatusLoaded], uploadPushToken)
  yield* Saga.chainGenerator<ConfigGen.LogoutHandshakePayload>(ConfigGen.logoutHandshake, deletePushToken)

  yield* Saga.chainAction(NotificationsGen.receivedBadgeState, updateAppBadge)
  yield* Saga.chainGenerator<PushGen.NotificationPayload>(PushGen.notification, handlePush)
  yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(ConfigGen.daemonHandshake, setupPushEventLoop)
  yield Saga.spawn(initialPermissionsCheck)
}

export default pushSaga
export {getStartupDetailsFromInitialPush, getStartupDetailsFromInitialShare}
