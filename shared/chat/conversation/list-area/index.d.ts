import * as React from 'react'
import * as Types from '../../../constants/types/chat2'

export type ItemType = Types.Ordinal | 'specialTop' | 'specialBottom'

export type Props = {
  conversationIDKey: Types.ConversationIDKey
  onFocusInput: () => void
  scrollListDownCounter: number
  scrollListToBottomCounter: number
  scrollListUpCounter: number
}
export default class ConversationList extends React.Component<Props> {}
