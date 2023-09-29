import * as React from 'react'
import type * as T from '../../constants/types'

type Props = {
  conversationIDKey: T.Chat.ConversationIDKey
  ordinal: T.Chat.Ordinal
  url?: string
}
export default class ChatPDF extends React.Component<Props> {}
