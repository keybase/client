// @flow
import * as Chat2Gen from '../chat2-gen'
// import * as ChatConstants from '../../constants/chat2'
import * as ConfigGen from '../config-gen'
import * as Constants from '../../constants/push'
import * as NotificationsGen from '../../actions/notifications-gen'
import * as ProfileGen from '../profile-gen'
import * as PushGen from '../push-gen'
import * as PushNotifications from 'react-native-push-notification'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Saga from '../../util/saga'
import * as WaitingGen from '../waiting-gen'
import logger from '../../logger'
import {NativeModules, AsyncStorage} from 'react-native'
import {isIOS} from '../../constants/platform'

import type {TypedState} from '../../constants/reducer'

const updateAppBadge = (_: any, action: NotificationsGen.ReceivedBadgeStatePayload) => {
  const count = (action.payload.badgeState.conversations || []).reduce(
    (total, c) => (c.badgeCounts ? total + c.badgeCounts[`${RPCTypes.commonDeviceType.mobile}`] : total),
    0
  )

  PushNotifications.setApplicationIconBadgeNumber(count)
  if (count === 0) {
    PushNotifications.cancelAllLocalNotifications()
  }
}

// Used to listen to the java intent for notifications
// let RNEmitter
// // Push notifications on android are very messy. It works differently if we're entirely killed or if we're in the background
// // If we're killed it all works. clicking on the notification launches us and we get the onNotify callback and it all works
// // If we're backgrounded we get the silent or the silent and real. To work around this we:
// // 1. Plumb through the intent from the java side if we relaunch due to push
// // 2. We store the last push and re-use it when this event is emitted to just 'rerun' the push
// if (!isIOS) {
// RNEmitter = new NativeEventEmitter(NativeModules.KeybaseEngine)
// }

// let lastPushForAndroid = null
// const listenForNativeAndroidIntentNotifications = emitter => {
// TODO
// if (!RNEmitter) {
// return
// }
// // If android launched due to push
// RNEmitter.addListener('androidIntentNotification', () => {
// if (!lastPushForAndroid) {
// return
// }
// // if plaintext is on we get this but not the real message if we're backgrounded, so convert it to a non-silent type
// if (lastPushForAndroid.type === 'chat.newmessageSilent_2') {
// lastPushForAndroid.type = 'chat.newmessage'
// // grab convo id
// lastPushForAndroid.convID = lastPushForAndroid.c
// }
// // emulate like the user clicked it while we're killed
// lastPushForAndroid.userInteraction = true // force this true
// emitter(PushGen.createNotification({notification: lastPushForAndroid}))
// lastPushForAndroid = null
// })
// }

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
    // lastPushForAndroid = notification
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
      // listenForNativeAndroidIntentNotifications(emitter)
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
    if (unboxPayload && membersType) {
      logger.info('[Push] unboxing message')
      yield Saga.call(RPCChatTypes.localUnboxMobilePushNotificationRpcPromise, {
        convID: conversationIDKey,
        membersType,
        payload: unboxPayload,
        shouldAck: false,
      })
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

// on iOS the go side handles a lot of push details. We currently only handle readmessage to clear badges
// TODO android
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

const deletePushToken = (state: TypedState) =>
  Saga.call(function*() {
    const waitKey = 'push:deleteToken'
    yield Saga.put(ConfigGen.createLogoutHandshakeWait({increment: true, name: waitKey}))

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
      yield Saga.put(ConfigGen.createLogoutHandshakeWait({increment: false, name: waitKey}))
    }
  })

const requestPermissionsFromNative = () =>
  isIOS ? PushNotifications.requestPermissions() : Promise.resolve()
const askNativeIfSystemPushPromptHasBeenShown = () =>
  isIOS ? NativeModules.PushPrompt.getHasShownPushPrompt() : Promise.resolve(false)
const checkPermissionsFromNative = () =>
  new Promise((resolve, reject) => PushNotifications.checkPermissions(resolve))

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
  if (!hasPermissions) {
    const shownNativePushPromptTask = yield Saga.fork(askNativeIfSystemPushPromptHasBeenShown)
    const storageKey = 'shownMonsterPushPrompt'
    const shownMonsterPushPromptTask = yield Saga.fork(AsyncStorage.getItem, storageKey)
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
      yield Saga.fork(AsyncStorage.setItem, storageKey, 'true')
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
      logger.info('[PushCheck] enabled: getting token')
      yield Saga.put(PushGen.createUpdateHasPermissions({hasPermissions: true}))
      yield Saga.call(requestPermissionsFromNative)
      return true
    } else {
      logger.info('[PushCheck] disabled')
      yield Saga.put(PushGen.createUpdateHasPermissions({hasPermissions: false}))
      return false
    }
  })
}

type InitialNotificationData =
  | {
      type: 'follow',
      username: ?string,
    }
  | {
      type: 'chat.newmessage',
      convID: ?string,
    }

const getStartupDetailsFromInitialPush = () =>
  new Promise(resolve => {
    PushNotifications.popInitialNotification(n => {
      console.log('aaaa TEMP INITAIl push', n)
      if (!n) {
        resolve(null)
        return
      }
      const data: InitialNotificationData = n._data
      if (data.type === 'follow') {
        if (data.username) {
          resolve({startupFollowUser: data.username})
          return
        }
      } else if (data.type === 'chat.newmessage') {
        if (data.convID) {
          resolve({startupConversation: data.convID})
          return
        }
      }
      resolve(null)
    })
  })

function* pushSaga(): Saga.SagaGenerator<any, any> {
  // Permissions
  yield Saga.actionToAction(PushGen.requestPermissions, requestPermissions)
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
