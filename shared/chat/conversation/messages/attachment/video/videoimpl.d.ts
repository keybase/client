import type * as React from 'react'
export type Props = {
  openFullscreen: () => void
  toggleMessageMenu: () => void
  allowPlay: boolean
}
declare const VideoImpl: (p: Props) => React.ReactNode
export default VideoImpl
