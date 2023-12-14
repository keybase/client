import type * as React from 'react'
export type Props = {
  openFullscreen: () => void
  showPopup: () => void
  allowPlay: boolean
}
declare const VideoImpl: (p: Props) => React.ReactNode
export default VideoImpl
