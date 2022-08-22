import * as React from 'react'
import * as Types from '../../../constants/types/chat2'

export type ItemType = Types.Ordinal

export type Props = {
  conversationIDKey: Types.ConversationIDKey
  onFocusInput: () => void
  scrollListDownCounter: number
  requestScrollToBottomRef: React.MutableRefObject<undefined | (() => void)>
  scrollListUpCounter: number
}
export default class ConversationList extends React.Component<Props> {}
