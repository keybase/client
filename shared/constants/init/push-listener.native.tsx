import * as T from '@/constants/types'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import logger from '@/logger'
import {emitDeepLink} from '@/router-v2/linking'
import {
  getRegistrationToken,
  setApplicationIconBadgeNumber,
  getNativeEmitter,
  getInitialNotification,
  removeAllPendingNotificationRequests,
  shareListenersRegistered,
} from 'react-native-kb'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useLogoutState} from '@/stores/logout'
import {usePushState} from '@/stores/push'
import {useShellState} from '@/stores/shell'

type DataCommon = {
  userInteraction: boolean
}
type DataReadMessage = DataCommon & {
  type: 'chat.readmessage'
  b: string | number
  i?: string
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
  targetUID?: string
  username?: string
}
type DataChatExtension = DataCommon & {
  type: 'chat.extension'
  convID?: string
}
type DataDeviceRevoked = DataCommon & {
  type: 'device.revoked'
  device_id?: string
}
type DataDeviceNew = DataCommon & {
  type: 'device.new'
  device_id?: string
}
type DataAutoreset = DataCommon & {
  type: 'autoreset'
}
type Data =
  | DataReadMessage
  | DataNewMessage
  | DataNewMessageSilent2
  | DataFollow
  | DataChatExtension
  | DataDeviceRevoked
  | DataDeviceNew
  | DataAutoreset

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
    const dataUid = data as {uid?: string; targetUID?: string}
    const forUid = dataUid.uid

    switch (data.type) {
      case 'chat.readmessage': {
        const badges = typeof data.b === 'string' ? parseInt(data.b) : data.b
        return {
          badges,
          forUid: data.i,
          type: 'chat.readmessage',
        } as const
      }
      case 'chat.newmessage':
        return data.convID
          ? {
              conversationIDKey: T.Chat.stringToConversationIDKey(data.convID),
              forUid,
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
              forUid: forUid ?? dataUid.targetUID,
              type: 'follow',
              userInteraction,
              username: data.username,
            }
          : undefined
      case 'device.revoked':
        return forUid
          ? {
              forUid,
              type: 'device.revoked',
              userInteraction,
            }
          : undefined
      case 'device.new':
        return forUid
          ? {
              forUid,
              type: 'device.new',
              userInteraction,
            }
          : undefined
      case 'autoreset':
        return forUid
          ? {
              forUid,
              type: 'autoreset',
              userInteraction,
            }
          : undefined
      case 'chat.extension':
        return data.convID
          ? {
              conversationIDKey: T.Chat.stringToConversationIDKey(data.convID),
              forUid,
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
      // For chat.newmessage with forUid, route through the pending-notification
      // subscribers so account-switching logic runs if the notification is for a
      // different account. Returning startupConversation here would navigate to a
      // conversation in the wrong account before the switch can happen.
      if (notification.type === 'chat.newmessage' && notification.forUid) {
        usePushState.getState().dispatch.setPendingPushNotification(notification)
        return
      }
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
  useShellState.subscribe((s, old) => {
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
    if (count === 0 && lastCount !== 0) {
      removeAllPendingNotificationRequests()
    }
    lastCount = count
  })

  // Retry token upload when user state becomes available.
  // The FCM token often arrives before username/deviceID are loaded,
  // so the initial upload silently bails. This retries once user state is ready.
  useCurrentUserState.subscribe((s, old) => {
    if (s.username === old.username && s.deviceID === old.deviceID) return
    const token = usePushState.getState().token
    if (token && s.username && s.deviceID) {
      usePushState.getState().dispatch.setPushToken(token)
    }
  })

  usePushState.getState().dispatch.initialPermissionsCheck()

  // When current-user.uid changes, run pending push if it was for this account.
  useCurrentUserState.subscribe((s, old) => {
    if (s.uid === old.uid) return
    const pushState = usePushState.getState()
    const pending = pushState.pendingPushNotification
    if (!pending || !('forUid' in pending)) return
    const forUid = (pending as {forUid?: string}).forUid
    if (!forUid || forUid !== s.uid) return
    pushState.dispatch.clearPendingPushNotification()
    useConfigState.getState().dispatch.setUserSwitching(false)
    pushState.dispatch.handlePush(pending)
  })

  useConfigState.subscribe((s, old) => {
    if (s.configuredAccounts === old.configuredAccounts || s.userSwitching) return
    const pushState = usePushState.getState()
    const pending = pushState.pendingPushNotification
    if (!pending || !('forUid' in pending)) return
    const forUid = (pending as {forUid?: string}).forUid
    if (!forUid || forUid === useCurrentUserState.getState().uid) return
    const account = s.configuredAccounts.find(acc => acc.uid === forUid)
    if (!account?.hasStoredSecret) return
    pushState.dispatch.handlePush(pending)
  })

  useConfigState.subscribe((s, old) => {
    if (s.loggedIn === old.loggedIn) return
    if (!s.loggedIn && !s.userSwitching) {
      usePushState.getState().dispatch.clearPendingPushNotification()
    }
  })

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
      usePushState.getState().dispatch.handlePush(notification)
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
            usePushState.getState().dispatch.setPushToken(token)
          }
        })
      }

      if (isAndroid) {
        RNEmitter.addListener('onShareData', (evt: {text?: string; localPaths?: Array<string>}) => {
          const {setAndroidShare} = useConfigState.getState().dispatch

          const text = evt.text
          const urls = evt.localPaths

          if (urls) {
            setAndroidShare({type: T.RPCGen.IncomingShareType.file, urls})
          } else if (text) {
            setAndroidShare({text, type: T.RPCGen.IncomingShareType.text})
          } else {
            return
          }
          emitDeepLink('keybase://incoming-share')
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
      usePushState.getState().dispatch.setPushToken(pushToken)
    } catch (e) {
      logger.warn('[PushToken] failed to get token (will retry later): ', e)
      // Token will be retrieved later when permissions are checked
    }
  }
  ignorePromise(listenNative())
}

export {getStartupDetailsFromInitialPush}
