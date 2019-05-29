import * as Types from '../../../constants/types/chat2'
export type Props = {
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
  threadLoadedOffline: boolean
}
