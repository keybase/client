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
      recipientUsername?: string
      type: 'chat.newmessageSilent_2'
      unboxPayload: string
    }
  | {
      conversationIDKey: ChatTypes.ConversationIDKey
      membersType?: RPCChatTypes.ConversationMembersType
      recipientUsername?: string
      type: 'chat.newmessage'
      unboxPayload: string
      userInteraction: boolean
    }
  | {
      type: 'follow'
      userInteraction: boolean
      username: string
    }
  | {
      conversationIDKey: ChatTypes.ConversationIDKey
      recipientUsername?: string
      type: 'chat.extension'
    }
  | {
      type: 'settings.contacts'
    }
