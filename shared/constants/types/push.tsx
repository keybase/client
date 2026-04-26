import type * as ChatTypes from './chat'
import type * as RPCChatTypes from '@/constants/rpc/rpc-chat-gen'

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
      forUid?: string | undefined
      membersType?: RPCChatTypes.ConversationMembersType | undefined
      type: 'chat.newmessage'
      unboxPayload: string
      userInteraction: boolean
    }
  | {
      forUid?: string | undefined
      type: 'follow'
      userInteraction: boolean
      username: string
    }
  | {
      conversationIDKey: ChatTypes.ConversationIDKey
      forUid?: string | undefined
      type: 'chat.extension'
    }
  | {
      type: 'settings.contacts'
    }
