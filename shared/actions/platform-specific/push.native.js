// @flow
import * as Chat2Gen from '../chat2-gen'
import * as ConfigGen from '../config-gen'
import * as Constants from '../../constants/push'
import * as FsGen from '../../actions/fs-gen'
import * as FsConstants from '../../constants/fs'
import * as FsTypes from '../../constants/types/fs'
import * as NotificationsGen from '../../actions/notifications-gen'
import * as ProfileGen from '../profile-gen'
import * as PushGen from '../push-gen'
import * as PushNotifications from 'react-native-push-notification'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as ChatTypes from '../../constants/types/chat2'
import * as Saga from '../../util/saga'
import * as WaitingGen from '../waiting-gen'
import * as RouteTreeGen from '../route-tree-gen'
import logger from '../../logger'
import {NativeModules, NativeEventEmitter} from 'react-native'
import {isIOS} from '../../constants/platform'

let lastCount = -1
const updateAppBadge = (_, action) => {
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
const listenForNativeAndroidIntentNotifications = emitter => {
  const RNEmitter = new NativeEventEmitter(NativeModules.KeybaseEngine)
  // If android launched due to push
  RNEmitter.addListener('androidIntentNotification', (evt) => {
    logger.info('[PushAndroidIntent]', evt && evt.type)
    const notification = evt && Constants.normalizePush(evt)
    if (!notification) {
      return
    }

    emitter(PushGen.createNotification({notification}))
  })

  // TODO: move this out of this file.
  RNEmitter.addListener('onShareData', evt => {
    logger.info('[ShareDataIntent]', evt)
    emitter(RouteTreeGen.createNavigateTo({path: FsConstants.fsRootRouteForNav1}))
    emitter(FsGen.createSetIncomingShareLocalPath({localPath: FsTypes.stringToLocalPath(evt.path)}))
    emitter(FsGen.createShowIncomingShare({initialDestinationParentPath: FsTypes.stringToPath('/keybase')}))
  })
  RNEmitter.addListener('onShareText', evt => {
    logger.info('[ShareTextIntent]', evt)
    emitter(RouteTreeGen.createNavigateTo({path: FsConstants.fsRootRouteForNav1}))
    // TODO: implement
  })
}

const listenForPushNotificationsFromJS = emitter => {
  const onRegister = token => {
    console.log('[PushToken] received new token: ', token)
    emitter(PushGen.createUpdatePushToken({token: token.token}))
  }

  const onNotification = n => {
    logger.info('[onNotification]: ', n)
    const notification = Constants.normalizePush(n)
    if (!notification) {
      return
    }
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

function* setupPushEventLoop() {
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
}

function* handleLoudMessage(notification) {
  // We only care if the user clicked while in session
  if (!notification.userInteraction) {
    return
  }

  const {conversationIDKey, unboxPayload, membersType} = notification

  yield Saga.put(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'push'}))
  yield Saga.put(Chat2Gen.createNavigateToThread())
  if (unboxPayload && membersType && !isIOS) {
    logger.info('[Push] unboxing message')
    try {
      yield* Saga.callPromise(RPCChatTypes.localUnboxMobilePushNotificationRpcPromise, {
        convID: conversationIDKey,
        membersType,
        payload: unboxPayload,
        shouldAck: false,
      })
    } catch (e) {
      logger.info('[Push] failed to unbox message form payload')
    }
  }
}

// on iOS the go side handles a lot of push details
function* handlePush(_, action) {
  try {
    const notification = action.payload.notification
    logger.info('[Push]: ' + notification.type || 'unknown')

    switch (notification.type) {
      case 'chat.readmessage':
        logger.info('[Push] read message')
        if (notification.badges === 0) {
          PushNotifications.cancelAllLocalNotifications()
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
        const {conversationIDKey} = notification
        yield Saga.put(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'extension'}))
        break
    }
  } catch (e) {
    if (__DEV__) {
      console.error(e)
    }

    logger.error('[Push] unhandled!!')
  }
}

const uploadPushToken = state =>
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

function* deletePushToken(state, action) {
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

    yield* Saga.callPromise(RPCTypes.apiserverDeleteRpcPromise, {
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
}

const requestPermissionsFromNative = () =>
  isIOS ? PushNotifications.requestPermissions() : Promise.resolve()
const askNativeIfSystemPushPromptHasBeenShown = () =>
  isIOS ? NativeModules.PushPrompt.getHasShownPushPrompt() : Promise.resolve(false)
const checkPermissionsFromNative = () =>
  new Promise((resolve, reject) => PushNotifications.checkPermissions(resolve))
const monsterStorageKey = 'shownMonsterPushPrompt'

function* neverShowMonsterAgain(state) {
  if (!state.push.showPushPrompt) {
    yield Saga.spawn(() =>
      RPCTypes.configSetValueRpcPromise({path: `ui.${monsterStorageKey}`, value: {b: true, isNull: false}})
    )
  }
}

function* requestPermissions() {
  if (isIOS) {
    const shownPushPrompt = yield* Saga.callPromise(askNativeIfSystemPushPromptHasBeenShown)
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
    const permissions = yield* Saga.callPromise(requestPermissionsFromNative)
    logger.info('[PushRequesting] after prompt:', permissions)
    if (permissions?.alert || permissions?.badge) {
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
}

function* initialPermissionsCheck(): Saga.SagaGenerator<any, any> {
  const hasPermissions = yield _checkPermissions(null)
  if (hasPermissions) {
    // Get the token
    yield Saga.spawn(requestPermissionsFromNative)
  } else {
    const shownNativePushPromptTask = yield Saga._fork(askNativeIfSystemPushPromptHasBeenShown)
    const shownMonsterPushPromptTask = yield Saga._fork(() =>
      RPCTypes.configGetValueRpcPromise({path: `ui.${monsterStorageKey}`})
        .then(v => !!v.b)
        .catch(() => false)
    )
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

function* checkPermissions(_, action: ConfigGen.MobileAppStatePayload | null) {
  yield* _checkPermissions(action)
}
// Call when we foreground and on app start, action is null on app start. Returns if you have permissions
function* _checkPermissions(action: ConfigGen.MobileAppStatePayload | null) {
  // Only recheck on foreground, not background
  if (action && action.payload.nextAppState !== 'active') {
    logger.info('[PushCheck] skip on backgrounding')
    return false
  }

  console.log('[PushCheck] checking ', action ? 'on foreground' : 'on startup')
  const permissions = yield* Saga.callPromise(checkPermissionsFromNative)
  if (permissions.alert || permissions.badge) {
    const state = yield* Saga.selectState()
    if (!state.push.hasPermissions) {
      logger.info('[PushCheck] enabled: getting token')
      yield Saga.put(PushGen.createUpdateHasPermissions({hasPermissions: true}))
      yield* Saga.callPromise(requestPermissionsFromNative)
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
  yield* Saga.chainGenerator<PushGen.RequestPermissionsPayload>(
    PushGen.requestPermissions,
    requestPermissions
  )
  yield* Saga.chainGenerator<PushGen.ShowPermissionsPromptPayload | PushGen.RejectPermissionsPayload>(
    [PushGen.showPermissionsPrompt, PushGen.rejectPermissions],
    neverShowMonsterAgain
  )
  yield* Saga.chainGenerator<ConfigGen.MobileAppStatePayload>(ConfigGen.mobileAppState, checkPermissions)

  // Token handling
  yield* Saga.chainAction<PushGen.UpdatePushTokenPayload | ConfigGen.BootstrapStatusLoadedPayload>(
    [PushGen.updatePushToken, ConfigGen.bootstrapStatusLoaded],
    uploadPushToken
  )
  yield* Saga.chainGenerator<ConfigGen.LogoutHandshakePayload>(ConfigGen.logoutHandshake, deletePushToken)

  yield* Saga.chainAction<NotificationsGen.ReceivedBadgeStatePayload>(
    NotificationsGen.receivedBadgeState,
    updateAppBadge
  )
  yield* Saga.chainGenerator<PushGen.NotificationPayload>(PushGen.notification, handlePush)
  yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(ConfigGen.daemonHandshake, setupPushEventLoop)
  yield Saga.spawn(initialPermissionsCheck)
}

export default pushSaga
export {getStartupDetailsFromInitialPush}
