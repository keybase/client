import * as C from '..'
import * as T from '../types'
import {useConfigState} from '../config'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import logger from '@/logger'
import {isIOS, isAndroid} from '../platform'
import {
  androidGetRegistrationToken,
  androidSetApplicationIconBadgeNumber,
  getNativeEmitter,
} from 'react-native-kb'
import {usePushState} from '../push'
import {useLogoutState} from '../logout'

const setApplicationIconBadgeNumber = (n: number) => {
  if (isIOS) {
    PushNotificationIOS.setApplicationIconBadgeNumber(n)
  } else {
    androidSetApplicationIconBadgeNumber(n)
  }
}

type DataCommon = {
  userInteraction: boolean
}
type DataReadMessage = DataCommon & {
  type: 'chat.readmessage'
  b: string | number
}
type DataNewMessage = DataCommon & {
  type: 'chat.newmessage'
  convID?: string
  t: string | number
  m: string
}
type DataNewMessageSilent2 = DataCommon & {
  type: 'chat.newmessageSilent_2'
  t: string | number
  c?: string
  m: string
}
type DataFollow = DataCommon & {
  type: 'follow'
  username?: string
}
type DataChatExtension = DataCommon & {
  type: 'chat.extension'
  convID?: string
}
type Data = DataReadMessage | DataNewMessage | DataNewMessageSilent2 | DataFollow | DataChatExtension

type PushN = {
  data?: Data
  _data?: Data
  message: string
} & Data

const anyToConversationMembersType = (a: string | number): T.RPCChat.ConversationMembersType | undefined => {
  const membersTypeNumber: T.RPCChat.ConversationMembersType =
    typeof a === 'string' ? parseInt(a, 10) : a || -1
  switch (membersTypeNumber) {
    case T.RPCChat.ConversationMembersType.kbfs:
      return T.RPCChat.ConversationMembersType.kbfs
    case T.RPCChat.ConversationMembersType.team:
      return T.RPCChat.ConversationMembersType.team
    case T.RPCChat.ConversationMembersType.impteamnative:
      return T.RPCChat.ConversationMembersType.impteamnative
    case T.RPCChat.ConversationMembersType.impteamupgrade:
      return T.RPCChat.ConversationMembersType.impteamupgrade
    default:
      return undefined
  }
}
const normalizePush = (_n?: object): T.Push.PushNotification | undefined => {
  try {
    if (!_n) {
      return undefined
    }

    const n = _n as PushN
    const data = isIOS ? n.data || n._data : n
    if (!data) {
      return undefined
    }
    const userInteraction = !!data.userInteraction

    switch (data.type) {
      case 'chat.readmessage': {
        const badges = typeof data.b === 'string' ? parseInt(data.b) : data.b
        return {
          badges,
          type: 'chat.readmessage',
        } as const
      }
      case 'chat.newmessage':
        return data.convID
          ? {
              conversationIDKey: T.Chat.stringToConversationIDKey(data.convID),
              membersType: anyToConversationMembersType(data.t),
              type: 'chat.newmessage',
              unboxPayload: data.m || '',
              userInteraction,
            }
          : undefined
      case 'chat.newmessageSilent_2':
        if (data.c) {
          const membersType = anyToConversationMembersType(data.t)
          if (membersType) {
            return {
              conversationIDKey: T.Chat.stringToConversationIDKey(data.c),
              membersType,
              type: 'chat.newmessageSilent_2',
              unboxPayload: data.m || '',
            }
          }
        }
        return undefined
      case 'follow':
        return data.username
          ? {
              type: 'follow',
              userInteraction,
              username: data.username,
            }
          : undefined
      case 'chat.extension':
        return data.convID
          ? {
              conversationIDKey: T.Chat.stringToConversationIDKey(data.convID),
              type: 'chat.extension',
            }
          : undefined
      default:
        if (typeof n.message === 'string' && n.message.startsWith('Your contact') && userInteraction) {
          return {
            type: 'settings.contacts',
          }
        }

        return undefined
    }
  } catch (e) {
    logger.error('Error handling push', e)
    return undefined
  }
}

// Push notifications on android are simple.
// 1. KeybasePushNotificationListenerService.java is our listening service. (https://firebase.google.com/docs/cloud-messaging/android/receive)
// 2. When a notification comes in it is handled only on Go/Java side (native only)
// That's it.
// If the intent is available and react isn't inited we'll stash it and emit when react is alive

const listenForNativeAndroidIntentNotifications = async () => {
  const pushToken = await androidGetRegistrationToken()
  logger.debug('[PushToken] received new token: ', pushToken)

  usePushState.getState().dispatch.setPushToken(pushToken)

  const RNEmitter = getNativeEmitter()
  RNEmitter.addListener('initialIntentFromNotification', (evt?: object) => {
    const notification = evt && normalizePush(evt)
    if (notification) {
      usePushState.getState().dispatch.handlePush(notification)
    }
  })

  RNEmitter.addListener('onShareData', (evt: {text?: string; localPaths?: Array<string>}) => {
    logger.debug('[ShareDataIntent]', evt)
    const {setAndroidShare} = useConfigState.getState().dispatch

    const text = evt.text
    const urls = evt.localPaths

    if (urls) {
      setAndroidShare({type: T.RPCGen.IncomingShareType.file, urls})
    } else if (text) {
      setAndroidShare({text, type: T.RPCGen.IncomingShareType.text})
    }
  })
}

const iosListenForPushNotificationsFromJS = () => {
  const onRegister = (token: string) => {
    logger.debug('[PushToken] received new token: ', token)
    usePushState.getState().dispatch.setPushToken(token)
  }

  const onNotification = (n: object) => {
    logger.debug('[onNotification]: ', n)
    const notification = normalizePush(n)
    if (!notification) {
      return
    }

    usePushState.getState().dispatch.handlePush(notification)
  }

  isIOS && PushNotificationIOS.addEventListener('notification', onNotification)
  isIOS && PushNotificationIOS.addEventListener('localNotification', onNotification)
  isIOS && PushNotificationIOS.addEventListener('register', onRegister)
}

const getStartupDetailsFromInitialPush = async () => {
  const notification = await Promise.race([isAndroid ? null : getInitialPushiOS(), C.timeoutPromise(10)])
  if (!notification) {
    return
  }

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

  return
}

const getInitialPushiOS = async () => {
  if (!isIOS) return undefined
  const n = await PushNotificationIOS.getInitialNotification()
  return n ? normalizePush(n) : undefined
}

export const initPushListener = () => {
  // Permissions
  useConfigState.subscribe((s, old) => {
    if (s.mobileAppState === old.mobileAppState) return
    // Only recheck on foreground, not background
    if (s.mobileAppState !== 'active') {
      logger.info('[PushCheck] skip on backgrounding')
      return
    }
    logger.debug(`[PushCheck] checking on foreground`)
    usePushState
      .getState()
      .dispatch.checkPermissions()
      .then(() => {})
      .catch(() => {})
  })

  // Token handling
  useLogoutState.subscribe((s, old) => {
    if (s.version === old.version) return
    usePushState.getState().dispatch.deleteToken(s.version)
  })

  let lastCount = -1
  useConfigState.subscribe((s, old) => {
    if (s.badgeState === old.badgeState) return
    if (!s.badgeState) return
    const count = s.badgeState.bigTeamBadgeCount + s.badgeState.smallTeamBadgeCount
    setApplicationIconBadgeNumber(count)
    // Only do this native call if the count actually changed, not over and over if its zero
    if (isIOS && count === 0 && lastCount !== 0) {
      PushNotificationIOS.removeAllPendingNotificationRequests()
    }
    lastCount = count
  })

  usePushState.getState().dispatch.initialPermissionsCheck()

  const listenNative = async () => {
    if (isAndroid) {
      try {
        await listenForNativeAndroidIntentNotifications()
      } catch {}
    } else {
      iosListenForPushNotificationsFromJS()
    }
  }
  C.ignorePromise(listenNative())
}

export {getStartupDetailsFromInitialPush}
