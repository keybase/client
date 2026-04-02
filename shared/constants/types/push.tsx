import type * as ChatTypes from './chat2'
import type * as RPCChatTypes from './rpc-chat-gen'

export type TokenType = 'apple' | 'appledev' | 'androidplay'

export type PushNotification =
  | {
      badges: number
      type: 'chat.readmessage'
    }
  | {
      conversationIDKey: ChatTypes.ConversationIDKey
      membersType: RPCChatTypes.ConversationMembersType
      type: 'chat.newmessageSilent_2'
      unboxPayload: string
    }
  | {
      conversationIDKey: ChatTypes.ConversationIDKey
      forUid?: string
      membersType?: RPCChatTypes.ConversationMembersType
      type: 'chat.newmessage'
      unboxPayload: string
      userInteraction: boolean
    }
  | {
      forUid?: string
      type: 'follow'
      userInteraction: boolean
      username: string
    }
  | {
      conversationIDKey: ChatTypes.ConversationIDKey
      forUid?: string
      type: 'chat.extension'
    }
  | {
      type: 'settings.contacts'
    }
