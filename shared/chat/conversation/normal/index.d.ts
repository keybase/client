import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
export type Props = {
  audioRecording: boolean
  conversationIDKey: Types.ConversationIDKey
  focusInputCounter: number
  jumpToRecent: () => void
  scrollListDownCounter: number
  scrollListToBottomCounter: number
  scrollListUpCounter: number
  showLoader: boolean
  onPaste: (data: Buffer) => void
  onAttach: (paths: Array<string>) => void
  onFocusInput: () => void
  onRequestScrollDown: () => void
  onRequestScrollToBottom: () => void
  onRequestScrollUp: () => void
  onShowTracker: (username: string) => void
  onToggleInfoPanel: () => void
  onToggleThreadSearch: () => void
  showThreadSearch: boolean
  threadLoadedOffline: boolean
}
export default class Conversation extends React.Component<Props> {}
