import type * as React from 'react'
import type * as T from '@/constants/types'
export type Props = {
  openFullscreen: () => void
  showPopup: () => void
  allowPlay: boolean
  message: T.Chat.MessageAttachment
}
declare const VideoImpl: (p: Props) => React.ReactNode
export default VideoImpl
