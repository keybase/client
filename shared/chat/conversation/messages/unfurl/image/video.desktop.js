// @flow
import * as React from 'react'
import type {Props} from './video.types'

export class Video extends React.Component<Props> {
  vidRef: any
  constructor(props: Props) {
    super(props)
    this.vidRef = React.createRef()
  }
  _playVideo = () => {
    if (!(this.vidRef && this.vidRef.current)) {
      return
    }
    this.vidRef.current.play()
  }
  render() {
    return (
      <video
        ref={this.vidRef}
        onLoadedData={this._playVideo}
        src={this.props.url}
        style={this.props.style}
        loop={true}
      />
    )
  }
}
