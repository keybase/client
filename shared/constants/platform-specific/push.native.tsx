import * as T from '../types'
import {ignorePromise, timeoutPromise} from '../utils'
import logger from '@/logger'
import {isAndroid, isIOS} from '../platform'
import {
  getRegistrationToken,
  setApplicationIconBadgeNumber,
  getNativeEmitter,
  getInitialNotification,
  removeAllPendingNotificationRequests,
  shareListenersRegistered,
} from 'react-native-kb'
import {storeRegistry} from '../store-registry'
import {DeviceEventEmitter} from 'react-native'

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

type PushN = Data & {
  message?: string
}

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

    const data = _n as PushN
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
        {
          const unk = data as any
          if (typeof unk.message === 'string' && unk.message.startsWith('Your contact') && userInteraction) {
            return {
              type: 'settings.contacts',
            }
          }
        }

        return undefined
    }
  } catch (e) {
    logger.error('Error handling push', e)
    return undefined
  }
}

const getInitialPush = async () => {
  const n = await getInitialNotification()
  return n ? normalizePush(n) : undefined
}
const getStartupDetailsFromInitialPush = async () => {
  const notification = await Promise.race([getInitialPush(), timeoutPromise(10)])
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
    const RNEmitter = getNativeEmitter()

    // Set up listener immediately, before waiting for token
    // This ensures notifications aren't lost if they arrive before token is ready
    const onNotification = (n: object) => {
      logger.debug('[onNotification]: ', n)
      const notification = normalizePush(n)
      if (!notification) {
        logger.warn('[onNotification]: normalized notification is null/undefined')
        return
      }
      storeRegistry.getState('push').dispatch.handlePush(notification)
    }

    try {
      // Unified push notification handling for both iOS and Android
      // Silent notifications (chat.newmessageSilent_2) are handled entirely natively
      // Other notification types are handled natively first, then emitted to JS via onPushNotification
      RNEmitter.addListener('onPushNotification', onNotification)

      if (isIOS) {
        RNEmitter.addListener('onPushToken', (payload?: {token?: string}) => {
          const token = payload?.token
          if (token) {
            logger.debug('[PushToken] received token via onPushToken event: ', token)
            storeRegistry.getState('push').dispatch.setPushToken(token)
          }
        })
      }

      if (isAndroid) {
        DeviceEventEmitter.addListener('onShareData', (evt: {text?: string; localPaths?: Array<string>}) => {
          const {setAndroidShare} = storeRegistry.getState('config').dispatch

          const text = evt.text
          const urls = evt.localPaths

          if (urls) {
            setAndroidShare({type: T.RPCGen.IncomingShareType.file, urls})
          } else if (text) {
            setAndroidShare({text, type: T.RPCGen.IncomingShareType.text})
          } else {
            return
          }
          try {
            storeRegistry.getState('deeplinks').dispatch.handleAppLink('keybase://incoming-share')
          } catch {}
        })
        shareListenersRegistered()
      }
    } catch (e) {
      logger.error('[Push] failed to set up listeners: ', e)
    }

    // Get token after listener is set up (may fail if not ready yet, but listener is already active)
    try {
      const pushToken = await getRegistrationToken()
      logger.debug('[PushToken] received new token: ', pushToken)
      storeRegistry.getState('push').dispatch.setPushToken(pushToken)
    } catch (e) {
      logger.warn('[PushToken] failed to get token (will retry later): ', e)
      // Token will be retrieved later when permissions are checked
    }
  }
  ignorePromise(listenNative())
}

export {getStartupDetailsFromInitialPush}
