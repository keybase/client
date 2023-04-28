import * as Chat2Gen from '../chat2-gen'
import * as ConfigGen from '../config-gen'
import * as Constants from '../../constants/push'
import * as Container from '../../util/container'
import * as NotificationsGen from '../notifications-gen'
import * as ProfileGen from '../profile-gen'
import * as PushGen from '../push-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../route-tree-gen'
import * as Tabs from '../../constants/tabs'
import * as WaitingGen from '../waiting-gen'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import logger from '../../logger'
import type * as ChatTypes from '../../constants/types/chat2'
import type * as Types from '../../constants/types/push'
import {isIOS, isAndroid} from '../../constants/platform'
import {
  iosGetHasShownPushPrompt,
  androidRequestPushPermissions,
  androidCheckPushPermissions,
  androidGetRegistrationToken,
  androidSetApplicationIconBadgeNumber,
  androidGetInitialBundleFromNotification,
  androidGetInitialShareFileUrl,
  androidGetInitialShareText,
  getNativeEmitter,
} from 'react-native-kb'

const setApplicationIconBadgeNumber = (n: number) => {
  if (isIOS) {
    PushNotificationIOS.setApplicationIconBadgeNumber(n)
  } else {
    androidSetApplicationIconBadgeNumber(n)
  }
}

let lastCount = -1
const updateAppBadge = (_: unknown, action: NotificationsGen.ReceivedBadgeStatePayload) => {
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
const listenForNativeAndroidIntentNotifications = async (listenerApi: Container.ListenerApi) => {
  const pushToken = await androidGetRegistrationToken()
  logger.debug('[PushToken] received new token: ', pushToken)
  listenerApi.dispatch(PushGen.createUpdatePushToken({token: pushToken}))

  const RNEmitter = getNativeEmitter()
  RNEmitter.addListener('initialIntentFromNotification', evt => {
    const notification = evt && Constants.normalizePush(evt)
    notification && listenerApi.dispatch(PushGen.createNotification({notification}))
  })

  RNEmitter.addListener('onShareData', evt => {
    logger.debug('[ShareDataIntent]', evt)
    listenerApi.dispatch(
      ConfigGen.createAndroidShare({
        text: evt.text,
        url: evt.localPath,
      })
    )
  })
}

const iosListenForPushNotificationsFromJS = (listenerApi: Container.ListenerApi) => {
  const onRegister = (token: string) => {
    logger.debug('[PushToken] received new token: ', token)
    listenerApi.dispatch(PushGen.createUpdatePushToken({token}))
  }

  const onNotification = (n: Object) => {
    logger.debug('[onNotification]: ', n)
    const notification = Constants.normalizePush(n)
    if (!notification) {
      return
    }
    listenerApi.dispatch(PushGen.createNotification({notification}))
  }

  isIOS && PushNotificationIOS.addEventListener('notification', onNotification)
  isIOS && PushNotificationIOS.addEventListener('localNotification', onNotification)
  isIOS && PushNotificationIOS.addEventListener('register', onRegister)
}

const setupPushEventLoop = async (_s: unknown, _a: unknown, listenerApi: Container.ListenerApi) => {
  if (isAndroid) {
    try {
      await listenForNativeAndroidIntentNotifications(listenerApi)
    } catch {}
  } else {
    iosListenForPushNotificationsFromJS(listenerApi)
  }
}

const handleLoudMessage = async (
  notification: Types.PushNotification,
  listenerApi: Container.ListenerApi
) => {
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
  listenerApi.dispatch(
    Chat2Gen.createNavigateToThread({conversationIDKey, pushBody: unboxPayload, reason: 'push'})
  )
  if (unboxPayload && membersType && !isIOS) {
    logger.info('[Push] unboxing message')
    try {
      await RPCChatTypes.localUnboxMobilePushNotificationRpcPromise({
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
const handlePush = async (
  state: Container.TypedState,
  action: PushGen.NotificationPayload,
  listenerApi: Container.ListenerApi
) => {
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
        await handleLoudMessage(notification, listenerApi)
        break
      case 'follow':
        // We only care if the user clicked while in session
        if (notification.userInteraction) {
          const {username} = notification
          logger.info('[Push] follower: ', username)
          listenerApi.dispatch(ProfileGen.createShowUserProfile({username}))
        }
        break
      case 'chat.extension':
        {
          const {conversationIDKey} = notification
          listenerApi.dispatch(Chat2Gen.createNavigateToThread({conversationIDKey, reason: 'extension'}))
        }
        break
      case 'settings.contacts':
        if (state.config.loggedIn) {
          listenerApi.dispatch(RouteTreeGen.createSwitchTab({tab: Tabs.peopleTab}))
          listenerApi.dispatch(RouteTreeGen.createNavUpToScreen({name: 'peopleRoot'}))
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

const deletePushToken = async (
  state: Container.TypedState,
  action: ConfigGen.LogoutHandshakePayload,
  listenerApi: Container.ListenerApi
) => {
  const waitKey = 'push:deleteToken'
  listenerApi.dispatch(
    ConfigGen.createLogoutHandshakeWait({increment: true, name: waitKey, version: action.payload.version})
  )

  try {
    const deviceID = state.config.deviceID
    if (!deviceID) {
      logger.info('[PushToken] no device id')
      return
    }

    await RPCTypes.apiserverDeleteRpcPromise({
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
    listenerApi.dispatch(
      ConfigGen.createLogoutHandshakeWait({
        increment: false,
        name: waitKey,
        version: action.payload.version,
      })
    )
  }
}

const requestPermissionsFromNative: () => Promise<{
  alert: boolean
  badge: boolean
  sound: boolean
}> = async () => {
  if (isIOS) {
    const perm = await (PushNotificationIOS.requestPermissions() as any)
    return perm
  } else {
    const on = await androidRequestPushPermissions()
    const perm = {alert: on, badge: on, sound: on}
    return perm
  }
}

const askNativeIfSystemPushPromptHasBeenShown = async () =>
  isIOS ? iosGetHasShownPushPrompt() ?? Promise.resolve(false) : Promise.resolve(false)
const checkPermissionsFromNative = async () =>
  new Promise<{alert?: boolean; badge?: boolean; sound?: boolean}>((resolve, reject) => {
    if (isIOS) {
      PushNotificationIOS.checkPermissions(perms => resolve(perms))
    } else {
      androidCheckPushPermissions()
        .then(on => resolve({alert: on, badge: on, sound: on}))
        .catch(() => reject())
    }
  })
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

const requestPermissions = async (_s: unknown, _a: unknown, listenerApi: Container.ListenerApi) => {
  if (isIOS) {
    const shownPushPrompt = await askNativeIfSystemPushPromptHasBeenShown()
    if (shownPushPrompt) {
      // we've already shown the prompt, take them to settings
      listenerApi.dispatch(ConfigGen.createOpenAppSettings())
      listenerApi.dispatch(PushGen.createShowPermissionsPrompt({persistSkip: true, show: false}))
      return
    }
  }
  try {
    listenerApi.dispatch(ConfigGen.createOpenAppSettings())
    listenerApi.dispatch(WaitingGen.createIncrementWaiting({key: Constants.permissionsRequestingWaitingKey}))
    logger.info('[PushRequesting] asking native')
    await requestPermissionsFromNative()
    const permissions = await checkPermissionsFromNative()
    logger.info('[PushRequesting] after prompt:', permissions)
    if (permissions && (permissions.alert || permissions.badge)) {
      logger.info('[PushRequesting] enabled')
      listenerApi.dispatch(PushGen.createUpdateHasPermissions({hasPermissions: true}))
    } else {
      logger.info('[PushRequesting] disabled')
      listenerApi.dispatch(PushGen.createUpdateHasPermissions({hasPermissions: false}))
    }
  } finally {
    listenerApi.dispatch(WaitingGen.createDecrementWaiting({key: Constants.permissionsRequestingWaitingKey}))
    listenerApi.dispatch(PushGen.createShowPermissionsPrompt({persistSkip: true, show: false}))
  }
}

const initialPermissionsCheck = async (listenerApi: Container.ListenerApi) => {
  const hasPermissions = await _checkPermissions(null, listenerApi)
  if (hasPermissions) {
    // Get the token
    await requestPermissionsFromNative()
  } else {
    const shownNativePushPromptTask = askNativeIfSystemPushPromptHasBeenShown
    const shownMonsterPushPromptTask = async () => {
      const v = await RPCTypes.configGuiGetValueRpcPromise({path: `ui.${monsterStorageKey}`})
      return !!v.b
    }
    const [shownNativePushPrompt, shownMonsterPushPrompt] = await Promise.all([
      Container.neverThrowPromiseFunc(shownNativePushPromptTask),
      Container.neverThrowPromiseFunc(shownMonsterPushPromptTask),
    ])
    logger.info(
      '[PushInitialCheck] shownNativePushPrompt:',
      shownNativePushPrompt,
      'shownMonsterPushPrompt:',
      shownMonsterPushPrompt
    )
    if (!shownNativePushPrompt && !shownMonsterPushPrompt) {
      logger.info('[PushInitialCheck] no permissions, never shown prompt, now show prompt')
      listenerApi.dispatch(PushGen.createShowPermissionsPrompt({show: true}))
    }
  }
}

const checkPermissions = async (
  _: Container.TypedState,
  action: ConfigGen.MobileAppStatePayload,
  listenerApi: Container.ListenerApi
) => {
  await _checkPermissions(action, listenerApi)
}
// Call when we foreground and on app start, action is null on app start. Returns if you have permissions
const _checkPermissions = async (
  action: ConfigGen.MobileAppStatePayload | null,
  listenerApi: Container.ListenerApi
) => {
  // Only recheck on foreground, not background
  if (action && action.payload.nextAppState !== 'active') {
    logger.info('[PushCheck] skip on backgrounding')
    return false
  }

  logger.debug(`[PushCheck] checking ${action ? 'on foreground' : 'on startup'}`)
  const permissions = await checkPermissionsFromNative()
  if (permissions.alert || permissions.badge) {
    const state = listenerApi.getState()
    if (!state.push.hasPermissions) {
      logger.info('[PushCheck] enabled: getting token')
      listenerApi.dispatch(PushGen.createUpdateHasPermissions({hasPermissions: true}))
      await requestPermissionsFromNative()
    } else {
      logger.info('[PushCheck] enabled already')
    }
    return true
  } else {
    logger.info('[PushCheck] disabled')
    listenerApi.dispatch(PushGen.createUpdateHasPermissions({hasPermissions: false}))
    return false
  }
}

const getStartupDetailsFromInitialShare = async () => {
  if (isAndroid) {
    const fileUrl = await (androidGetInitialShareFileUrl() ?? Promise.resolve(''))
    const text = await (androidGetInitialShareText() ?? Promise.resolve(''))
    return {fileUrl, text}
  } else {
    return Promise.resolve(undefined)
  }
}

const getStartupDetailsFromInitialPush = async () => {
  const push = await Promise.race([
    isAndroid ? getInitialPushAndroid() : getInitialPushiOS(),
    Container.timeoutPromise(10),
  ])
  if (!push) {
    return null
  }

  // TODO push is any here
  const notification = push.payload.notification
  if (notification.type === 'follow') {
    if (notification.username) {
      return {startupFollowUser: notification.username as string}
    }
  } else if (notification.type === 'chat.newmessage' || notification.type === 'chat.newmessageSilent_2') {
    if (notification.conversationIDKey) {
      return {
        startupConversation: notification.conversationIDKey as ChatTypes.ConversationIDKey,
        startupPushPayload: notification.unboxPayload as string,
      }
    }
  }

  return null
}

const getInitialPushAndroid = async () => {
  const n = await (androidGetInitialBundleFromNotification() ?? Promise.resolve({}))
  const notification = n && Constants.normalizePush(n)
  return notification && PushGen.createNotification({notification})
}

const getInitialPushiOS = async () =>
  new Promise<Container.TypedActions | null | false>(resolve => {
    isIOS &&
      PushNotificationIOS.getInitialNotification()
        .then((n: any) => {
          const notification = Constants.normalizePush(n)
          if (notification) {
            resolve(PushGen.createNotification({notification}))
          }
          resolve(null)
        })
        .catch(() => {})
  })

export const initPushListener = () => {
  // Permissions
  Container.listenAction(PushGen.requestPermissions, requestPermissions)
  Container.listenAction([PushGen.showPermissionsPrompt, PushGen.rejectPermissions], neverShowMonsterAgain)
  Container.listenAction(ConfigGen.mobileAppState, checkPermissions)

  // Token handling
  Container.listenAction([PushGen.updatePushToken, ConfigGen.bootstrapStatusLoaded], uploadPushToken)
  Container.listenAction(ConfigGen.logoutHandshake, deletePushToken)

  Container.listenAction(NotificationsGen.receivedBadgeState, updateAppBadge)
  Container.listenAction(PushGen.notification, handlePush)
  Container.listenAction(ConfigGen.daemonHandshake, setupPushEventLoop)
  Container.spawn(initialPermissionsCheck, 'initialPermissionsCheck')
}

export {getStartupDetailsFromInitialPush, getStartupDetailsFromInitialShare}
