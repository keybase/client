import * as I from 'immutable'
import * as ChatTypes from './chat2'
import * as RPCChatTypes from './rpc-chat-gen'
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
      membersType: RPCChatTypes.ConversationMembersType | null
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

export type _State = {
  hasPermissions: boolean
  showPushPrompt: boolean
  token: string
}

export type State = I.RecordOf<_State>
