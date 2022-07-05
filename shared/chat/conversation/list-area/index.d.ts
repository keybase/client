import * as React from 'react'
import * as Types from '../../../constants/types/chat2'

export type ItemType = Types.Ordinal | 'specialTop' | 'specialBottom'

export type Props = {
  centeredOrdinal?: Types.Ordinal
  containsLatestMessage: boolean
  conversationIDKey: Types.ConversationIDKey
  copyToClipboard: (arg0: string) => void
  editingOrdinal?: Types.Ordinal
  lastMessageIsOurs: boolean
  loadNewerMessages: (ordinal?: Types.Ordinal | null) => void
  loadOlderMessages: (ordinal?: Types.Ordinal | null) => void
  markInitiallyLoadedThreadAsRead: () => void
  messageOrdinals: Array<Types.Ordinal>
  onFocusInput: () => void
  onJumpToRecent: () => void
  scrollListDownCounter: number
  scrollListToBottomCounter: number
  scrollListUpCounter: number
}
export default class ConversationList extends React.Component<Props> {}
