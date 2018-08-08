// @flow
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

export const makeInitialState: I.RecordFactory<Types._State> = I.Record({
  hasPermissions: true,
  showPushPrompt: false,
  token: '',
  tokenType: null,
})

export const normalizePush = (n: any): ?Types.PushNotification => {
  try {
    if (!n) {
      return null
    }
    if (isIOS) {
      const data = n.data
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
        const membersType = ChatConstants.anyToConversationMembersType(data.t)
        if (membersType) {
          return {
            conversationIDKey: ChatTypes.stringToConversationIDKey(data.convID),
            membersType,
            type: 'chat.newmessage',
            unboxPayload: n.m || '',
            userInteraction: !!n.userInteraction,
          }
        }
      } else if (data.type === 'follow' && data.username) {
        return {
          type: 'follow',
          userInteraction: !!n.userInteraction,
          username: data.username,
        }
      }
    } else {
    }
    return null
  } catch (e) {
    logger.error('Error handling push', e)
    return null
  }
}
