import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
export type Props = {
  conversationIDKey: Types.ConversationIDKey
  dragAndDropRejectReason?: string
  focusInputCounter: number
  jumpToRecent: () => void
  scrollListDownCounter: number
  scrollListToBottomCounter: number
  scrollListUpCounter: number
  showLoader: boolean
  onPaste: (data: Buffer) => void
  onAttach: ((paths: Array<string>) => void) | null
  onFocusInput: () => void
  onRequestScrollDown: () => void
  onRequestScrollToBottom: () => void
  onRequestScrollUp: () => void
  onShowTracker: (username: string) => void
  onToggleThreadSearch: () => void
  showThreadSearch: boolean
  threadLoadedOffline: boolean
}
export default class Conversation extends React.Component<Props> {}
