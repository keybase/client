import * as React from 'react'
import * as Types from '../../../constants/types/chat2'

export type ItemType = Types.Ordinal

export type Props = {
  conversationIDKey: Types.ConversationIDKey
  onFocusInput: () => void
  requestScrollToBottomRef: React.MutableRefObject<undefined | (() => void)>
  requestScrollUpRef: React.MutableRefObject<undefined | (() => void)>
  requestScrollDownRef: React.MutableRefObject<undefined | (() => void)>
}
export default class ConversationList extends React.Component<Props> {}
