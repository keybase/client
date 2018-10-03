// @flow
import * as Chat2Gen from '../chat2-gen'
import * as ConfigGen from '../config-gen'
import * as Constants from '../../constants/push'
import * as NotificationsGen from '../../actions/notifications-gen'
import * as ProfileGen from '../profile-gen'
import * as PushGen from '../push-gen'
import * as PushNotifications from 'react-native-push-notification'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as ChatTypes from '../../constants/types/chat2'
import * as Saga from '../../util/saga'
import * as WaitingGen from '../waiting-gen'
import logger from '../../logger'
import {NativeModules, AsyncStorage, NativeEventEmitter} from 'react-native'
import {isIOS} from '../../constants/platform'

import type {TypedState} from '../../constants/reducer'

let lastCount = -1
const updateAppBadge = (_: any, action: NotificationsGen.ReceivedBadgeStatePayload) => {
  const count = (action.payload.badgeState.conversations || []).reduce(
    (total, c) => (c.badgeCounts ? total + c.badgeCounts[`${RPCTypes.commonDeviceType.mobile}`] : total),
    0
  )

  PushNotifications.setApplicationIconBadgeNumber(count)
  // Only do this native call if the count actually changed, not over and over if its zero
  if (count === 0 && lastCount !== 0) {
    PushNotifications.cancelAllLocalNotifications()
  }
  lastCount = count
}

// Push notifications on android are very messy. It works differently if we're entirely killed or if we're in the background
// If we're killed it all works. clicking on the notification launches us and we get the onNotify callback and it all works
// If we're backgrounded we get the silent or the silent and real. To work around this we:
// 1. Plumb through the intent from the java side if we relaunch due to push
// 2. We store the last push and re-use it when this event is emitted to just 'rerun' the push
let lastPushForAndroid = null
const listenForNativeAndroidIntentNotifications = emitter => {
  const RNEmitter = new NativeEventEmitter(NativeModules.KeybaseEngine)
  // If android launched due to push
  RNEmitter.addListener('androidIntentNotification', () => {
    logger.info('[PushAndroidIntent]', lastPushForAndroid && lastPushForAndroid.type)
    if (!lastPushForAndroid) {
      return
    }

    switch (lastPushForAndroid.type) {
      // treat this like a loud message
      case 'chat.newmessageSilent_2':
        lastPushForAndroid = {
          conversationIDKey: lastPushForAndroid.conversationIDKey,
          membersType: lastPushForAndroid.membersType,
          type: 'chat.newmessage',
          unboxPayload: lastPushForAndroid.unboxPayload,
          userInteraction: true,
        }
        break
      case 'chat.newmessage':
        lastPushForAndroid.userInteraction = true
        break
      case 'follow':
        lastPushForAndroid.userInteraction = true
        break
      default:
        lastPushForAndroid = null
        return
    }

    emitter(PushGen.createNotification({notification: lastPushForAndroid}))
    lastPushForAndroid = null
  })
}

const listenForPushNotificationsFromJS = emitter => {
  const onRegister = token => {
    console.log('[PushToken] received new token: ', token)
    emitter(PushGen.createUpdatePushToken({token: token.token}))
  }

  const onNotification = n => {
    const notification = Constants.normalizePush(n)
    if (!notification) {
      return
    }
    // bookkeep for android special handling
    lastPushForAndroid = notification
    emitter(PushGen.createNotification({notification}))
  }

  const onError = error => {
    logger.error('push error:', error)
  }

  PushNotifications.configure({
    onError,
    onNotification,
    onRegister,
    popInitialNotification: false,
    // Don't request permissions for ios, we'll ask later, after showing UI
    requestPermissions: !isIOS,
    senderID: Constants.androidSenderID,
  })
}

const setupPushEventLoop = () =>
  Saga.call(function*() {
    const pushChannel = yield Saga.eventChannel(emitter => {
      if (!isIOS) {
        listenForNativeAndroidIntentNotifications(emitter)
      }
      listenForPushNotificationsFromJS(emitter)

      // we never unsubscribe
      return () => {}
    }, Saga.buffers.expanding(10))

    while (true) {
      const action = yield Saga.take(pushChannel)
      yield Saga.put(action)
    }
  })

const handleReadMessage = notification => {
  logger.info('[Push] read message')
  if (notification.badges === 0) {
    PushNotifications.cancelAllLocalNotifications()
  }
}

const handleLoudMessage = notification => {
  // We only care if the user clicked while in session
  if (!notification.userInteraction) {
    return
  }

  const {conversationIDKey, unboxPayload, membersType} = notification

  return Saga.call(function*() {
    yield Saga.put(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'push'}))
    yield Saga.put(Chat2Gen.createNavigateToThread())
    if (unboxPayload && membersType && !isIOS) {
      logger.info('[Push] unboxing message')
      try {
        yield Saga.call(RPCChatTypes.localUnboxMobilePushNotificationRpcPromise, {
          convID: conversationIDKey,
          membersType,
          payload: unboxPayload,
          shouldAck: false,
        })
      } catch (e) {
        logger.info('[Push] failed to unbox message form payload')
      }
    }
  })
}

const handleFollow = notification => {
  // We only care if the user clicked while in session
  if (!notification.userInteraction) {
    return
  }
  const {username} = notification
  logger.info('[Push] follower: ', username)
  return Saga.put(ProfileGen.createShowUserProfile({username}))
}

const handleChatExtension = notification => {
  const {conversationIDKey} = notification
  return Saga.put(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'extension'}))
}

// on iOS the go side handles a lot of push details
const handlePush = (_: any, action: PushGen.NotificationPayload) => {
  try {
    const notification = action.payload.notification
    logger.info('[Push]: ' + notification.type || 'unknown')

    switch (notification.type) {
      case 'chat.readmessage':
        return handleReadMessage(notification)
      case 'chat.newmessageSilent_2':
        // entirely handled by go on ios and not being sent on android. TODO eventually make android like ios and plumb this through native land
        break
      case 'chat.newmessage':
        return handleLoudMessage(notification)
      case 'follow':
        return handleFollow(notification)
      case 'chat.extension':
        return handleChatExtension(notification)
    }
  } catch (e) {
    if (__DEV__) {
      console.error(e)
    }

    logger.error('[Push] unhandled!!')
  }
}

const uploadPushToken = (state: TypedState) =>
  !!state.push.token &&
  !!state.config.deviceID &&
  RPCTypes.apiserverPostRpcPromise({
    args: [
      {key: 'push_token', value: state.push.token},
      {key: 'device_id', value: state.config.deviceID},
      {key: 'token_type', value: Constants.tokenType},
    ],
    endpoint: 'device/push_token',
  })
    .then(() => {
      logger.info('[PushToken] Uploaded to server')
      return false
    })
    .catch(e => {
      logger.error("[PushToken] Couldn't save a push token", e)
    })

const deletePushToken = (state: TypedState, action: ConfigGen.DaemonHandshakePayload) =>
  Saga.call(function*() {
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

      yield Saga.call(RPCTypes.apiserverDeleteRpcPromise, {
        args: [{key: 'device_id', value: deviceID}, {key: 'token_type', value: Constants.tokenType}],
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
  })

const requestPermissionsFromNative = () =>
  isIOS ? PushNotifications.requestPermissions() : Promise.resolve()
const askNativeIfSystemPushPromptHasBeenShown = () =>
  isIOS ? NativeModules.PushPrompt.getHasShownPushPrompt() : Promise.resolve(false)
const checkPermissionsFromNative = () =>
  new Promise((resolve, reject) => PushNotifications.checkPermissions(resolve))
const monsterStorageKey = 'shownMonsterPushPrompt'

const neverShowMonsterAgain = (state: TypedState) =>
  !state.push.showPushPrompt && Saga.fork(AsyncStorage.setItem, monsterStorageKey, 'true')

const requestPermissions = () =>
  Saga.call(function*() {
    if (isIOS) {
      const shownPushPrompt = yield Saga.call(askNativeIfSystemPushPromptHasBeenShown)
      if (shownPushPrompt) {
        // we've already shown the prompt, take them to settings
        yield Saga.put(ConfigGen.createOpenAppSettings())
        yield Saga.put(PushGen.createShowPermissionsPrompt({show: false}))
        return
      }
    }
    try {
      yield Saga.put(WaitingGen.createIncrementWaiting({key: Constants.permissionsRequestingWaitingKey}))
      logger.info('[PushRequesting] asking native')
      const permissions = yield Saga.call(requestPermissionsFromNative)
      logger.info('[PushRequesting] after prompt:', permissions)
      if (permissions.alert || permissions.badge) {
        logger.info('[PushRequesting] enabled')
        yield Saga.put(PushGen.createUpdateHasPermissions({hasPermissions: true}))
      } else {
        logger.info('[PushRequesting] disabled')
        yield Saga.put(PushGen.createUpdateHasPermissions({hasPermissions: false}))
      }
    } finally {
      yield Saga.put(WaitingGen.createDecrementWaiting({key: Constants.permissionsRequestingWaitingKey}))
      yield Saga.put(PushGen.createShowPermissionsPrompt({show: false}))
    }
  })

function* initialPermissionsCheck(): Saga.SagaGenerator<any, any> {
  const hasPermissions = yield checkPermissions(null, null)
  if (hasPermissions) {
    // Get the token
    yield Saga.fork(requestPermissionsFromNative)
  } else {
    const shownNativePushPromptTask = yield Saga.fork(askNativeIfSystemPushPromptHasBeenShown)
    const shownMonsterPushPromptTask = yield Saga.fork(AsyncStorage.getItem, monsterStorageKey)
    const [shownNativePushPrompt, shownMonsterPushPrompt] = yield Saga.join(
      shownNativePushPromptTask,
      shownMonsterPushPromptTask
    )
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

// Call when we foreground and on app start, action is null on app start. Returns if you have permissions
const checkPermissions = (_: any, action: ConfigGen.MobileAppStatePayload | null) => {
  // Only recheck on foreground, not background
  if (action && action.payload.nextAppState !== 'active') {
    logger.info('[PushCheck] skip on backgrounding')
    return false
  }

  return Saga.call(function*() {
    console.log('[PushCheck] checking ', action ? 'on foreground' : 'on startup')
    const permissions = yield Saga.call(checkPermissionsFromNative)
    if (permissions.alert || permissions.badge) {
      const state: TypedState = yield Saga.select()
      if (!state.push.hasPermissions) {
        logger.info('[PushCheck] enabled: getting token')
        yield Saga.put(PushGen.createUpdateHasPermissions({hasPermissions: true}))
        yield Saga.call(requestPermissionsFromNative)
      } else {
        logger.info('[PushCheck] enabled already')
      }
      return true
    } else {
      logger.info('[PushCheck] disabled')
      yield Saga.put(PushGen.createUpdateHasPermissions({hasPermissions: false}))
      return false
    }
  })
}

const getStartupDetailsFromInitialPush = (): Promise<
  null | {startupFollowUser: string} | {startupConversation: ChatTypes.ConversationIDKey}
> =>
  new Promise(resolve => {
    PushNotifications.popInitialNotification(n => {
      const notification = Constants.normalizePush(n)
      if (!notification) {
        resolve(null)
        return
      }
      if (notification.type === 'follow') {
        if (notification.username) {
          resolve({startupFollowUser: notification.username})
          return
        }
      } else if (notification.type === 'chat.newmessage') {
        if (notification.conversationIDKey) {
          resolve({startupConversation: notification.conversationIDKey})
          return
        }
      }
      resolve(null)
    })
  })

function* pushSaga(): Saga.SagaGenerator<any, any> {
  // Permissions
  yield Saga.actionToAction(PushGen.requestPermissions, requestPermissions)
  yield Saga.actionToAction([PushGen.showPermissionsPrompt, PushGen.rejectPermissions], neverShowMonsterAgain)
  yield Saga.actionToAction(ConfigGen.mobileAppState, checkPermissions)

  // Token handling
  yield Saga.actionToPromise([PushGen.updatePushToken, ConfigGen.bootstrapStatusLoaded], uploadPushToken)
  yield Saga.actionToAction(ConfigGen.logoutHandshake, deletePushToken)

  yield Saga.actionToAction(NotificationsGen.receivedBadgeState, updateAppBadge)
  yield Saga.actionToAction(PushGen.notification, handlePush)
  yield Saga.actionToAction(ConfigGen.daemonHandshake, setupPushEventLoop)
  yield Saga.fork(initialPermissionsCheck)
}

export default pushSaga
export {getStartupDetailsFromInitialPush}
