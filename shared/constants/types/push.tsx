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
      membersType?: RPCChatTypes.ConversationMembersType
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
      type: 'chat.extension'
      conversationIDKey: ChatTypes.ConversationIDKey
    }
  | {
      type: 'settings.contacts'
    }

export type State = {
  hasPermissions: boolean
  justSignedUp: boolean
  showPushPrompt: boolean
  token: string
}
