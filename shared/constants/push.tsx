import * as RPCChatTypes from './types/rpc-chat-gen'
import * as ChatTypes from './types/chat2'
import type * as Types from './types/push'
import type * as RPCTypes from './types/rpc-gen'
import {isIOS} from './platform'
import {isDevApplePushToken} from '../local-debug'
import {pluralize} from '../util/string'
import logger from '../logger'

export const tokenType = isIOS ? (isDevApplePushToken ? 'appledev' : 'apple') : 'androidplay'
export const androidSenderID = '9603251415'
export const permissionsRequestingWaitingKey = 'push:permissionsRequesting'

const anyToConversationMembersType = (
  a: string | number
): RPCChatTypes.ConversationMembersType | undefined => {
  const membersTypeNumber: number = typeof a === 'string' ? parseInt(a, 10) : a || -1
  switch (membersTypeNumber) {
    case RPCChatTypes.ConversationMembersType.kbfs:
      return RPCChatTypes.ConversationMembersType.kbfs
    case RPCChatTypes.ConversationMembersType.team:
      return RPCChatTypes.ConversationMembersType.team
    case RPCChatTypes.ConversationMembersType.impteamnative:
      return RPCChatTypes.ConversationMembersType.impteamnative
    case RPCChatTypes.ConversationMembersType.impteamupgrade:
      return RPCChatTypes.ConversationMembersType.impteamupgrade
    default:
      return undefined
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

export const normalizePush = (_n: Object | null): Types.PushNotification | undefined => {
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
              conversationIDKey: ChatTypes.stringToConversationIDKey(data.convID),
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
              conversationIDKey: ChatTypes.stringToConversationIDKey(data.c),
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
              conversationIDKey: ChatTypes.stringToConversationIDKey(data.convID),
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

// When the notif is tapped we are only passed the message, use this as a marker
// so we can handle it correctly.
const contactNotifMarker = 'Your contact'
export const makeContactsResolvedMessage = (cts: Array<RPCTypes.ProcessedContact>) => {
  if (cts.length === 0) {
    return ''
  }
  switch (cts.length) {
    case 1:
      return `${contactNotifMarker} ${cts[0].contactName} joined Keybase!`
    case 2:
      return `${contactNotifMarker}s ${cts[0].contactName} and ${cts[1].contactName} joined Keybase!`
    default: {
      const lenMinusTwo = cts.length - 2
      return `${contactNotifMarker}s ${cts[0].contactName}, ${
        cts[1].contactName
      }, and ${lenMinusTwo} ${pluralize('other', lenMinusTwo)} joined Keybase!`
    }
  }
}
