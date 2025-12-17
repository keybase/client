import * as T from '../types'
import {ignorePromise, timeoutPromise} from '../utils'
import logger from '@/logger'
import {isIOS, isAndroid} from '../platform'
import {
  getRegistrationToken,
  setApplicationIconBadgeNumber,
  getNativeEmitter,
  getInitialNotification,
  removeAllPendingNotificationRequests,
} from 'react-native-kb'
import {storeRegistry} from '../store-registry'

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
  const pushToken = await getRegistrationToken()
  logger.debug('[PushToken] received new token: ', pushToken)

  storeRegistry.getState('push').dispatch.setPushToken(pushToken)

  const RNEmitter = getNativeEmitter()
  RNEmitter.addListener('initialIntentFromNotification', (evt?: object) => {
    const notification = evt && normalizePush(evt)
    if (notification) {
      storeRegistry.getState('push').dispatch.handlePush(notification)
    }
  })

  RNEmitter.addListener('onShareData', (evt: {text?: string; localPaths?: Array<string>}) => {
    logger.debug('[ShareDataIntent]', evt)
    const {setAndroidShare} = storeRegistry.getState('config').dispatch

    const text = evt.text
    const urls = evt.localPaths

    if (urls) {
      setAndroidShare({type: T.RPCGen.IncomingShareType.file, urls})
    } else if (text) {
      setAndroidShare({text, type: T.RPCGen.IncomingShareType.text})
    }
  })
}

const iosListenForPushNotificationsFromJS = async () => {
  const pushToken = await getRegistrationToken()
  logger.debug('[PushToken] received new token: ', pushToken)
  storeRegistry.getState('push').dispatch.setPushToken(pushToken)

  const onNotification = (n: object) => {
    logger.debug('[onNotification]: ', n)
    const notification = normalizePush(n)
    if (!notification) {
      return
    }

    storeRegistry.getState('push').dispatch.handlePush(notification)
  }

  const RNEmitter = getNativeEmitter()
  RNEmitter.addListener('onPushNotification', onNotification)
}

const getStartupDetailsFromInitialPush = async () => {
  const notification = await Promise.race([isAndroid ? null : getInitialPushiOS(), timeoutPromise(10)])
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
  const n = await getInitialNotification()
  return n ? normalizePush(n) : undefined
}

export const initPushListener = () => {
  // Permissions
  storeRegistry.getStore('config').subscribe((s, old) => {
    if (s.mobileAppState === old.mobileAppState) return
    // Only recheck on foreground, not background
    if (s.mobileAppState !== 'active') {
      logger.info('[PushCheck] skip on backgrounding')
      return
    }
    logger.debug(`[PushCheck] checking on foreground`)
    storeRegistry
      .getState('push')
      .dispatch.checkPermissions()
      .then(() => {})
      .catch(() => {})
  })

  // Token handling
  storeRegistry.getStore('logout').subscribe((s, old) => {
    if (s.version === old.version) return
    storeRegistry.getState('push').dispatch.deleteToken(s.version)
  })

  let lastCount = -1
  storeRegistry.getStore('config').subscribe((s, old) => {
    if (s.badgeState === old.badgeState) return
    if (!s.badgeState) return
    const count = s.badgeState.bigTeamBadgeCount + s.badgeState.smallTeamBadgeCount
    setApplicationIconBadgeNumber(count)
    // Only do this native call if the count actually changed, not over and over if its zero
    if (count === 0 && lastCount !== 0) {
      removeAllPendingNotificationRequests()
    }
    lastCount = count
  })

  storeRegistry.getState('push').dispatch.initialPermissionsCheck()

  const listenNative = async () => {
    if (isAndroid) {
      try {
        await listenForNativeAndroidIntentNotifications()
      } catch {}
    } else {
      try {
        await iosListenForPushNotificationsFromJS()
      } catch {}
    }
  }
  ignorePromise(listenNative())
}

export {getStartupDetailsFromInitialPush}
