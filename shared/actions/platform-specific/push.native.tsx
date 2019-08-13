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
import * as Container from '../../util/container'

let lastCount = -1
const updateAppBadge = (_: Container.TypedState, action: NotificationsGen.ReceivedBadgeStatePayload) => {
  const count = (action.payload.badgeState.conversations || []).reduce(
    (total, c) => (c.badgeCounts ? total + c.badgeCounts[`${RPCTypes.DeviceType.mobile}`] : total),
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
// The notification is first passed through native code for e.g. plaintext processing.
// If we were killed, then launching from the notification will go through the
//   `getStartupDetailsFromInitialPush` flow, via
//   actions/platfrom-specific/index.native->loadStartupDetails.
//   * This flow queries the native code's Intent, which contains the original
//     notification, and then the JS routes us to the right place.
// If we're backgrounded, then we receive an `androidIntentNotification` event,
// and execute the listener code below, causing an action that routes us correctly.
const listenForNativeAndroidIntentNotifications = emitter => {
  const RNEmitter = new NativeEventEmitter(NativeModules.KeybaseEngine)
  // If android launched due to push
  RNEmitter.addListener('androidIntentNotification', evt => {
    logger.debug('[PushAndroidIntent]', evt && evt.type)
    const notification = evt && Constants.normalizePush(evt)
    if (!notification) {
      return
    }

    emitter(PushGen.createNotification({notification}))
  })

  // TODO: move this out of this file.
  // FIXME: sometimes this doubles up on a cold start--we've already executed the previous code.
  RNEmitter.addListener('onShareData', evt => {
    logger.debug('[ShareDataIntent]', evt)
    emitter(RouteTreeGen.createSwitchLoggedIn({loggedIn: true}))
    emitter(RouteTreeGen.createNavigateAppend({path: FsConstants.fsRootRouteForNav1}))
    emitter(FsGen.createSetIncomingShareLocalPath({localPath: FsTypes.stringToLocalPath(evt.localPath)}))
    emitter(FsGen.createShowIncomingShare({initialDestinationParentPath: FsTypes.stringToPath('/keybase')}))
  })
  RNEmitter.addListener('onShareText', evt => {
    logger.debug('[ShareTextIntent]', evt)
    emitter(RouteTreeGen.createNavigateAppend({path: FsConstants.fsRootRouteForNav1}))
    // TODO: implement
  })
}

const listenForPushNotificationsFromJS = emitter => {
  const onRegister = token => {
    logger.debug('[PushToken] received new token: ', token)
    emitter(PushGen.createUpdatePushToken({token: token.token}))
  }

  const onNotification = n => {
    logger.debug('[onNotification]: ', n)
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

  // immediately show the thread on top of the inbox w/o a nav
  const actions = [
    RouteTreeGen.createNavigateAppend({path: [{props: {conversationIDKey}, selected: 'chatConversation'}]}),
  ]
  yield Saga.put(RouteTreeGen.createClearModals())
  yield Saga.put(RouteTreeGen.createResetStack({actions, index: 1, tab: 'tabs.chatTab'}))
  yield Saga.put(RouteTreeGen.createSwitchTab({tab: 'tabs.chatTab'}))
  yield Saga.put(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'push'}))
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
      logger.info('[Push] failed to unbox message form payload')
    }
  }
}

// on iOS the go side handles a lot of push details
function* handlePush(_: Container.TypedState, action: PushGen.NotificationPayload) {
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
        {
          const {conversationIDKey} = notification
          yield Saga.put(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'extension'}))
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

const uploadPushToken = (state: Container.TypedState) =>
  !!state.config.username &&
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
      return false as const
    })
    .catch(e => {
      logger.error("[PushToken] Couldn't save a push token", e)
    })

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
const checkPermissionsFromNative = () => new Promise(resolve => PushNotifications.checkPermissions(resolve))
const monsterStorageKey = 'shownMonsterPushPrompt'

function* neverShowMonsterAgain(state: Container.TypedState) {
  if (!state.push.showPushPrompt) {
    yield Saga.spawn(() =>
      RPCTypes.configGuiSetValueRpcPromise({path: `ui.${monsterStorageKey}`, value: {b: true, isNull: false}})
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
    if (permissions && (permissions.alert || permissions.badge)) {
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
      RPCTypes.configGuiGetValueRpcPromise({path: `ui.${monsterStorageKey}`})
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
  const permissions = yield* Saga.callPromise(checkPermissionsFromNative)
  if (permissions.alert || permissions.badge) {
    const state: Container.TypedState = yield* Saga.selectState()
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
  | null
  | {
      startupFollowUser: string
    }
  | {
      startupConversation: ChatTypes.ConversationIDKey
    }
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
  yield* Saga.chainAction2([PushGen.updatePushToken, ConfigGen.bootstrapStatusLoaded], uploadPushToken)
  yield* Saga.chainGenerator<ConfigGen.LogoutHandshakePayload>(ConfigGen.logoutHandshake, deletePushToken)

  yield* Saga.chainAction2(NotificationsGen.receivedBadgeState, updateAppBadge)
  yield* Saga.chainGenerator<PushGen.NotificationPayload>(PushGen.notification, handlePush)
  yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(ConfigGen.daemonHandshake, setupPushEventLoop)
  yield Saga.spawn(initialPermissionsCheck)
}

export default pushSaga
export {getStartupDetailsFromInitialPush}
