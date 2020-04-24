import * as Types from '../constants/types/chat2'

export type ParamList = {
  chatConversation: {
    conversationIDKey: Types.ConversationIDKey
  }
  chatRoot: {
    conversationIDKey: Types.ConversationIDKey
  }
}

export type ModalParamList = {
  chatAttachmentFullscreen: {
    conversationIDKey: Types.ConversationIDKey
    ordinal: Types.Ordinal
  }
}
