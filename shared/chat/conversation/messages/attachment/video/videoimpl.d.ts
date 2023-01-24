import * as React from 'react'
export type Props = {
  openFullscreen: () => void
  toggleMessageMenu: () => void
}
declare class VideoImpl extends React.Component<Props> {}
export default VideoImpl
