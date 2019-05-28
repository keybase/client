import * as I from 'immutable'
import * as Types from '../../../../constants/types/chat2'

export type Props = {
  centeredOrdinal: Types.Ordinal | null
  copyToClipboard: (arg0: string) => void
  containsLatestMessage: boolean
  conversationIDKey: Types.ConversationIDKey
  messageOrdinals: I.List<Types.Ordinal>
  onFocusInput: () => void
  onJumpToRecent: () => void
  loadNewerMessages: (ordinal?: Types.Ordinal | null) => void
  loadOlderMessages: (ordinal?: Types.Ordinal | null) => void
  editingOrdinal: Types.Ordinal | null
  lastMessageIsOurs: boolean
  lastLoadMoreOrdinal: Types.Ordinal | null
  scrollListDownCounter: number
  scrollListToBottomCounter: number
  scrollListUpCounter: number
  showThreadSearch: boolean
}
