import type * as React from 'react'
export type Props = {
  dragAndDropRejectReason?: string
  jumpToRecent: () => void
  onPaste: (data: Uint8Array) => void
  onAttach?: (paths: Array<string>) => void
  onShowTracker: (username: string) => void
  onToggleThreadSearch: () => void
  showThreadSearch: boolean
  threadLoadedOffline: boolean
}
declare const Conversation: (p: Props) => React.ReactNode
export default Conversation
