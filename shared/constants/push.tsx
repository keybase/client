import * as I from 'immutable'
import * as Types from './types/push'
import * as ChatConstants from './chat2'
import * as ChatTypes from './types/chat2'
import {isIOS} from '../constants/platform'
import {isDevApplePushToken} from '../local-debug'
import logger from '../logger'

export const tokenType = isIOS ? (isDevApplePushToken ? 'appledev' : 'apple') : 'androidplay'
export const androidSenderID = '9603251415'
export const permissionsRequestingWaitingKey = 'push:permissionsRequesting'

export const makeInitialState = I.Record<Types._State>({
  hasPermissions: true,
  showPushPrompt: false,
  token: '',
})

export const normalizePush = (n: any): Types.PushNotification | null => {
  try {
    if (!n) {
      return null
    }

    const userInteraction = !!n.userInteraction
    const data = isIOS ? n.data || n._data : n

    if (!data) {
      return null
    }

    if (data.type === 'chat.readmessage') {
      const badges = typeof data.b === 'string' ? parseInt(data.b) : data.b
      return {
        badges,
        type: 'chat.readmessage',
      }
    } else if (data.type === 'chat.newmessage' && data.convID) {
      return {
        conversationIDKey: ChatTypes.stringToConversationIDKey(data.convID),
        membersType: ChatConstants.anyToConversationMembersType(data.t),
        type: 'chat.newmessage',
        unboxPayload: n.m || '',
        userInteraction,
      }
    } else if (data.type === 'chat.newmessageSilent_2' && data.c) {
      const membersType = ChatConstants.anyToConversationMembersType(data.t)
      if (membersType) {
        return {
          conversationIDKey: ChatTypes.stringToConversationIDKey(data.c),
          membersType,
          type: 'chat.newmessageSilent_2',
          unboxPayload: n.m || '',
        }
      }
    } else if (data.type === 'follow' && data.username) {
      return {
        type: 'follow',
        userInteraction,
        username: data.username,
      }
    } else if (data.type === 'chat.extension' && data.convID) {
      return {
        conversationIDKey: ChatTypes.stringToConversationIDKey(data.convID),
        type: 'chat.extension',
      }
    }

    return null
  } catch (e) {
    logger.error('Error handling push', e)
    return null
  }
}
